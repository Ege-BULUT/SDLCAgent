import socket
import subprocess
import sys
import os
import time
import signal
from pathlib import Path

BASE_DIR = Path(__file__).parent
BACKEND_DIR = BASE_DIR / "agentic_backend"
FRONTEND_DIR = BASE_DIR / "agentic_frontend"


def find_free_port(start: int = 8000, max_tries: int = 100) -> int | None:
    for port in range(start, start + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("localhost", port)) != 0:
                return port
    return None


def get_backend_python() -> str:
    """Use the project's virtual environment Python if available."""
    venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def main():
    port = find_free_port()
    if port is None:
        print("ERROR: No free port found.")
        sys.exit(1)

    backend_python = get_backend_python()
    print(f"[launcher] Found free port: {port}")
    print(f"[launcher] Using backend Python: {backend_python}")
    print(f"[launcher] Starting backend (uvicorn app.main:app --host 0.0.0.0 --port {port})...")

    backend_proc = subprocess.Popen(
        [
            backend_python,
            "-m", "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", str(port),
        ],
        cwd=str(BACKEND_DIR),
    )

    try:
        for _ in range(30):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("localhost", port)) == 0:
                    break
            time.sleep(0.5)
        else:
            print("[launcher] Backend did not start in time.")
            backend_proc.kill()
            sys.exit(1)

        backend_url = f"http://localhost:{port}"
        print(f"[launcher] Backend ready at {backend_url}")

        env = os.environ.copy()
        env["VITE_BACKEND_URL"] = backend_url

        print(f"[launcher] Starting frontend...")
        frontend_proc = subprocess.Popen(
            ["npm.cmd", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            env=env,
        )

        print()
        print(f"  Backend  → {backend_url}")
        print(f"  Frontend → http://localhost:5173")
        print(f"  Docs     → {backend_url}/docs")
        print()
        print("  Press Ctrl+C to stop both.")

        frontend_proc.wait()

    except KeyboardInterrupt:
        print("\n[launcher] Shutting down...")
    finally:
        backend_proc.terminate()
        frontend_proc.terminate()
        backend_proc.wait()
        frontend_proc.wait()
        print("[launcher] Both stopped.")


if __name__ == "__main__":
    main()
