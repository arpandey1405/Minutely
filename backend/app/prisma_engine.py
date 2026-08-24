"""Bundles the Prisma query engine binary with the application.

`prisma py fetch` only installs the Node CLI; the query engine itself is
downloaded by `prisma generate` into the CLI's npm cache under the home
directory. Hosts like Render build and run in separate containers and only
carry over the project directory, so that cache is empty by the time the app
boots. Copying the engine into the backend directory makes it part of the
deployed artifact.
"""

from __future__ import annotations

import gzip
import os
import shutil
import stat
import urllib.request
from pathlib import Path

from prisma import config
from prisma.binaries import platform

BACKEND_DIR = Path(__file__).resolve().parents[1]
DOWNLOAD_URL = "https://binaries.prisma.sh/all_commits/{version}/{platform}/{filename}"


def engine_path() -> Path:
    """Where we keep our copy of the engine, mirroring Prisma's naming."""
    return BACKEND_DIR / f"prisma-query-engine-{platform.check_for_extension(platform.binary_platform())}"


def _cached_engine() -> Path | None:
    target = platform.check_for_extension(platform.binary_platform())
    candidates = [
        config.binary_cache_dir / "node_modules" / "prisma" / f"query-engine-{target}",
        config.binary_cache_dir / f"prisma-query-engine-{target}",
    ]
    return next((path for path in candidates if path.exists()), None)


def _download_engine(destination: Path) -> None:
    url = DOWNLOAD_URL.format(
        version=config.expected_engine_version,
        platform=platform.binary_platform(),
        filename=platform.check_for_extension("query-engine.gz"),
    )
    print(f"[*] Downloading query engine from {url}", flush=True)
    # The CDN rejects urllib's default user agent with a 403.
    request = urllib.request.Request(url, headers={"User-Agent": "minutely-backend"})
    with urllib.request.urlopen(request, timeout=120) as response:
        destination.write_bytes(gzip.decompress(response.read()))


def ensure_local_engine() -> Path:
    """Place the query engine in the backend directory, downloading it if needed."""
    destination = engine_path()
    if destination.exists():
        return destination

    cached = _cached_engine()
    if cached is not None:
        shutil.copy2(cached, destination)
    else:
        _download_engine(destination)

    mode = destination.stat().st_mode
    destination.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return destination


def use_local_engine() -> None:
    """Point Prisma at the bundled engine so lookup doesn't depend on the cwd."""
    destination = engine_path()
    if destination.exists():
        os.environ.setdefault("PRISMA_QUERY_ENGINE_BINARY", str(destination))
