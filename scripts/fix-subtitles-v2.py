"""
Subtitle Fix v2 — Root Cause Analysis from logs:
  {"success":true,"subtitles":[]}

Root causes:
1. OpenSubtitles: uses `tmdb_id` for TV, needs `parent_tmdb_id` for episodes
2. Subdl scrapers: TMDB-to-IMDB lookup fails silently; frontend already has imdb_id
3. No visibility per-provider result in response
"""

import re

# ── 1. Fix opensubtitles-fallback.ts ────────────────────────────────────
# Use parent_tmdb_id for TV episodes, add rapidapi backup

with open('spa/backend/src/providers/opensubtitles-fallback.ts', 'r', encoding='utf-8') as f:
    os = f.read()

old_os = """const params = new URLSearchParams({ tmdb_id: tmdbId, languages: "en", type: season != null ? "episode" : "movie" });
    if (season != null) params.set("season_number", String(season));
    if (episode != null) params.set("episode_number", String(episode));"""

# For TV episodes, use parent_tmdb_id instead of tmdb_id
new_os = """const isEpisode = season != null;
    const params = new URLSearchParams();
    if (isEpisode) {
      // OpenSubtitles API expects parent_tmdb_id for episodes (the SHOW's TMDB id)
      params.set("parent_tmdb_id", tmdbId);
      params.set("season_number", String(season));
      params.set("episode_number", String(episode));
    } else {
      params.set("tmdb_id", tmdbId);
    }
    params.set("languages", "en");
    params.set("type", isEpisode ? "episode" : "movie");"""

os = os.replace(old_os, new_os)

# Also log the raw response from OpenSubtitles
old_os_return = """    const data = await res.json() as any;
    const subs = data?.data ?? [];
    if (!Array.isArray(subs) || subs.length === 0) return [];"""

new_os_return = """    const data = await res.json() as any;
    console.log('[OpenSubtitles] API response: ' + JSON.stringify(data).slice(0, 500));
    const subs = data?.data ?? [];
    if (!Array.isArray(subs) || subs.length === 0) {
      console.warn('[OpenSubtitles] Zero subtitles for tmdbId=' + tmdbId + ' S=' + season + ' E=' + episode);
      // Fallback: search by IMDB query
      try {
        const queryParams = new URLSearchParams({ query: tmdbId + ' season ' + (season || 1) + ' episode ' + (episode || 1), languages: 'en' });
        const qRes = await fetch(OS_API + '/subtitles?' + queryParams.toString(), { headers, signal: AbortSignal.timeout(8000) });
        if (qRes.ok) {
          const qData = await qRes.json() as any;
          const qSubs = qData?.data ?? [];
          if (Array.isArray(qSubs) && qSubs.length > 0) {
            console.log('[OpenSubtitles] Fallback query found ' + qSubs.length + ' subtitles');
            return await processOpenSubtitles(qSubs, headers);
          }
        }
      } catch { }
      return [];
    }"""

os = os.replace(old_os_return, new_os_return)

# Add the shared download function (extract download logic to reusable function)
os = os.replace(
    "export async function resolveWithOpenSubtitles(",
    "async function processOpenSubtitles(subs: any[], headers: Record<string, string>): Promise<SubtitleTrack[]> {\n  const tracks: SubtitleTrack[] = [];\n  for (const sub of subs.slice(0, 5)) {\n    const attrs = sub.attributes || sub;\n    if (!attrs?.files?.[0]?.file_id) continue;\n    const lang = attrs.language || attrs.language_name || 'Unknown';\n    const fileName = attrs.files[0].file_name || '';\n    try {\n      const dl = await fetch(OS_API + '/download', {\n        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },\n        body: JSON.stringify({ file_id: attrs.files[0].file_id }),\n        signal: AbortSignal.timeout(10000),\n      });\n      if (!dl.ok) continue;\n      const dlData = await dl.json() as any;\n      const url = dlData?.link;\n      if (!url) continue;\n      const ext = fileName.split('.').pop()?.toLowerCase() || 'srt';\n      const fmt = ext === 'vtt' ? 'vtt' : ext === 'ass' ? 'ass' : 'srt';\n      tracks.push({ lang, url: buildSubtitleProxyUrl(url), format: fmt, default: lang.toLowerCase() === 'english' });\n    } catch { continue; }\n  }\n  return tracks;\n}\n\nexport async function resolveWithOpenSubtitles("
)

with open('spa/backend/src/providers/opensubtitles-fallback.ts', 'w', encoding='utf-8') as f:
    f.write(os)
print('[1] Fixed opensubtitles-fallback.ts - parent_tmdb_id for TV + fallback query + logging')

# ── 2. Fix resolveSubtitles.ts: accept imdbId, return provider_results ──

