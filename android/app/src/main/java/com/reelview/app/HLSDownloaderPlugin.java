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
            Log.d(TAG, "getCapturedStreams called - Current count: " + capturedStreams.size());
            if (capturedStreams.isEmpty()) {
                Log.w(TAG, "? NO CAPTURED STREAMS - Check ReelViewWebViewClient logs for interception");
            }
            
            JSONArray streams = new JSONArray();
            for (String url : capturedStreams) {
                Log.d(TAG, "  Including stream: " + url.substring(0, Math.min(100, url.length())));
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
        String url = call.getString("url");
        String filename = call.getString("filename");
        String quality = call.getString("quality");
        
        if (url == null || filename == null) {
            call.reject("URL and filename are required");
            return;
        }
        
        String downloadId = "dl-" + System.currentTimeMillis();
        DownloadState state = new DownloadState();
        state.id = downloadId;
        state.filename = filename;
        state.url = url;
        state.quality = quality;
        state.status = "fetching";
        state.startTime = System.currentTimeMillis();
        downloads.put(downloadId, state);
        
        // Start foreground service
        try {
            Activity activity = getActivity();
            if (activity != null) {
                Intent serviceIntent = new Intent(activity, DownloadService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    activity.startForegroundService(serviceIntent);
                } else {
                    activity.startService(serviceIntent);
                }
                Log.d(TAG, "Foreground service started");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service: " + e.getMessage());
        }
        
        saveDownloadsToPreferences();
        
        Log.d(TAG, "Starting download: " + downloadId);
        notifyListeners("downloads-updated", createDownloadsObject());
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("downloadId", downloadId);
        call.resolve(result);
        
        // Start download in background thread
        new Thread(() -> {
            try {
                Log.d(TAG, "Download thread started for " + downloadId);
                
                hlsDownloader.downloadStream(url, quality, filename, new HLSDownloader.DownloadProgressCallback() {
                    @Override
                    public void onProgress(String status, int progress, String estimatedQuality, double bitrateMbps) {
                        state.status = mapStatus(status);
                        state.progress = progress;
                        state.estimatedQuality = estimatedQuality;
                        state.bitrateMbps = bitrateMbps;
                        
                        Log.d(TAG, String.format("Progress: %s - %d%% - Quality: %s @ %.1f Mbps", 
                            status, progress, estimatedQuality, bitrateMbps));
                        
                        saveDownloadsToPreferences();
                        
                        notifyListeners("download-progress", createProgressObject(state));
                        notifyListeners("downloads-updated", createDownloadsObject());
                    }
                    
                    @Override
                    public void onFileReady(String filePath, String estimatedQuality, double bitrateMbps) {
                        state.status = "complete";
                        state.progress = 100;
                        state.filePath = filePath;
                        state.estimatedQuality = estimatedQuality;
                        state.bitrateMbps = bitrateMbps;
                        File file = new File(filePath);
                        if(file.exists()) state.downloadedBytes = file.length();
                        
                        Log.d(TAG, String.format("Download complete: %s - Quality: %s @ %.2f Mbps", 
                            filePath, estimatedQuality, bitrateMbps));
                        
                        saveDownloadsToPreferences();
                        
                        notifyListeners("download-complete", createProgressObject(state));
                        notifyListeners("downloads-updated", createDownloadsObject());
                        
                        stopDownloadService();
                    }
                    
                    @Override
                    public void onError(String error) {
                        state.status = "error";
                        state.error = error;
                        Log.e(TAG, "Download error: " + error);
                        
                        saveDownloadsToPreferences();
                        
                        notifyListeners("download-error", createProgressObject(state));
                        notifyListeners("downloads-updated", createDownloadsObject());
                        
                        stopDownloadService();
                    }
                });
                
                Log.d(TAG, "Download completed for " + downloadId);
            } catch (Exception e) {
                Log.e(TAG, "Download exception for " + downloadId + ": " + e.getMessage(), e);
                state.status = "error";
                state.error = e.getMessage();
                saveDownloadsToPreferences();
                notifyListeners("downloads-updated", createDownloadsObject());
                stopDownloadService();
            }
        }, "DownloadThread-" + downloadId).start();
    }

    private void stopDownloadService() {
        try {
            Activity activity = getActivity();
            if (activity != null) {
                Intent serviceIntent = new Intent(activity, DownloadService.class);
                activity.stopService(serviceIntent);
                Log.d(TAG, "Foreground service stopped");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping service: " + e.getMessage());
        }
    }

    private void saveDownloadsToPreferences() {
        try {
            Activity activity = getActivity();
            if (activity == null) {
                Log.w(TAG, "Cannot save downloads: Activity is null");
                return;
            }
            
            android.content.SharedPreferences prefs = activity.getSharedPreferences("reelview_downloads", android.content.Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            
            JSONArray downloadsJson = new JSONArray();
            for (DownloadState state : downloads.values()) {
                JSONObject obj = new JSONObject();
                obj.put("id", state.id);
                obj.put("filename", state.filename);
                obj.put("url", state.url);
                obj.put("quality", state.quality);
                obj.put("status", state.status);
                obj.put("progress", state.progress);
                obj.put("downloadedBytes", state.downloadedBytes);
                obj.put("filePath", state.filePath);
                obj.put("error", state.error);
                obj.put("startTime", state.startTime);
                obj.put("estimatedQuality", state.estimatedQuality);
                obj.put("bitrateMbps", state.bitrateMbps);
                downloadsJson.put(obj);
            }
            
            editor.putString("downloads_list", downloadsJson.toString());
            editor.apply();
            Log.d(TAG, "Saved " + downloads.size() + " downloads to preferences");
        } catch (Exception e) {
            Log.e(TAG, "Error saving downloads: " + e.getMessage(), e);
        }
    }

    private void loadDownloadsFromPreferences() {
        try {
            Activity activity = getActivity();
            if (activity == null) {
                Log.w(TAG, "Cannot load downloads: Activity is null");
                return;
            }
            
            android.content.SharedPreferences prefs = activity.getSharedPreferences("reelview_downloads", android.content.Context.MODE_PRIVATE);
            String downloadsJson = prefs.getString("downloads_list", "[]");
            
            JSONArray array = new JSONArray(downloadsJson);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                
                DownloadState state = new DownloadState();
                state.id = obj.getString("id");
                state.filename = obj.getString("filename");
                state.url = obj.getString("url");
                state.quality = obj.optString("quality");
                state.status = obj.getString("status");
                state.progress = obj.getInt("progress");
                state.downloadedBytes = obj.getLong("downloadedBytes");
                state.filePath = obj.optString("filePath");
                state.error = obj.optString("error");
                state.startTime = obj.getLong("startTime");
                state.estimatedQuality = obj.optString("estimatedQuality");
                state.bitrateMbps = obj.optDouble("bitrateMbps", 0);
                
                downloads.put(state.id, state);
            }
            
            Log.d(TAG, "Loaded " + downloads.size() + " downloads from preferences");
        } catch (Exception e) {
            Log.e(TAG, "Error loading downloads: " + e.getMessage(), e);
        }
    }
    
    @PluginMethod
    public void getDownloadsList(PluginCall call) {
        call.resolve(new JSObject().put("downloads", createDownloadsArray()));
    }

    @PluginMethod
    public void captureStream(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }
        
        storeCapturedStream(url, "js");
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("count", capturedStreams.size());
        call.resolve(result);
    }

    @PluginMethod
    public void clearStreams(PluginCall call) {
        capturedStreams.clear();
        Log.d(TAG, "Cleared captured streams");
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void removeDownload(PluginCall call) {
        String id = call.getString("id");
        boolean deleteFile = call.getBoolean("deleteFile", false);
        
        if (id != null && downloads.containsKey(id)) {
            DownloadState state = downloads.get(id);
            
            if (deleteFile && state != null && state.filePath != null) {
                try {
                    File file = new File(state.filePath);
                    if (file.exists()) {
                        boolean deleted = file.delete();
                        Log.d(TAG, "File deletion " + (deleted ? "successful" : "failed") + ": " + state.filePath);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error deleting file: " + e.getMessage());
                }
            }
            
            downloads.remove(id);
            saveDownloadsToPreferences();
            notifyListeners("downloads-updated", createDownloadsObject());
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void clearCompletedDownloads(PluginCall call) {
        List<String> toRemove = new ArrayList<>();
        for (Map.Entry<String, DownloadState> entry : downloads.entrySet()) {
            String status = entry.getValue().status;
            if ("complete".equals(status) || "error".equals(status) || "cancelled".equals(status)) {
                toRemove.add(entry.getKey());
            }
        }
        for (String id : toRemove) {
            downloads.remove(id);
        }
        saveDownloadsToPreferences();
        notifyListeners("downloads-updated", createDownloadsObject());
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void deleteDownloadedFile(PluginCall call) {
        String filePath = call.getString("filePath");
        
        if (filePath == null || filePath.isEmpty()) {
            call.reject("File path is required");
            return;
        }
        
        try {
            File file = new File(filePath);
            if (file.exists()) {
                boolean deleted = file.delete();
                Log.d(TAG, "File deletion " + (deleted ? "successful" : "failed") + ": " + filePath);
                
                String idToRemove = null;
                for (Map.Entry<String, DownloadState> entry : downloads.entrySet()) {
                    if (filePath.equals(entry.getValue().filePath)) {
                        idToRemove = entry.getKey();
                        break;
                    }
                }
                if (idToRemove != null) {
                    downloads.remove(idToRemove);
                    saveDownloadsToPreferences();
                    notifyListeners("downloads-updated", createDownloadsObject());
                }
                
                JSObject result = new JSObject();
                result.put("success", deleted);
                result.put("message", deleted ? "File deleted" : "Failed to delete file");
                call.resolve(result);
            } else {
                call.resolve(new JSObject().put("success", false).put("message", "File not found"));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error deleting file: " + e.getMessage());
            call.reject("Error deleting file: " + e.getMessage());
        }
    }
    
    private String mapStatus(String status) {
        if (status == null) return "unknown";
        switch (status.toLowerCase()) {
            case "fetching playlist": return "fetching";
            case "analyzing":
            case "analyzing segments": return "parsing";
            case "downloading": return "downloading";
            case "merging segments": return "merging";
            case "converting to mkv": return "converting";
            case "complete": return "complete";
            default: return status;
        }
    }
    
    private JSObject createProgressObject(DownloadState state) {
        JSObject obj = new JSObject();
        obj.put("id", state.id);
        obj.put("status", state.status);
        obj.put("progress", state.progress);
        obj.put("downloadedBytes", state.downloadedBytes);
        obj.put("estimatedQuality", state.estimatedQuality);
        obj.put("bitrateMbps", state.bitrateMbps);
        if (state.filePath != null) obj.put("filePath", state.filePath);
        if (state.error != null) obj.put("error", state.error);
        return obj;
    }
    
    private JSObject createDownloadsObject() {
        return new JSObject().put("downloads", createDownloadsArray());
    }
    
    private JSONArray createDownloadsArray() {
        JSONArray array = new JSONArray();
        for (DownloadState state : downloads.values()) {
            try {
                array.put(new JSObject()
                    .put("id", state.id)
                    .put("filename", state.filename)
                    .put("url", state.url)
                    .put("quality", state.quality)
                    .put("status", state.status)
                    .put("progress", state.progress)
                    .put("downloadedBytes", state.downloadedBytes)
                    .put("filePath", state.filePath)
                    .put("error", state.error)
                    .put("startTime", state.startTime)
                    .put("estimatedQuality", state.estimatedQuality)
                    .put("bitrateMbps", state.bitrateMbps));
            } catch (Exception e) {}
        }
        return array;
    }
}
