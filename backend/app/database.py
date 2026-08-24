from prisma import Prisma

# Global prisma client instance
db = Prisma(auto_register=True)

async def connect_db():
    if not db.is_connected():
        # Programmatically ensure the query engine binary exists at runtime on Render
        try:
            import subprocess
            import sys
            import os
            import shutil
            from pathlib import Path
            
            binary_name = "prisma-query-engine-debian-openssl-3.0.x"
            local_binary = Path(__file__).resolve().parents[2] / binary_name
            
            if not local_binary.exists():
                print("[*] Database engine binary not found. Fetching Prisma binaries dynamically...", flush=True)
                subprocess.run(
                    [sys.executable, "-m", "prisma", "py", "fetch"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                
                # Search cache folder recursively and copy to local root
                found_path = None
                search_dirs = [
                    Path.home() / ".cache" / "prisma-python",
                    Path.home(),
                    Path("/tmp")
                ]
                
                for search_dir in search_dirs:
                    if not search_dir.exists():
                        continue
                    for root, dirs, files in os.walk(search_dir):
                        for file in files:
                            if file == binary_name or file.startswith("prisma-query-engine-debian-openssl-"):
                                found_path = Path(root) / file
                                break
                        if found_path:
                            break
                    if found_path:
                        break
                
                if found_path:
                    shutil.copy2(found_path, local_binary)
                    os.chmod(local_binary, 0o755)
                    print(f"[+] Successfully copied runtime engine to {local_binary}", flush=True)
                else:
                    print("[!] Failed to locate downloaded query engine binary in cache.", flush=True)
        except Exception as e:
            print(f"[!] Warning: Failed to fetch Prisma binaries dynamically: {e}", flush=True)
            
        await db.connect()

async def disconnect_db():
    if db.is_connected():
        await db.disconnect()
