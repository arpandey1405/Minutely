"""Build-time database setup for deployment (Render, Docker, etc.).

Run from the `backend` directory after installing requirements:
    python build_db.py
"""

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

# The Prisma CLI only looks for a .env next to the schema, but this project keeps
# a single .env at the repo root, so load it into the environment ourselves.
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

from app.prisma_engine import ensure_local_engine  # noqa: E402


def run_step(description, args):
    print(f"[*] {description}...", flush=True)
    result = subprocess.run([sys.executable, *args])
    if result.returncode != 0:
        print(f"[!] Failed: {description} (exit code {result.returncode})", flush=True)
        sys.exit(result.returncode)


def main():
    if not os.getenv("DATABASE_URL"):
        print(
            "[!] DATABASE_URL is not set. Point it at your Postgres instance "
            "(Render: the database's Internal Database URL).",
            flush=True,
        )
        sys.exit(1)

    # `generate` must run first: it writes the client that `app` imports, and it
    # downloads the query engine that the next step copies out of the cache.
    run_step("Generating Prisma client", ["-m", "prisma", "generate"])

    print("[*] Bundling query engine binary...", flush=True)
    print(f"[+] Query engine ready at {ensure_local_engine()}", flush=True)

    run_step("Applying schema to the database", ["-m", "prisma", "db", "push", "--skip-generate"])

    print("[+] Database build completed successfully.", flush=True)


if __name__ == "__main__":
    main()
