"""Map configuration, so tile URLs live in configuration rather than in components."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ....core.container import Container
from ...deps import get_container

router = APIRouter()


@router.get("/map-config")
async def map_config(container: Container = Depends(get_container)) -> dict[str, str]:
    """The tile template and attribution the browser should draw.

    Free OpenStreetMap raster tiles: no key, no billing, and attribution is
    returned with them because the tile usage policy requires it to be shown.
    """
    return {
        "tile_url": container.settings.MAP_TILE_URL,
        "attribution": container.settings.MAP_TILE_ATTRIBUTION,
    }