with open('spa/backend/src/routes/resolveSubtitles.ts', 'r', encoding='utf-8') as f:
    rs = f.read()

# Add imdbId parameter to request body handling
rs = rs.replace(
    "const { tmdbId, type = \"tv\", season, episode } = req.body as any;",
    "const { tmdbId, type = \"tv\", season, episode, imdbId } = req.body as any;"
)

# Change the provider calls to pass imdbId and return per-provider stats
old_providers = """  const [osT, subdlT, freeT] = await Promise.all([
    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => { console.warn('[ResolveSubtitles] OpenSubtitles failed for ' + tmdbId); return [] as SubtitleTrack[]; }),
    scrapeSubdl(tmdbId, type, s, e).catch(() => { console.warn('[ResolveSubtitles] Subdl failed for ' + tmdbId); return [] as SubtitleTrack[]; }),
    resolveFreeSubtitles(tmdbId, type, s, e).catch(() => { console.warn('[ResolveSubtitles] Free failed for ' + tmdbId); return [] as SubtitleTrack[]; }),
  ]);"""

new_providers = """  const [osT, subdlT, freeT] = await Promise.all([
    resolveWithOpenSubtitles(tmdbId, s, e).catch((e: any) => { console.warn('[ResolveSubtitles] OpenSubtitles failed for ' + tmdbId, e?.message || ''); return [] as SubtitleTrack[]; }),
    scrapeSubdl(tmdbId, type, s, e, imdbId).catch((e: any) => { console.warn('[ResolveSubtitles] Subdl failed for ' + tmdbId, e?.message || ''); return [] as SubtitleTrack[]; }),
    resolveFreeSubtitles(tmdbId, type, s, e, imdbId).catch((e: any) => { console.warn('[ResolveSubtitles] Free failed for ' + tmdbId, e?.message || ''); return [] as SubtitleTrack[]; }),
  ]);"""

rs = rs.replace(old_providers, new_providers)

# Make the response include provider_results
rs = rs.replace(
    "return res.json({ success: true, subtitles: Array.from(dedup.values()) });",
    "return res.json({ success: true, subtitles: Array.from(dedup.values()), provider_results: { opensubtitles: osT.length, subdl: subdlT.length, free: freeT.length } });"
)

with open('spa/backend/src/routes/resolveSubtitles.ts', 'w', encoding='utf-8') as f:
    f.write(rs)
print('[2] Fixed resolveSubtitles.ts - imdbId param + provider_results in response')

# ── 3. Fix subtitle-scraper.ts: accept optional imdbId ──────────────────

with open('spa/backend/src/providers/subtitle-scraper.ts', 'r', encoding='utf-8') as f:
    ss = f.read()

# Change function to accept imdbId
ss = ss.replace(
    "export async function scrapeSubdl(tmdbId: string, type: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {",
    "export async function scrapeSubdl(tmdbId: string, type: string, season?: number, episode?: number, imdbId?: string | null): Promise<SubtitleTrack[]> {"
)

# Use imdbId if provided, otherwise do TMDB lookup
ss = ss.replace(
    "const imdbId = await tmdbToImdb(tmdbId, type);",
    "const imdb_id = imdbId || await tmdbToImdb(tmdbId, type);"
)
ss = ss.replace(
    "if (!imdbId) return [];",
    "if (!imdb_id) { console.warn('[Subdl] No IMDB ID available for ' + tmdbId); return []; }"
)
ss = ss.replace(
    'const url = type === "movie" ? "https://subdl.com/subtitle/" + imdbId : "https://subdl.com/s/subtitle/" + imdbId + "/" + season + "/" + episode;',
    'const url = type === "movie" ? "https://subdl.com/subtitle/" + imdb_id : "https://subdl.com/s/subtitle/" + imdb_id + "/" + season + "/" + episode;'
)

with open('spa/backend/src/providers/subtitle-scraper.ts', 'w', encoding='utf-8') as f:
    f.write(ss)
print('[3] Fixed subtitle-scraper.ts - accepts imdbId override')

# ── 4. Fix subtitle-freestream.ts: accept optional imdbId ───────────────

with open('spa/backend/src/providers/subtitle-freestream.ts', 'r', encoding='utf-8') as f:
    fs = f.read()

# Change the export function signature
fs = fs.replace(
    "export async function resolveFreeSubtitles(\n  tmdbId: string, type: string, season?: number, episode?: number\n): Promise<SubtitleTrack[]> {",
    "export async function resolveFreeSubtitles(\n  tmdbId: string, type: string, season?: number, episode?: number, imdbId?: string | null\n): Promise<SubtitleTrack[]> {"
)

# In the body, use provided imdbId first
fs = fs.replace(
    "  const imdbId = await tmdbToImdb(tmdbId, type);\n  if (!imdbId) return [];",
    "  const imdb_id = imdbId || await tmdbToImdb(tmdbId, type);\n  if (!imdb_id) { console.warn('[FreeSubs] No IMDB ID for ' + tmdbId); return []; }"
)

