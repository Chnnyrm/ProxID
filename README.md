# ProxID

Hyper-local services marketplace where providers are verified humans and the agent is a
registered on-chain identity. Built for the Concordium Trusted Agents Hackathon.

A person posts a job, nearby providers are found by geography, a provider accepts, they
talk in a job room, and an AI agent helps run it. Two things make it Concordium-specific:
a provider carries a zero-knowledge proof that they are a real person, and the agent holds
its own scoped identity with a card anyone can verify.

Phase 2 is the whole product, wired against boundaries that are not connected yet. The
identity, agent registry and payment rails all answer `not configured` and attempt no
network call, because no credentials or addresses have been issued. Nothing in this
repository claims to have transacted with Concordium, because it has not.

## The four beats the demo shows

The workshops said what judges look for. Each one is visible in the Judge Demo, not merely
buildable:

1. **A company-backed agent and a consumer-backed agent.** `Northgate Facilities Ltd` is a
   company with its own agent account. `Ada (judge demo)` is a person with an agent too.
   Their two agents share a job room, and the thread shows the handover.
2. **Identity and age by zero-knowledge proof.** Providers are marked human-verified with a
   proof reference; the demo person has an approved age-over-18 verification request.
3. **Human consent through the ID app.** A verification request row carries its nonce, its
   domain binding and its expiry, so the consent moment is a thing on the screen rather than
   a claim in the copy.
4. **Receipts and payments anchored on chain.** Receipts exist with status `demo`, and every
   audit row carries a real nonce and a real payload hash, which is exactly what would be
   anchored.

Everything seeded is marked `is_demo` **in the row**, not only in the copy. Chain-shaped
placeholders are `demo-` prefixed strings, which cannot parse as a base58 account address or
a 64-character hash, so a demo record cannot be mistaken for a real one by a reader or a
script. A test asserts that.

## What is built, and what is waiting

**Built and running**

- PostGIS proximity search over providers, listings and jobs: `ST_DWithin` and spheroid
  distance, ported with their semantics intact.
- The agent: typed tools, a bounded tool-calling loop, and an append-only activity log.
- Job rooms, a validated state machine, and object-level authorisation in the service layer.
- An append-only audit trail with per-record nonce and payload hash, filtered so no personal
  data can reach the hash input.
- The Veriox identity adapter, and a stub behind the same interface.
- The x402 payment interface, the nine verification rules, and a local pre-check for eight
  of them.
- The judge demo seed, idempotent, plus a one-click session.
- The WebMCP tool registry: `search_providers`, `get_provider_reputation`, `post_job`,
  `accept_job`, `send_message`, and `initiate_x402_payment` / `settle_x402_payment` in place
  of the escrow tools.

**Built, waiting for credentials**

| Boundary | What is missing |
| --- | --- |
| Veriox identity | base URL, API key, and the two resource paths. The public demo publishes no schema. |
| Concordium anchoring | a node endpoint. The registry contract `12802,0` is known. |
| x402 settlement | a facilitator URL, a merchant account, and the Node bridge that wraps `@x402/concordium`. |
| Agent IDP | a DevNet delegated-identity endpoint and an agent account. |
| Google sign-in | a client id. The button disables itself and says so. |

## Corrections this build made to the written brief

Three facts were checked against primary sources rather than taken on trust.

**The npm package name is wrong in the brief.** `@concordium/x402` does not exist: npm
answers 404. The real package is **`@x402/concordium` 2.32.0**, published by
x402-foundation, depending on `@x402/core` and `@concordium/web-sdk`, exporting Client,
Server and Facilitator under `/exact/client`, `/exact/server` and `/exact/facilitator`. The
workshop described a "Concordium plugin sitting alongside the standard x402 packages", which
is exactly what this is. The interface in `backend/app/services/concordium/x402_service.py`
is written against that package's real API: `PaymentRequirements` with `scheme: "exact"`, a
CAIP-2 `network`, `payTo`, `price: {amount, asset}`, `mimeType`, and `extra.feePayer`.

