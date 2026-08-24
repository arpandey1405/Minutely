# Imported for its side effect of loading the root .env, so DATABASE_URL is in
# the environment before the query engine resolves the datasource.
from app import config  # noqa: F401
from app.prisma_engine import ensure_local_engine, use_local_engine
from prisma import Prisma

use_local_engine()

# Global prisma client instance
db = Prisma(auto_register=True)

async def connect_db():
    if db.is_connected():
        return

    try:
        await db.connect()
    except Exception as e:
        # The engine should have been bundled at build time; if the deploy
        # predates that step, pull it down once rather than failing to boot.
        print(f"[!] Prisma connect failed ({e}). Fetching query engine and retrying...", flush=True)
        ensure_local_engine()
        use_local_engine()
        await db.connect()

async def disconnect_db():
    if db.is_connected():
        await db.disconnect()
