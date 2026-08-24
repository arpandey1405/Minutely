import subprocess
import sys
import os
import time
from pathlib import Path

def print_banner(text):
    print("=" * 60)
    print(f" {text:^58}")
    print("=" * 60)

def free_port(port):
    """
    Checks if a port is in use and terminates the process holding it.
    """
    import subprocess
    import os
    if os.name == 'nt':  # Windows
        try:
            # Find the PID holding the port
            cmd = f'netstat -ano | findstr :{port}'
            output = subprocess.check_output(cmd, shell=True).decode('utf-8')
            lines = [line.strip() for line in output.split('\n') if line.strip()]
            pids = set()
            for line in lines:
                parts = [p for p in line.split(' ') if p]
                if len(parts) >= 5 and 'LISTENING' in line:
                    pids.add(parts[-1])
            
            for pid in pids:
                if pid and pid != '0':
                    print(f"[*] Port {port} is in use by process ID {pid}. Terminating process...")
                    subprocess.run(f'taskkill /F /PID {pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            pass
    else:  # Linux/Mac
        try:
            cmd = f'lsof -t -i:{port}'
            pid = subprocess.check_output(cmd, shell=True).decode('utf-8').strip()
            if pid:
                print(f"[*] Port {port} is in use by PID {pid}. Terminating process...")
                subprocess.run(f'kill -9 {pid}', shell=True)
        except subprocess.CalledProcessError:
            pass

def main():
    root_dir = Path(__file__).resolve().parent
    backend_dir = root_dir / "backend"
    frontend_dir = root_dir / "frontend"
    
    print_banner("AI Meeting Summarizer Orchestrator")
    
    # Force free target ports to prevent bind address usage conflicts
    free_port(8000)
    free_port(5173)

    
    # 1. Check/initialize Prisma DB
    db_file = backend_dir / "prisma" / "dev.db"
    
    if not db_file.exists():
        print("[*] SQLite dev.db not detected. Running database migrations...")
        try:
            # Run prisma db push via python module
            subprocess.run(
                [sys.executable, "-m", "prisma", "db", "push", f"--schema={backend_dir / 'prisma' / 'schema.prisma'}"],
                check=True,
                cwd=backend_dir
            )
            print("[+] Database successfully initialized.")
        except subprocess.CalledProcessError as e:
            print(f"[!] Database migration failed: {e}")
            print("[!] Please check if Prisma is installed correctly or run 'prisma db push --schema=backend/prisma/schema.prisma' manually.")
    else:
        print("[+] Prisma SQLite database dev.db detected.")
        # Make sure Prisma client is generated
        try:
            subprocess.run(
                [sys.executable, "-m", "prisma", "generate", f"--schema={backend_dir / 'prisma' / 'schema.prisma'}"],
                check=True,
                cwd=backend_dir,
                stdout=subprocess.DEVNULL
            )
        except Exception:
            pass

    # Ensure uploads directory exists
    uploads_dir = backend_dir / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    
    # 2. Launch FastAPI Backend
    print("[*] Starting FastAPI Backend on http://127.0.0.1:8000 ...")
    backend_cmd = [
        sys.executable, "-m", "uvicorn", "app.main:app", 
        "--host", "127.0.0.1", 
        "--port", "8000"
    ]
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir
    )
    
    # Give backend a moment to spin up and bind port
    time.sleep(2)
    
    # 3. Launch React Frontend (Vite)
    print("[*] Starting Vite React Frontend on http://localhost:5173 ...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_cmd = [
        npm_cmd, "run", "dev", "--", "--port", "5173"
    ]
    
    # Verify node_modules exists, if not prompt
    if not (frontend_dir / "node_modules").exists():
        print("[*] node_modules not detected. Installing npm dependencies first...")
        subprocess.run([npm_cmd, "install"], cwd=frontend_dir, check=True)
        
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir
    )
    
    print("\n[+] Both processes are running! Press Ctrl+C to terminate.")
    print("------------------------------------------------------------\n")
    
    try:
        # Keep orchestrator running
        while True:
            # Check if any process terminated unexpectedly
            backend_status = backend_process.poll()
            frontend_status = frontend_process.poll()
            
            if backend_status is not None:
                print(f"[!] Backend process exited with code {backend_status}")
                break
            if frontend_status is not None:
                print(f"[!] Frontend process exited with code {frontend_status}")
                break
                
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[*] Terminating services...")
    finally:
        # Gracefully kill both processes
        backend_process.terminate()
        frontend_process.terminate()
        
        # Wait a moment for termination
        time.sleep(1)
        
        # Force kill if still running
        if backend_process.poll() is None:
            backend_process.kill()
        if frontend_process.poll() is None:
            frontend_process.kill()
            
        print("[+] Services stopped successfully.")

if __name__ == "__main__":
    main()
