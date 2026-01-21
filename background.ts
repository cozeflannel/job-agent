import { UserProfile, FormField, PageContext, ChatMessage, PersonaType } from './types';
import { AIClient, AICompletionRequest } from './utils/AIClient';
import { GeminiAdapter } from './services/GeminiAdapter';
import { OpenAIAdapter } from './services/OpenAIAdapter';
import { AnthropicAdapter } from './services/AnthropicAdapter';

declare var chrome: any;

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime;

// Mock Type enum to maintain compatibility with existing logical flow without full dependency
const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT"
};

// --- Factory ---
const getAIClient = (profile: UserProfile): AIClient => {
  const provider = profile.selectedProvider || 'google';

  // Backward compatibility: use old apiKey if google logic is active and specific key missing
  let apiKey = '';

  if (provider === 'google') {
    apiKey = profile.apiKeys?.google || profile.apiKey;
  } else if (provider === 'openai') {
    apiKey = profile.apiKeys?.openai || '';
  } else if (provider === 'anthropic') {
    apiKey = profile.apiKeys?.anthropic || '';
  }

  if (!apiKey) {
    throw new Error(`⚠️ Missing API Key for provider: ${provider}. Please check your Settings.`);
  }

  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(apiKey);
    case 'anthropic':
      return new AnthropicAdapter(apiKey);
    case 'google':
    default:
      return new GeminiAdapter(apiKey); // Default to Gemini
  }
};

// --- Logic Engine (2026 Standards) ---

