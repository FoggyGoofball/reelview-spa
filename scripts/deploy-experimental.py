import os, shutil, subprocess, tempfile, json, re

tmp = tempfile.mkdtemp()
print(f"Working in {tmp}")

# Copy dist contents
src = r'c:\Users\Admin\Downloads\reelview\spa\dist'
dst = os.path.join(tmp, 'dist')
os.makedirs(dst)

for item in os.listdir(src):
    s = os.path.join(src, item)
    d = os.path.join(dst, item)
    if os.path.isdir(s):
        shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)

# Add .nojekyll
open(os.path.join(dst, '.nojekyll'), 'w').close()

os.chdir(dst)

# Get token for auth
token_r = subprocess.run(['gh', 'auth', 'token'], capture_output=True, text=True)
token = token_r.stdout.strip()
remote_url = f"https://FoggyGoofball:{token}@github.com/FoggyGoofball/reelview-experimental.git"

# Init and push
subprocess.run(['git', 'init'], capture_output=True, check=True)
subprocess.run(['git', 'checkout', '-b', 'gh-pages'], capture_output=True, check=True)
subprocess.run(['git', 'config', 'user.email', 'bot@reelview.dev'], capture_output=True)
subprocess.run(['git', 'config', 'user.name', 'Deploy Bot'], capture_output=True)
subprocess.run(['git', 'add', '-A'], capture_output=True, check=True)
subprocess.run(['git', 'commit', '-m', 'deploy reelview-experimental'], capture_output=True, check=True)
subprocess.run(['git', 'remote', 'add', 'origin', remote_url], capture_output=True)

print("Pushing to gh-pages...")
r = subprocess.run(['git', 'push', '-f', 'origin', 'gh-pages'], capture_output=True, text=True)
print(f"exit={r.returncode}")
if r.stdout: print(f"stdout={r.stdout[:500]}")
if r.stderr: print(f"stderr={r.stderr[:500]}")

if r.returncode == 0:
    # Enable GitHub Pages
    payload = json.dumps({'source': {'branch': 'gh-pages', 'path': '/'}})
    r2 = subprocess.run(['gh', 'api', 'repos/FoggyGoofball/reelview-experimental/pages', '-X', 'POST', '--input', '-'],
                       input=payload, capture_output=True, text=True)
    if r2.returncode == 0:
        data = json.loads(r2.stdout)
        print(f"\n✅ DEPLOYED: {data.get('html_url', 'unknown')}")
    else:
        # Check if already configured
        r3 = subprocess.run(['gh', 'api', 'repos/FoggyGoofball/reelview-experimental/pages'], capture_output=True, text=True)
        if r3.returncode == 0 and r3.stdout.strip():
            data = json.loads(r3.stdout)
            print(f"\n✅ Pages already configured: {data.get('html_url', 'unknown')}")
        else:
            print(f"\n⚠️ Pages enable failed: {r2.stderr[:200]}")
else:
    print("\n❌ Push failed!")
