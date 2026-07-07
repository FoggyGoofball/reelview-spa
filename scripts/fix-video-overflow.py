# Fixes for video overflow + global scroll lock

# 1. Remove global overflow:hidden from index.html
with open('spa/index.html', 'r') as f:
    html = f.read()
html = html.replace('    <style>html,body{overflow:hidden;height:100%;margin:0}</style>\n', '')
with open('spa/index.html', 'w') as f:
    f.write(html)
print('1. Removed global overflow:hidden from index.html')

# 2. Insert spacer in Watch.tsx between flex-1 close and flex-col close
with open('spa/src/pages/Watch.tsx', 'r') as f:
    watch = f.read()

old = '        </div>\n      </div>\n      \n      {mediaType'
new = '        </div>\n        <div className="h-16 shrink-0" />\n      </div>\n      \n      {mediaType'

if old in watch:
    watch = watch.replace(old, new)
    with open('spa/src/pages/Watch.tsx', 'w') as f:
        f.write(watch)
    print('2. Inserted spacer in Watch.tsx')
else:
    print('2. ERROR: pattern not found in Watch.tsx')
    lines = watch.split('\n')
    for i in range(510, min(525, len(lines))):
        print(f'  {i+1}: |{lines[i]}|')
