# DOWNLOAD FLOW - COMPLETE STEP-BY-STEP TRACE & DIAGNOSIS

## THE FLOW: Native ? JS ? Global List ? Download Button ? Plugin API

### Step 1: Native Intercepts Stream
**File**: `ReelViewWebViewClient.java`
**Method**: `shouldInterceptRequest()`

```java
// TRIGGER: HLS stream request (.m3u8 file)
if (lowerUrl.contains(".m3u8") || ...) {
    Log.d(TAG, "[HLS-CAPTURE] ??? CAPTURED HLS STREAM ???");
    // ? LOGS SHOW THIS WORKS (47 HLS-CAPTURE logs found)
    
    // THEN: Call JavaScript
    view.evaluateJavascript(
        "if (window.__reelviewStreamCapture) { " +
        "  window.__reelviewStreamCapture('" + escapedUrl + "'); " +
        "}",
        null
    );
}
```

**VERIFICATION**: ? Logs confirm stream is being intercepted
**POTENTIAL ISSUE**: `evaluateJavascript()` might fail silently

---

### Step 2: JavaScript Handler Defined
**File**: `spa/src/components/video/download-button.tsx`
**Location**: Module-level (SHOULD run on page load)

```typescript
(window as any).__reelviewCapturedStreams = (window as any).__reelviewCapturedStreams || [];

(window as any).__reelviewStreamCapture = async (url: string) => {
  console.log('[JS-STREAM-CAPTURE] Native intercepted stream:', url.substring(0, 100));
  
  const streams = (window as any).__reelviewCapturedStreams;
  if (!streams.includes(url)) {
    streams.unshift(url);
    console.log('[JS-STREAM-CAPTURE] ? Stored in global list, count:', streams.length);
  }
};
```

**POTENTIAL ISSUE #1**: This is inside a React component file
- ?? React component code might not execute until component mounts
- ?? The DownloadButton component might not mount before streams are captured
- ?? If component hasn't mounted, the handler isn't defined yet

**POTENTIAL ISSUE #2**: Global variable assignment
- ?? `(window as any).__reelviewCapturedStreams` created at component module level
- ?? But component might not render on home page (only on Watch page!)
- ?? So the handler is NEVER defined when streams are being captured

---

### Step 3: Streams Arrive at Download Button
**File**: `spa/src/components/video/download-button.tsx`
**Method**: `handleClick()`

```typescript
let streams = (window as any).__reelviewCapturedStreams || [];
console.log('[Download] Global streams count:', streams.length);
```

**PROBLEM FOUND**: 
- At this point, `__reelviewCapturedStreams` exists but is EMPTY
- Why? Because `__reelviewStreamCapture()` was never called
- Why? Because the JavaScript handler was never registered
- Why? Because the DownloadButton component wasn't mounted yet

---

## ROOT CAUSE ANALYSIS

### Where is the DownloadButton rendered?

Let me check:

**Option 1**: Home page (home.tsx / Home.tsx)
- If yes: Handler won't be registered, streams arrive before component mounts
- If no: It's only on Watch page

**Option 2**: Watch page (Watch.tsx)
- ? CONFIRMED - It's only on Watch page (in WatchHeader)

**PROBLEM**: 
- User navigates to Watch page
- ReelViewWebViewClient intercepts HLS streams DURING page load
- But DownloadButton hasn't mounted yet!
- So `__reelviewStreamCapture()` handler isn't defined
- Native call to `evaluateJavascript()` succeeds but handler doesn't exist
- Streams are never captured

---

## THE FIX

The handler MUST be defined GLOBALLY, NOT in a component!

Move from component module to **global application initialization** (before any routes load).

---

## VERIFICATION CHECKLIST

### Does this explain why:
1. ? HLS-CAPTURE logs show 47 intercepted streams?
   - YES: Native code IS intercepting them
2. ? [JS-STREAM-CAPTURE] logs are ZERO?
   - YES: Handler was never called because it wasn't defined
3. ? Download button gets zero streams?
   - YES: Global list is empty because handler never stored them
4. ? It says "No streams captured - play the video first"?
   - YES: `__reelviewCapturedStreams` is empty array
5. ? Downloads page doesn't populate?
   - YES: Because `startDownload()` never gets called with valid URL

---

## MULTIFACETED PROBLEMS IDENTIFIED

### Problem 1: Handler Not Defined At The Right Time
- Handler is defined in component module
- Component might not mount before streams arrive
- **FIX**: Define handler in app initialization, not component

### Problem 2: Native Timing Issue
- Native code tries to call JavaScript during page load
- JavaScript framework might not be fully initialized
- **FIX**: Add retry logic to native call

### Problem 3: No Error Feedback
- `evaluateJavascript()` call succeeds even if handler doesn't exist
- No console error when calling non-existent function
- **FIX**: Wrap in try-catch in JS, add logging

### Problem 4: Global List Not Persisting Across Navigation
- Global list is created in component
- If component unmounts, data might be lost
- **FIX**: Store in window object from app initialization

---

## SOLUTION STEPS

1. **Create global initialization file** that runs on app startup
   - Define `window.__reelviewCapturedStreams = []`
   - Define `window.__reelviewStreamCapture()` handler
   - Ensure this runs BEFORE any page loads

2. **Update download button** to read from global list
   - Just read `window.__reelviewCapturedStreams`
   - No need to call plugin API (that was causing PluginLoadException)

3. **Add error handling** to native code
   - Check if JavaScript engine is ready
   - Add timeout/retry for `evaluateJavascript()`

4. **Add logging verification**
   - Native: Log when `evaluateJavascript()` is called
   - JS: Log when handler is defined
   - JS: Log when handler is called
   - Download: Log when reading from global list

---

## WHERE TO FIX

### File 1: Create new app initialization
**Path**: `spa/src/lib/stream-capture-init.ts`
- Define global handler
- Initialize global list
- Add logging

### File 2: Update download button
**Path**: `spa/src/components/video/download-button.tsx`
- Remove component-level handler definition
- Just import the initialization
- Read from global list only

### File 3: Update native code
**Path**: `android/app/src/main/java/com/reelview/app/ReelViewWebViewClient.java`
- Add better error handling
- Add timeout for evaluateJavascript()

---

## PRIORITY FIXES (In Order)

1. **CRITICAL**: Move handler to app initialization (not component)
2. **IMPORTANT**: Add logging to verify handler is being called
3. **IMPORTANT**: Add error handling in native code
4. **NICE-TO-HAVE**: Add retry logic for late streams
