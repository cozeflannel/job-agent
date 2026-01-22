// import { FormField } from '../types';

// // Helper to find all inputs, including inside open Shadow DOMs (recursive)
// export const getAllFormFields = (root: Document | ShadowRoot = document): FormField[] => {
//     const inputs = Array.from(root.querySelectorAll('input, select, textarea'));
//     let fields: FormField[] = [];

//     inputs.forEach((el) => {
//         const element = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
//         if (element.type === 'hidden' || element.style.display === 'none') return;

//         // Attempt to find a label
//         let label = '';
//         if (element.id) {
//             const labelEl = root.querySelector(`label[for="${element.id}"]`);
//             if (labelEl) label = labelEl.textContent || '';
//         }
//         if (!label && element.parentElement) {
//             label = element.parentElement.innerText || '';
//         }

//         // Get options for Select or Radio
//         let options: string[] = [];
//         if (element.tagName === 'SELECT') {
//             options = Array.from((element as HTMLSelectElement).options).map(o => o.text);
//         } else if (element.type === 'radio') {
//             // Heuristic: find label text adjacent to radio
//             options = [label];
//         }

//         fields.push({
//             id: element.id || element.name || `generated_id_${Math.random().toString(36).substr(2, 9)}`,
//             name: element.name,
//             label: label.trim().substring(0, 100), // Truncate for token limits
//             type: element.type,
//             options: options.length > 0 ? options : undefined
//         });
//     });

//     // Handle nested Shadow DOMs
//     const allElements = Array.from(root.querySelectorAll('*'));
//     allElements.forEach((el) => {
//         if (el.shadowRoot) {
//             fields = fields.concat(getAllFormFields(el.shadowRoot));
//         }
//     });

//     return fields;
// };

// // Function to fill a specific field
// export const fillField = (fieldId: string, value: any) => {
//     const element = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
//     if (!element) return;

//     // React/Vue Compatibility: Dispatch events
//     const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
//     const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
//     const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

//     if (element.type === 'checkbox' || element.type === 'radio') {
//         const inputEl = element as HTMLInputElement;
//         if (inputEl.checked !== value) {
//             inputEl.click(); // Click is often better for triggering listeners on toggles
//         }
//     } else {
//         // Set value prototype bypass for React 16+
//         if (element.tagName === 'INPUT' && nativeInputValueSetter) {
//             nativeInputValueSetter.call(element, value);
//         } else if (element.tagName === 'SELECT' && nativeSelectValueSetter) {
//             nativeSelectValueSetter.call(element, value);
//         } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
//             nativeTextAreaValueSetter.call(element, value);
//         } else {
//             element.value = String(value);
//         }
//     }

//     element.dispatchEvent(new Event('input', { bubbles: true }));
//     element.dispatchEvent(new Event('change', { bubbles: true }));
//     element.dispatchEvent(new Event('blur', { bubbles: true }));
// };

// // --- Auto-Upload Logic ---

// const getRelevanceScore = (text: string, positive: string[], negative: string[]): number => {
//     const t = text.toLowerCase();
//     if (negative.some(k => t.includes(k))) return -100;
//     if (positive.some(k => t.includes(k))) return 10;
//     return 0;
// };

// const findResumeUploadField = (): HTMLInputElement | null => {
//     const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
//     const positiveKeywords = ['resume', 'cv', 'curriculum vitae', 'upload resume'];
//     const negativeKeywords = ['cover letter', 'portfolio', 'transcript', 'photo', 'image', 'picture'];

//     let bestInput = null;
//     let maxScore = 0;

//     inputs.forEach(input => {
//         let score = 0;

//         // Check ID/Name
//         score += getRelevanceScore(input.id || '', positiveKeywords, negativeKeywords);
//         score += getRelevanceScore(input.name || '', positiveKeywords, negativeKeywords);
//         score += getRelevanceScore(input.getAttribute('aria-label') || '', positiveKeywords, negativeKeywords);

//         // Check associated Label
//         if (input.id) {
//             const label = document.querySelector(`label[for="${input.id}"]`);
//             if (label) score += getRelevanceScore(label.textContent || '', positiveKeywords, negativeKeywords);
//         }

//         // Check surrounding text (simple heuristic: look at parent text)
//         if (input.parentElement) {
//             score += getRelevanceScore(input.parentElement.innerText || '', positiveKeywords, negativeKeywords);
//         }

//         if (score > maxScore) {
//             maxScore = score;
//             bestInput = input;
//         }
//     });

//     return bestInput;
// };

// export const injectResumeFile = (resumeText: string, fileName: string): boolean => {
//     const input = findResumeUploadField();
//     if (!input) {
//         console.log("Job-Agent: No resume file input found.");
//         return false;
//     }

//     try {
//         // Create a File object from the text content
//         const file = new File([resumeText], fileName, { type: 'text/plain' });

//         // Use DataTransfer to simulate drag-and-drop file selection
//         const dataTransfer = new DataTransfer();
//         dataTransfer.items.add(file);
//         input.files = dataTransfer.files;

