# Testing Guide: Auto-Fill on Greenhouse & Ashby

## Quick Test Checklist

### Before Testing
- [ ] Extension rebuilt with latest changes (run `npm run build`)
- [ ] Extension reloaded in Chrome (`chrome://extensions` → reload)
- [ ] Profile configured with API key and resume uploaded
- [ ] Browser console open (F12) to view logs

---

## Test 1: Greenhouse Job Application

### Sample URL
Find any Greenhouse job posting (commonly used by tech companies)

**Example:** Search "greenhouse.io jobs" on Google

### Expected Behavior
1. Navigate to application page
2. Open extension side panel
3. Click "Auto-Fill Application"
4. Console should show:
   ```
   [ContentScript] Total inputs on page: X (Y visible, Z hidden)
   [ContentScript] Fields after filtering: Y
   [ContentScript] Sample fields: [...]
   ```
5. Extension should:
   - Detect fields (First Name, Last Name, Email, Phone, etc.)
   - Fill text inputs
   - Handle combobox dropdowns (role="combobox")
   - Attach resume if upload field exists

### ✅ Success Criteria
- At least 5+ fields detected
- Text fields populated with correct values
- No "No form fields found" error

---

## Test 2: Ashby Job Application

### Sample URL  
Find any Ashby job posting (used by many startups)

**Example:** Search "ashby careers" on Google

### Expected Behavior
1. Navigate to application page
2. Wait 1-2 seconds for React to render (Ashby is fully React-based)
3. Open extension side panel
4. Click "Auto-Fill Application"
5. Console should show discovered fields
6. Extension should fill all standard inputs

### ✅ Success Criteria
- Fields detected successfully
- Standard inputs filled (text, email, phone)
- No errors in console related to field visibility

---

## Test 3: Generic Form (Control Test)

### Sample URL
Use a simple online form builder

**Example:** https://forms.gle/ (Google Forms)

### Expected Behavior
1. Should detect all input fields
2. Should fill fields that match profile data
3. Should skip fields that don't have matching data

### ✅ Success Criteria
- Proves extension works on standard HTML forms
- Helps isolate platform-specific issues

---

## Debugging Failed Tests

### Issue: Still seeing "No form fields found"

**Step 1: Check Console**
```
[ContentScript] Total inputs on page: 0
```
→ Form hasn't loaded. Wait and retry.

```
[ContentScript] Total inputs on page: 15 (12 visible, 3 hidden)
[ContentScript] Fields after filtering: 0
```
→ All fields filtered out. Need to debug visibility logic further.

**Step 2: Manual Inspection**
Open console and run:
```javascript
document.querySelectorAll('input, select, textarea').length
```

If this returns > 0 but extension finds 0, there's a filtering issue.

**Step 3: Check Field Attributes**
Run in console:
```javascript
document.querySelectorAll('input:not([type="hidden"])').forEach(el => {
  const style = window.getComputedStyle(el);
  console.log(el.id || el.name, {
    display: style.display,
    visibility: style.visibility,
    rect: el.getBoundingClientRect()
  });
});
```

This shows exactly which fields exist and their visibility state.

---

## Expected Console Output (Success)

```
[ContentScript] Initialized and listening for messages
[ContentScript] Received message: GET_PAGE_CONTEXT
[ContentScript] Total inputs on page: 18 (15 visible, 3 hidden)
[ContentScript] Fields after filtering: 15
[ContentScript] Sample fields: [
  { id: 'first_name', label: 'First Name *', type: 'text' },
  { id: 'last_name', label: 'Last Name *', type: 'text' },
  { id: 'email', label: 'Email Address *', type: 'email' }
]
[ContentScript] Scanned page: { context: {...}, fieldsCount: 15 }
[JobFiller] Sending PROCESS_FORM_DATA request
[JobFiller] Received response: { success: true, data: '[...]' }
[JobFiller] AI Response: [15 field mappings]
[ContentScript] Filling field: first_name with value: John
[Job-Agent] Filled field #first_name with value: John
[ContentScript] Filling field: last_name with value: Doe
[Job-Agent] Filled field #last_name with value: Doe
...
```

---

## Known Limitations

### What Works
✅ Standard HTML inputs (text, email, tel, number)
✅ Select dropdowns
✅ Textareas
✅ Checkboxes and radio buttons
✅ React-based forms (Ashby, Greenhouse)
✅ Auto-resume upload detection

### What Might Not Work
❌ Custom autocomplete components (some edge cases)
❌ Multi-step wizards (need to run on each step)
❌ Forms inside iframes
❌ JavaScript-disabled environments

---

## Report Issues

If tests fail, collect:
1. URL of the job application
2. Full console output (copy all `[ContentScript]` and `[JobFiller]` messages)
3. Screenshot of the form
4. Extension version (check manifest.json or sidebar footer)
