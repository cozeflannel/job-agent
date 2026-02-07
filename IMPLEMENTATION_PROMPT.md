# Job-Agent AI — Full Feature Implementation Prompt for Claude Code

> **How to use:** Copy the entire prompt below (everything inside the `---` fences) and paste it into Claude Code as a single message. It references the exact file structure, types, and patterns of this codebase.

---

## Prompt

You are implementing a major feature expansion for **Job-Agent AI**, a Chrome browser extension that automates job applications using AI. The codebase is a React 19 + TypeScript + Vite Chrome extension with Tailwind CSS styling.

### Existing Architecture (DO NOT restructure — build on top of it)

```
Key Files:
- App.tsx                    → Main app, tab navigation (resume-hub | auto-fill | career-dev | config)
- background.ts              → Service worker: AI logic, message routing, all AI system instructions
- contentScript.ts           → Content script: DOM scanning, form field detection, field filling
- types.ts                   → All TypeScript interfaces (UserProfile, FormField, PageContext, etc.)
- utils/AIClient.ts          → AIClient interface (generateText, generateStructuredJSON)
- utils/domFunctions.ts      → DOM utility functions
- utils/FileHandler.ts       → PDF parsing with pdfjs-dist
- utils/RemoteLogger.ts      → Logging (currently points to localhost:3000)
- services/GeminiAdapter.ts  → Google Gemini AI adapter
- services/OpenAIAdapter.ts  → OpenAI GPT adapter
- services/AnthropicAdapter.ts → Anthropic Claude adapter
- components/ResumeHub.tsx   → Resume upload, parsing, profile management
- components/JobFiller.tsx   → Auto-fill orchestration UI
- components/OptimizedResumes.tsx → Job-specific resume optimization
- components/CareerDev.tsx   → Career development (coach + skills tabs)
- components/ChatInterface.tsx → AI chat interface
- components/SkillsDev.tsx   → Skills development tracker
- components/Settings.tsx    → API key and provider configuration
- components/ApplicationHistory.tsx → Application tracking
- public/manifest.json       → Chrome extension manifest (Manifest V3)
- package.json               → Dependencies: react 19, pdfjs-dist, @google/genai, openai, @anthropic-ai/sdk
```

```
Message Flow:
UI Component → chrome.runtime.sendMessage({ type: 'MESSAGE_TYPE', payload: {...} })
  → background.ts listener routes to handler function
  → handler calls getAIClient(profile) to get adapter
  → adapter.generateStructuredJSON({ systemInstruction, prompt, responseSchema })
  → response sent back via sendResponse()
```

```
Storage Pattern:
- chrome.storage.local for extension mode
- localStorage fallback for dev mode
- Profile saved under key 'jobAgentProfile'
- Optimized docs saved under key 'jobAgentOptimizedDocs'
```

```
Current Types (types.ts):
- UserProfile: { apiKey, selectedProvider, apiKeys, firstName, lastName, email, phone, linkedin, portfolio, dob, address, city, state, zip, citizenship, workCountry, veteranStatus, disabilityStatus, gender, race, sexualOrientation, resumeText, resumeFileName, resumeBlob, resumeMimeType, coverLetterText, applicationHistory }
- ApplicationEntry: { id, date, company, role, autofillTimeSeconds, estimatedManualTimeSeconds, status: 'applied' | 'failed' | 'in-progress' }
- FormField: { id, name, label, type, options?, value? }
- PageContext: { url, title, siteName?, pageText? }
- OptimizedDocument: { id, jobTitle, companyName, jobDescription, createdAt, optimizedResume, optimizedCoverLetter, isActive }
- LLMProvider: 'google' | 'openai' | 'anthropic'
- PersonaType: 'ARCHITECT' | 'STRATEGIST' | 'IDLE'
- ChatMessage: { id, sender, text, timestamp }
```

### KNOWN BUGS TO FIX FIRST

Before building new features, fix these issues:

1. **Hardcoded date in background.ts:57** — `new Date('2026-01-16')` in `calculateAge()`. Replace with `new Date()` so it always uses the current date.

2. **Hardcoded localhost in RemoteLogger.ts:2** — Points to `http://localhost:3000/log`. Make the logger a no-op in production (check `chrome.runtime` exists) and only log to console. Remove the remote HTTP endpoint entirely.

3. **Overly broad host_permissions in manifest.json** — Currently requests `http://*/*` and `https://*/*`. Restrict to only the domains actually needed:
   ```json
   "host_permissions": [
     "https://generativelanguage.googleapis.com/*",
     "https://api.openai.com/*",
     "https://api.anthropic.com/*"
   ]
   ```
   The content script already matches `<all_urls>` via `content_scripts`, so form filling still works everywhere.