fs = fs.replace(
    "    scrapeYifyFast(imdbId),",
    "    scrapeYifyFast(imdb_id),"
)
fs = fs.replace(
    "    scrapePodnapisiFast(imdbId, season, episode),",
    "    scrapePodnapisiFast(imdb_id, season, episode),"
)

with open('spa/backend/src/providers/subtitle-freestream.ts', 'w', encoding='utf-8') as f:
    f.write(fs)
print('[4] Fixed subtitle-freestream.ts - accepts imdbId override')

# ── 5. Fix Watch.tsx: pass imdb_id to DirectStreamPlayer ────────────────

with open('spa/src/pages/Watch.tsx', 'r', encoding='utf-8') as f:
    wt = f.read()

# Find the DirectStreamPlayer usage and add imdbId prop
# The current usage is:
# <DirectStreamPlayer
#   video={video}
#   streamUrl={playerUrl}
#   ...
#   tmdbId={tmdbId || undefined}
#   title={video.title || video.name || ''}
# />
# We need to add: imdbId={video.external_ids?.imdb_id || undefined}

# Find the DirectStreamPlayer block
old_player_block = """            <DirectStreamPlayer
              video={video}
              streamUrl={playerUrl}
              streamType={
                (resolvedStreams.find((s) => s.url === selectedStreamUrl)?.type ||
                (playerUrl.includes('.m3u8') || playerUrl.includes('proxy-stream') ? 'hls' : 'mp4')) as 'hls' | 'mp4' | 'mkv'
              }
              season={currentSeason}
              episode={currentEpisode}
              subtitles={resolvedSubtitles}
              tmdbId={tmdbId || undefined}
              title={video.title || video.name || ''}
            />"""

new_player_block = """            <DirectStreamPlayer
              video={video}
              streamUrl={playerUrl}
              streamType={
                (resolvedStreams.find((s) => s.url === selectedStreamUrl)?.type ||
                (playerUrl.includes('.m3u8') || playerUrl.includes('proxy-stream') ? 'hls' : 'mp4')) as 'hls' | 'mp4' | 'mkv'
              }
              season={currentSeason}
              episode={currentEpisode}
              subtitles={resolvedSubtitles}
              tmdbId={tmdbId || undefined}
              title={video.title || video.name || ''}
              imdbId={video.external_ids?.imdb_id || undefined}
            />"""

wt = wt.replace(old_player_block, new_player_block)

with open('spa/src/pages/Watch.tsx', 'w', encoding='utf-8') as f:
    f.write(wt)
print('[5] Fixed Watch.tsx - passes imdbId to DirectStreamPlayer')

# ── 6. Fix direct-stream-player.tsx: add imdbId prop and pass through ────

with open('spa/src/components/video/direct-stream-player.tsx', 'r', encoding='utf-8') as f:
    dsp = f.read()

# Update the Props interface
old_props = "interface P { video: Video; streamUrl: string; streamType: \"hls\" | \"mp4\" | \"mkv\"; season?: number; episode?: number; subtitles?: SubtitleTrack[]; onSubtitlesChange?: (t: SubtitleTrack[]) => void; tmdbId?: string; title?: string; }"
new_props = "interface P { video: Video; streamUrl: string; streamType: \"hls\" | \"mp4\" | \"mkv\"; season?: number; episode?: number; subtitles?: SubtitleTrack[]; onSubtitlesChange?: (t: SubtitleTrack[]) => void; tmdbId?: string; title?: string; imdbId?: string; }"
dsp = dsp.replace(old_props, new_props)

# Update the function signature to destructure imdbId
old_fn = "export function DirectStreamPlayer({ video, streamUrl, streamType, season, episode, subtitles: extSubs, onSubtitlesChange, tmdbId, title }: P) {"
new_fn = "export function DirectStreamPlayer({ video, streamUrl, streamType, season, episode, subtitles: extSubs, onSubtitlesChange, tmdbId, title, imdbId }: P) {"
dsp = dsp.replace(old_fn, new_fn)

# Pass imdbId to SubtitleSelector
old_ss_call = '<SubtitleSelector videoRef={vr} subtitles={allSubs} selectedSubtitle={selSub} onSubtitleSelect={hSubSel} onSubtitlesChange={hSubChg} tmdbId={tmdbId} season={season} episode={episode} title={title} />'
new_ss_call = '<SubtitleSelector videoRef={vr} subtitles={allSubs} selectedSubtitle={selSub} onSubtitleSelect={hSubSel} onSubtitlesChange={hSubChg} tmdbId={tmdbId} season={season} episode={episode} title={title} imdbId={imdbId} />'
dsp = dsp.replace(old_ss_call, new_ss_call)