const calculateAge = (dob: string): number => {
  if (!dob) return 30;
  const birthDate = new Date(dob);
  const today = new Date('2026-01-16');
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// --- Form Filling System Instructions ---
const generateFormSystemInstruction = (profile: UserProfile, context: PageContext): string => {
  const age = calculateAge(profile.dob);
  return `
    You are Job-Agent AI, a sophisticated autonomous agent filling job applications in 2026.
    Current Context: Date: Jan 16, 2026. User Age: ${age}. Site: ${context.siteName || context.title}.
    Profile: ${JSON.stringify(profile)}
    Rules:
    1. Map age ${age} to brackets.
    2. Check 'resumeText' for ${context.siteName} to answer "worked here before?".
    3. Use semantic matching for demographics.
    4. Legal: Citizenship "${profile.citizenship}". Work Country: "${profile.workCountry}".
    5. For "country to work from" or "location preference" questions, use workCountry: "${profile.workCountry}".
    6. IMPORTANT: If a field is labeled "Location" (and is not a full address), prefer "${profile.city}, ${profile.state}, ${profile.workCountry}" or just "${profile.city}, ${profile.state}".
    7. STAR: Generate 3-5 sentence narratives from resume for behavioral qs.
  `;
};

// --- Data Extraction System Instructions ---
const generateExtractionSystemInstruction = (): string => {
  return `
    You are a Data Extraction Specialist for a Resume Parsing System.
    Task: Extract key personal profile information from the provided resume text.
    
    Rules:
    1. Extract 'firstName', 'lastName', 'email', 'phone', 'portfolio', 'linkedin', 'address', 'city', 'state', 'zip'.
    2. If a field is missing, return null. DO NOT invent placeholders.
    3. EMAIL: Look closely for email addresses (containing '@'). Common patterns: header, sidebar, or top contact info.
    4. LINKEDIN: Look for 'linkedin.com/in/...' or similar. If found, return the FULL URL.
    5. Split full name into first and last name.
    6. Prioritize the header and contact sections of the resume.
  `;
};

// --- Resume Audit & Gamification System Instructions ---
const generateAuditSystemInstruction = (previousObjective?: string): string => {
  return `
    You are the "Game Master" of Job-Agent AI. Your goal is to level up the candidate.
    
    Analyze the provided RESUME TEXT.
    ${previousObjective ? `USER CONTEXT: The user is re-uploading after trying to solve: "${previousObjective}". Acknowledge if they succeeded.` : ''}

    DETERMINE PERSONA & OBJECTIVE:

    LEVEL 1: "THE RESUME ARCHITECT"
    - Trigger: Resume has spelling errors, inconsistencies, bad formatting, or passive voice.
    - Tone: Instructional, strict but encouraging.
    - Goal: "Achieve Structural Perfection".
    - First Message: "I've detected [X] errors. We cannot proceed to strategy until these are fixed."

    LEVEL 2: "THE CAREER STRATEGIST"
    - Trigger: Resume is clean, professional, metric-heavy.
    - Tone: Visionary, analytical.
    - Goal: "Optimize for [Industry/Role] & Close Skill Gaps".
    - First Message: "Your foundation is solid. Let's align this with the market."

    OUTPUT JSON ONLY:
    {
      "persona": "ARCHITECT" | "STRATEGIST",
      "objective": "Short, punchy goal (e.g., 'Fix 3 Formatting Errors')",
      "analysis": "Internal logic summary.",
      "firstMessage": "The response to the user. If re-uploading, explicitly reference their improvements."
    }
  `;
};

// --- Chat System Instructions ---
const generateChatSystemInstruction = (persona: PersonaType, objective: string, resumeText: string, context: PageContext): string => {
  const base = `You are the ${persona === 'ARCHITECT' ? 'RESUME ARCHITECT' : 'CAREER STRATEGIST'}.
  Current Objective: "${objective}".
  
  USER RESUME:
  "${resumeText.substring(0, 4000)}..."
  
  CURRENT BROWSER PAGE CONTEXT:
  Title: ${context.title}
  Content Snippet: "${context.pageText?.substring(0, 1000) || 'No page content available.'}"
  `;

  if (persona === 'ARCHITECT') {
    return `${base}
    ROLE: You are a strict Resume Coach.
    TONE: Direct, precise, no-nonsense.
    DIRECTIVE:
    1. Ignore the job description for now. Focus ONLY on the resume document.
    2. Point out passive voice ("Responsible for..."), typos, or layout issues.
    3. If the user asks for career advice, say: "We focus on structure first. Fix the errors."
    `;
  } else {
    return `${base}
    ROLE: You are a high-level Career Agent.
    TONE: Strategic, peer-to-peer.
    DIRECTIVE:
    1. ANALYZE THE PAGE CONTENT (Job Description) if available. 
    2. GAP ANALYSIS: Compare the Resume to the Page Content. What skills are missing?
    3. RECOMMEND: Suggest specific additions or certifications (Coursera, etc).
    4. If the page is not a job description, give general industry advice based on the resume.
    `;
  }
};

// --- Handlers ---

const handleAnalysis = async (profile: UserProfile, fields: FormField[], context: PageContext) => {
  try {
    const ai = getAIClient(profile);
    const prompt = `Analyze HTML fields: ${JSON.stringify(fields)}. Return JSON value mappings based on profile.`;

    const response = await ai.generateStructuredJSON({
      systemInstruction: generateFormSystemInstruction(profile, context),
      prompt: prompt,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            fieldId: { type: Type.STRING },
            value: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          }
        }
      }
    });
    return response;
  } catch (error: any) {
    // Parse error for quota issues
    const errorMessage = error?.message || JSON.stringify(error);

    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      throw new Error('⚠️ API Quota Exceeded: You\'ve hit the API limit. Please wait or upgrade your API key.');
    } else if (errorMessage.includes('401') || errorMessage.includes('UNAUTHENTICATED')) {
      throw new Error('⚠️ Invalid API Key: Please check your API key in Settings');
    } else if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
      throw new Error('⚠️ API Access Denied: Your API key doesn\'t have permission to use this model');
    } else if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
      throw new Error('⚠️ AI Model Overloaded: The system is experiencing high traffic. Please try again in a moment.');
    } else {
      throw new Error(`AI Analysis Failed: ${errorMessage.substring(0, 200)}`);
    }
  }
};

