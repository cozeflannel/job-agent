# Quick Fix - Form Fields Not Found

## What I Just Fixed

### ✅ Added Retry Mechanism for Dynamic Forms
Greenhouse (and similar ATS platforms) load forms **dynamically** after the page loads. The extension was scanning too early and finding 0 fields.

**Solution**: The extension now retries up to 3 times with 1-second delays to catch fields after they load.

---

## How to Test

### Step 1: Reload Extension
```
1. chrome://extensions
2. Find "Job-Agent AI"
3. Click reload button
```

### Step 2: Navigate to Application Form
**IMPORTANT**: You need to be on the **actual application form**, not just the job listing page.

For Greenhouse jobs:
1. Go to the job listing (e.g., `https://job-boards.greenhouse.io/doordashusa/jobs/7536486`)
2. **Scroll down** and click the "Apply for this job" button
3. **Wait for the form to fully load** (you should see input fields for name, email, etc.)
4. **NOW** open the extension side panel

### Step 3: Click Auto-Fill
1. Open extension side panel
2. Click "Auto-Fill Application"
3. Watch the logs:

**Expected logs**:
```
[12:25:59 PM] Scanning page DOM for inputs...
[12:25:59 PM] Found 38 fields on attempt 1
[12:26:00 PM] Sending to Gemini 3 for semantic reasoning...
```

**If you see**:
```
❌ No form fields found. Are you on a job application page?
💡 Try scrolling down or clicking 'Apply' to load the form first.
```

Then you're not on the application form yet - click "Apply" first!

---

## About Profile Data Not Parsing

You mentioned "profile data is not being parsed from the resume". Let's test this separately:

### Test Resume Upload:
1. Go to Settings → Resume tab
2. Upload your PDF resume
3. **Check the console** for these logs:
   ```
   [FileHandler] Processing resume...
   [Background] EXTRACT_RESUME_DATA request received
   [Background] Extraction result: { firstName: "...", ... }
   ```

4. Go to Settings → Personal tab
5. **Are the fields filled?**
   - ✅ YES → Auto-save is working!
   - ❌ NO → Check if you have API quota left

### If Personal Fields Are Empty:

**Possible causes**:
1. **API Quota Exhausted** - Check console for "429" or "quota" errors
2. **API Key Invalid** - Check Settings → API Key
3. **Resume Format** - Try a different PDF (some PDFs don't parse well)

**To debug**:
1. Open DevTools (F12) on the extension page
2. Go to Settings → Resume
3. Upload resume
4. Watch console for errors

---

## Current Status

### ✅ What's Working:
- Content script loads correctly
- Form scanning works (finds 38 fields when on the right page)
- Retry mechanism added for dynamic forms
- Gender & Race are now dropdowns
- Auto-save after resume extraction

### ⚠️ What to Check:
1. **Are you on the application form page?** (not just the job listing)
2. **Do you have API quota left?** (check for 429 errors)
3. **Is your API key valid?** (check Settings)

---

## Next Steps

1. **Reload the extension**
2. **Go to a Greenhouse job** and click "Apply for this job"
3. **Wait for form to load** (you should see name/email fields)
4. **Open extension** and click "Auto-Fill Application"
5. **Share the console logs** if it still doesn't work

The logs should now show:
- `[JobFiller] Sending PROCESS_FORM_DATA request`
- `[JobFiller] Received response`
- `[JobFiller] AI Response`
- `[ContentScript] Filling field...`

If you don't see these, share what you DO see and we'll debug further!

---

## Pro Tip

For Greenhouse applications, the URL changes when you click "Apply":
- ❌ Before: `https://job-boards.greenhouse.io/company/jobs/123456`
- ✅ After: `https://job-boards.greenhouse.io/company/jobs/123456#app`

Notice the `#app` at the end? That means you're on the application form!
