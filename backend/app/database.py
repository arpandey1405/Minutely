import subprocess
import sys

# Imported for its side effect of loading the root .env, so DATABASE_URL is in
# the environment before the query engine resolves the datasource.
from app import config  # noqa: F401
from prisma import Prisma

# Global prisma client instance
db = Prisma(auto_register=True)

async def connect_db():
    if db.is_connected():
        return

    try:
        await db.connect()
    except Exception as e:
        # Hosts like Render run the app in a fresh container that may not carry
        # over the query engine downloaded at build time, so fetch it and retry.
        print(f"[!] Prisma connect failed ({e}). Fetching query engine and retrying...", flush=True)
        subprocess.run([sys.executable, "-m", "prisma", "py", "fetch"], check=True)
        await db.connect()

async def disconnect_db():
    if db.is_connected():
        await db.disconnect()
