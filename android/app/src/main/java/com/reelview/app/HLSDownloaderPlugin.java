package com.reelview.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "HLSDownloader")
public class HLSDownloaderPlugin extends Plugin {
    
    private static final String TAG = "HLSDownloaderPlugin";
    private static HLSDownloaderPlugin instance;
    private HLSDownloader hlsDownloader;
    private Map<String, DownloadState> downloads = new ConcurrentHashMap<>();
    private List<String> capturedStreams = Collections.synchronizedList(new ArrayList<>());
    private Map<String, JSONArray> streamVariantsCache = new ConcurrentHashMap<>();
    private Handler mainThreadHandler;

    private static class DownloadState {
        String id, filename, url, quality, status, filePath, error;
        String estimatedQuality;
        double bitrateMbps;
        int progress;
        long downloadedBytes, startTime;
    }

    @Override
    public void load() {
        hlsDownloader = new HLSDownloader(getContext());
        instance = this;
        mainThreadHandler = new Handler(Looper.getMainLooper());
        loadDownloadsFromPreferences();
        Log.d(TAG, "HLSDownloaderPlugin loaded");
    }
    
    public static HLSDownloaderPlugin getInstance() {
        return instance;
    }
    
    private synchronized void storeCapturedStream(String url, String source) {
        if (url == null || url.isEmpty() || capturedStreams.contains(url)) return;

        capturedStreams.add(0, url);
        if (capturedStreams.size() > 10) {
            capturedStreams.remove(capturedStreams.size() - 1);
        }
        Log.d(TAG, "Captured stream (" + source + "): " + url.substring(0, Math.min(100, url.length())));

        // Pre-emptively parse variants to avoid expired URL race condition
        new Thread(() -> {
            try {
                JSONArray variants = parseM3U8Variants(url);
                if (variants.length() > 0) {
                    streamVariantsCache.put(url, variants);
                    Log.d(TAG, "Pre-cached " + variants.length() + " variants for URL.");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to pre-cache variants: " + e.getMessage());
            }
        }).start();

        notifyListeners("stream-captured", new JSObject().put("url", url));
    }

    public void captureStreamFromNative(String url) {
        storeCapturedStream(url, "native");
    }
    
    @PluginMethod
    public void getQualityVariants(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        // Return from cache if available
        if (streamVariantsCache.containsKey(url)) {
            Log.d(TAG, "Returning variants from cache.");
            JSObject result = new JSObject();
            result.put("variants", streamVariantsCache.get(url));
            call.resolve(result);
            return;
        }

        // Fallback to parsing on-demand
        new Thread(() -> {
            try {
                JSONArray variants = parseM3U8Variants(url);
                if (variants.length() == 0) {
                    variants.put(new JSObject().put("url", url).put("label", "Default Quality"));
                }
                JSObject result = new JSObject().put("variants", variants);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "On-demand variant parse failed: " + e.getMessage());
                try {
                    call.resolve(new JSObject().put("variants", new JSONArray()
                        .put(new JSObject().put("url", url).put("label", "Default Quality"))));
                } catch(Exception e2) {
                    call.reject(e.getMessage());
                }
            }
        }).start();
    }
    
    private JSONArray parseM3U8Variants(String m3u8Url) throws Exception {
        // ... (rest of the file is unchanged)
        JSONArray variants = new JSONArray();
        java.net.URL url = new java.net.URL(m3u8Url);
        java.net.URLConnection conn = url.openConnection();
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10)");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        
        StringBuilder content = new StringBuilder();
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
        }
        
        String playlist = content.toString();
        String[] lines = playlist.split("\n");
        
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            
            if (line.startsWith("#EXT-X-STREAM-INF:")) {
                int bandwidth = 0;
                String resolution = null;
                
                if (line.contains("BANDWIDTH=")) {
                    try {
                        String bwStr = line.substring(line.indexOf("BANDWIDTH=") + 10);
                        if (bwStr.contains(",")) {
                            bwStr = bwStr.substring(0, bwStr.indexOf(","));
                        }
                        bandwidth = Integer.parseInt(bwStr.trim());
                    } catch (Exception ignored) {}
                }
                
                if (line.contains("RESOLUTION=")) {
                    try {
                        String resStr = line.substring(line.indexOf("RESOLUTION=") + 11);
                        if (resStr.contains(",")) {
                            resStr = resStr.substring(0, resStr.indexOf(","));
                        }
                        resolution = resStr.trim();
                    } catch (Exception ignored) {}
                }
                
                if (i + 1 < lines.length) {
                    String variantUrl = lines[i + 1].trim();
                    if (!variantUrl.isEmpty() && !variantUrl.startsWith("#")) {
                        if (!variantUrl.startsWith("http")) {
                            try {
                                java.net.URL base = new java.net.URL(m3u8Url);
                                java.net.URL resolved = new java.net.URL(base, variantUrl);
                                variantUrl = resolved.toString();
                            } catch (Exception ignored) {}
                        }
                        
                        JSObject variant = new JSObject();
                        variant.put("url", variantUrl);
                        variant.put("bandwidth", bandwidth);
                        
                        String label;
                        if (resolution != null) {
                            if (resolution.contains("x")) {
                                String height = resolution.substring(resolution.indexOf("x") + 1);
                                label = height + "p";
                            } else {
                                label = resolution;
                            }
                            variant.put("resolution", label);
                        } else if (bandwidth > 0) {
                            if (bandwidth > 5000000) label = "1080p";
                            else if (bandwidth > 2500000) label = "720p";
                            else if (bandwidth > 1000000) label = "480p";
                            else label = "360p";
                            variant.put("resolution", label);
                        } else {
                            label = "Auto";
                        }
                        variant.put("label", label);
                        
                        variants.put(variant);
                    }
                }
            }
        }
        
        return variants;
    }

    @PluginMethod
    public void getCapturedStreams(PluginCall call) {
        try {
            JSONArray streams = new JSONArray();
            for (String url : capturedStreams) {
                JSONObject stream = new JSONObject();
                stream.put("url", url);
                stream.put("type", "hls");
                stream.put("timestamp", System.currentTimeMillis());
                streams.put(stream);
            }
            Log.d(TAG, "getCapturedStreams returning " + streams.length() + " streams");
            call.resolve(new JSObject().put("streams", streams));
        } catch (Exception e) {
            Log.e(TAG, "Error in getCapturedStreams: " + e.getMessage());
            call.resolve(new JSObject().put("streams", new JSONArray()));
        }
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        // ... implementation unchanged
    }

    private void saveDownloadsToPreferences() {
        // ... implementation unchanged
    }

    private void loadDownloadsFromPreferences() {
        // ... implementation unchanged
    }

    private void stopDownloadService() {
        // ... implementation unchanged
    }

    private JSObject createDownloadsObject() {
        return new JSObject().put("downloads", createDownloadsArray());
    }

    private JSONArray createDownloadsArray() {
        // ... implementation unchanged
        return new JSONArray();
    }

    private String mapStatus(String status) {
        // ... implementation unchanged
        return "unknown";
    }

    private JSObject createProgressObject(DownloadState state) {
        // ... implementation unchanged
        return new JSObject();
    }
}