const handleResumeExtraction = async (resumeText: string, apiKey: string) => {
  // Logic where we don't have a full profile yet, assume default provider but using passed key
  // Or since this is "handleResumeExtraction" usually called with just a key (from existing flow).
  // We need to support this. The existing flow passed `apiKey`. 
  // We should prob construct a temp profile or just instantiate Gemini default if unknown, 
  // BUT the caller might only pass a string.
  // Ideally we change signature to take UserProfile, but to minimize regressions let's assume Gemini or infer.
  // Actually, we can assume it's a Gemini key if legacy, OR we need the profile to know provider.

  // To stay safe: default to Gemini adapter with the key provided, unless we can change call site.
  // The 'EXTENSION_MESSAGE' type has `apiKey` in payload.
  // Let's assume Gemini for legacy direct key usage OR check if the key looks like sk- (OpenAI) or sk-ant (Anthropic).
  // A simple heuristic for this specific function which is stateless.

  let adapter: AIClient;
  if (apiKey.startsWith('sk-ant')) {
    adapter = new AnthropicAdapter(apiKey);
  } else if (apiKey.startsWith('sk-')) {
    adapter = new OpenAIAdapter(apiKey);
  } else {
    adapter = new GeminiAdapter(apiKey);
  }

  const response = await adapter.generateStructuredJSON({
    prompt: `Extract contact info from this resume:\n\n${resumeText}`,
    systemInstruction: generateExtractionSystemInstruction(),
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        firstName: { type: Type.STRING, nullable: true },
        lastName: { type: Type.STRING, nullable: true },
        email: { type: Type.STRING, nullable: true },
        phone: { type: Type.STRING, nullable: true },
        portfolio: { type: Type.STRING, nullable: true },
        linkedin: { type: Type.STRING, nullable: true },
        address: { type: Type.STRING, nullable: true },
        city: { type: Type.STRING, nullable: true },
        state: { type: Type.STRING, nullable: true },
        zip: { type: Type.STRING, nullable: true }
      }
    }
  });
  return response;
};

const handleResumeAudit = async (resumeText: string, apiKey: string, previousObjective?: string) => {
  let adapter: AIClient;
  if (apiKey.startsWith('sk-ant')) {
    adapter = new AnthropicAdapter(apiKey);
  } else if (apiKey.startsWith('sk-')) {
    adapter = new OpenAIAdapter(apiKey);
  } else {
    adapter = new GeminiAdapter(apiKey);
  }

  const response = await adapter.generateStructuredJSON({
    prompt: `Audit this resume text: \n\n${resumeText}`,
    systemInstruction: generateAuditSystemInstruction(previousObjective),
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        persona: { type: Type.STRING, enum: ["ARCHITECT", "STRATEGIST"] },
        objective: { type: Type.STRING },
        analysis: { type: Type.STRING },
        firstMessage: { type: Type.STRING }
      }
    }
  });
  return response;
};

const handleChat = async (message: string, history: ChatMessage[], resumeText: string, persona: PersonaType, objective: string, apiKey: string, context: PageContext) => {
  let adapter: AIClient;
  if (apiKey.startsWith('sk-ant')) {
    adapter = new AnthropicAdapter(apiKey);
  } else if (apiKey.startsWith('sk-')) {
    adapter = new OpenAIAdapter(apiKey);
  } else {
    adapter = new GeminiAdapter(apiKey);
  }

  // Helper to ensure we pass history correctly
  const response = await adapter.generateText({
    prompt: message,
    history: history,
    systemInstruction: generateChatSystemInstruction(persona, objective, resumeText, context),
  });

  return response;
};