4. **CSP includes localhost** — In manifest.json `content_security_policy`, remove `http://localhost:3000` from `connect-src`.

5. **API key detection by prefix in background.ts** — Multiple functions (handleResumeExtraction, handleResumeAudit, handleChat, etc.) use a `startsWith('sk-ant')` / `startsWith('sk-')` heuristic to pick the AI adapter. This is fragile. Refactor: pass the full `UserProfile` (or at minimum `selectedProvider` + the resolved API key) instead of just `apiKey` string. Update the `ExtensionMessage` type payloads and all call sites accordingly.

---

### PHASE 1: Career Health Score & Persistent Career Intelligence

**Goal:** Transform the app from an episodic job-search tool into an always-on career monitor. No competitor does this.

#### 1A. Career Health Score Engine

Create a new file `utils/CareerHealthEngine.ts`:

```typescript
export interface CareerHealthScore {
  overall: number;           // 0-100
  breakdown: {
    resumeQuality: number;   // 0-100 — grammar, formatting, quantified achievements
    marketAlignment: number;  // 0-100 — how well skills match current market demand
    applicationMomentum: number; // 0-100 — application frequency & response rate
    skillCurrency: number;   // 0-100 — are skills current or becoming outdated
  };
  insights: string[];        // 3-5 actionable insights
  trend: 'improving' | 'stable' | 'declining';
  lastCalculated: number;    // timestamp
}

export interface MarketSignal {
  id: string;
  type: 'opportunity' | 'trend' | 'warning';
  title: string;
  description: string;
  relevanceScore: number;   // 0-100
  detectedAt: number;
  acknowledged: boolean;
}
```

Add to `types.ts`:
```typescript
export interface CareerHealthData {
  score: CareerHealthScore | null;
  signals: MarketSignal[];
  skillTimeline: SkillSnapshot[];  // periodic snapshots of skill relevance
  weeklyDigest: WeeklyDigest[];
}

export interface SkillSnapshot {
  date: string;
  skills: { name: string; marketDemand: 'rising' | 'stable' | 'declining'; confidence: number }[];
}

export interface WeeklyDigest {
  weekOf: string;
  applicationsSubmitted: number;
  responsesReceived: number;
  responseRate: number;
  topInsight: string;
}
```

Add a new message type to `ExtensionMessage`:
```typescript
| { type: 'CALCULATE_CAREER_HEALTH'; payload: { profile: UserProfile } }
| { type: 'GET_MARKET_SIGNALS'; payload: { skills: string[]; jobTitle: string; apiKey: string; selectedProvider: LLMProvider } }
```

In `background.ts`, add a handler `handleCareerHealthCalculation` that:
1. Takes the user's resumeText, applicationHistory, and any stored optimized documents
2. Sends to AI with a system instruction asking it to score the resume on the 4 dimensions
3. Compares current application stats (last 30 days) to calculate momentum
4. Returns a `CareerHealthScore`

In `background.ts`, add a handler `handleMarketSignals` that:
1. Takes the user's top skills (extracted from resume) and desired job title
2. Asks AI to generate 3-5 market signals about those skills/role
3. Returns `MarketSignal[]`

#### 1B. Career Health Dashboard Component

Create `components/CareerHealthDashboard.tsx`:
- A card-based dashboard that shows:
  - **Overall score** as a large circular gauge (0-100) with color coding (red < 40, yellow 40-70, green > 70)
  - **4 sub-scores** as smaller horizontal bars with labels
  - **Trend indicator** (arrow up/down/flat with "improving"/"declining"/"stable")
  - **3-5 actionable insights** as a bulleted list below the scores
  - **Market signals** section — cards with type icon (opportunity/trend/warning), title, description, relevance badge
  - **"Refresh Score" button** that triggers recalculation
- Style consistently with existing Tailwind patterns (bg-white, rounded-lg, shadow-sm, border-gray-200)
- Store the score in chrome.storage.local under key `jobAgentCareerHealth`
- Auto-calculate on first visit if no score exists, then show "Last updated X ago"

#### 1C. Integrate into App.tsx

Add a new tab `"insights"` to the `MainTab` type. Add it to the navigation bar between "Career Dev" and "Config". Label it "Insights". Render `<CareerHealthDashboard>` when active.

---

### PHASE 2: Post-Rejection Intelligence & Application Analytics

**Goal:** Turn rejection data into actionable learning. No tool in the market does this well.

#### 2A. Enhanced Application Tracking