//         // Dispatch events to trigger UI updates (progress bars, file name display)
//         input.dispatchEvent(new Event('change', { bubbles: true }));
//         input.dispatchEvent(new Event('input', { bubbles: true }));
//         input.dispatchEvent(new Event('blur', { bubbles: true }));

//         console.log(`Job-Agent: Attached ${fileName} to input #${input.id || input.name}`);
//         return true;
//     } catch (e) {
//         console.error("Job-Agent: File injection failed", e);
//         return false;
//     }
// };

// export const scanPage = () => {
//     const context = {
//         url: window.location.href,
//         title: document.title,
//         siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '',
//         pageText: document.body.innerText.substring(0, 5000) // Capture first 5k chars for context
//     };
//     const fields = getAllFormFields();
//     return { context, fields };
// };


import { FormField } from '../types';

// Helper to find all inputs, including inside open Shadow DOMs (recursive)
export const getAllFormFields = (root: Document | ShadowRoot = document): FormField[] => {
    // ENHANCED: Include contenteditable and role-based inputs for Ashby
    const standardInputs = Array.from(root.querySelectorAll('input, select, textarea'));
    const contentEditableInputs = Array.from(root.querySelectorAll('[contenteditable="true"]'));
    const roleBasedInputs = Array.from(root.querySelectorAll('[role="textbox"], [role="combobox"], [role="searchbox"]'));

    const allPotentialInputs = [...standardInputs, ...contentEditableInputs, ...roleBasedInputs];

    let fields: FormField[] = [];

    allPotentialInputs.forEach((el) => {
        const element = el as any;

        if (element.type === 'hidden') return;
        if (element.type === 'file') return; // Exclude file inputs - handled by injection agents
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' && computedStyle.visibility === 'hidden') return;

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && (computedStyle.display === 'none' || computedStyle.visibility === 'hidden')) return;

        let label = '';
        if (element.id) {
            const labelEl = root.querySelector(`label[for="${element.id}"]`);
            if (labelEl) label = labelEl.textContent || '';
        }
        if (!label && element.getAttribute('aria-labelledby')) {
            const labelId = element.getAttribute('aria-labelledby');
            if (labelId) {
                const labelEl = root.querySelector(`#${labelId}`);
                if (labelEl) label = labelEl.textContent || '';
            }
        }
        if (!label) {
            const parentLabel = element.closest('label');
            if (parentLabel) label = parentLabel.textContent || '';
        }
        if (!label && element.getAttribute('aria-label')) label = element.getAttribute('aria-label') || '';
        if (!label && element.getAttribute('placeholder')) label = element.getAttribute('placeholder') || '';
        if (!label && element.getAttribute('data-label')) label = element.getAttribute('data-label') || '';
        if (!label && element.parentElement) {
            const formGroup = element.closest('[class*="field"], [class*="form-group"], [class*="input"], [class*="Field"], div');
            if (formGroup) {
                const labelElement = formGroup.querySelector('label, [class*="label"], [class*="Label"]');
                if (labelElement && labelElement.textContent) label = labelElement.textContent;
            }
        }
        if (!label && element.previousElementSibling) {
            const prevSibling = element.previousElementSibling;
            if (prevSibling.textContent && prevSibling.textContent.trim().length < 100) label = prevSibling.textContent;
        }

        let fieldType = 'text';
        if (element.tagName === 'INPUT') fieldType = element.type || 'text';
        else if (element.tagName === 'SELECT') fieldType = 'select';
        else if (element.tagName === 'TEXTAREA') fieldType = 'textarea';
        else if (element.getAttribute('contenteditable') === 'true') fieldType = 'text';
        else if (element.getAttribute('role') === 'textbox') fieldType = 'text';
        else if (element.getAttribute('role') === 'combobox') fieldType = 'select';

        let options: string[] = [];
        if (element.tagName === 'SELECT') {
            options = Array.from((element as HTMLSelectElement).options).map(o => o.text);
        } else if (fieldType === 'radio') {
            options = [label];
        }

        const fieldId = element.id || element.name || element.getAttribute('data-field-id') || `generated_id_${Math.random().toString(36).substr(2, 9)}`;

        fields.push({
            id: fieldId,
            name: element.name || '',
            label: label.trim().substring(0, 100),
            type: fieldType,
            options: options.length > 0 ? options : undefined
        });
    });

    const allElements = Array.from(root.querySelectorAll('*'));
    allElements.forEach((el) => {
        if (el.shadowRoot) {
            fields = fields.concat(getAllFormFields(el.shadowRoot));
        }
    });

    return fields;
};