// --- Resume Optimization System Instructions ---
const generateOptimizationSystemInstruction = (jobTitle: string, companyName: string): string => {
  return `
    You are a Professional Resume & Cover Letter Optimization Specialist.
    
    TASK: Create a job-specific optimized resume and cover letter for:
    Position: ${jobTitle}
    Company: ${companyName}
    
    CRITICAL FORMATTING RULES FOR RESUME:
    1. Use clean, professional structure with clear section headers
    2. Each section should be separated by blank lines
    3. Use UPPERCASE for section headers (e.g., PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION)
    4. Use bullet points (•) for lists, not asterisks or dashes
    5. Include proper spacing between sections
    6. Format dates consistently (e.g., "Jan 2020 - Present")
    7. Keep lines to reasonable length (60-80 characters)
    8. Use clear hierarchy: Name → Title → Contact → Summary → Experience → Skills → Education
    
    CONTENT RULES FOR OPTIMIZED RESUME:
    1. Keep all truthful information from the original resume
    2. Reorganize and emphasize experiences relevant to the job description
    3. Add keywords from the job description where they naturally fit
    4. Quantify achievements with metrics when possible
    5. Use strong action verbs (Led, Developed, Implemented, Achieved, etc.)
    6. Tailor the professional summary to match the role
    7. Highlight skills that match the job requirements
    8. Remove or de-emphasize irrelevant experiences
    9. Format should be ATS-friendly (clean, simple structure)
    
    RESUME TEMPLATE STRUCTURE:
    
    [FULL NAME]
    [Current/Target Title]
    
    [Email] | [Phone] | [LinkedIn] | [Location]
    
    PROFESSIONAL SUMMARY
    [2-3 sentences highlighting key qualifications relevant to this specific role]
    
    PROFESSIONAL EXPERIENCE
    
    [Job Title] | [Company Name]
    [Start Date] - [End Date] | [Location]
    • [Achievement with metric demonstrating impact]
    • [Key responsibility relevant to target role]
    • [Technical skills or technologies used]
    • [Leadership or collaboration example]
    
    [Repeat for each relevant position]
    
    SKILLS
    • [Category 1]: [Relevant skills from job description]
    • [Category 2]: [Technical competencies]
    • [Category 3]: [Soft skills that match requirements]
    
    EDUCATION
    [Degree] in [Field] | [University Name]
    [Graduation Year] | [Relevant coursework or achievements if applicable]
    
    CERTIFICATIONS (if applicable)
    • [Relevant certifications]
    
    RULES FOR COVER LETTER:
    1. Keep it concise (3-4 paragraphs max)
    2. Professional business letter format
    3. Include proper spacing between paragraphs
    4. Opening: Express enthusiasm for the specific role and company
    5. Body: Connect 2-3 key experiences from resume to job requirements
    6. Closing: Express desire to discuss further and thank them
    7. Professional tone but personable
    8. Reference specific aspects of the job description
    9. Show you've researched the company
    
    COVER LETTER TEMPLATE STRUCTURE:
    
    [Your Name]
    [Your Email] | [Your Phone]
    [Date]
    
    Hiring Manager
    ${companyName}
    
    Dear Hiring Manager,
    
    [Opening paragraph: Express enthusiasm and briefly state why you're an excellent fit for the ${jobTitle} position at ${companyName}. Mention where you found the position if relevant.]
    
    [Body paragraph 1: Highlight your most relevant experience or achievement that directly relates to a key requirement in the job description. Use specific examples and metrics.]
    
    [Body paragraph 2: Demonstrate additional qualifications, skills, or experiences that make you uniquely suited for this role. Reference company values or recent initiatives if possible.]
    
    [Closing paragraph: Express enthusiasm for the opportunity to discuss your qualifications further. Thank them for their consideration and provide clear next steps.]
    
    Sincerely,
    [Your Name]
    
    OUTPUT: Return both documents as clean, formatted text ready to copy-paste or print.
  `;
};