Update `ApplicationEntry` in `types.ts`:
```typescript
export interface ApplicationEntry {
  id: string;
  date: string;
  company: string;
  role: string;
  autofillTimeSeconds: number;
  estimatedManualTimeSeconds: number;
  status: 'applied' | 'failed' | 'in-progress' | 'interviewing' | 'rejected' | 'offer' | 'ghosted';
  resumeVersion: string;        // 'base' or optimized doc ID
  coverLetterUsed: boolean;
  jobDescription?: string;      // store the JD for later analysis
  rejectionStage?: 'resume-screen' | 'phone-screen' | 'technical' | 'final' | 'unknown';
  responseReceivedDate?: string;
  notes?: string;
  matchScore?: number;          // 0-100, the AI's pre-application fit assessment
  url?: string;                 // the application URL
}
```

#### 2B. Application Analytics Component

Create `components/ApplicationAnalytics.tsx`:
- **Conversion funnel visualization** — horizontal bar chart showing:
  - Total Applications → Responses → Interviews → Offers
  - With percentage drop-off at each stage
  - Use simple div-based bars with Tailwind (no charting library needed)
- **Response rate by resume version** — table showing base resume vs. each optimized version, with response rates
- **Pattern detection panel** — when the user has 10+ applications:
  - Add a message type `ANALYZE_APPLICATION_PATTERNS` to `ExtensionMessage`
  - Handler in `background.ts` sends full application history to AI
  - AI identifies patterns: "Companies in fintech respond 3x more to your profile" or "Your base resume has a 5% response rate vs. 18% for optimized versions"
  - Display as insight cards
- **Status update UI** — each application row should have a dropdown to update status (applied → interviewing → rejected/offer/ghosted)
- **Time-based grouping** — group by week, show weekly application count and response rate

#### 2C. Update ApplicationHistory.tsx

Refactor the existing `ApplicationHistory.tsx` to incorporate the analytics. Add a toggle at the top: "List View" | "Analytics View". List view shows the existing table (enhanced with new status options). Analytics view shows the `ApplicationAnalytics` component.

---

### PHASE 3: Pre-Application Match Scoring & Human Review Gate

**Goal:** Shift from "apply to everything" to "apply to the right things with confidence."

#### 3A. Match Score Calculator

Add a new message type:
```typescript
| { type: 'CALCULATE_MATCH_SCORE'; payload: { resumeText: string; jobDescription: string; apiKey: string; selectedProvider: LLMProvider } }
```

Handler `handleMatchScoreCalculation` in `background.ts`:
- System instruction that asks AI to score fit on 5 dimensions:
  1. **Skills match** (0-100): How many required skills does the candidate have?
  2. **Experience level** (0-100): Does seniority match?
  3. **Industry relevance** (0-100): Has the candidate worked in this industry/domain?
  4. **Education fit** (0-100): Do qualifications match requirements?
  5. **Cultural signals** (0-100): Do values/work-style indicators align?
- Returns overall score (weighted average) + dimension breakdown + honest assessment text
- Use structured JSON output schema

#### 3B. Match Score UI in JobFiller.tsx

Before the "Auto-Fill" button fires, add a **pre-flight check**:
1. When user clicks "Auto-Fill", first extract job details from page (existing `EXTRACT_JOB_DETAILS`)
2. Run match score calculation
3. Show a **Review Card** overlay with:
   - Match score (large number, color-coded)
   - 5-dimension breakdown bars
   - Honest assessment text ("Strong match in skills, but you lack 2 years of the requested experience in...")
   - **"Proceed with Auto-Fill"** button (green)
   - **"Skip — Not a Good Fit"** button (gray)
   - **"Optimize Resume First"** button (blue) — takes them to OptimizedResumes with the JD pre-filled
4. Store the match score on the ApplicationEntry when they proceed
5. If match score < 40, show a yellow warning: "This role may not be a strong fit. Consider optimizing your resume for this specific role before applying."

#### 3C. Pre-Fill Review Screen

After AI generates field values but BEFORE filling them into the page, show a review screen:
1. Table listing every field: Label | AI's Suggested Value | Edit button
2. User can inline-edit any value before it gets filled
3. "Fill All" button commits the values to the page
4. "Cancel" button aborts

This is the single most requested feature across all competing tools. Implement it as a modal/overlay inside the JobFiller component.

---

### PHASE 4: Proof-Based Applications (Evidence Layer)

**Goal:** Shift from unverifiable resume claims to provable evidence. Nobody in the space does this.

#### 4A. Evidence Portfolio Data Model