**Finality is about 10 seconds, not 2 to 4.** The package README states ~10s deterministic
finality and defaults its finalisation timeout to 60 seconds. The package is the primary
source, so the copy is optimistic and the timeout is defensive.

**`demo.veriox.io` publishes no API.** It was inspected on 21 November 2026 and serves an
age-gated storefront with a "Reset verification" control: no fetch calls, no documented
endpoints. The Veriox adapter therefore takes its two resource paths from configuration with
no defaults, and refuses to run without them, rather than calling a guessed URL.

On naming: the docs say **CIS-8004**, the workshops say CIS-804. Code comments use CIS-8004,
the documented name. User-facing copy avoids the standard's name entirely until it is
confirmed. The verified testnet contract `12802,0` is used as the registry address.

## Stack

Backend: Python 3.12, FastAPI, SQLAlchemy 2 async, asyncpg, Postgres with PostGIS, pydantic
v2, Alembic.
Frontend: React 18, Vite, TypeScript strict, Tailwind, react-query, zustand, react-leaflet
with OpenStreetMap tiles.

```
backend/app/
  api/v1/endpoints/   routers: parse, call one service, shape the response
  core/               config, database, errors, logging, resilience, security, container
  crud/               persistence, one entity per file, no cross-entity joins
  models/             SQLAlchemy entities
  schemas/            wire contracts
  services/           business logic and outbound boundaries
    concordium/       identity, registry, x402, audit
  middleware/         correlation, security headers, rate limit, error mapping
  scripts/            seed_demo
frontend/src/
  types/              entities (import nothing)
  lib/                api client, contracts, formatting, webmcp tools
  services/           transport, one file per domain
  hooks/              query and mutation composition
  store/              auth, theme, location
  components/         presentation, including the map
  pages/              route entry points
```

Five layers, dependencies pointing inward, enforced by a machine check
(`backend/arch_check.py`) that also fails on emoji or non-ASCII, a banned filename, raw SQL
outside `crud/`, or an environment read outside `core/config.py`.

## Run it locally

Prerequisites: Docker (or a Postgres 16 with PostGIS), Python 3.12, Node 20 or newer.

**1. Database**

```bash
cd /path/to/ProxID
docker compose up -d db
```

**2. Backend**

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
# Set SECRET_KEY to something at least 32 characters:
python -c "import secrets; print(secrets.token_urlsafe(48))"
alembic upgrade head
python -m app.scripts.seed_demo
uvicorn app.main:app --reload --port 8000
```

The API is at `http://localhost:8000/api/v1`, with interactive docs at
`http://localhost:8000/docs`. Health: `/api/v1/health` (liveness) and `/api/v1/health/ready`
(readiness, which touches the database).

**3. Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173` and press **Launch Judge Demo**.

**4. Verify**

```bash
cd backend  && python arch_check.py && python -m pytest -q
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build
```

`npm run build` runs the type check first, so a type error fails the build.

## Design system

Three colours carry everything, declared once as CSS custom properties and consumed through
Tailwind, so no component holds a colour literal.

Soft Sand `#F0E5DB`, Mocha Green `#474329`, Watermelon Pink `#FC75B4`.

**Light**: Sand is the canvas, Mocha is text, borders and structural headers, Pink is the one
loud accent for primary actions, active pins, verified badges and focus rings.
**Dark**: Mocha is the base surface, cards sit at `#2A281A`, deeper wells at `#1C1B12`, Sand
becomes the text, Pink stays the accent.

Every text and background pair shipped, measured with WCAG 2.1 relative luminance:

