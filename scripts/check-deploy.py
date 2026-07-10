import subprocess, json, sys

# Check gh-pages branch exists
r = subprocess.run(['gh', 'api', 'repos/FoggyGoofball/reelview-experimental/git/ref/heads/gh-pages'], capture_output=True, text=True)
print(f"REF CHECK exit={r.returncode}")
print(f"REF CHECK out={r.stdout[:300]}")
print(f"REF CHECK err={r.stderr[:300]}")

if r.returncode == 0:
    # Enable pages
    payload = json.dumps({'source': {'branch': 'gh-pages', 'path': '/'}})
    r = subprocess.run(['gh', 'api', 'repos/FoggyGoofball/reelview-experimental/pages', '-X', 'POST', '--input', '-'], input=payload, capture_output=True, text=True)
    print(f"\nPAGES CREATE exit={r.returncode}")
    print(f"PAGES CREATE out={r.stdout[:300]}")
    print(f"PAGES CREATE err={r.stderr[:300]}")
    
    if r.returncode == 0:
        data = json.loads(r.stdout)
        print(f"\nPages URL: {data.get('html_url', 'unknown')}")
else:
    # Push dist to gh-pages
    print("\ngh-pages branch doesn't exist yet, deploying fresh...")
