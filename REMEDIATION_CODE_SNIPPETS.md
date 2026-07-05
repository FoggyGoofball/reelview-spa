# Remediation Code Snippets

## File 1: fresh-migrated/electron/src/preload.ts

### ADD to downloadAPI object (after openFile declaration or at end of object):

```typescript
  openFile: async (path: string) => {
    try {
      return await ipcRenderer.invoke('open-file', path);
    } catch (e: any) {
      console.error('[DOWNLOAD] openFile error:', e.message);
      return { success: false, error: e.message };
    }
  },
```

**Location**: Inside the `const downloadAPI = { ... }` object definition

---

## File 2: fresh-migrated/electron/src/index.ts

### MODIFY ipcMain.handle('get-downloads-list', ...) handler:

```typescript
ipcMain.handle('get-downloads-list', async () => {
  // Return wrapped format to match Capacitor plugin response
  return { downloads: getDownloadsList() };
});
```

**Current Code** (lines ~200-202):
```typescript
ipcMain.handle('get-downloads-list', async () => {
  return getDownloadsList();
});
```

**Change**: Wrap in `{ downloads: ... }` object

---

### OPTIONAL: Enhance startDownload() return value for consistency

**Current Return** (around line ~180):
```typescript
return { success: true, filePath: result.filePath, downloadId, quality: result.estimatedQuality };
```

**Enhanced Return**:
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

**Reason**: Include all estimated quality info for consistency with Android

---

## File 3: spa/src/lib/unified-download.ts

### NO CHANGES REQUIRED

The wrapper will work correctly once Electron returns `{ downloads: [...] }` format.

Current code:
```typescript
getDownloadsList: async () => {
  try {
    const result = await rawApi.getDownloadsList();
    // Capacitor returns { downloads: [...] }
    return result?.downloads || result || [];
  }
}
```

Will handle both:
- Capacitor: `result = { downloads: [...] }` ? extracts from `result?.downloads` ?
- Electron (after fix): `result = { downloads: [...] }` ? extracts from `result?.downloads` ?

---

## Verification Steps (Do NOT Apply Yet)

### Step 1: Verify Current Electron preload doesn't have openFile

```bash
grep -n "openFile" fresh-migrated/electron/src/preload.ts
# Should return: (no results)
```

### Step 2: Verify Electron index.ts has the handler

```bash
grep -n "open-file" fresh-migrated/electron/src/index.ts
# Should return: line number for ipcMain.handle('open-file', ...)
```

### Step 3: Check current getDownloadsList in Electron

```bash
grep -A2 "get-downloads-list" fresh-migrated/electron/src/index.ts
# Should show: return getDownloadsList();
```

---

## Testing After Applying Fixes

### Electron Test
```javascript
// In browser console after applying fixes
await window.electronDownload.getDownloadsList()
// Should return: { downloads: [...] }

await window.electronDownload.openFile('/some/path')
// Should return: { success: true } or { success: false, error: "..." }
```

### Android Test
```javascript
// In browser console after applying fixes
await window.Capacitor.Plugins.HLSDownloader.getDownloadsList()
// Should still return: { downloads: [...] }
```

---

## Summary

**Total Changes Required**: ~5 lines of code across 2 files

| File | Change Type | Lines | Complexity |
|------|-------------|-------|-----------|
| preload.ts | Add method | 6 | Trivial |
| index.ts | Modify response | 2 | Trivial |
| unified-download.ts | None | 0 | N/A |

**Risk Level**: VERY LOW - Simple format standardization
**Rollback Difficulty**: VERY EASY - Reverse the wrapping

