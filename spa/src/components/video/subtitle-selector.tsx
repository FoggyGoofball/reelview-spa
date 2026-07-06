"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api-base";
import type { SubtitleTrack } from "./direct-stream-player";
const LS_SPEED = "reelview_playback_speed";
const LS_DELAY = "reelview_subtitle_delay";
const LS_FONTSIZE = "reelview_subtitle_fontsize";
interface Props { videoRef: React.RefObject<HTMLVideoElement | null>; subtitles: SubtitleTrack[]; selectedSubtitle: string | null; onSubtitleSelect: (lang: string | null) => void; onSubtitlesChange: (tracks: SubtitleTrack[]) => void; tmdbId?: string; season?: number; episode?: number; title?: string; }
export function SubtitleSelector({ videoRef, subtitles, selectedSubtitle, onSubtitleSelect, onSubtitlesChange, tmdbId, season, episode, title }: Props) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<"main"|"speed"|"delay"|"appearance">("main");
  const [resolving, setResolving] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(() => { const s = localStorage.getItem(LS_SPEED); return s ? parseFloat(s) : 1.0; });
  const [delay, setDelay] = useState(() => { const s = localStorage.getItem(LS_DELAY); return s ? parseFloat(s) : 0; });
  const [fontSz, setFontSz] = useState(() => { const s = localStorage.getItem(LS_FONTSIZE); return s || "1rem"; });
  useEffect(() => { const el = videoRef.current; if (el) el.playbackRate = speed; }, [speed, videoRef]);
  useEffect(() => { const el = videoRef.current; if (el) el.style.setProperty("--cue-font-size", fontSz); }, [fontSz, videoRef]);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) { setOpen(false); setMenu("main"); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  const handleSearch = useCallback(async () => { if (!tmdbId || resolving) return; setResolving(true); try { const r = await fetch(apiUrl("/api/resolve-subtitles"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId, type: "tv", season, episode, title }) }); const d = await r.json(); if (d.success && d.subtitles?.length > 0) { onSubtitlesChange(d.subtitles); onSubtitleSelect(d.subtitles[0].lang); } } catch {} finally { setResolving(false); } }, [tmdbId, season, episode, title, resolving, onSubtitlesChange, onSubtitleSelect]);
  const sp = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const dp = [-5, -2, -1, -0.5, 0, 0.5, 1, 2, 5];
  const fp = ["0.8rem", "1rem", "1.2rem", "1.5rem", "2rem"];
  return (
    <div ref={ddRef} className="relative">
      <button onClick={() => { setOpen(!open); setMenu("main"); }} className={"px-2 py-1 rounded text-xs font-medium transition-colors " + (selectedSubtitle ? "bg-blue-600/80 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")} title="Subtitles & Audio"><span className="font-bold">CC</span>{selectedSubtitle && <span className="ml-1 opacity-70">{selectedSubtitle.substring(0, 3)}</span>}</button>
      {open && <div className="absolute bottom-10 right-0 z-[100] w-56 rounded-lg bg-gray-900/95 backdrop-blur border border-white/10 shadow-xl text-sm">
        {menu === "main" && <div className="py-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtitles</div>
          <button onClick={() => { onSubtitleSelect(null); setOpen(false); }} className={"w-full text-left px-3 py-1.5 hover:bg-white/5 " + (!selectedSubtitle ? "text-blue-400" : "text-gray-300")}>Off</button>
          {subtitles.map((sub, i) => <button key={i} onClick={() => { onSubtitleSelect(sub.lang); setOpen(false); }} className={"w-full text-left px-3 py-1.5 hover:bg-white/5 " + (selectedSubtitle === sub.lang ? "text-blue-400" : "text-gray-300")}>{sub.lang} <span className="text-gray-500 text-xs">({sub.format.toUpperCase()})</span></button>)}
          <button onClick={handleSearch} disabled={resolving} className="w-full text-left px-3 py-1.5 text-gray-400 hover:bg-white/5 disabled:opacity-50">{resolving ? "Searching..." : "Search for subtitles..."}</button>
          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</div>
          <button onClick={() => setMenu("speed")} className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5">Play Speed: {speed.toFixed(2)}x</button>
          <button onClick={() => setMenu("delay")} className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5">Sub Delay: {delay > 0 ? "+" : ""}{delay.toFixed(1)}s</button>
          <button onClick={() => setMenu("appearance")} className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5">Font Size</button>
        </div>}
        {menu === "speed" && <div className="py-2 px-3"><div className="text-xs font-semibold text-gray-400 mb-2">Playback Speed</div><div className="flex flex-wrap gap-1 mb-2">{sp.map(v => <button key={v} onClick={() => { setSpeed(v); localStorage.setItem(LS_SPEED, String(v)); }} className={"px-2 py-1 rounded text-xs " + (Math.abs(speed - v) < 0.01 ? "bg-blue-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")}>{v}x</button>)}</div><input type="range" min="0.25" max="3" step="0.05" value={speed} onChange={e => { const v = parseFloat(e.target.value); setSpeed(v); localStorage.setItem(LS_SPEED, String(v)); }} className="w-full" /><div className="text-center text-xs text-gray-500 mt-1">{speed.toFixed(2)}x</div><button onClick={() => setMenu("main")} className="text-xs text-blue-400 mt-2">Back</button></div>}
        {menu === "delay" && <div className="py-2 px-3"><div className="text-xs font-semibold text-gray-400 mb-2">Subtitle Delay</div><div className="flex flex-wrap gap-1 mb-2">{dp.map(v => <button key={v} onClick={() => { setDelay(v); localStorage.setItem(LS_DELAY, String(v)); }} className={"px-2 py-1 rounded text-xs " + (delay === v ? "bg-blue-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")}>{v > 0 ? "+" : ""}{v}s</button>)}</div><input type="range" min="-10" max="10" step="0.1" value={delay} onChange={e => { const v = parseFloat(e.target.value); setDelay(v); localStorage.setItem(LS_DELAY, String(v)); }} className="w-full" /><div className="text-center text-xs text-gray-500 mt-1">{delay > 0 ? "+" : ""}{delay.toFixed(1)}s</div><button onClick={() => setMenu("main")} className="text-xs text-blue-400 mt-2">Back</button></div>}
        {menu === "appearance" && <div className="py-2 px-3"><div className="text-xs font-semibold text-gray-400 mb-2">Font Size</div><div className="flex flex-wrap gap-1 mb-2">{fp.map(v => <button key={v} onClick={() => { setFontSz(v); localStorage.setItem(LS_FONTSIZE, v); }} className={"px-2 py-1 rounded text-xs " + (fontSz === v ? "bg-blue-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")}>{v}</button>)}</div><input type="range" min="0.6" max="3" step="0.1" value={parseFloat(fontSz)} onChange={e => { const v = e.target.value + "rem"; setFontSz(v); localStorage.setItem(LS_FONTSIZE, v); }} className="w-full" /><button onClick={() => setMenu("main")} className="text-xs text-blue-400 mt-2">Back</button></div>}
      </div>}
    </div>
  );
}
