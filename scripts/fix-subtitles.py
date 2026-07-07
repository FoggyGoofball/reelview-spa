# Fix subtitle search:
# 1. allSubs should prefer search results (intSubs) over parent subs
# 2. Add error logging to the catch block

with open('spa/src/components/video/direct-stream-player.tsx', 'r') as f:
    dsp = f.read()

# Fix allSubs: prefer intSubs (search results) when available
old = "const allSubs = extSubs && extSubs.length > 0 ? extSubs : intSubs;"
new = "const allSubs = intSubs.length > 0 ? intSubs : (extSubs || []);"
dsp = dsp.replace(old, new)
print('[1] allSubs now prefers search results (intSubs) over parent subs')

with open('spa/src/components/video/direct-stream-player.tsx', 'w') as f:
    f.write(dsp)

# Fix subtitle-selector.tsx - add error logging
with open('spa/src/components/video/subtitle-selector.tsx', 'r') as f:
    ss = f.read()

# Replace the handleSearch catch block
old_catch = "} catch {} finally { setResolving(false); }"
new_catch = "} catch (e) { console.error('[SubSearch] Failed:', e); } finally { setResolving(false); }"
ss = ss.replace(old_catch, new_catch)
print('[2] subtitle-selector.tsx - added error logging to catch block')

with open('spa/src/components/video/subtitle-selector.tsx', 'w') as f:
    f.write(ss)

print()
print('Done. Rebuild and deploy needed.')
