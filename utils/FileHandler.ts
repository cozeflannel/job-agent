// import * as pdfjsLib from 'pdfjs-dist';
// import { UserProfile } from '../types';

// // Handle ESM default export structure (common with CDNs like esm.sh)
// const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// // Configure Worker to handle PDF parsing in the browser
// // Configure Worker to handle PDF parsing in the browser
// if (pdfjs.GlobalWorkerOptions) {
//   // Use local worker to comply with CSP and offline capability
//   pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
// }

// declare var chrome: any;

// export class FileHandler {

//   /**
//    * Extracts raw text from a File object (PDF or Text).
//    */
//   static async readFileAsText(file: File): Promise<string> {
//     if (file.type === 'application/pdf') {
//       try {
//         const arrayBuffer = await file.arrayBuffer();
//         const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
//         const pdf = await loadingTask.promise;
//         let fullText = '';

//         for (let i = 1; i <= pdf.numPages; i++) {
//           const page = await pdf.getPage(i);
//           const textContent = await page.getTextContent();
//           const pageText = textContent.items.map((item: any) => item.str).join(' ');
//           fullText += pageText + '\n';
//         }
//         return fullText;
//       } catch (error) {
//         console.error("PDF Parsing Error:", error);
//         throw new Error("Failed to parse PDF. Please ensure it is a valid text-based PDF.");
//       }
//     } else {
//       // Default to text (txt, md, etc.)
//       return await file.text();
//     }
//   }

//   /**
//    * Orchestrates the upload process:
//    * 1. Extracts text locally.
//    * 2. Saves to local storage.
//    * 3. Triggers extraction and audit via background script.
//    * 4. Returns both text and base64 blob for storage.
//    */
//   static async handleUpload(file: File, apiKey: string): Promise<{
//     text: string,
//     blob: string,
//     mimeType: string,
//     extractionResult?: Partial<UserProfile>,
//     auditResult?: any
//   }> {
//     const text = await this.readFileAsText(file);

//     // Convert file to base64 for storage and later upload
//     const blob = await this.fileToBase64(file);
//     const mimeType = file.type || 'application/pdf';

//     // Persistence: Zero-Mock Policy - store actual extracted text
//     if (typeof chrome !== 'undefined' && chrome.storage) {
//       await chrome.storage.local.set({ raw_resume_text: text });
//     }

//     let extractionResult;
//     let auditResult;

//     if (apiKey && typeof chrome !== 'undefined' && chrome.runtime) {

//       // 1. Trigger Auto-Extraction of Personal Info
//       try {
//         const extractResp = await chrome.runtime.sendMessage({
//           type: 'EXTRACT_RESUME_DATA',
//           payload: { resumeText: text, apiKey }
//         });
//         if (extractResp && extractResp.success) {
//           extractionResult = JSON.parse(extractResp.data);
//         }
//       } catch (e) {
//         console.error("Extraction trigger failed", e);
//       }

//       // 2. Trigger Game Mode Audit
//       try {
//         const auditResp = await chrome.runtime.sendMessage({
//           type: 'AUDIT_RESUME',
//           payload: { resumeText: text, apiKey }
//         });
//         if (auditResp && auditResp.success) {
//           auditResult = JSON.parse(auditResp.data);
//         }
//       } catch (e) {
//         console.error("Audit trigger failed", e);
//       }
//     }

//     return { text, blob, mimeType, extractionResult, auditResult };
//   }

//   /**
//    * Converts a File to base64 string
//    */
//   private static async fileToBase64(file: File): Promise<string> {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onload = () => {
//         const result = reader.result as string;
//         // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
//         const base64 = result.split(',')[1];
//         resolve(base64);
//       };
//       reader.onerror = reject;
//       reader.readAsDataURL(file);
//     });
//   }
// }

import * as pdfjsLib from 'pdfjs-dist';
import { UserProfile } from '../types';

// Handle ESM default export structure (common with CDNs like esm.sh)
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Configure Worker to handle PDF parsing in the browser
if (pdfjs.GlobalWorkerOptions) {
  // Use local worker to comply with CSP and offline capability
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
}

declare var chrome: any;

export class FileHandler {

  /**
   * Extracts raw text from a File object (PDF or Text).
   */
  static async readFileAsText(file: File): Promise<string> {
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        return fullText;
      } catch (error) {
        console.error("PDF Parsing Error:", error);
        throw new Error("Failed to parse PDF. Please ensure it is a valid text-based PDF.");
      }
    } else {
      // Default to text (txt, md, etc.)
      return await file.text();
    }
  }

  /**
   * Orchestrates the upload process:
   * 1. Extracts text locally.
   * 2. Saves to local storage.
   * 3. Triggers extraction and audit via background script.
   * 4. Returns both text and base64 blob for storage.
   */
  static async handleUpload(file: File, apiKey: string): Promise<{
    text: string,
    blob: string,
    mimeType: string,
    extractionResult?: Partial<UserProfile>,
    auditResult?: any,
    error?: string
  }> {
    const text = await this.readFileAsText(file);

    // Convert file to base64 for storage and later upload
    const blob = await this.fileToBase64(file);
    const mimeType = file.type || 'application/pdf';

    // Persistence: Zero-Mock Policy - store actual extracted text
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ raw_resume_text: text });
    }

    let extractionResult;
    let auditResult;
    let error: string | undefined;

    if (apiKey && typeof chrome !== 'undefined' && chrome.runtime) {

      // 1. Trigger Auto-Extraction of Personal Info
      try {
        const extractResp = await chrome.runtime.sendMessage({
          type: 'EXTRACT_RESUME_DATA',
          payload: { resumeText: text, apiKey }
        });
        if (extractResp && extractResp.success && extractResp.data) {
          try {
            extractionResult = JSON.parse(extractResp.data);
          } catch (e) {
            console.error("Failed to parse extraction result:", e, extractResp.data);
            error = "Invalid response format from AI";
          }
        } else if (extractResp && !extractResp.success) {
          console.error("Extraction failed:", extractResp.error);
          error = extractResp.error;
        } else {
          console.warn("Extraction returned no data");
        }
      } catch (e: any) {
        console.error("Extraction trigger failed", e);
        error = e.message || "Failed to trigger extraction";
      }

      // 2. Trigger Game Mode Audit (Fire and forget if extraction failed to save quota? Or just try)
      // Only try if extraction didn't fail hard, or just try anyway.
      try {
        const auditResp = await chrome.runtime.sendMessage({
          type: 'AUDIT_RESUME',
          payload: { resumeText: text, apiKey }
        });
        if (auditResp && auditResp.success && auditResp.data) {
          try {
            auditResult = JSON.parse(auditResp.data);
          } catch (e) {
            console.error("Failed to parse audit result:", e, auditResp.data);
          }
        }
      } catch (e) {
        console.error("Audit trigger failed", e);
      }
    }

    return { text, blob, mimeType, extractionResult, auditResult, error };
  }

  /**
   * Converts a File to base64 string
   */
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}