const handleResumeOptimization = async (
  originalResume: string,
  jobDescription: string,
  jobTitle: string,
  companyName: string,
  apiKey: string
) => {
  let adapter: AIClient;
  if (apiKey.startsWith('sk-ant')) {
    adapter = new AnthropicAdapter(apiKey);
  } else if (apiKey.startsWith('sk-')) {
    adapter = new OpenAIAdapter(apiKey);
  } else {
    adapter = new GeminiAdapter(apiKey);
  }

  const prompt = `
    ORIGINAL RESUME:
    ${originalResume}

    JOB DESCRIPTION:
    ${jobDescription}

    Generate an optimized resume and cover letter for this specific job.
  `;

  console.log('[Job-Agent] Starting Resume Optimization...');

  const response = await adapter.generateStructuredJSON({
    prompt: prompt,
    systemInstruction: generateOptimizationSystemInstruction(jobTitle, companyName),
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        optimizedResume: { type: Type.STRING },
        optimizedCoverLetter: { type: Type.STRING }
      }
    }
  });

  console.log('[Job-Agent] Resume Optimization complete. Response length:', response?.length);
  return response;
};

// --- Job Details Extraction System Instructions ---
const generateJobExtractionSystemInstruction = (): string => {
  return `
    You are a Job Posting Parser specializing in extracting structured information from web pages.

    TASK: Extract job posting details from the provided page content.

    RULES:
    1. Identify the job title - the main position being advertised
    2. Identify the company name - the organization hiring
    3. Extract the complete job description - all relevant text about the role, requirements, responsibilities, qualifications, benefits, etc.
    4. If the page is NOT a job posting, return null for all fields
    5. Be intelligent about what constitutes the "job description" - include everything a candidate would need to know
    6. Remove navigation elements, headers, footers, and unrelated page content
    7. Keep the job description comprehensive but clean

    EXAMPLES OF VALID PAGES:
    - LinkedIn job postings
    - Company career pages
    - Indeed, Glassdoor, etc.
    - Greenhouse, Lever, Ashby application pages
    - Direct employer job boards

    EXAMPLES OF INVALID PAGES:
    - General company homepages
    - About pages
    - News articles
    - Search results pages
  `;
};

const handleJobDetailsExtraction = async (pageContent: string, apiKey: string) => {
  let adapter: AIClient;
  // Heuristic detection
  if (apiKey.startsWith('sk-ant')) {
    adapter = new AnthropicAdapter(apiKey);
  } else if (apiKey.startsWith('sk-')) {
    adapter = new OpenAIAdapter(apiKey);
  } else {
    adapter = new GeminiAdapter(apiKey);
  }

  // Truncate page content if it's too long (keep first ~8000 chars)
  const truncatedContent = pageContent.length > 8000
    ? pageContent.substring(0, 8000) + "... [content truncated]"
    : pageContent;

  const prompt = `
    Analyze this web page content and extract job posting details:

    PAGE CONTENT:
    ${truncatedContent}

    Extract the job title, company name, and full job description.
  `;

  const response = await adapter.generateStructuredJSON({
    prompt: prompt,
    systemInstruction: generateJobExtractionSystemInstruction(),
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        jobTitle: { type: Type.STRING, nullable: true },
        companyName: { type: Type.STRING, nullable: true },
        jobDescription: { type: Type.STRING, nullable: true }
      }
    }
  });

  return response;
};

