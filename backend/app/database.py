from prisma import Prisma

# Global prisma client instance
db = Prisma(auto_register=True)

async def connect_db():
    if not db.is_connected():
        # Programmatically ensure the query engine binary exists at runtime on Render
        try:
            import subprocess
            import sys
            from pathlib import Path
            
            binary_name = "prisma-query-engine-debian-openssl-3.0.x"
            local_binary = Path(__file__).resolve().parents[2] / binary_name
            
            if not local_binary.exists():
                print("[*] Database engine binary not found. Fetching Prisma binaries dynamically...")
                subprocess.run(
                    [sys.executable, "-m", "prisma", "py", "fetch"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                print("[+] Prisma binaries fetched successfully.")
        except Exception as e:
            print(f"[!] Warning: Failed to fetch Prisma binaries dynamically: {e}")
            
        await db.connect()

async def disconnect_db():
    if db.is_connected():
        await db.disconnect()
