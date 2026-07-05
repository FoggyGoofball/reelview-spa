package com.reelview.app;

import android.util.Log;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

/**
 * OkHttp3 interceptor that captures HLS streams and authentication headers
 * BEFORE they reach the WebView. This catches cross-origin iframe streams.
 */
public class HLSNetworkInterceptor implements Interceptor {
    private static final String TAG = "HLSNetworkInterceptor";

    @Override
    public Response intercept(Chain chain) throws IOException {
        Request request = chain.request();
        String url = request.url().toString();

        // Capture HLS streams at network level
        if (isHLSStream(url)) {
            Log.d(TAG, "? HLS stream intercepted at network level: " + url.substring(0, Math.min(100, url.length())));
            
            // Extract ALL request headers (including authentication)
            Map<String, String> headers = new HashMap<>();
            for (String headerName : request.headers().names()) {
                String headerValue = request.headers().get(headerName);
                headers.put(headerName, headerValue);
                Log.d(TAG, "  Header: " + headerName + " = " + (headerValue != null && headerValue.length() > 100 
                    ? headerValue.substring(0, 100) + "..." 
                    : headerValue));
            }

            // Pass to plugin with headers BEFORE the request is made
            captureStreamWithHeaders(url, headers);
        }

        // Continue with the request
        Response response = chain.proceed(request);
        return response;
    }

    /**
     * Check if URL is an HLS stream
     */
    private boolean isHLSStream(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        
        return lowerUrl.contains(".m3u8") ||
               lowerUrl.contains("/hls/") ||
               lowerUrl.contains("/playlist") ||
               lowerUrl.contains("/manifest") ||
               lowerUrl.contains("/pl/") ||
               lowerUrl.contains("/master.") ||
               (lowerUrl.contains("stream") && lowerUrl.contains("m3u"));
    }

    /**
     * Capture stream with authentication headers
     */
    private void captureStreamWithHeaders(String url, Map<String, String> headers) {
        try {
            HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
            
            if (plugin != null) {
                // Store headers for this URL (CRITICAL for authenticated downloads)
                ReelViewWebViewClient.storeHeaders(url, headers);
                
                // Capture the stream
                plugin.captureStreamFromNative(url);
                
                Log.d(TAG, "? Stream captured with " + headers.size() + " auth headers");
            } else {
                Log.w(TAG, "? Plugin not available, queuing stream");
                PendingStreamCapture.queueStream(url);
                ReelViewWebViewClient.storeHeaders(url, headers);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error capturing stream: " + e.getMessage(), e);
        }
    }
}
