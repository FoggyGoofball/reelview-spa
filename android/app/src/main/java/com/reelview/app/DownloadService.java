package com.reelview.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import java.io.File;
import java.util.HashMap;
import java.util.Map;

/**
 * Foreground Service for HLS Download Management
 * 
 * Features:
 * - Keeps downloads alive when app is backgrounded
 * - Survives screen lock
 * - Persists across app restarts
 * - Shows foreground notification
 * - Handles download progress updates
 */
public class DownloadService extends Service {
    
    private static final String TAG = "DownloadService";
    private static final String CHANNEL_ID = "reelview_downloads";
    private static final int NOTIFICATION_ID = 42;
    
    private HLSDownloader hlsDownloader;
    private Handler mainHandler;
    private Map<String, DownloadTask> activeTasks = new HashMap<>();
    private NotificationManager notificationManager;
    
    private static class DownloadTask {
        String downloadId;
        String url;
        String quality;
        String filename;
        Map<String, String> headers;
        int progress;
        String status;
    }
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "? DownloadService created");
        
        hlsDownloader = new HLSDownloader(this);
        mainHandler = new Handler(Looper.getMainLooper());
        notificationManager = getSystemService(NotificationManager.class);
        
        createNotificationChannel();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Log.w(TAG, "? onStartCommand called with null intent");
            return START_STICKY;
        }
        
        String action = intent.getAction();
        Log.d(TAG, "[DOWNLOAD-SERVICE] Action: " + action);
        
        // CRITICAL: Start foreground notification IMMEDIATELY (within 5 seconds)
        // This must happen BEFORE any other work to avoid ANR
        if ("DOWNLOAD".equals(action)) {
            String filename = intent.getStringExtra("filename");
            if (filename == null) filename = "Download";
            
            // Start foreground notification FIRST
            startForeground(NOTIFICATION_ID, createDownloadNotification("pending", filename, 0));
            
            // THEN start the download task
            startDownloadTask(intent);
        }
        
        // START_STICKY: If service is killed, OS will restart it with the last intent
        return START_STICKY;
    }
    
    /**
     * Start a download in the background
     * CRITICAL: This persists even if app is backgrounded or screen is locked
     */
    private void startDownloadTask(Intent intent) {
        String downloadId = intent.getStringExtra("downloadId");
        String url = intent.getStringExtra("url");
        String quality = intent.getStringExtra("quality");
        String filename = intent.getStringExtra("filename");
        Bundle headersBundle = intent.getBundleExtra("headers");
        
        if (downloadId == null || url == null || filename == null) {
            Log.e(TAG, "? Missing required download parameters");
            return;
        }
        
        // Extract headers from Bundle
        Map<String, String> headers = new HashMap<>();
        if (headersBundle != null) {
            for (String key : headersBundle.keySet()) {
                headers.put(key, headersBundle.getString(key));
            }
        }
        
        Log.d(TAG, "[DOWNLOAD-SERVICE] Starting download: " + downloadId);
        Log.d(TAG, "  URL: " + url.substring(0, Math.min(100, url.length())));
        Log.d(TAG, "  Quality: " + quality);
        Log.d(TAG, "  Filename: " + filename);
        Log.d(TAG, "  Headers: " + headers.size());
        
        // Create task
        DownloadTask task = new DownloadTask();
        task.downloadId = downloadId;
        task.url = url;
        task.quality = quality;
        task.filename = filename;
        task.headers = headers;
        task.status = "starting";
        task.progress = 0;
        
        activeTasks.put(downloadId, task);
        
        // Start download in background thread
        new Thread(() -> {
            try {
                performDownload(task);
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD-ERROR] Download failed for " + downloadId + ": " + e.getMessage(), e);
                task.status = "error";
                updateNotification();
                notifyDownloadError(downloadId, filename, e.getMessage());
            }
        }, "DownloadThread-" + downloadId).start();
    }
    
    /**
     * Perform the actual HLS download
     */
    private void performDownload(DownloadTask task) {
        try {
            Log.d(TAG, "[DOWNLOAD] Starting HLS download for: " + task.filename);
            
            hlsDownloader.downloadStream(task.url, task.quality, task.filename, task.headers,
                new HLSDownloader.DownloadProgressCallback() {
                    @Override
                    public void onProgress(String status, int progress, String estimatedQuality, double bitrateMbps) {
                        task.status = status;
                        task.progress = progress;
                        
                        Log.d(TAG, String.format("[DOWNLOAD-PROGRESS] %s - %d%% (%s @ %.1f Mbps)",
                            status, progress, estimatedQuality, bitrateMbps));
                        
                        updateNotification();
                        
                        // CRITICAL: Notify plugin about progress so JavaScript UI updates
                        notifyPluginProgress(task.downloadId, status, progress, estimatedQuality, bitrateMbps);
                    }
                    
                    @Override
                    public void onFileReady(String filePath, String estimatedQuality, double bitrateMbps) {
                        task.status = "complete";
                        task.progress = 100;
                        
                        Log.d(TAG, String.format("[DOWNLOAD-COMPLETE] %s at %s - %s @ %.2f Mbps",
                            task.filename, filePath, estimatedQuality, bitrateMbps));
                        
                        updateNotification();
                        
                        // Notify plugin of completion
                        notifyPluginComplete(task.downloadId, task.filename, filePath, estimatedQuality, bitrateMbps);
                        
                        // Clean up task after completion
                        activeTasks.remove(task.downloadId);
                        if (activeTasks.isEmpty()) {
                            stopForeground(true);
                            stopSelf();
                        }
                    }
                    
                    @Override
                    public void onError(String error) {
                        task.status = "error";
                        task.progress = 0;
                        
                        Log.e(TAG, "[DOWNLOAD-ERROR] " + error);
                        updateNotification();
                        
                        // Notify plugin of error
                        notifyPluginError(task.downloadId, task.filename, error);
                        
                        // Clean up failed task
                        activeTasks.remove(task.downloadId);
                        if (activeTasks.isEmpty()) {
                            stopForeground(true);
                            stopSelf();
                        }
                    }
                });
            
        } catch (Exception e) {
            Log.e(TAG, "[DOWNLOAD-EXCEPTION] " + e.getMessage(), e);
            task.status = "error";
            notifyPluginError(task.downloadId, task.filename, e.getMessage());
            activeTasks.remove(task.downloadId);
            if (activeTasks.isEmpty()) {
                stopForeground(true);
                stopSelf();
            }
        }
    }
    
    /**
     * Create notification channel (required for Android 8+)
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Downloads",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("ReelView Download Progress");
            channel.setShowBadge(true);
            
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
    
    /**
     * Create the foreground notification
     */
    private Notification createDownloadNotification(String downloadId, String filename, int progress) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.putExtra("downloadId", downloadId);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Downloading: " + filename)
            .setContentText(progress + "% complete")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setProgress(100, progress, progress == 0)
            .setOngoing(true);
        
        return builder.build();
    }
    
    /**
     * Update the foreground notification with current progress
     */
    private void updateNotification() {
        if (activeTasks.isEmpty()) return;
        
        // Get the first (or most recent) task for notification display
        DownloadTask task = activeTasks.values().iterator().next();
        
        Notification notification = createDownloadNotification(task.downloadId, task.filename, task.progress);
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }
    
    /**
     * Notify plugin of download progress (via event listener)
     */
    private void notifyPluginProgress(String downloadId, String status, int progress, String quality, double bitrate) {
        mainHandler.post(() -> {
            try {
                HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
                if (plugin != null) {
                    // Update the plugin's internal download state
                    // This will trigger the downloads-updated event
                    plugin.updateDownloadProgress(downloadId, status, progress, quality, bitrate);
                    
                    Log.d(TAG, "Notified plugin of progress: " + downloadId + " - " + progress + "%");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error notifying progress: " + e.getMessage());
            }
        });
    }
    
    /**
     * Notify plugin of download completion
     */
    private void notifyPluginComplete(String downloadId, String filename, String filePath, String quality, double bitrate) {
        mainHandler.post(() -> {
            try {
                HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
                if (plugin != null) {
                    // Update the plugin's internal download state
                    plugin.updateDownloadComplete(downloadId, filePath, quality, bitrate);
                    
                    Log.d(TAG, "Notified plugin of completion: " + downloadId);
                }
                
                Toast.makeText(getApplicationContext(), "Download complete: " + filename, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Log.e(TAG, "Error notifying completion: " + e.getMessage());
            }
        });
    }
    
    /**
     * Notify plugin of download error
     */
    private void notifyPluginError(String downloadId, String filename, String error) {
        mainHandler.post(() -> {
            try {
                HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
                if (plugin != null) {
                    // Update the plugin's internal download state
                    plugin.updateDownloadError(downloadId, error);
                    
                    Log.d(TAG, "Notified plugin of error: " + downloadId);
                }
                
                Toast.makeText(getApplicationContext(), "Download failed: " + filename, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Log.e(TAG, "Error notifying error: " + e.getMessage());
            }
        });
    }
    
    /**
     * Notify plugin of download completion
     */
    private void notifyDownloadComplete(String downloadId, String filename, String filePath, String quality, double bitrate) {
        mainHandler.post(() -> {
            // Show toast notification
            Toast.makeText(getApplicationContext(), "Download complete: " + filename, Toast.LENGTH_SHORT).show();
        });
    }
    
    /**
     * Notify plugin of download error
     */
    private void notifyDownloadError(String downloadId, String filename, String error) {
        mainHandler.post(() -> {
            // Show toast notification
            Toast.makeText(getApplicationContext(), "Download failed: " + filename, Toast.LENGTH_SHORT).show();
        });
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null; // This is a started service, not bound
    }
    
    @Override
    public void onDestroy() {
        Log.d(TAG, "? DownloadService destroyed");
        activeTasks.clear();
        super.onDestroy();
    }
}
