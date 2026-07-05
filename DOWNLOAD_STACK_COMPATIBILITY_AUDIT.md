# Download Stack Compatibility Audit Report

## Executive Summary
The Android download stack changes have introduced compatibility issues with the Electron platform. While Android works correctly, Electron has critical gaps in the API exposure layer and response format standardization.

---

## Platform Comparison Matrix

| Feature | Android (Capacitor) | Electron (Native) | Status |
|---------|-------------------|-------------------|---------|
| `getCapturedStreams()` | Returns array | Returns array | ? Compatible |
| `startDownload()` response | `{ success, downloadId }` | `{ success, filePath, downloadId, quality }` | ?? Inconsistent |
| `getDownloadsList()` return | Wrapped: `{ downloads: [...] }` | Direct array: `[...]` | ?? Inconsistent |
| `onDownloadsUpdated()` payload | `data?.downloads \|\| data` (tries both) | Direct array | ? Compatible |
| `openFile()` in preload | Not exposed | Handler exists but not exposed | ? Missing |
| Response wrapping | Capacitor plugin wraps responses | IPC returns direct values | ? Mismatch |

---

## Critical Issues

### Issue 1: openFile() Not Exposed in Electron Preload
**Severity**: HIGH  
**Impact**: Downloads page cannot open downloaded files on Electron

**Current State**:
- `fresh-migrated/electron/src/index.ts` has handler for 'open-file'
- `fresh-migrated/electron/src/preload.ts` does NOT have `openFile()` method
- `spa/src/lib/unified-download.ts` wrapper tries to call `api.openFile()`

**Evidence**:
```typescript
// preload.ts - MISSING:
// openFile: async (path: string) => { ... }

// index.ts - HAS handler:
ipcMain.handle('open-file', async (event, filePath: string) => { ... })

// unified-download.ts - EXPECTS it:
openFile: async (path: string) => { return { success: false }; },
```

**Fix Required**: Add `openFile()` to preload.ts downloadAPI object

---

### Issue 2: getDownloadsList() Response Format Inconsistency
**Severity**: HIGH  
**Impact**: Downloads page may not render correctly on Electron

**Android (Current)**:
```typescript
// HLSDownloaderPlugin returns:
{ downloads: [...] }

// Wrapper extracts:
return result?.downloads || result || [];
```

**Electron (Current)**:
```typescript
// index.ts returns:
getDownloadsList()  // Direct array: [...]

// But wrapper expects wrapping:
return result?.downloads || result || [];  // Works but relies on fallback
```

**Problem**: On Electron, `result?.downloads` is undefined, so it falls back to `result`. This works but is brittle and suggests format mismatch.

**Fix Required**: Standardize response format. Two options:
- Option A: Make Electron return `{ downloads: [...] }` to match Capacitor
- Option B: Detect platform and handle differently in wrapper

Recommend **Option A** for consistency.

---

### Issue 3: startDownload() Response Format Differs
**Severity**: MEDIUM  
**Impact**: May cause UI issues if response fields aren't checked safely

**Android**:
```typescript
// HLSDownloaderPlugin.startDownload() returns:
{
  success: true,
  downloadId: "dl-1234567890"
}
```

**Electron**:
```typescript
// index.ts returns:
{
  success: true,
  filePath: result.filePath,
  downloadId,
  quality: result.estimatedQuality
}
```

**Problem**: Different fields returned. Download button in `download-button.tsx` checks:
```typescript
result?.success  // Works for both
result?.error    // Works for both
```

But future code expecting `filePath` will fail on Android.

**Fix Required**: Standardize response format to include all relevant fields on both platforms.

---

## SPA Changes That May Break Electron

### 1. useToast() Hook Import
**File**: `spa/src/components/video/download-button.tsx`  
**Change**: Added `import { useToast } from '@/hooks/use-toast';`  
**Risk**: ? SAFE - Hook exists and works on both platforms

### 2. Unified Download Wrapper Logic
**File**: `spa/src/lib/unified-download.ts`  
**Critical Code**:
```typescript
// createCapacitorWrapper checks for Capacitor-specific response format
getDownloadsList: async () => {
  try {
    const result = await rawApi.getDownloadsList();
    // Tries to extract { downloads: [...] }
    return result?.downloads || result || [];
  }
}
```

