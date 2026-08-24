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

# `generate` must run before anything imports `prisma.Prisma`, otherwise the
# package raises "The Client hasn't been generated yet" at import time.
STEPS = [
    (["-m", "prisma", "generate"], "Generating Prisma client"),
    (["-m", "prisma", "py", "fetch"], "Downloading query engine binaries"),
    (["-m", "prisma", "db", "push", "--skip-generate"], "Applying schema to the database"),
]


def main():
    if not os.getenv("DATABASE_URL"):
        print(
            "[!] DATABASE_URL is not set. Point it at your Postgres instance "
            "(Render: the database's Internal Database URL).",
            flush=True,
        )
        sys.exit(1)

    for args, description in STEPS:
        print(f"[*] {description}...", flush=True)
        result = subprocess.run([sys.executable, *args])
        if result.returncode != 0:
            print(f"[!] Failed: {description} (exit code {result.returncode})", flush=True)
            sys.exit(result.returncode)

    print("[+] Database build completed successfully.", flush=True)


if __name__ == "__main__":
    main()
