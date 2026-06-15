#!/usr/bin/env python3
"""Launch the Streamlit dashboard and print the URL for the frontend."""
import subprocess, sys, os, socket

def find_free_port(start=8501, end=8600):
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return 8501

script_dir = os.path.dirname(os.path.abspath(__file__))
app_path = os.path.join(script_dir, "app.py")
port = find_free_port()

print(f"LAUNCH_URL=http://localhost:{port}")
print(f"LAUNCH_TYPE=streamlit")
sys.stdout.flush()

subprocess.run([
    sys.executable, "-m", "streamlit", "run", app_path,
    "--server.port", str(port),
    "--server.headless", "true",
    "--server.enableCORS", "false",
    "--server.runOnSave", "false",
])
