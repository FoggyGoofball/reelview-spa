package com.reelview.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Message;
import android.util.Log;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.View;
import android.view.WindowManager;
import okhttp3.OkHttpClient;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // CRITICAL: Initialize HLS interceptor BEFORE Capacitor bridge loads
        // This ensures all HTTP requests are intercepted at network level
        initializeHttpInterceptor();
        
        // Register plugins BEFORE super.onCreate() - CRITICAL
        registerPlugin(HLSDownloaderPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        // Enable immersive fullscreen mode
        enableImmersiveMode();
        
        Log.d(TAG, "? MainActivity.onCreate() - Plugins registered, immersive mode enabled");
        
        // Register WebViewClient IMMEDIATELY in onCreate - CRITICAL for ad blocking
        // This MUST happen before any URLs are loaded
        registerWebViewClientNow();
        applyPopupJailingNow();
    }

    private void applyPopupJailingNow() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) return;

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setSupportMultipleWindows(false);

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    Log.w(TAG, "[AD-JAIL] Blocked popup window creation (onCreateWindow)");
                    return false;
                }
            });

            Log.d(TAG, "? Popup jailing configured (no JS popup windows, no multiple windows)");
        } catch (Exception e) {
            Log.e(TAG, "Error applying popup jailing: " + e.getMessage());
        }
    }
    
    /**
     * Initialize HTTP interceptor for HLS stream capture
     * This is called BEFORE the bridge loads to ensure all requests are intercepted
     */
    private void initializeHttpInterceptor() {
        try {
            OkHttpClient client = ReelViewHttpClientFactory.createClient(this);
            Log.d(TAG, "? HTTP interceptor initialized - will capture HLS streams at network level");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing HTTP interceptor: " + e.getMessage());
        }
    }
    
    private void registerWebViewClientNow() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null && getBridge() != null) {
                webView.setWebViewClient(new ReelViewWebViewClient(getBridge()));
                Log.d(TAG, "? ReelViewWebViewClient registered IMMEDIATELY in onCreate");
            } else {
                Log.w(TAG, "? WebView not ready in onCreate, will retry in onResume");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error registering WebViewClient in onCreate: " + e.getMessage());
        }
    }
    
    private void enableImmersiveMode() {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        );
        
        View decorView = getWindow().getDecorView();
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        
        decorView.setSystemUiVisibility(flags);
        Log.d(TAG, "? Immersive fullscreen mode flags applied");
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "? MainActivity.onResume()");
        
        enableImmersiveMode();
        
        // Re-register WebViewClient if not already done (fallback)
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null && getBridge() != null) {
                // Re-apply WebViewClient to ensure it's active
                webView.setWebViewClient(new ReelViewWebViewClient(getBridge()));
                applyPopupJailingNow();
                Log.d(TAG, "? ReelViewWebViewClient re-registered in onResume");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onResume WebViewClient setup: " + e.getMessage());
        }
    }
}
