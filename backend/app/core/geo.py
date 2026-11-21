"""Geographic helpers shared by the PostGIS queries.

Ported from Gigr's ``core/geo.py``. Its whole reason to exist is that GeoAlchemy2
raises ``TypeError: Only WKBElement and WKTElement objects are supported`` when a
geometry column is assigned a raw string, which happened whenever a schema
serialiser or a model property touched the value. Every location assignment goes
through ``to_wkt_point``.
"""

from __future__ import annotations

import re
from typing import Any

from geoalchemy2.elements import WKBElement, WKTElement
from geoalchemy2.shape import to_shape


def to_wkt_point(latitude: float | None, longitude: float | None) -> WKTElement | None:
    """Build ``SRID=4326;POINT(longitude latitude)`` from a coordinate pair.

    Note the axis order: WKT is longitude first, which is the opposite of how the
    API and the UI speak. Getting this backwards puts every pin in the wrong
    hemisphere, so the swap lives here and only here.

    Returns ``None`` when either value is missing or unparseable.
    """
    if latitude is None or longitude is None:
        return None
    try:
        flattened_latitude = float(latitude)
        flattened_longitude = float(longitude)
    except (TypeError, ValueError):
        return None
    return WKTElement(f"POINT({flattened_longitude} {flattened_latitude})", srid=4326)


def to_wkt_element(location_value: Any) -> Any | None:
    """Normalise a string, WKTElement, WKBElement or dict into a GeoAlchemy2 element."""
    if location_value is None:
        return None
    if isinstance(location_value, (WKTElement, WKBElement)):
        return location_value
    if isinstance(location_value, str):
        cleaned = location_value.strip()
        if not cleaned:
            return None
        if cleaned.upper().startswith("SRID="):
            cleaned = cleaned.split(";", 1)[-1]
        return WKTElement(cleaned, srid=4326)
    if isinstance(location_value, dict):
        return to_wkt_point(
            location_value.get("latitude") or location_value.get("lat"),
            location_value.get("longitude")
            or location_value.get("lng")
            or location_value.get("lon"),
        )
    return None


def extract_coordinates(location_value: Any) -> tuple[float | None, float | None]:
    """Return ``(latitude, longitude)`` for any geometry element or WKT string.

    Never raises: a malformed stored geometry yields ``(None, None)`` so one bad
    row cannot break a list endpoint.
    """
    if location_value is None:
        return None, None

    if isinstance(location_value, (WKTElement, WKBElement)):
        try:
            shape = to_shape(location_value)
            return float(shape.y), float(shape.x)
        except Exception:  # noqa: BLE001 - a bad geometry is not a crash
            return None, None

    match = re.search(r"POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)", str(location_value), re.IGNORECASE)
    if match:
        try:
            return float(match.group(2)), float(match.group(1))
        except (TypeError, ValueError):
            return None, None
    return None, None