| Pair | Ratio | Use |
| --- | --- | --- |
| `#474329` on `#F0E5DB` | **8.05:1** | body text, light |
| `#474329` on `#FAF4ED` | **9.14:1** | body text on a card, light |
| `#5C5738` on `#F0E5DB` | **5.89:1** | muted text, light |
| `#5C5738` on `#FAF4ED` | **6.69:1** | muted text on a card, light |
| `#5C5738` on `#D9C9BA` | **4.53:1** | muted text on a sunken well, light |
| `#1C1B12` on `#FC75B4` | **6.87:1** | every label on a pink fill, both themes |
| `#7A7350` on `#F0E5DB` | **3.85:1** | input and control borders, light |
| `#7A7350` on `#FAF4ED` | **4.37:1** | control borders on a card, light |
| `#F0E5DB` on `#474329` | **8.05:1** | body text, dark |
| `#F0E5DB` on `#2A281A` | **11.95:1** | body text on a card, dark |
| `#F0E5DB` on `#1C1B12` | **13.94:1** | body text in a well, dark |
| `#C4B7A8` on `#474329` | **5.08:1** | muted text, dark |
| `#C4B7A8` on `#2A281A` | **7.54:1** | muted text on a card, dark |
| `#9A8E79` on `#474329` | **3.10:1** | control borders, dark |
| `#FC75B4` on `#2A281A` | **5.89:1** | accent text on a card, dark |
| `#FC75B4` on `#474329` | **3.97:1** | large text and UI edges only, dark |

Two pairs are deliberately not in that table, and the design obeys the consequence:

- **Pink on Sand is 2.03:1.** Pink is never body text in light mode. It is a fill, a border
  and an accent; text on it is the dark ink at 6.87:1.
- **Pink alone is under 3:1 as a focus ring on Sand.** The focus indicator is therefore a
  2px pink ring with a 4px mocha keyline outside it, so the indicator always contains a
  component well above 3:1 against the page. It is the one place the palette needs a second
  colour to meet the bar, and it is stated rather than assumed.

Typography is Geist only, weights 400 to 600, Tailwind's type scale, no italics. Motion uses
one curve, `cubic-bezier(0.22, 1, 0.36, 1)`, animates transform and opacity only, and is
reduced to nothing under `prefers-reduced-motion`. Loading states are skeletons, never
spinners. Nothing overflows horizontally at 390px.

The map is OpenStreetMap raster tiles with no paid key. In dark mode the tile layer is
filtered (`invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9) saturate(0.65)`) so it
sits inside the mocha page instead of glowing white, and Leaflet's own chrome is repainted
from the theme tokens.

## Payments and spending safety

The rail is x402 on Concordium, full stop. There is no payment-rail toggle and no wallet
adapter.

The flow the package implements, and the nine rules the facilitator checks: version is 1,
sender identity, sponsor identity, transfer destination, exact amount, asset type, expiry
window, sender signature, single transfer. Eight are checked on this side before submission,
because a refused payment should never leave the process. The ninth needs the facilitator's
verifier and is left to it: claiming to have checked a signature without a verifier would be
exactly the false assurance this project exists to avoid.

Protocol-level account locks are DevNet only, so the agent is confined three ways: it pays
from its **own** low-balance account, never the human's; per-payment and daily caps are
enforced before a payment requirement is created; and the recipient allowlist is deny by
default, so an empty allowlist means the agent may pay nobody. `spending_policy.py` is
shaped so replacing the caps with a call into the account's on-chain lock is a change in one
file.

## Credentials never appear in this repository

`SECRET_KEY`, `DATABASE_URL` and every integration key come from `backend/.env`, which is
ignored. No contract address, node endpoint or facilitator URL is invented anywhere: the one
address present, `12802,0`, was given to us as verified.

## Origin of the code

The organisers confirmed that existing codebases are allowed. ProxID ports logic from a
previous project rather than rewriting it. Ported: the PostGIS proximity queries
(`ST_DWithin` and spheroid distance, semantics unchanged), the Groq client with key rotation,
the Cloudinary and Brevo clients, the Google OAuth flow, the react-leaflet map, the WebMCP
tool registry, and the agent's tool-calling loop.

Left behind, deliberately: every Solana, Anchor, cNFT, PayPal, Walrus Memory and Aurora
module; the wallet adapters; the payment-rail toggle; the escrow and milestone payment paths;
and the memory tools. Where a file mixed concerns, the clean part was carried across and the
rest was not. The schema drops the Solana and cNFT columns outright and replaces them with
the Concordium account, verification and agent columns.

## Licence

Unsigned; the repository is public for the hackathon submission.
