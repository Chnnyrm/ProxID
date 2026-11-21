"""Architecture and hygiene check. Fails the build on a broken layer or a banned habit.

Run with::

    cd backend && python arch_check.py

Why this exists instead of import-linter: it enforces every contract import-linter
would (dependency direction, one service never importing another entity's service, no
raw SQL outside the crud layer), plus the rules import-linter cannot express (no
emoji, no banned filenames, no ``os.getenv`` outside configuration, no database driver
in a service). One command, no extra dependency, and it runs in CI and locally the
same way.

Exit code 0 means clean. Exit code 1 means at least one violation, each printed with
the file and line, because a check that only says "failed" wastes the reader's time.
"""

from __future__ import annotations

import ast
import re
import sys
from dataclasses import dataclass
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent / "app"
FRONTEND_ROOT = Path(__file__).resolve().parent.parent / "frontend" / "src"

#: Layer of each top-level package under app/. Used to resolve "may A import B".
LAYER_OF_PACKAGE = {
    "api": "routers",
    "schemas": "schemas",
    "services": "services",
    "crud": "crud",
    "models": "entities",
    "core": "core",
    "middleware": "middleware",
    "scripts": "scripts",
}

#: Which layers each layer may import. Anything not listed is a violation.
ALLOWED_IMPORTS = {
    "routers": {"routers", "schemas", "services", "core", "middleware", "scripts"},
    "services": {"services", "schemas", "entities", "crud", "core", "scripts"},
    "crud": {"crud", "schemas", "entities", "core", "scripts"},
    "entities": {"entities", "core", "scripts"},
    "schemas": {"schemas", "core", "scripts"},
    "core": {"core", "entities", "schemas", "scripts"},
    "middleware": {"middleware", "core", "schemas", "scripts"},
    "scripts": {
        "scripts",
        "core",
        "crud",
        "entities",
        "schemas",
        "services",
        "routers",
        "middleware",
    },
}

#: Module paths a service may never import: a database driver, or an engine factory.
FORBIDDEN_IN_SERVICES = (
    "asyncpg",
    "psycopg2",
    "psycopg",
    "sqlalchemy.ext.asyncio.create_async_engine",
    "sqlalchemy.create_engine",
)

#: Files that may contain a raw SQL string. The list is short on purpose and each entry
#: states why: a raw string anywhere else means a query escaped the crud layer.
RAW_SQL_EXCEPTIONS = {
    "api/v1/endpoints/health.py": "a liveness probe is one literal SELECT 1, not a query",
}

#: Filenames the house standard rejects outright.
BANNED_FILENAMES = {"utils.py", "helpers.py", "common.py", "helper.py", "misc.py", "temp.py"}

#: Banned standalone identifiers, checked as function, class and variable names.
BANNED_IDENTIFIERS = {"data", "info", "manager", "helper", "utils", "common", "misc", "thing", "obj"}

#: SQL shapes that must not appear in a string outside crud/. Deliberately shaped
#: rather than single keywords: the word "update" appears in ordinary prose.
SQL_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"\bSELECT\b[^;\n]{0,200}\bFROM\b",
        r"\bINSERT\s+INTO\b",
        r"\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b",
        r"\bDELETE\s+FROM\b",
        r"\bALTER\s+TABLE\b",
        r"\bCREATE\s+TABLE\b",
    )
)

#: Modules whose whole purpose is the import the rule forbids. Each states why.
LAYER_EXCEPTIONS = {
    # The composition root builds every service. Wiring is the one thing core/container
    # is for, and it is the only module allowed to know the whole graph.
    "core/container.py": "the composition root wires services by design",
    # The transport's session bootstrap resolves a token to an actor before a router
    # runs. It hands the router an alias, so no endpoint imports an entity.
    "api/deps.py": "the request-scoped dependency boundary resolves the actor once",
}


@dataclass(frozen=True)
class Violation:
    """One broken rule, at one place."""

    path: str
    line: int
    rule: str
    detail: str

    def render(self) -> str:
        return f"[FAIL] {self.path}:{self.line}  {self.rule}  {self.detail}"


def _layer_of(module_path: str) -> str | None:
    """The layer a dotted module path belongs to, or None when it is not ours."""
    parts = module_path.split(".")
    if not parts or parts[0] != "app":
        return None
    if len(parts) < 2:
        return None
    return LAYER_OF_PACKAGE.get(parts[1])


