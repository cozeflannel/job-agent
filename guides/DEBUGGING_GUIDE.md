# Debugging Guide - Form Filling Issues

## Issues Fixed

### ✅ 1. Resume Upload Not Auto-Filling Personal Info
**Problem**: When uploading a resume, extracted data wasn't persisting in the Settings form.

**Fix**: Added `onSave(updatedProfile)` after extraction to automatically save the profile.

**How to test**:
1. Go to Settings → Resume tab
2. Upload a PDF resume
3. Check Settings → Personal tab
4. Fields should now be auto-filled with extracted data ✅

---

### ✅ 2. Gender and Race as Text Inputs
**Problem**: Gender and Race were text inputs instead of dropdowns.

**Fix**: Converted to `<select>` dropdowns with proper options:

**Gender options**:
- Prefer not to say (default)
- Male
- Female
- Non-binary
- Other

**Race/Ethnicity options**:
- Prefer not to say (default)
- American Indian or Alaska Native
- Asian
- Black or African American
- Hispanic or Latino
- Native Hawaiian or Other Pacific Islander
- White
- Two or More Races

---

### ✅ 3. Form Filling Not Working - Enhanced Debugging
**Problem**: Form auto-fill silently failing with no error messages.

**Fix**: Added comprehensive console logging at every step:

**Where to look**:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for messages prefixed with:
   - `[JobFiller]` - Side panel operations
   - `[ContentScript]` - Page interaction
   - `Job-Agent:` - Field filling operations

---

## How to Debug Form Filling Issues

### Step 1: Reload the Extension
1. Go to `chrome://extensions`
2. Find "Job-Agent AI"
3. Click the **reload icon** (circular arrow)
4. This ensures you have the latest code with debug logging

### Step 2: Open DevTools on the Job Application Page
1. Navigate to a job application page (e.g., Greenhouse)
2. Press **F12** to open DevTools
3. Go to the **Console** tab
4. Look for: `[ContentScript] Initialized and listening for messages`
   - ✅ If you see this, content script is loaded
   - ❌ If not, the extension isn't injecting properly

### Step 3: Open the Extension Side Panel
1. Click the extension icon in Chrome toolbar
2. The side panel should open
3. Go to the **Console** tab in DevTools
4. You should see extension-related logs

### Step 4: Click "Auto-Fill Application"
Watch the console for this sequence:

**Expected Flow**:
```
[JobFiller] Sending PROCESS_FORM_DATA request
[JobFiller] Received response: { success: true, data: "..." }
[JobFiller] AI Response: [{ fieldId: "...", value: "..." }]
[JobFiller] Filling field first_name with value: John
[ContentScript] Received message: FILL_FIELD
[ContentScript] Filling field: first_name with value: John
Job-Agent: Filled field #first_name with value: John
[ContentScript] Fill result: true
[JobFiller] ✅ Filled: first_name
```

**Common Error Patterns**:

#### Error 1: API Quota Exceeded
```
[JobFiller] Background script error: ⚠️ API Quota Exceeded...
```
**Solution**: Wait 24 hours or upgrade API key (see `API_QUOTA_GUIDE.md`)

#### Error 2: No Response from Background Script
```
[JobFiller] Error: No response from background script
```
**Solution**: Reload the extension

#### Error 3: Content Script Not Loaded
```
// No [ContentScript] messages in console
```
**Solution**: 
1. Check `manifest.json` - ensure `content_scripts` is configured
2. Reload the extension
3. Refresh the job application page

#### Error 4: Fields Not Found
```
[ContentScript] Scanned page: { fieldsCount: 0 }
```
**Solution**: The page might not have loaded yet, or it uses a custom form system

---

## Testing Checklist

### Test 1: Resume Upload & Auto-Fill
- [ ] Upload resume in Settings → Resume
- [ ] See success message
- [ ] Check Settings → Personal - fields should be filled
- [ ] Check Settings → Demographics - dropdowns should work

### Test 2: Form Filling (with API quota)
- [ ] Go to a Greenhouse job application
- [ ] Open DevTools Console (F12)
- [ ] Click "Auto-Fill Application"
- [ ] See `[JobFiller]` and `[ContentScript]` logs
- [ ] Form fields should fill
- [ ] Resume should auto-upload

### Test 3: Form Filling (without API quota)
- [ ] If quota exceeded, you should see clear error message
- [ ] Resume auto-upload should still work
- [ ] Manual filling is still possible

---

## Console Log Reference

### JobFiller Logs (Side Panel)
| Log Message | Meaning |
|------------|---------|
| `Sending PROCESS_FORM_DATA request` | Sending fields to AI for analysis |
| `Received response: { success: true }` | AI analysis succeeded |
| `Received response: { success: false }` | AI analysis failed (check error) |
| `AI Response: [...]` | AI's field mappings |
| `Filling field X with value: Y` | Attempting to fill field |
| `✅ Filled: X` | Field filled successfully |
| `⚠️ Failed: X` | Field filling failed |
| `❌ Error: ...` | Critical error occurred |

### ContentScript Logs (Job Application Page)
| Log Message | Meaning |
|------------|---------|
| `Initialized and listening for messages` | Content script loaded |
| `Received message: GET_PAGE_CONTEXT` | Scanning page for fields |
| `Scanned page: { fieldsCount: X }` | Found X form fields |
| `Received message: FILL_FIELD` | Filling a field |
| `Fill result: true` | Field filled successfully |
| `Fill result: false` | Field not found or failed |
| `Received message: ATTACH_RESUME` | Uploading resume |
| `Resume attach result: true` | Resume uploaded |

---

## Still Not Working?

If you've tried all the above and it's still not working:

1. **Check the exact error message** in console
2. **Copy the console logs** and share them for debugging
3. **Verify your API key** is valid and has quota
4. **Try a different job application site** (Lever, Workday, etc.)
5. **Check if the page uses Shadow DOM** (some sites do)

---

## Quick Fixes

### Fix 1: Extension Not Responding
```bash
# In Chrome
1. chrome://extensions
2. Find "Job-Agent AI"
3. Click "Reload"
4. Refresh job application page
```

### Fix 2: Content Script Not Loading
Check `manifest.json`:
```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["contentScript.js"]
}]
```

### Fix 3: Clear Extension Data
```bash
# In Chrome DevTools (on extension page)
Application → Storage → Clear site data
```

---

**The extension now has comprehensive logging. Check the console to see exactly what's happening!** 🔍
