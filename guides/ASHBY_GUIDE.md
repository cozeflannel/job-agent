# Ashby Application Troubleshooting Guide

## The Problem
Your console logs show: `Total inputs on page: 0 (0 visible, 0 hidden)`

This means **the application form hasn't loaded yet** when the extension scans the page.

---

## ✅ Correct Workflow for Ashby

### Step 1: Navigate to Job Posting
Go to the Ashby job posting page (e.g., `jobs.ashbyhq.com/company-name/job-id`)

You'll see:
- Job title
- Job description
- "Apply for this job" button

**⚠️ DO NOT RUN THE EXTENSION YET** - You're not on the form yet!

### Step 2: Open the Application Form
Click the **"Apply for this job"** button

One of two things will happen:
- **Option A:** A modal/popup appears with the application form
- **Option B:** You're redirected to a new page with the application form

### Step 3: Wait for Form to Load
You should now see form fields like:
- First Name
- Last Name
- Email Address  
- Phone Number
- Resume Upload
- etc.

**✅ NOW you can run the extension!**

### Step 4: Run Auto-Fill
1. Open the extension side panel
2. Click **"Auto-Fill Application"**
3. You should see in the logs:
   ```
   🔍 Detected Ashby application - using extended retry strategy
   ✅ Found X fields on attempt 1
   ```

---

## 🔍 Enhanced Features (Latest Build)

### Ashby-Specific Detection
The extension now:
- ✅ **Detects Ashby URLs** automatically
- ✅ **Uses 8 retries** instead of 5 (Ashby forms load slowly)
- ✅ **Longer delays** between retries (1s, 2s, 3s, 4s, 5s, 6s, 7s, 8s)
- ✅ **Specific error messages** if form isn't detected

### What You'll See in Logs

**Success on Ashby:**
```
🔍 Detected Ashby application - using extended retry strategy
Scanning page DOM for inputs...
✅ Found 25 fields on attempt 1
✅ Verified 25 fields are stable
Sending to Gemini 3 for semantic reasoning...
```

**Failure (form not loaded):**
```
Scanning page DOM for inputs...
Retry 1/8 - waiting 1000ms for form to load...
Retry 2/8 - waiting 2000ms for form to load...
...
Retry 8/8 - waiting 8000ms for form to load...
❌ No form fields found. Are you on a job application page?
💡 For Ashby: Click the 'Apply for this job' button first to open the application form.
💡 Make sure the form modal is visible with fields like 'First Name', 'Email', etc.
```

---

## 🐛 Still Not Working?

### Debug Step 1: Manual Check
Open browser console (F12) and run:
```javascript
document.querySelectorAll('input, select, textarea').length
```

**If this returns 0:**
- The form genuinely hasn't loaded
- You're on the job description page, not the application page
- The modal might have closed

**If this returns > 0:**
- The form exists but might be in an iframe or shadow DOM
- Report this as a bug with the URL

### Debug Step 2: Check for Iframe
Run in console:
```javascript
document.querySelectorAll('iframe').length
```

**If this returns > 0:**
- Ashby might be loading the form in an iframe
- Current extension doesn't support iframes yet
- This would need a code fix

### Debug Step 3: Inspect the Modal
1. Click "Apply for this job"
2. Right-click on a form field (e.g., First Name input)
3. Select "Inspect"
4. Look at the HTML structure
5. Check if the input has an `id` or `name` attribute

### Debug Step 4: Share Debug Info
If still not working, share:
1. Full Ashby URL (the one with the application form)
2. Console output showing the `[ContentScript]` messages
3. Result of the manual checks above
4. Screenshot of the application form

---

## 📋 Known Ashby Behaviors

### Different Modal Types

**Type 1: In-Page Modal**
- Form renders in a modal overlay on the same page
- Extension should detect this ✅

**Type 2: New Page**
- Redirects to a new URL (e.g., `/application`)
- Extension should detect this ✅

**Type 3: Iframe**
- Form loads inside an `<iframe>`
- Extension **cannot** detect this yet ❌
- Needs code enhancement

### Common Ashby Form Fields
If you see these, the extension should work:
- ✅ First Name (text input)
- ✅ Last Name (text input)
- ✅ Email (email input)
- ✅ Phone (tel input)
- ✅ Resume (file input)
- ✅ Cover Letter (textarea)
- ✅ LinkedIn URL (text/url input)

---

## 💡 Pro Tips

### Tip 1: Wait Before Clicking
After clicking "Apply for this job", wait 1-2 seconds before running the extension. This gives React time to render all fields.

### Tip 2: Check the Console First
Before running auto-fill, open console and check:
```javascript
document.querySelectorAll('input:not([type="hidden"])').length
```
If this shows 0, wait a bit longer.

### Tip 3: Try Manual Refresh
If the form seems stuck:
1. Close the Ashby modal
2. Refresh the job posting page
3. Click "Apply for this job" again
4. Wait for form to fully load
5. Then run auto-fill

---

## 🔧 Technical Details

### Why Ashby is Harder Than Greenhouse

**Greenhouse:**
- Server-side rendered HTML
- Fields appear immediately in the DOM
- Fast detection (usually attempt 1)

**Ashby:**
- Fully React-based SPA
- Lazy loads form components
- Can take 2-3 seconds to render
- Needs aggressive retry strategy

### Current Strategy
```typescript
// Ashby detection
const isAshby = url.includes('ashby') || url.includes('jobs.ashbyhq.com');

// More retries for Ashby
const retries = isAshby ? 8 : 5;

// Longer delays for Ashby
const delay = isAshby ? attempt * 1000 : attempt * 500;
// Ashby: 1s, 2s, 3s, 4s, 5s, 6s, 7s, 8s
// Other: 500ms, 1s, 1.5s, 2s, 2.5s
```

This gives Ashby up to **36 seconds total** to load the form (1+2+3+4+5+6+7+8).

---

## 🎯 Next Steps

1. **Reload the extension** in Chrome (`chrome://extensions` → reload)
2. **Test on Ashby:**
   - Find any Ashby job posting
   - Click "Apply for this job"
   - Wait for form to fully appear
   - Run auto-fill
3. **Report results:**
   - Success? Great! 🎉
   - Still failing? Share the debug info above