def _resolve_relative(module_path: str, node: ast.ImportFrom) -> str:
    """Turn a relative import into the absolute dotted path it refers to."""
    if not node.level:
        return node.module or ""
    package = module_path.split(".")
    # A module's package is its parent; level 1 means "in this package".
    base = package[: max(0, len(package) - node.level)]
    if node.module:
        base = base + node.module.split(".")
    return ".".join(part for part in base if part)


def _imported_modules(node: ast.AST) -> list[tuple[str, int]]:
    """Every module an import node names, with its line."""
    found: list[tuple[str, int]] = []
    if isinstance(node, ast.Import):
        for alias in node.names:
            found.append((alias.name, node.lineno))
    elif isinstance(node, ast.ImportFrom):
        found.append((node.module or "", node.lineno))
    return found


def _check_import_direction(path: Path, module_path: str, tree: ast.AST) -> list[Violation]:
    """Dependencies point inward. A layer may only import from its own allowed set."""
    violations: list[Violation] = []
    relative = path.relative_to(APP_ROOT).as_posix()
    if relative in LAYER_EXCEPTIONS:
        return violations
    layer = _layer_of(module_path)
    if layer is None:
        return violations
    allowed = ALLOWED_IMPORTS[layer]

    for node in ast.walk(tree):
        if not isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        for raw_module, line in _imported_modules(node):
            if isinstance(node, ast.ImportFrom):
                target = _resolve_relative(module_path, node)
            else:
                target = raw_module
            target_layer = _layer_of(target)
            if target_layer is None:
                continue
            if target_layer == layer:
                continue
            if target_layer not in allowed:
                violations.append(
                    Violation(
                        str(path.relative_to(APP_ROOT.parent)),
                        line,
                        "import-direction",
                        f"{layer} may not import {target_layer} (module {target})",
                    )
                )

            # One service never imports another entity's service: the shared rule
            # belongs in a third service, or in core.
            if layer == "services" and target_layer == "services":
                source_parts = module_path.split(".")
                target_parts = target.split(".")
                if len(source_parts) > 2 and len(target_parts) > 2:
                    if source_parts[2] != target_parts[2]:
                        violations.append(
                            Violation(
                                str(path.relative_to(APP_ROOT.parent)),
                                line,
                                "service-coupling",
                                f"service {source_parts[2]} imports service {target_parts[2]}",
                            )
                        )
    return violations


def _check_service_purity(path: Path, module_path: str, tree: ast.AST) -> list[Violation]:
    """A service never imports a database driver or builds an engine."""
    violations: list[Violation] = []
    if _layer_of(module_path) != "services":
        return violations
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        for raw_module, line in _imported_modules(node):
            for forbidden in FORBIDDEN_IN_SERVICES:
                if raw_module == forbidden or raw_module.startswith(forbidden + "."):
                    violations.append(
                        Violation(
                            str(path.relative_to(APP_ROOT.parent)),
                            line,
                            "service-database-driver",
                            f"services may not import {forbidden}",
                        )
                    )
    return violations


def _check_raw_sql(path: Path, tree: ast.AST) -> list[Violation]:
    """A SQL string outside crud/ means a query escaped the persistence layer."""
    violations: list[Violation] = []
    relative = path.relative_to(APP_ROOT).as_posix()
    if "/crud/" in f"/{relative}" or relative.startswith("crud/"):
        return violations
    if relative in RAW_SQL_EXCEPTIONS:
        return violations
    for node in ast.walk(tree):
        if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
            continue
        for pattern in SQL_PATTERNS:
            match = pattern.search(node.value)
            if match:
                violations.append(
                    Violation(
                        f"app/{relative}",
                        getattr(node, "lineno", 0),
                        "raw-sql-outside-crud",
                        f"found {match.group(0)[:40]!r} in a string outside the crud layer",
                    )
                )
                break
    return violations


def _check_environment_access(path: Path, tree: ast.AST) -> list[Violation]:
    """Only core/configuration may read the environment."""
    violations: list[Violation] = []
    relative = path.relative_to(APP_ROOT).as_posix()
    if relative == "core/config.py":
        return violations
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        name = ""
        if isinstance(function, ast.Attribute) and isinstance(function.value, ast.Name):
            name = f"{function.value.id}.{function.attr}"
        if name in ("os.getenv", "os.environ.get"):
            violations.append(
                Violation(
                    f"app/{relative}",
                    node.lineno,
                    "config-flag-placement",
                    "settings are read in core/config.py and injected; do not read the environment here",
                )
            )
    return violations