// Function to fill a specific field (Updated with Ashby Logic)
export const fillField = (fieldId: string, value: any) => {
    let element = document.getElementById(fieldId) as any;

    if (!element) element = document.querySelector(`[name="${fieldId}"]`) as any;
    if (!element) element = document.querySelector(`[data-field-id="${fieldId}"]`) as any;
    if (!element) return;
    if (element.type === 'file') return; // Safety: Never try to set text value on file input

    // --- CHECK 1: Ashby Location Field ---
    if (fieldId.toLowerCase().includes('location') || element.getAttribute('placeholder')?.toLowerCase().includes('location')) {
        fillAshbyLocation(element, String(value));
        return;
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

    if (element.type === 'checkbox' || element.type === 'radio') {
        const inputEl = element as HTMLInputElement;
        if (inputEl.checked !== value) {
            inputEl.click();
        }
    } else {
        if (element.tagName === 'INPUT' && nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        } else if (element.tagName === 'SELECT' && nativeSelectValueSetter) {
            nativeSelectValueSetter.call(element, value);
        } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(element, value);
        } else {
            element.value = String(value);
        }
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
};

const fillAshbyLocation = async (element: HTMLInputElement, value: string) => {
    try {
        element.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) {
            nativeSetter.call(element, value);
        } else {
            element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 800));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    } catch (e) {
        console.error("Ashby location fill failed", e);
    }
}

// --- Auto-Upload Logic (Updated with Ashby Logic) ---
const getRelevanceScore = (text: string, positive: string[], negative: string[]): number => {
    const t = text.toLowerCase();
    if (negative.some(k => t.includes(k))) return -100;
    if (positive.some(k => t.includes(k))) return 10;
    return 0;
};

const findResumeUploadField = (): HTMLInputElement | null => {
    // 1. Ashby Check
    const ashbyInput = document.getElementById('_systemfield_resume') as HTMLInputElement;
    if (ashbyInput) return ashbyInput;

    const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const positiveKeywords = ['resume', 'cv', 'curriculum vitae', 'upload resume'];
    const negativeKeywords = ['cover letter', 'portfolio', 'transcript', 'photo', 'image', 'picture'];

    let bestInput = null;
    let maxScore = 0;

    inputs.forEach(input => {
        let score = 0;
        score += getRelevanceScore(input.id || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.name || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.getAttribute('aria-label') || '', positiveKeywords, negativeKeywords);
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) score += getRelevanceScore(label.textContent || '', positiveKeywords, negativeKeywords);
        }
        if (input.parentElement) {
            score += getRelevanceScore(input.parentElement.innerText || '', positiveKeywords, negativeKeywords);
        }
        if (score > maxScore) {
            maxScore = score;
            bestInput = input;
        }
    });

    return bestInput;
};

export const injectResumeFile = (resumeText: string, fileName: string): boolean => {
    const input = findResumeUploadField();
    if (!input) {
        console.log("Job-Agent: No resume file input found.");
        return false;
    }

    try {
        const file = new File([resumeText], fileName, { type: 'text/plain' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // --- React Hack ---
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
        const nativeSetter = descriptor?.set;
        if (nativeSetter) {
            nativeSetter.call(input, dataTransfer.files);
        } else {
            input.files = dataTransfer.files;
        }
        // ------------------

        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        console.log(`Job-Agent: Attached ${fileName} to input #${input.id || input.name}`);
        return true;
    } catch (e) {
        console.error("Job-Agent: File injection failed", e);
        return false;
    }
};

const findCoverLetterUploadField = (): HTMLInputElement | null => {
    // 1. Ashby Check (Hypothetical ID based on patterns)
    const ashbyInput = document.getElementById('_systemfield_cover_letter') as HTMLInputElement;
    if (ashbyInput) return ashbyInput;

    const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const positiveKeywords = ['cover letter', 'coverletter', 'cl_upload', 'additional documents'];
    const negativeKeywords = ['resume', 'cv', 'curriculum vitae', 'photo', 'transcript', 'headshot'];

    let bestInput = null;
    let maxScore = 0;

    inputs.forEach(input => {
        let score = 0;
        score += getRelevanceScore(input.id || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.name || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.getAttribute('aria-label') || '', positiveKeywords, negativeKeywords);
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) score += getRelevanceScore(label.textContent || '', positiveKeywords, negativeKeywords);
        }
        if (input.parentElement) {
            score += getRelevanceScore(input.parentElement.innerText || '', positiveKeywords, negativeKeywords);
        }
        if (score > maxScore) {
            maxScore = score;
            bestInput = input;
        }
    });

    return bestInput;
};

export const injectCoverLetterFile = (coverLetterText: string, fileName: string): boolean => {
    const input = findCoverLetterUploadField();
    if (!input) {
        console.log("Job-Agent: No cover letter file input found.");
        return false;
    }

    try {
        const file = new File([coverLetterText], fileName, { type: 'text/plain' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // --- React Hack ---
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
        const nativeSetter = descriptor?.set;
        if (nativeSetter) {
            nativeSetter.call(input, dataTransfer.files);
        } else {
            input.files = dataTransfer.files;
        }
        // ------------------

        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        console.log(`Job-Agent: Attached Cover Letter ${fileName} to input #${input.id || input.name}`);
        return true;
    } catch (e) {
        console.error("Job-Agent: Cover Letter injection failed", e);
        return false;
    }
};

export const scanPage = () => {
    const context = {
        url: window.location.href,
        title: document.title,
        siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '',
        pageText: document.body.innerText.substring(0, 5000)
    };
    const fields = getAllFormFields();
    return { context, fields };
};