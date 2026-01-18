import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, FormField, PageContext, ChatMessage, PersonaType } from './types';

declare var chrome: any;

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime;

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
    6. STAR: Generate 3-5 sentence narratives from resume for behavioral qs.
  `;
};

// --- Data Extraction System Instructions ---
const generateExtractionSystemInstruction = (): string => {
  return `
    You are a Data Extraction Specialist for a Resume Parsing System.
    Task: Extract key personal profile information from the provided resume text.
    
    Rules:
    1. Extract 'firstName', 'lastName', 'email', 'phone', 'portfolio', 'linkedin', 'address', 'city', 'zip'.
    2. If a field is missing, return null. DO NOT invent placeholders.
    3. For LinkedIn, extract the full URL.
    4. Split full name into first and last name.
    5. Prioritize the header section of the resume.
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
    const ai = new GoogleGenAI({ apiKey: profile.apiKey });
    const prompt = `Analyze HTML fields: ${JSON.stringify(fields)}. Return JSON value mappings based on profile.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: generateFormSystemInstruction(profile, context),
        responseMimeType: "application/json",
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
      }
    });
    return response.text;
  } catch (error: any) {
    // Parse error for quota issues
    const errorMessage = error?.message || JSON.stringify(error);

    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      throw new Error('⚠️ API Quota Exceeded: You\'ve hit the Gemini API free tier limit (20 requests/day). Please wait 24 hours or upgrade your API key at https://ai.google.dev/pricing');
    } else if (errorMessage.includes('401') || errorMessage.includes('UNAUTHENTICATED')) {
      throw new Error('⚠️ Invalid API Key: Please check your Gemini API key in Settings');
    } else if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
      throw new Error('⚠️ API Access Denied: Your API key doesn\'t have permission to use this model');
    } else {
      throw new Error(`AI Analysis Failed: ${errorMessage.substring(0, 200)}`);
    }
  }
};

const handleResumeExtraction = async (resumeText: string, apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract contact info from this resume:\n\n${resumeText}`,
    config: {
      systemInstruction: generateExtractionSystemInstruction(),
      responseMimeType: "application/json",
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
          zip: { type: Type.STRING, nullable: true }
        }
      }
    }
  });
  return response.text;
};

const handleResumeAudit = async (resumeText: string, apiKey: string, previousObjective?: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Audit this resume text: \n\n${resumeText}`,
    config: {
      systemInstruction: generateAuditSystemInstruction(previousObjective),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          persona: { type: Type.STRING, enum: ["ARCHITECT", "STRATEGIST"] },
          objective: { type: Type.STRING },
          analysis: { type: Type.STRING },
          firstMessage: { type: Type.STRING }
        }
      }
    }
  });
  return response.text;
};

const handleChat = async (message: string, history: ChatMessage[], resumeText: string, persona: PersonaType, objective: string, apiKey: string, context: PageContext) => {
  const ai = new GoogleGenAI({ apiKey });

  // Sanitize history to ensure strict content structure
  const cleanHistory = history
    .filter(h => h.sender !== 'system' && h.text && h.text.trim().length > 0)
    .map(h => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

  const cleanMessage = message && message.trim().length > 0 ? message : "Study my resume.";

  const contents = [...cleanHistory, { role: 'user', parts: [{ text: cleanMessage }] }];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: contents,
    config: {
      systemInstruction: generateChatSystemInstruction(persona, objective, resumeText, context),
    }
  });

  return response.text;
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
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    ORIGINAL RESUME:
    ${originalResume}
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    Generate an optimized resume and cover letter for this specific job.
  `;

  console.log('[Job-Agent] Starting Resume Optimization...');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: generateOptimizationSystemInstruction(jobTitle, companyName),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedResume: { type: Type.STRING },
          optimizedCoverLetter: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  console.log('[Job-Agent] Resume Optimization complete. Response length:', text?.length);
  return text;
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
  const ai = new GoogleGenAI({ apiKey });

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

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: generateJobExtractionSystemInstruction(),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          jobTitle: { type: Type.STRING, nullable: true },
          companyName: { type: Type.STRING, nullable: true },
          jobDescription: { type: Type.STRING, nullable: true }
        }
      }
    }
  });

  return response.text;
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
  });
}

export { };