def _check_names(path: Path, tree: ast.AST) -> list[Violation]:
    """Banned standalone names, at every definition site."""
    violations: list[Violation] = []
    relative = path.relative_to(APP_ROOT).as_posix()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.name.lower() in BANNED_IDENTIFIERS:
                violations.append(
                    Violation(
                        f"app/{relative}",
                        node.lineno,
                        "banned-name",
                        f"'{node.name}' says nothing about what it is",
                    )
                )
    return violations


def _check_ascii(path: Path, text: str) -> list[Violation]:
    """No emoji and no non-ASCII in source. Engineering artefacts are ASCII."""
    violations: list[Violation] = []
    relative = path.relative_to(APP_ROOT).as_posix()
    for number, line in enumerate(text.splitlines(), 1):
        for character in line:
            if ord(character) > 127:
                violations.append(
                    Violation(
                        f"app/{relative}",
                        number,
                        "non-ascii",
                        f"character U+{ord(character):04X} is not ASCII",
                    )
                )
                break
    return violations


def check_backend() -> list[Violation]:
    """Every backend rule, over every Python file under app/."""
    violations: list[Violation] = []
    for path in sorted(APP_ROOT.rglob("*.py")):
        if path.name in BANNED_FILENAMES:
            violations.append(
                Violation(
                    str(path.relative_to(APP_ROOT.parent)),
                    0,
                    "banned-filename",
                    f"'{path.name}' is a bag of things with no owner",
                )
            )
        text = path.read_text(encoding="utf-8")
        violations.extend(_check_ascii(path, text))
        tree = ast.parse(text, filename=str(path))
        module_path = ".".join(path.relative_to(APP_ROOT.parent).with_suffix("").parts)
        violations.extend(_check_import_direction(path, module_path, tree))
        violations.extend(_check_service_purity(path, module_path, tree))
        violations.extend(_check_raw_sql(path, tree))
        violations.extend(_check_environment_access(path, tree))
        violations.extend(_check_names(path, tree))
    return violations


def check_frontend() -> list[Violation]:
    """Frontend rules that a dependency-free Python pass can enforce."""
    violations: list[Violation] = []
    if not FRONTEND_ROOT.exists():
        return violations
    for path in sorted(FRONTEND_ROOT.rglob("*")):
        if path.suffix not in {".ts", ".tsx", ".css"}:
            continue
        relative = path.relative_to(FRONTEND_ROOT).as_posix()
        if relative.startswith("types/"):
            continue
        text = path.read_text(encoding="utf-8")
        for number, line in enumerate(text.splitlines(), 1):
            for character in line:
                if ord(character) > 127:
                    violations.append(
                        Violation(
                            f"frontend/src/{relative}",
                            number,
                            "non-ascii",
                            f"character U+{ord(character):04X} is not ASCII",
                        )
                    )
                    break
            # Presentation and pages reach the backend through hooks, never directly.
            if relative.startswith(("pages/", "components/")) and "from '@/services/" in line:
                violations.append(
                    Violation(
                        f"frontend/src/{relative}",
                        number,
                        "frontend-import-direction",
                        "pages and components use hooks, not the transport layer",
                    )
                )
            if relative.startswith(("pages/", "components/")) and "from '@/lib/api'" in line:
                violations.append(
                    Violation(
                        f"frontend/src/{relative}",
                        number,
                        "frontend-import-direction",
                        "pages and components use hooks, not the API client",
                    )
                )
            if relative.startswith("hooks/") and "fetch(" in line:
                violations.append(
                    Violation(
                        f"frontend/src/{relative}",
                        number,
                        "frontend-import-direction",
                        "hooks call services, not fetch directly",
                    )
                )
    return violations


def main() -> int:
    """Run every check and report. Returns the process exit code."""
    violations = check_backend() + check_frontend()
    if not violations:
        print("[OK] architecture clean: layers, names, ASCII, config placement, raw SQL")
        return 0
    for violation in violations:
        print(violation.render())
    print(f"[FAIL] {len(violations)} violation(s)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
