# Optimized Resume Feature Guide

## Overview
The Optimized Resume feature allows users to create job-specific tailored resumes and cover letters based on their original resume and a specific job description. This feature uses AI to analyze the job requirements and optimize the resume to highlight relevant skills and experiences.

## How to Access
1. Open the Job-Agent AI Chrome Extension
2. Click on the **Config** tab in the top navigation
3. Click on the **Optimized Resume** tab in the settings navigation

## Creating an Optimized Resume

### Step 1: Upload Your Base Resume
Before creating optimized resumes, ensure you have uploaded your base resume in the **Resume** tab of the Config section.

### Step 2: Click "Create New"
In the Optimized Resume section, click the "+ Create New" button.

### Step 3: Fill in Job Details
A modal will appear asking for:
- **Job Title**: e.g., "Senior Software Engineer"
- **Company Name**: e.g., "Google"
- **Job Description**: Paste the full job description from the job posting

### Step 4: Generate
Click the "✨ Generate" button. The AI will:
1. Analyze the job description for key skills and requirements
2. Match those requirements with your original resume
3. Create an optimized version highlighting relevant experience
4. Generate a custom cover letter for the specific role
5. Integrate missing skills from the job description where appropriate

## Managing Optimized Documents

### Viewing Your Documents
All created optimized resumes and cover letters are displayed in a list showing:
- Job Title
- Company Name
- Creation Date
- Active Status (if currently being used for autofill)

### Preview Documents
Click the "👁️ Preview" button to:
- View the optimized resume in a modal
- Switch between Resume and Cover Letter views
- Read the full content before downloading

### Download Documents
Click the "📥 Download" button to access download options:
- **Resume (TXT)**: Download the optimized resume as a text file
- **Cover Letter (TXT)**: Download the cover letter as a text file
- PDF and DOCX formats are planned for future releases

### Replace Active Resume
The **"🔄 Use for Autofill"** button allows you to:
- Set an optimized resume as the active resume
- This resume will be used for parsing personal information
- It will be used for autofilling job applications
- Only one resume can be active at a time
- The active resume is marked with a green "Active" badge

### Delete Documents
Click the trash icon (🗑️) to delete an optimized document. A confirmation dialog will appear before deletion.

## How the AI Optimization Works

### Resume Optimization
The AI performs the following optimizations:
1. **Keyword Integration**: Adds relevant keywords from the job description
2. **Experience Prioritization**: Emphasizes relevant experiences
3. **Skills Highlighting**: Showcases skills that match job requirements
4. **Metrics & Quantification**: Uses strong action verbs and quantifiable achievements
5. **ATS-Friendly Formatting**: Ensures clean, simple structure for ATS systems
6. **Professional Summary**: Tailors the summary to match the specific role

### Cover Letter Generation
The AI creates a professional cover letter that:
1. **Opens with Enthusiasm**: Expresses genuine interest in the role and company
2. **Connects Experience**: Links 2-3 key resume experiences to job requirements
3. **Shows Research**: References specific aspects of the company/role
4. **Professional Tone**: Maintains a personable yet professional voice
5. **Clear Call-to-Action**: Closes with desire to discuss further

## Best Practices

### For Best Results:
1. **Upload a Complete Base Resume**: Include all your experiences, skills, and achievements
2. **Paste Full Job Description**: Include the entire job posting for better analysis
3. **Review Before Using**: Always preview generated documents before using them
4. **Customize Further**: The AI creates a foundation - feel free to manually edit in the text area
5. **Create Multiple Versions**: Generate different versions for different types of roles

### Storage:
- All optimized documents are stored locally in your browser
- They persist across browser sessions
- They are not sent to external servers
- Export/backup using the download feature

## Troubleshooting

### "⚠️ Please add your API key in Settings"
- Navigate to the API Key tab and add your Gemini API key

### "⚠️ Please upload your resume in Settings first"
- Go to the Resume tab and upload your base resume

### Generation Fails or Takes Too Long
- Check your internet connection
- Verify your API key is valid
- Ensure the job description isn't too long (try summarizing if needed)
- Check if you've hit API quota limits

### Downloaded File Issues
- Currently only TXT format is supported
- PDF and DOCX support coming in future updates
- Use TXT downloads and copy to your preferred word processor

## Technical Details

### API Usage
- Uses Gemini 3 Flash Preview model
- Each generation counts as 1 API call
- Stored locally in Chrome storage
- No external server processing

### Data Privacy
- All processing happens locally or via your personal API key
- Job descriptions are sent to Gemini API for processing
- No data is stored on Job-Agent AI servers
- Your documents remain private

## Future Enhancements
- PDF export with professional formatting
- DOCX export for easy editing in Microsoft Word
- Batch generation for multiple jobs
- Template customization
- ATS score analysis for optimized resumes
- Side-by-side comparison with original resume