// --- Skills Gap Analysis System Instructions ---
const generateSkillsGapSystemInstruction = (): string => {
  return `
    You are a Career Growth & Skills Gap Analysis Expert.
    
    TASK: Compare the User's Resume against the provided Job Description.
    
    GOAL: 
    1. Identify critical skills missing from the resume that are required by the job.
    2. Provide a thorough analysis of how well the user fits the role.
    3. Recommend specific Coursera courses to fill those gaps.
    
    CRITICAL RULE:
    - You MUST provide at least 3 relevant Coursera course recommendations.
    - USE GOOGLE SEARCH to find actual, live Coursera courses that match the skills gap.
    - Provide the REAL URL for the course.
    - If specific courses aren't obvious, recommend highly-rated general courses for the missing skills.
    - Do not return an empty courses array.

    OUTPUT STRUCTURE (JSON):
    {
      "analysis": "A detailed 2-3 paragraph analysis of the fit. Highlight strengths but focus on explaining the specific gaps and why they matter for this role.",
      "gaps": [
        {
          "skill": "Name of the missing skill (e.g., 'AWS', 'Python', 'Agile')",
          "importance": "High" | "Medium" | "Low",
          "explanation": "Why this skill is needed based on the JD."
        }
      ],
      "courses": [
        {
          "title": "Exact title of a relevant Coursera course",
          "provider": "University or Organization (e.g., 'IBM', 'Google', 'Yale')",
          "url": "The actual URL to the course on Coursera (e.g., 'https://www.coursera.org/learn/...')",
          "description": "A brief high-level description of what the course covers",
          "reasoning": "How this specific course addresses the identified gap."
        }
      ]
    }
  `;
};

const handleSkillsGapAnalysis = async (resumeText: string, jobDescription: string, apiKey: string) => {
  let adapter: AIClient;
  if (apiKey.startsWith('sk-ant')) {
    adapter = new AnthropicAdapter(apiKey);
  } else if (apiKey.startsWith('sk-')) {
    adapter = new OpenAIAdapter(apiKey);
  } else {
    adapter = new GeminiAdapter(apiKey);
  }

  const prompt = `
    RESUME:
    ${resumeText}

    JOB DESCRIPTION:
    ${jobDescription}

    Perform a skills gap analysis and recommend Coursera courses.
  `;

  console.log('[Job-Agent] Starting Skills Gap Analysis...');

  const response = await adapter.generateStructuredJSON({
    prompt: prompt,
    systemInstruction: generateSkillsGapSystemInstruction(),
    enableSearch: true, // Enable Google Search grounding
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        analysis: { type: Type.STRING },
        gaps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill: { type: Type.STRING },
              importance: { type: Type.STRING },
              explanation: { type: Type.STRING }
            }
          }
        },
        courses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              provider: { type: Type.STRING },
              url: { type: Type.STRING },
              description: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  return response;
};

// --- Message Router ---

if (isExtension) {
  // Enable side panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: any) => console.error("Job-Agent: Failed to set panel behavior", error));

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // 1. Form Filling
    if (request.type === 'PROCESS_FORM_DATA') {
      handleAnalysis(request.payload.profile, request.payload.fields, request.payload.context)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 2. Resume Data Extraction (Auto-Fill)
    if (request.type === 'EXTRACT_RESUME_DATA') {
      handleResumeExtraction(request.payload.resumeText, request.payload.apiKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 3. Resume Audit (Initial Upload or Re-upload)
    if (request.type === 'AUDIT_RESUME') {
      handleResumeAudit(request.payload.resumeText, request.payload.apiKey, request.payload.previousObjective)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 4. Chat Interaction
    if (request.type === 'CHAT_MESSAGE') {
      const { message, history, resumeText, persona, objective, apiKey, context } = request.payload;
      handleChat(message, history, resumeText, persona, objective, apiKey, context)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 5. Resume Optimization
    if (request.type === 'OPTIMIZE_RESUME') {
      const { originalResume, jobDescription, jobTitle, companyName, apiKey } = request.payload;
      handleResumeOptimization(originalResume, jobDescription, jobTitle, companyName, apiKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 6. Job Details Extraction (Auto-detect from page)
    if (request.type === 'EXTRACT_JOB_DETAILS') {
      const { pageContent, apiKey } = request.payload;
      handleJobDetailsExtraction(pageContent, apiKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 7. Skills Gap Analysis
    if (request.type === 'ANALYZE_SKILLS_GAP') {
      const { resumeText, jobDescription, apiKey } = request.payload;
      handleSkillsGapAnalysis(resumeText, jobDescription, apiKey)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
}

export { };