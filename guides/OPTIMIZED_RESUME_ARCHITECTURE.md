# Feature Architecture: Optimized Resume System

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          App.tsx                                 │
│  ┌───────────┬────────────────┬──────────────────────────────┐  │
│  │  Filler   │     Coach      │          Config              │  │
│  └───────────┴────────────────┴──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                        ┌───────────────────────────────────┐
                        │       Settings.tsx                │
                        │  ┌─────────────────────────────┐  │
                        │  │ Tabs:                       │  │
                        │  │ • API Key                   │  │
                        │  │ • Personal                  │  │
                        │  │ • Demographics              │  │
                        │  │ • Resume                    │  │
                        │  │ • Optimized Resume ★NEW★   │  │
                        │  └─────────────────────────────┘  │
                        └───────────────────────────────────┘
                                            │
                                            ▼
                        ┌───────────────────────────────────┐
                        │   OptimizedResumes.tsx ★NEW★     │
                        │                                   │
                        │  Features:                        │
                        │  • Document List                  │
                        │  • Create Modal                   │
                        │  • Preview Modal                  │
                        │  • Download Handler               │
                        │  • Replace Handler                │
                        │  • Delete Handler                 │
                        └───────────────────────────────────┘
```

## Data Flow

### Creating an Optimized Resume

```
User Input                    Frontend                  Background Service          AI
─────────                    ─────────                 ──────────────────         ───

1. Fill Form
   • Job Title      ────────▶
   • Company Name
   • Job Description
                           2. OptimizedResumes.tsx
                              Validates input
                              Shows loading state
                                              │
                                              │ chrome.runtime.sendMessage()
                                              │ type: 'OPTIMIZE_RESUME'
                                              ▼
                                        3. background.ts
                                           handleResumeOptimization()
                                                          │
                                                          │ API Call
                                                          ▼
                                                    4. Gemini 3 Flash
                                                       • Analyzes job desc
                                                       • Matches with resume
                                                       • Generates optimized
                                                       • Creates cover letter
                                                          │
                                                          │ JSON Response
                                                          ▼
                                        5. background.ts
                                           Returns structured data
                                              ▲
                                              │ sendResponse()
                                              │
                           6. OptimizedResumes.tsx
                              • Parses response
                              • Creates document
                              • Saves to storage
                              • Updates UI
                              ▼
7. Document List
   Shows new item
```

### Using an Optimized Resume for Autofill

```
User Action                  Storage                    JobFiller
───────────                  ───────                    ─────────

1. Click "Use for Autofill"
                    │
                    ▼
        2. OptimizedResumes.tsx
           • Marks doc as active
           • Updates profile.resumeText
           • Saves to chrome.storage
                    │
                    ▼
        3. chrome.storage.local
           {
             jobAgentProfile: {
               ...
               resumeText: "[optimized content]"
             }
           }
                    │
                    │ Profile loaded on mount
                    ▼
        4. JobFiller.tsx
           Uses profile.resumeText
           for form filling
```

## Storage Schema

### Chrome Storage Structure

```javascript
// chrome.storage.local
{
  // Existing profile data
  "jobAgentProfile": {
    "apiKey": "...",
    "firstName": "...",
    "resumeText": "...",  // ← Gets updated when replacing
    // ... other fields
  },
  
  // New optimized documents array
  "optimizedDocuments": [
    {
      "id": "1737138000000",
      "jobTitle": "Senior Software Engineer",
      "companyName": "Google",
      "jobDescription": "We are seeking...",
      "createdAt": 1737138000000,
      "optimizedResume": "John Doe\nSenior Software Engineer\n...",
      "optimizedCoverLetter": "Dear Hiring Manager,\n...",
      "isActive": true  // ← Only one can be true at a time
    },
    {
      "id": "1737137000000",
      "jobTitle": "Frontend Developer",
      "companyName": "Meta",
      "jobDescription": "Join our team...",
      "createdAt": 1737137000000,
      "optimizedResume": "...",
      "optimizedCoverLetter": "...",
      "isActive": false
    }
  ]
}
```

## Message Protocol

### OPTIMIZE_RESUME Message

```typescript
// Request
{
  type: 'OPTIMIZE_RESUME',
  payload: {
    originalResume: string,    // From profile.resumeText
    jobDescription: string,    // User input
    jobTitle: string,          // User input
    companyName: string,       // User input
    apiKey: string            // From profile.apiKey
  }
}

// Success Response
{
  success: true,
  data: string  // JSON string containing:
                // {
                //   optimizedResume: string,
                //   optimizedCoverLetter: string
                // }
}

