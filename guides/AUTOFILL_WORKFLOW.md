# Job-Agent AI Auto-Fill Workflow

## 🎯 Purpose
This extension automatically fills out job application forms on sites like **Greenhouse** and **Ashby** using your saved profile and resume data.

---

## ✅ Correct Workflow (Simple!)

### Step 1: Setup (One-Time)
1. Open the extension side panel (click the extension icon)
2. Go to **Settings** tab
3. Enter your **Gemini API Key**
4. Upload your **resume PDF**
5. The AI will auto-extract contact info (you can edit if needed)
6. Save your profile

### Step 2: Apply to Jobs (Every Time)
1. **Navigate to a job application page** (e.g., Greenhouse, Ashby, or any job board)
2. Wait for the application form to fully load on the page
3. **Click the extension icon** to open the side panel
4. Click **"Auto-Fill Application"** button
5. **That's it!** The extension will:
   - Scan the page for form fields
   - Send them to Gemini AI to determine the best values from your profile
   - Fill all detected fields automatically
   - Attach your resume to the upload field (if present)

---

## 🚫 What You DON'T Need to Do

❌ **You do NOT need to scroll** through the entire form first
❌ **You do NOT need to click into specific fields** before running
❌ **You do NOT need to follow a specific order**

The extension is designed to work **immediately** when you click "Auto-Fill Application" on any job application page.

---

## 🔧 Recent Fixes

### Issue: "No form fields found" on Greenhouse/Ashby

**Root Cause:**
- The form detection logic was too strict with visibility checks
- React-based forms (Ashby/Greenhouse) use dynamic rendering, and the extension was filtering out valid fields
- The retry mechanism wasn't accounting for how these platforms render forms

**Solution Applied:**
1. **More Lenient Visibility Detection**
   - Changed from strict "hidden OR display:none" to require BOTH conditions
   - Added bounding box dimension checks to detect actually rendered elements
   - Removed parent visibility checks that were too aggressive

2. **Enhanced Label Detection**
   - Added support for `aria-labelledby` (common in Ashby/Greenhouse)
   - Improved React form group label detection
   - Better handling of placeholder text as fallback

3. **Better Debugging**
   - Added detailed console logging to show:
     - Total inputs found vs. hidden inputs
     - Fields detected after filtering
     - Sample of first 3 fields for inspection

---

## 🐛 Debugging Tips

If the extension still doesn't detect fields:

### Check Browser Console
1. Open Developer Tools (F12 or Cmd+Option+I)
2. Go to **Console** tab
3. Look for messages like:
   ```
   [ContentScript] Total inputs on page: 15 (12 visible, 3 hidden)
   [ContentScript] Fields after filtering: 12
   [ContentScript] Sample fields: [...]
   ```

### Common Issues

**Issue: "No form fields found"**
- **Cause:** Form hasn't loaded yet (dynamic React apps)
- **Solution:** Wait 1-2 seconds, then try again. The extension has automatic retry logic built-in.

**Issue: Some fields aren't filled**
- **Cause:** AI couldn't determine the right value from your profile
- **Solution:** Check console for specific field errors. You may need to add missing info to your profile.

**Issue: Resume not attaching**
- **Cause:** No file input detected, or the input doesn't match "resume" keywords
- **Solution:** Manually upload after auto-fill runs. The extension uses smart heuristics but may not catch every upload field.

---

## 🔄 Version History

### v3.0 (Current - January 2026)
- **Fixed:** Form detection on Ashby and Greenhouse
- **Enhanced:** Visibility detection for React forms
- **Added:** aria-labelledby support
- **Improved:** Debugging and logging

### Previous Issues
- Extension worked on Greenhouse but not Ashby
- Then worked on Ashby but not Greenhouse
- Finally stopped working on both due to overly strict visibility filters

---

## 📋 Supported Platforms

✅ **Fully Tested:**
- Greenhouse.io
- Ashby
- Lever
- Workday (basic support)

✅ **Should Work:**
- Any standard HTML form with `<input>`, `<select>`, `<textarea>`
- React-based job applications
- LinkedIn Easy Apply
- Indeed

⚠️ **Limited Support:**
- Custom iframes (may not detect fields inside iframes)
- Multi-step forms (run auto-fill on each step)

---

## 🛠️ Technical Details

### How Form Detection Works

1. **Query all form elements:** `input, select, textarea`
2. **Filter out hidden fields:** `type="hidden"` only
3. **Check visibility:**
   - Requires BOTH `display:none` AND `visibility:hidden` to filter out
   - Checks bounding box dimensions (0x0 = likely hidden)
4. **Extract labels:**
   - Standard `<label for="id">`
   - `aria-labelledby` reference
   - Parent `<label>` wrapping
   - `aria-label` attribute
   - `placeholder` text
   - Nearby label elements in form groups
5. **Return structured data** to AI for semantic matching

### How Form Filling Works

1. **Scan:** Content script extracts all fields + context
2. **Analyze:** Background script sends to Gemini 3 Flash with your profile
3. **Match:** AI returns { fieldId, value, reasoning } for each field
4. **Fill:** Content script injects values using React-compatible event dispatching
5. **Upload:** Content script finds resume field and attaches your PDF

---

## 📞 Still Having Issues?

If you're still experiencing problems:

1. **Reload the extension:**
   - Go to `chrome://extensions`
   - Find "Job-Agent AI"
   - Click the reload icon

2. **Check your API key:**
   - Make sure your Gemini API key is valid
   - Free tier allows 20 requests/day

3. **Inspect the page:**
   - Open browser console and look for `[ContentScript]` messages
   - Share the console output for debugging

4. **Try a simple test:**
   - Visit a basic contact form (e.g., Google Forms)
   - See if auto-fill detects those fields
   - This helps isolate whether it's a platform-specific issue
