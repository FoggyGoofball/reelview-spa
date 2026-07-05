package com.reelview.app;

import android.content.Context;
import android.util.Log;
import com.getcapacitor.Bridge;
import okhttp3.OkHttpClient;
import java.util.concurrent.TimeUnit;

/**
 * HTTP Client factory that injects HLS stream interceptor
 * This ensures ALL HTTP requests go through our interceptor
 */
public class ReelViewHttpClientFactory {
    private static final String TAG = "ReelViewHttpClientFactory";
    private static OkHttpClient customClient;

    /**
     * Create or get the configured OkHttpClient with HLS interceptor
     */
    public static OkHttpClient createClient(Context context) {
        if (customClient == null) {
            customClient = new OkHttpClient.Builder()
                .addNetworkInterceptor(new HLSNetworkInterceptor())
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
            
            Log.d(TAG, "? OkHttpClient created with HLSNetworkInterceptor");
        }
        return customClient;
    }

    /**
     * Get the configured client
     */
    public static OkHttpClient getClient() {
        return customClient;
    }
}