**Issue**: Works on Capacitor (gets array from `result?.downloads`) but on Electron, `result` IS already the array, so fallback works but is not explicit.

**Risk**: ?? BRITTLE - Relies on fallback behavior

### 3. Download Progress Updates
**File**: `spa/src/pages/Downloads.tsx`  
**Change**: Listens to `onDownloadsUpdated` events  
**Risk**: ? SAFE - Both platforms send the event, though Android needed fixes

---

## Root Cause Analysis

The issue stems from **architectural difference**:

### Android (Capacitor Plugin)
1. Native plugin runs in Java
2. Returns to TypeScript via plugin bridge
3. Plugin must wrap responses in JS objects
4. Capacitor convention: `{ success: true, data: ... }`

### Electron (IPC)
1. Main process (Node.js) handles IPC
2. Returns directly to preload script
3. Preload exposes API to renderer
4. IPC is direct message passing

**Why SPA can't detect this**: The wrapper assumes one structure, but Electron's architecture naturally returns different formats.

---

## Remediation Steps (In Order)

### Step 1: Add openFile() to Electron Preload
**File**: `fresh-migrated/electron/src/preload.ts`

Add to `downloadAPI` object:
```typescript
openFile: async (path: string) => {
  try {
    return await ipcRenderer.invoke('open-file', path);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
},
```

### Step 2: Standardize getDownloadsList() Response in Electron
**File**: `fresh-migrated/electron/src/index.ts`

Change handler:
```typescript
ipcMain.handle('get-downloads-list', async () => {
  // Return wrapped format to match Capacitor
  return { downloads: getDownloadsList() };
});
```

### Step 3: Update Unified Wrapper for Consistency
**File**: `spa/src/lib/unified-download.ts`

No changes needed if Step 2 is applied (wrapper will work with both).

### Step 4: Standardize startDownload() Response
**File**: `fresh-migrated/electron/src/index.ts`

Update return object to include all fields:
```typescript
return {
  success: true,
  downloadId,
  filePath: result.filePath,
  quality: result.estimatedQuality,
  estimatedQuality: result.estimatedQuality,
  bitrateMbps: result.bitrateMbps
};
```

### Step 5: Test Electron Downloads
- Build Electron app
- Trigger download
- Verify progress updates
- Verify file open works
- Verify downloads list updates

### Step 6: Verify Android Still Works
- Install APK
- Run through full download flow
- Confirm no regressions

---

## Risk Assessment

| Issue | Risk | Impact | Mitigation |
|-------|------|--------|-----------|
| Missing openFile() | HIGH | Download complete, can't open file | Add preload method |
| Response format | MEDIUM | Brittle, may fail in edge cases | Standardize responses |
| startDownload() format | LOW | May cause future issues | Add all fields |

---

## Testing Checklist

### Android
- [ ] Play video
- [ ] Click download
- [ ] Toast appears ("Download started!")
- [ ] Navigate to Downloads page
- [ ] Progress updates 0% ? 100%
- [ ] Download completes
- [ ] File appears in file system

### Electron
- [ ] Play video
- [ ] Click download
- [ ] Save dialog appears
- [ ] Select save location
- [ ] Progress updates
- [ ] Download completes
- [ ] "Open file" button works
- [ ] File opens in correct application

### Both Platforms
- [ ] getCapturedStreams() works
- [ ] startDownload() returns correct fields
- [ ] onDownloadsUpdated() fires correctly
- [ ] Clear completed downloads works
- [ ] Remove download works
- [ ] No console errors

---

## Implementation Order

1. **Preload openFile()** - Trivial, 1 line of code
2. **Electron response wrapping** - Simple refactoring, 2-3 lines per handler
3. **Test both platforms** - Confirm no regressions
4. **Document in README** - Note platform differences for future developers

---

## Notes for Developer

- Don't overthink the response wrapping - it's just about format standardization
- The core logic works on both platforms; this is just API consistency
- Android works because Capacitor handles wrapping; Electron does it naturally differently
- Test Electron first since it's the native platform with less abstraction