with open('spa/src/components/video/direct-stream-player.tsx', 'w', encoding='utf-8') as f:
    f.write(dsp)
print('[6] Fixed direct-stream-player.tsx - passes imdbId to SubtitleSelector')

# ── 7. Fix subtitle-selector.tsx: accept imdbId and include in POST ──────

with open('spa/src/components/video/subtitle-selector.tsx', 'r', encoding='utf-8') as f:
    sl = f.read()

# Update Props interface to include imdbId
old_iface = "interface Props { videoRef: React.RefObject<HTMLVideoElement | null>; subtitles: SubtitleTrack[]; selectedSubtitle: string | null; onSubtitleSelect: (lang: string | null) => void; onSubtitlesChange: (tracks: SubtitleTrack[]) => void; tmdbId?: string; season?: number; episode?: number; title?: string; }"
new_iface = "interface Props { videoRef: React.RefObject<HTMLVideoElement | null>; subtitles: SubtitleTrack[]; selectedSubtitle: string | null; onSubtitleSelect: (lang: string | null) => void; onSubtitlesChange: (tracks: SubtitleTrack[]) => void; tmdbId?: string; season?: number; episode?: number; title?: string; imdbId?: string; }"
sl = sl.replace(old_iface, new_iface)

# Update function destructuring to include imdbId
old_fn = "export function SubtitleSelector({ videoRef, subtitles, selectedSubtitle, onSubtitleSelect, onSubtitlesChange, tmdbId, season, episode, title }: Props) {"
new_fn = "export function SubtitleSelector({ videoRef, subtitles, selectedSubtitle, onSubtitleSelect, onSubtitlesChange, tmdbId, season, episode, title, imdbId }: Props) {"
sl = sl.replace(old_fn, new_fn)

# Update the handleSearch to include imdbId in the body
old_body = "body: JSON.stringify({ tmdbId, type: \"tv\", season, episode, title })"
# There are 2 occurrences of this — one in the actual search and one in the logging
# Replace the search body specifically 
old_search_fn = """  const handleSearch = useCallback(async () => { if (!tmdbId || resolving) return; setResolving(true); try { console.log('[SubSearch] Fetching subtitles for tmdbId=' + tmdbId + ' S=' + season + ' E=' + episode); const r = await fetch(apiUrl("/api/resolve-subtitles"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId, type: "tv", season, episode, title }) }); console.log('[SubSearch] Response status: ' + r.status); const d = await r.json(); console.log('[SubSearch] Response body:', JSON.stringify(d)); if (d.success && d.subtitles?.length > 0) { console.log('[SubSearch] Got ' + d.subtitles.length + ' tracks, setting...'); onSubtitlesChange(d.subtitles); onSubtitleSelect(d.subtitles[0].lang); } else { console.warn('[SubSearch] No subtitles returned: success=' + d.success + ' subtitles=' + (d.subtitles?.length ?? 'undefined')); } } catch (e) { console.error('[SubSearch] Failed:', e); } finally { setResolving(false); } }, [tmdbId, season, episode, title, resolving, onSubtitlesChange, onSubtitleSelect]);"""

new_search_fn = """  const handleSearch = useCallback(async () => { if (!tmdbId || resolving) return; setResolving(true); try { console.log('[SubSearch] Fetching subtitles for tmdbId=' + tmdbId + ' S=' + season + ' E=' + episode + ' imdbId=' + (imdbId || 'none')); const r = await fetch(apiUrl("/api/resolve-subtitles"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId, type: "tv", season, episode, title, imdbId }) }); console.log('[SubSearch] Response status: ' + r.status); const d = await r.json(); console.log('[SubSearch] Response body:', JSON.stringify(d)); if (d.success && d.subtitles?.length > 0) { console.log('[SubSearch] Got ' + d.subtitles.length + ' tracks, setting...'); onSubtitlesChange(d.subtitles); onSubtitleSelect(d.subtitles[0].lang); } else { console.warn('[SubSearch] No subtitles returned: success=' + d.success + ' subtitles=' + (d.subtitles?.length ?? 'undefined') + ' provider_results=' + JSON.stringify(d.provider_results)); } } catch (e) { console.error('[SubSearch] Failed:', e); } finally { setResolving(false); } }, [tmdbId, season, episode, title, imdbId, resolving, onSubtitlesChange, onSubtitleSelect]);"""

sl = sl.replace(old_search_fn, new_search_fn)

with open('spa/src/components/video/subtitle-selector.tsx', 'w', encoding='utf-8') as f:
    f.write(sl)
print('[7] Fixed subtitle-selector.tsx - includes imdbId in request')

print()
print('=== All 7 fixes applied. Now rebuild SPA and push. ===')
