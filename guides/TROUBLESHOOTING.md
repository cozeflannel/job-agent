# Troubleshooting Guide

## Resume Optimization Not Working

### Symptoms
- Click "+ Create New" but fields don't auto-fill
- No logs in console from `[OptimizedResumes]`

### Diagnosis Steps

1. **Open DevTools Console** (F12)
2. **Navigate to a job posting** (LinkedIn, Ashby, Indeed, etc.)
3. **Open Extension** → Config → Optimized Resume
4. **Click "+ Create New"**
5. **Look for these logs:**
   ```
   [OptimizedResumes] Starting auto-detection...
   [OptimizedResumes] Querying active tab...
   [OptimizedResumes] Active tab: [URL]
   ```

### Common Issues

#### Issue 1: No logs appear at all
**Cause**: Extension context not available  
**Fix**: Make sure you're in the extension side panel, not a standalone page

#### Issue 2: "Extension context not available"
**Cause**: Running in dev mode instead of extension  
**Fix**: Load the extension properly in chrome://extensions

#### Issue 3: "No active tab found"
**Cause**: Tab query failing  
**Fix**: Make sure a tab is active and focused

#### Issue 4: "Timeout waiting for page content"
**Cause**: Content script not responding  
**Fix**: 
- Refresh the job posting page
- Reload the extension
- Try a different job posting site

#### Issue 5: "This doesn't look like a job posting"
**Cause**: AI couldn't identify job details  
**Fix**:
- Make sure you're on the actual job posting (not search results)
- Try scrolling to see full description
- Manually enter details using the form

### If Auto-Detection Fails

You can always **manually enter** the details:
1. Copy job title from page
2. Copy company name
3. Copy entire job description
4. Paste into modal
5. Click Generate

---

## Work Country Not Autofilling

### Why It Might Not Fill

The "work country" field might:
1. **Have a different label**: "Location preference", "Where do you want to work?", "Remote location"
2. **Be a dropdown**: Needs exact match to work
3. **Not be on the page**: Some Ashby forms don't ask this
4. **Be dynamically loaded**: Appears after other fields are filled

### How to Check

1. Look at the form manually
2. See if there's a "location" or "country" question
3. Check what the exact options are in the dropdown

### Manual Fix

If autofill doesn't fill it:
1. The field is there - just select manually
2. It takes 2 seconds
3. Everything else fills automatically

---

## For Better Results

### Before Opening Modal
1. Navigate to job posting page
2. Scroll to see full description
3. Make sure page is fully loaded
4. THEN click "+ Create New"

### During Auto-Detection
1. Don't switch tabs
2. Wait for green "✅ Detected" message
3. Review what was filled
4. Edit if needed

### If Something Fails
1. Click the "🔄 Retry" button
2. OR manually fill the fields
3. Still works perfectly!

---

## Console Log Guide

### Good Logs (Everything Working)
```
[OptimizedResumes] Starting auto-detection...
[OptimizedResumes] Querying active tab...
[OptimizedResumes] Active tab: https://jobs.ashbyhq.com/...
[OptimizedResumes] Requesting page context...
[OptimizedResumes] Page context response: {success: true, ...}
[OptimizedResumes] Page text length: 5234
[OptimizedResumes] Extracting job details with AI...
[OptimizedResumes] AI extraction response: {success: true, ...}
[OptimizedResumes] Extracted data: {jobTitle: "...", companyName: "...", ...}
[OptimizedResumes] Setting job title: Product Designer
[OptimizedResumes] Setting company name: Ashby
[OptimizedResumes] Setting job description length: 3421
```

### Bad Logs (Something Failed)
```
[OptimizedResumes] Starting auto-detection...
[OptimizedResumes] Error: Extension context not available
```

OR

```
[OptimizedResumes] Starting auto-detection...
[OptimizedResumes] Querying active tab...
[OptimizedResumes] Error: No active tab found
```

---

## Still Not Working?

1. **Reload the extension** in chrome://extensions
2. **Refresh the job posting page**
3. **Try a different job board** (LinkedIn, Indeed)
4. **Share your console logs** - I'll help debug

The feature works - we just need to identify where it's failing for you!