Add to `types.ts`:
```typescript
export interface EvidenceItem {
  id: string;
  type: 'github' | 'publication' | 'certification' | 'project' | 'testimonial' | 'custom';
  title: string;
  description: string;
  url?: string;
  dateAdded: number;
  linkedSkills: string[];     // skills this evidence supports
  verificationStatus: 'self-reported' | 'url-verified' | 'api-verified';
}

export interface EvidencePortfolio {
  items: EvidenceItem[];
  lastUpdated: number;
}
```

#### 4B. Evidence Hub Component

Create `components/EvidenceHub.tsx`:
- Rendered as a sub-tab within the "Resume Hub" tab (add sub-navigation: "Profile" | "Evidence")
- **Add Evidence form**: type selector dropdown, title, description, URL, skill tags
- **Evidence list**: cards showing each piece of evidence with type icon, title, linked skills
- **Auto-attach toggle**: when ON, the AI includes relevant evidence URLs in cover letter and open-ended application questions
- Store in chrome.storage.local under key `jobAgentEvidence`

#### 4C. Integrate Evidence into AI Prompts

Update `generateFormSystemInstruction` in `background.ts`:
- Add evidence items to the system instruction context
- When AI encounters a "Why are you qualified?" or behavioral question, it should reference specific evidence items with URLs
- When generating cover letters (in `generateOptimizationSystemInstruction`), include relevant evidence as "proof points"

---

### PHASE 5: Platform-Specific ATS Adapters

**Goal:** Dramatically improve form-filling reliability. The #1 technical complaint across all competitors.

#### 5A. ATS Adapter Architecture

Create `adapters/` directory with:

```
adapters/
├── ATSAdapter.ts           → Base interface
├── GreenhouseAdapter.ts    → Greenhouse-specific logic
├── LeverAdapter.ts         → Lever-specific logic
├── AshbyAdapter.ts         → Ashby-specific logic (extract from contentScript.ts)
├── WorkdayAdapter.ts       → Workday-specific logic
├── GenericAdapter.ts       → Fallback for unknown platforms
└── ATSDetector.ts          → URL/DOM-based platform detection
```

`ATSAdapter.ts` interface:
```typescript
export interface ATSAdapter {
  platform: string;
  detect(url: string, document: Document): boolean;
  scanFields(root: Document | ShadowRoot): FormField[];
  fillField(fieldId: string, value: any): boolean | Promise<boolean>;
  attachResume(resumeBlob: string, fileName: string, mimeType: string): boolean;
  getRetryConfig(): { maxAttempts: number; interval: number };
}
```

`ATSDetector.ts`:
```typescript
export const detectPlatform = (url: string): string => {
  if (url.includes('greenhouse.io') || url.includes('boards.greenhouse')) return 'greenhouse';
  if (url.includes('jobs.ashbyhq.com')) return 'ashby';
  if (url.includes('jobs.lever.co')) return 'lever';
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
  if (url.includes('linkedin.com/jobs')) return 'linkedin';
  if (url.includes('indeed.com')) return 'indeed';
  return 'generic';
};
```

#### 5B. Refactor contentScript.ts

The current `contentScript.ts` is 1117 lines with all logic inlined. Refactor:
1. Move platform-specific logic (Ashby location fill, Greenhouse combobox) into their respective adapters
2. `contentScript.ts` becomes a thin router:
   - Detect platform via `ATSDetector`
   - Delegate `scanFields`, `fillField`, `attachResume` to the appropriate adapter
   - Keep the message listener and MutationObserver as-is
3. Each adapter encapsulates its own retry logic, field detection quirks, and fill strategies

**IMPORTANT:** The content script must remain a single bundled file (no dynamic imports). Vite's build config already handles this. All adapter code gets bundled into the content script entry point.

#### 5C. Field Validation Layer

Before filling fields, add validation in `contentScript.ts`:
1. After AI returns field mappings, validate:
   - No required fields left empty
   - Email fields contain @ symbol
   - Phone fields contain only digits/dashes/parens/spaces
   - Select fields have a value that matches an available option
2. Return validation errors to the UI so the user can fix them in the review screen (Phase 3C)

---

### PHASE 6: Onboarding & Privacy

**Goal:** Critical for Chrome Web Store approval and user trust. The local-first architecture is a genuine differentiator — make it visible.

#### 6A. First-Launch Onboarding

