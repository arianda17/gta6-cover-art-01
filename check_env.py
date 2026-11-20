#!/usr/bin/env python3
import sys, subprocess, json, os

def run(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

print("python3:", run(["which", "python3"]).stdout.strip())
print("pip3:", run(["which", "pip3"]).stdout.strip())
print("node:", run(["which", "node"]).stdout.strip())

# chromium location
print("chromium:", run(["which", "chromium"]).stdout.strip())
print("google-chrome:", run(["which", "google-chrome"]).stdout.strip())

# try import websocket
try:
    import websocket
    print("websocket: OK")
except Exception as e:
    print("websocket:", e)

# try import playwright
try:
    import playwright
    print("playwright:", playwright.__version__)
except Exception as e:
    print("playwright:", e)

# node WebSocket
res = run(["node", "-e", "console.log(typeof WebSocket)"])
print("node WebSocket:", res.stdout.strip() if res.stdout else res.stderr.strip())

# check ms-playwright
home = os.path.expanduser("~")
for p in os.listdir(home + "/.cache/ms-playwright/") if os.path.exists(home + "/.cache/ms-playwright/") else []:
    print("ms-playwright:", p)

# node_modules
mods = "/home/hatch/workspace/makefun/node22/lib/node_modules"
if os.path.exists(mods):
    for d in sorted(os.listdir(mods)):
        print("node_module:", d)