// Error Response
{
  success: false,
  error: string  // Human-readable error message
}
```

## AI System Instructions

### Resume Optimization Rules
1. Keep all truthful information
2. Reorganize for relevance
3. Add keywords naturally
4. Quantify achievements
5. Use strong action verbs
6. Tailor professional summary
7. Highlight matching skills
8. De-emphasize irrelevant experiences
9. ATS-friendly formatting

### Cover Letter Rules
1. Concise (3-4 paragraphs)
2. Enthusiastic opening
3. Connect experiences to requirements
4. Professional yet personable
5. Reference specific job aspects
6. Show company research
7. Clear call-to-action

## File Dependency Graph

```
types.ts
   │
   ├──> App.tsx
   │
   ├──> Settings.tsx
   │      │
   │      └──> OptimizedResumes.tsx
   │             │
   │             └──> Uses chrome.runtime.sendMessage()
   │
   ├──> background.ts
   │      │
   │      └──> Handles OPTIMIZE_RESUME message
   │
   └──> JobFiller.tsx
          (No changes needed, uses profile.resumeText)
```

## UI/UX Flow

### Empty State
```
┌────────────────────────────────────────┐
│  Optimized Resumes            [+ New]  │
├────────────────────────────────────────┤
│                                        │
│              📄                        │
│                                        │
│    No optimized documents yet          │
│    Create your first job-specific      │
│         resume                         │
│                                        │
└────────────────────────────────────────┘
```

### With Documents
```
┌────────────────────────────────────────┐
│  Optimized Resumes            [+ New]  │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ Senior Software Engineer   [Active]│ │
│ │ Google                      [🗑️]   │ │
│ │ Jan 17, 2026                       │ │
│ │ [👁️ Preview] [📥 Download]         │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ Frontend Developer                 │ │
│ │ Meta                        [🗑️]   │ │
│ │ Jan 16, 2026                       │ │
│ │ [👁️ Preview] [📥 Download]         │ │
│ │ [🔄 Use for Autofill]              │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### Create Modal
```
┌──────────────────────────────────────────────┐
│  Create Optimized Resume             [✕]    │
├──────────────────────────────────────────────┤
│                                              │
│  Job Title:                                  │
│  [Senior Software Engineer              ]   │
│                                              │
│  Company Name:                               │
│  [Google                                ]   │
│                                              │
│  Job Description:                            │
│  ┌──────────────────────────────────────┐   │
│  │ We are seeking a talented...         │   │
│  │                                       │   │
│  │                                       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  💡 How it works:                            │
│  • AI analyzes job description               │
│  • Creates optimized resume                  │
│  • Generates custom cover letter             │
│                                              │
├──────────────────────────────────────────────┤
│              [Cancel]    [✨ Generate]       │
└──────────────────────────────────────────────┘
```

### Preview Modal
```
┌──────────────────────────────────────────────┐
│  Senior Software Engineer            [✕]    │
│  Google                                      │
├──────────────────────────────────────────────┤
│  [Resume]  [Cover Letter]                    │
├──────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐   │
│  │ JOHN DOE                             │   │
│  │ Senior Software Engineer             │   │
│  │                                       │   │
│  │ PROFESSIONAL SUMMARY                 │   │
│  │ Results-driven software engineer...   │   │
│  │                                       │   │
│  │ EXPERIENCE                           │   │
│  │ • Led team of 5 engineers...         │   │
│  │                                       │   │
│  └──────────────────────────────────────┘   │
├──────────────────────────────────────────────┤
│              [📥 Download TXT]               │
└──────────────────────────────────────────────┘
```

## Integration Benefits

### For Job Seekers
1. **Targeted Applications**: Each resume highlights most relevant experience
2. **ATS Optimization**: AI ensures resumes pass ATS filters
3. **Time Savings**: Automated optimization vs. manual tailoring
4. **Consistency**: Professional cover letters for every application
5. **Version Control**: Keep track of all customized resumes

### For the Extension
1. **Enhanced Value**: Major differentiating feature
2. **Improved Match Rates**: Better resumes = better autofill results
3. **User Retention**: Users return for each new application
4. **Data Insights**: Learn which optimizations work best
5. **Upsell Potential**: Foundation for premium features

## Performance Considerations

### API Usage
- 1 API call per generation
- ~2-3 seconds average response time
- Handles large job descriptions (up to ~4000 tokens)
- Graceful error handling for quota limits

### Storage
- Local storage only (no server calls)
- Minimal footprint (~5-10 KB per document)
- Instant load times
- Persists across sessions

### UI Performance
- Lazy loading of document content
- Efficient re-renders with React hooks
- No blocking operations
- Smooth modal transitions
