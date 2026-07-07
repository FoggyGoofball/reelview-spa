import re

# 1. Fix spa/index.html - add overflow hidden to html,body
with open('spa/index.html', 'r') as f:
    html = f.read()
html = html.replace('<head>', '<head>\n    <style>html,body{overflow:hidden;height:100%;margin:0}</style>')
with open('spa/index.html', 'w') as f:
    f.write(html)
print('1. spa/index.html updated')

# 2. Fix Watch.tsx - remove pb-16 from flex-1, add spacer after video area
with open('spa/src/pages/Watch.tsx', 'r') as f:
    watch = f.read()
# Remove pb-16 from flex-1 div
watch = watch.replace('className="flex-1 relative w-full pb-16"', 'className="flex-1 relative w-full"')
# Add spacer div after the closing of the video area div
old = '</div>\n        </div>\n      </div>\n      \n      {mediaType'
new = '</div>\n        </div>\n      </div>\n      <div className="h-16 shrink-0" />\n      \n      {mediaType'
watch = watch.replace(old, new)
with open('spa/src/pages/Watch.tsx', 'w') as f:
    f.write(watch)
print('2. Watch.tsx updated')

# 3. Fix subtitle-scraper.ts - replace fake TMDB API key with real one
with open('spa/backend/src/providers/subtitle-scraper.ts', 'r') as f:
    scraper = f.read()
scraper = scraper.replace('3a4d5d2a9f5e4c8b8a7f6e5d4c3b2a1f', '3fa2f58b01fc2153fe716cb40c39dddf')
with open('spa/backend/src/providers/subtitle-scraper.ts', 'w') as f:
    f.write(scraper)
print('3. subtitle-scraper.ts updated')

print()
print('All 3 files modified successfully')
