import sys, os, shutil, subprocess, tempfile, json

sys.stdout.reconfigure(encoding='utf-8')

dist_dir = r'c:\Users\Admin\Downloads\reelview\spa\dist'

# 1. Fix index.html
idx = os.path.join(dist_dir, 'index.html')
with open(idx, 'r') as f:
    html = f.read()
old = '/reelview-final/'
new = '/reelview-experimental/'
html = html.replace(old, new)
with open(idx, 'w') as f:
    f.write(html)
print(f"Fixed: replaced '{old}' -> '{new}'")
print(f"Content: {html[:300]}")

# 2. Deploy
tmp = tempfile.mkdtemp()
dst = os.path.join(tmp, 'dist')
os.makedirs(dst)
for item in os.listdir(dist_dir):
    s = os.path.join(dist_dir, item)
    d = os.path.join(dst, item)
    if os.path.isdir(s):
        shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)
open(os.path.join(dst, '.nojekyll'), 'w').close()

os.chdir(dst)
token_r = subprocess.run(['gh', 'auth', 'token'], capture_output=True, text=True)
token = token_r.stdout.strip()
remote_url = f"https://FoggyGoofball:{token}@github.com/FoggyGoofball/reelview-experimental.git"

subprocess.run(['git', 'init'], capture_output=True, check=True)
subprocess.run(['git', 'checkout', '-b', 'gh-pages'], capture_output=True, check=True)
subprocess.run(['git', 'config', 'user.email', 'bot@reelview.dev'], capture_output=True)
subprocess.run(['git', 'config', 'user.name', 'Deploy Bot'], capture_output=True)
subprocess.run(['git', 'add', '-A'], capture_output=True, check=True)
subprocess.run(['git', 'commit', '-m', 'deploy reelview-experimental'], capture_output=True, check=True)
subprocess.run(['git', 'remote', 'add', 'origin', remote_url], capture_output=True)

r = subprocess.run(['git', 'push', '-f', 'origin', 'gh-pages'], capture_output=True, text=True)
print(f"Push exit={r.returncode}, stdout={r.stdout[:200]}, stderr={r.stderr[:200]}")
