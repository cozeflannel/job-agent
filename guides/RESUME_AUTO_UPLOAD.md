# Resume Auto-Upload Feature

## Overview
The Job-Agent AI extension now automatically uploads your resume to job application forms. The resume is stored as a **base64-encoded PDF blob** in your profile, preserving the original file format for maximum compatibility with Applicant Tracking Systems (ATS).

## How It Works

### 1. **Resume Storage**
When you upload a resume in the Settings tab:
- The PDF is converted to **base64** encoding and stored in `profile.resumeBlob`
- The MIME type (e.g., `application/pdf`) is stored in `profile.resumeMimeType`
- The extracted text is stored in `profile.resumeText` for AI analysis
- The filename is stored in `profile.resumeFileName`

### 2. **Auto-Upload Process**
When you click "Auto-Fill Application":
1. The extension scans the page for form fields
2. AI fills in all detected fields with your profile data
3. **Automatically detects resume upload fields** using intelligent scoring
4. **Converts the base64 blob back to a File object**
5. **Attaches the PDF to the file input** using DataTransfer API
6. Triggers change events to update the UI

### 3. **Resume Field Detection**
The extension uses a sophisticated scoring system to find the correct resume upload field:

**Positive Indicators (+points):**
- Accept attribute includes `.pdf` or `.doc` (+15 points)
- ID/name/label contains "resume", "cv", "curriculum vitae" (+10 points each)
- Parent element text mentions resume (+10 points)
- On ATS platforms (Greenhouse, Lever, Workday, Ashby), first file input gets bonus (+5 points)

**Negative Indicators (-100 points):**
- Field mentions "cover letter", "portfolio", "transcript", "photo", etc.

## Code Changes

### Updated Files

#### 1. `types.ts`
Added new fields to `UserProfile`:
```typescript
resumeBlob?: string;        // Base64-encoded PDF
resumeMimeType?: string;    // e.g., 'application/pdf'
```

Updated `ExtensionMessage` type:
```typescript
| { type: 'ATTACH_RESUME'; payload: { resumeBlob: string, fileName: string, mimeType?: string } }
```

#### 2. `utils/FileHandler.ts`
Enhanced `handleUpload()` to return blob data:
```typescript
static async handleUpload(file: File, apiKey: string): Promise<{
  text: string,
  blob: string,        // NEW: Base64 blob
  mimeType: string,    // NEW: MIME type
  extractionResult?: Partial<UserProfile>,
  auditResult?: any
}>
```

Added `fileToBase64()` helper method to convert File to base64 string.

#### 3. `components/Settings.tsx`
Updated `handleFileChange()` to store blob data:
```typescript
const updatedProfile = { 
  ...formData, 
  resumeText: result.text,
  resumeFileName: file.name,
  resumeBlob: result.blob,        // NEW
  resumeMimeType: result.mimeType  // NEW
};
```

#### 4. `contentScript.ts`
**Enhanced `findResumeUploadField()`:**
- Added accept attribute checking
- Added data-testid attribute checking
- Added grandparent element text checking
- Added ATS platform detection bonus
- Expanded keyword lists

**Updated `injectResumeFile()`:**
```typescript
const injectResumeFile = (resumeBlob: string, fileName: string, mimeType: string = 'application/pdf'): boolean => {
  // Convert base64 → binary → File object
  const byteCharacters = atob(resumeBlob);
  const byteArray = new Uint8Array(byteNumbers);
  const file = new File([byteArray], fileName, { type: mimeType });
  
  // Attach to input using DataTransfer
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  
  // Trigger events
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
```

#### 5. `components/JobFiller.tsx`
Updated auto-upload logic:
```typescript
if (profile.resumeBlob) {
  const response = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'ATTACH_RESUME',
    payload: {
      resumeBlob: profile.resumeBlob,
      fileName: profile.resumeFileName || 'Resume.pdf',
      mimeType: profile.resumeMimeType || 'application/pdf'
    }
  });
}
```

## Usage Instructions

### For Users:
1. **Upload your resume** in Settings → Resume tab
2. Navigate to a job application page
3. Click **"Auto-Fill Application"**
4. Watch the logs - you'll see:
   - ✅ Resume automatically attached for review
   - OR ⚠️ Could not detect a valid 'Resume' upload field

### Supported Platforms:
- ✅ Greenhouse
- ✅ Lever
- ✅ Workday
- ✅ Ashby
- ✅ Most standard HTML forms with file inputs

### Troubleshooting:
If the resume doesn't auto-upload:
1. Check that you've uploaded a resume in Settings
2. Verify the page has a file input field
3. Check the console logs for "Job-Agent: No resume file input found"
4. Some sites may use custom upload widgets that aren't standard `<input type="file">` elements

## Technical Details

### Why Base64?
- **Persistence**: Chrome extension storage works best with strings
- **Portability**: Easy to pass between content scripts and background workers
- **Format Preservation**: Maintains the exact PDF structure, unlike text extraction

### Security Considerations:
- Resume data is stored **locally only** (Chrome storage API)
- Never sent to external servers
- Only injected into file inputs on job application pages

### Browser Compatibility:
- Chrome/Edge: ✅ Full support
- Firefox: ⚠️ Requires Manifest V3 adaptation
- Safari: ⚠️ Limited extension API support

## Future Enhancements
- [ ] Support for multiple resume versions (tailored per job)
- [ ] Automatic resume optimization before upload
- [ ] Cover letter auto-upload
- [ ] Support for custom upload widgets (drag-drop zones)
- [ ] Fallback to manual upload prompt if auto-detection fails
