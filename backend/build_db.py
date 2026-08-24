import os
import shutil
import subprocess
import sys
from pathlib import Path

def main():
    print("[*] Running Prisma db push...")
    try:
        subprocess.run([sys.executable, "-m", "prisma", "db", "push"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"[!] prisma db push failed: {e}")
        sys.exit(1)
    
    print("[*] Locating prisma query engine binary...")
    search_dirs = [
        Path.home() / ".cache" / "prisma-python",
        Path("/opt/render/.cache/prisma-python"),
        Path("/opt/render"),
        Path.home(),
    ]
    
    binary_name = "prisma-query-engine-debian-openssl-3.0.x"
    found_path = None
    
    # 1. Search for already downloaded binary in cache
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        print(f"Searching in: {search_dir}...")
        for root, dirs, files in os.walk(search_dir):
            for file in files:
                if file.startswith("prisma-query-engine-debian-openssl-") or file == binary_name:
                    found_path = Path(root) / file
                    print(f"[+] Found query engine at: {found_path}")
                    break
            if found_path:
                break
        if found_path:
            break
            
    # 2. Try prisma py fetch if not found
    if not found_path:
        print("[-] Query engine binary not found in cache. Running prisma py fetch...")
        try:
            subprocess.run([sys.executable, "-m", "prisma", "py", "fetch"], check=True)
        except subprocess.CalledProcessError as e:
            print(f"[!] prisma py fetch failed: {e}")
            sys.exit(1)
            
        # Search again after fetch
        for search_dir in search_dirs:
            if not search_dir.exists():
                continue
            for root, dirs, files in os.walk(search_dir):
                for file in files:
                    if file.startswith("prisma-query-engine-debian-openssl-") or file == binary_name:
                        found_path = Path(root) / file
                        print(f"[+] Found query engine after fetch at: {found_path}")
                        break
                if found_path:
                    break
            if found_path:
                break
                
    # 3. Copy binary to current folder
    if found_path:
        dest_path = Path(".") / binary_name
        try:
            shutil.copy2(found_path, dest_path)
            # Apply executable permissions (+x)
            os.chmod(dest_path, 0o755)
            print(f"[+] Successfully copied query engine binary to: {dest_path.resolve()}")
        except Exception as e:
            print(f"[!] Failed to copy binary: {e}")
            sys.exit(1)
    else:
        print("[!] Warning: Could not locate query engine binary in any cache path.")
        print("[!] The server might fail to start if the binary is missing at runtime.")

if __name__ == "__main__":
    main()