Create `components/Onboarding.tsx`:
- A multi-step onboarding wizard shown only on first launch (check `chrome.storage.local` for `jobAgentOnboardingComplete`)
- **Step 1 — Welcome**: "Job-Agent AI helps you apply to jobs faster with AI. Your data never leaves your browser." Privacy badge. Continue button.
- **Step 2 — API Key Setup**: Explain that the user needs their own AI API key. Show provider selector + key input. Link to "How to get a free API key" for each provider. Skip button if they want to set up later.
- **Step 3 — Resume Upload**: Drag-and-drop resume upload. "We'll extract your info automatically." Skip button.
- **Step 4 — Ready**: "You're all set! Navigate to any job application and click Auto-Fill." Show the 4 main tabs with brief descriptions.
- Set `jobAgentOnboardingComplete: true` in storage after completion.

#### 6B. Privacy Controls

Add to `Settings.tsx`:
- **"Your Data" section** with:
  - "Export All Data" button — downloads all chrome.storage.local data as JSON
  - "Delete All Data" button (with confirmation dialog) — clears all stored data
  - "What We Store" expandable section explaining each data type
- **Privacy badge** in the header (small shield icon + "Local Only") that links to the data section

---

### PHASE 7: Testing Foundation

**Goal:** The project has zero tests. Add a foundation.

#### 7A. Setup

Add to `package.json` devDependencies:
```json
"vitest": "^3.0.0",
"@testing-library/react": "^16.0.0",
"@testing-library/jest-dom": "^6.0.0",
"jsdom": "^25.0.0"
```

Add script: `"test": "vitest run"`, `"test:watch": "vitest"`

Create `vite.config.test.ts` or add test config to existing `vite.config.ts`:
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./tests/setup.ts'],
}
```

Create `tests/setup.ts` that mocks `chrome.storage.local` and `chrome.runtime`.

#### 7B. Critical Path Tests

Create test files:

1. `tests/careerHealth.test.ts` — test CareerHealthScore calculation logic (the non-AI parts: score aggregation, trend calculation, weekly digest generation)
2. `tests/matchScore.test.ts` — test score normalization and threshold logic
3. `tests/atsDetector.test.ts` — test URL-based platform detection for all supported platforms
4. `tests/applicationAnalytics.test.ts` — test funnel calculation, response rate computation, grouping logic
5. `tests/fieldValidation.test.ts` — test the field validation layer (email format, phone format, required fields, select option matching)
6. `tests/evidencePortfolio.test.ts` — test evidence CRUD operations and storage

Focus on testing **pure logic functions** (not AI calls or DOM manipulation). Mock the AI client interface for any tests that touch AI-dependent code.

---

### IMPLEMENTATION ORDER

Execute in this exact order to minimize merge conflicts and build incrementally:

1. **Bug fixes** (hardcoded date, localhost logger, manifest permissions, CSP, API key heuristic)
2. **Phase 7A** (test setup) — so all subsequent work can be tested
3. **Phase 6A** (onboarding) — standalone component, no dependencies
4. **Phase 2A** (enhanced ApplicationEntry type) — types change, needed by later phases
5. **Phase 3A + 3B + 3C** (match scoring + review gate) — transforms the core auto-fill flow
6. **Phase 2B + 2C** (analytics) — builds on enhanced ApplicationEntry
7. **Phase 1A + 1B + 1C** (career health) — new tab, mostly independent
8. **Phase 4** (evidence portfolio) — new sub-tab in Resume Hub
9. **Phase 5** (ATS adapters) — refactors contentScript.ts, highest risk
10. **Phase 6B** (privacy controls) — small addition to Settings
11. **Phase 7B** (tests) — write tests after features are stable

### STYLE GUIDELINES

- Follow existing Tailwind patterns: `bg-white rounded-lg shadow-sm border border-gray-200 p-4`
- Buttons: primary = `bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700`, secondary = `bg-gray-100 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-200`
- Cards: `bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3`
- Section headers: `text-sm font-semibold text-gray-700 mb-2`
- Use existing `chrome.storage.local` pattern with `localStorage` dev fallback
- All new message types must be added to the `ExtensionMessage` union in `types.ts`
- All new AI handlers in `background.ts` must follow existing pattern: get adapter via `getAIClient(profile)`, call `generateStructuredJSON`, return response
- Keep the extension popup width constraint in mind — all UI must work in a ~400px wide side panel

### WHAT NOT TO DO

- Do NOT add any external charting libraries (no Chart.js, no D3, no Recharts). Build simple visualizations with Tailwind divs.
- Do NOT add a backend server or database. Everything stays in chrome.storage.local.
- Do NOT change the Vite build configuration entry points unless absolutely necessary for the adapter refactor.
- Do NOT add authentication or user accounts. The app is local-first by design.
- Do NOT add social features, sharing, or any network requests beyond the AI provider APIs.
- Do NOT refactor the AI adapter interface (AIClient). It works. Build on top of it.

---
