"""The geo axis order is the difference between a pin in Lagos and a pin in the ocean.

``to_wkt_point`` takes (latitude, longitude) and must emit POINT(longitude latitude),
which is what PostGIS reads. The first test is the one that catches the swap.
"""

from __future__ import annotations

from app.core.geo import extract_coordinates, to_wkt_point


def test_to_wkt_point_writes_longitude_before_latitude() -> None:
    """A Lagos coordinate is stored as POINT(3.3711 6.5095), never the reverse."""
    point = to_wkt_point(6.5095, 3.3711)
    assert point is not None
    assert str(point.data) == "POINT(3.3711 6.5095)"


def test_to_wkt_point_keeps_srid_4326() -> None:
    """Every stored point is WGS84; a different SRID would make distances meaningless."""
    point = to_wkt_point(6.5, 3.3)
    assert point is not None
    assert point.srid == 4326


def test_to_wkt_point_rejects_a_half_coordinate() -> None:
    """One axis is not a position. Returning None keeps a bad form out of the database."""
    assert to_wkt_point(None, 3.3711) is None
    assert to_wkt_point(6.5095, None) is None


def test_to_wkt_point_returns_none_for_a_non_number() -> None:
    """Worst-case input: a string from a form that never parsed as a number."""
    assert to_wkt_point("not-a-number", 3.3711) is None  # type: ignore[arg-type]


def test_extract_coordinates_recovers_latitude_then_longitude() -> None:
    """Reading a point back returns (lat, lon), the order the API speaks."""
    latitude, longitude = extract_coordinates(to_wkt_point(6.5095, 3.3711))
    assert latitude is not None and longitude is not None
    assert round(latitude, 4) == 6.5095
    assert round(longitude, 4) == 3.3711


def test_extract_coordinates_never_raises_on_a_bad_geometry() -> None:
    """One malformed row must not break a list endpoint."""
    assert extract_coordinates("not a geometry") == (None, None)
    assert extract_coordinates(None) == (None, None)
