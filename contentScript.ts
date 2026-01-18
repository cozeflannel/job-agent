import { FormField } from './types';

declare var chrome: any;



// --- INLINED DOM UTILS (To ensure standalone content script without shared chunks) ---

// Helper to find all inputs, including inside open Shadow DOMs (recursive)
const getAllFormFields = (root: Document | ShadowRoot = document): FormField[] => {
    // ENHANCED: Include contenteditable and role-based inputs for Ashby
    const standardInputs = Array.from(root.querySelectorAll('input, select, textarea'));
    const contentEditableInputs = Array.from(root.querySelectorAll('[contenteditable="true"]'));
    const roleBasedInputs = Array.from(root.querySelectorAll('[role="textbox"], [role="combobox"], [role="searchbox"]'));

    // Combine all potential form elements
    const allPotentialInputs = [...standardInputs, ...contentEditableInputs, ...roleBasedInputs];

    let fields: FormField[] = [];

    allPotentialInputs.forEach((el) => {
        const element = el as any; // Can be various types

        // Skip truly hidden fields (type=hidden only for standard inputs)
        if (element.type === 'hidden') return;

        // More lenient visibility check for dynamic forms
        const computedStyle = window.getComputedStyle(element);

        // Only skip if BOTH display is none AND visibility is hidden
        // This is more lenient for React forms that might toggle visibility
        if (computedStyle.display === 'none' && computedStyle.visibility === 'hidden') {
            return;
        }

        // Check if element is actually rendered with dimensions
        const rect = element.getBoundingClientRect();
        const hasZeroDimensions = rect.width === 0 && rect.height === 0;

        // Skip ONLY if element has zero dimensions AND is explicitly hidden via CSS
        if (hasZeroDimensions && (computedStyle.display === 'none' || computedStyle.visibility === 'hidden')) {
            return;
        }

        // Attempt to find a label - enhanced for React forms
        let label = '';

        // Method 1: Standard label[for] attribute
        if (element.id) {
            const labelEl = root.querySelector(`label[for="${element.id}"]`);
            if (labelEl) label = labelEl.textContent || '';
        }

        // Method 2: aria-labelledby (very common in Ashby/Greenhouse)
        if (!label && element.getAttribute('aria-labelledby')) {
            const labelId = element.getAttribute('aria-labelledby');
            if (labelId) {
                const labelEl = root.querySelector(`#${labelId}`);
                if (labelEl) label = labelEl.textContent || '';
            }
        }

        // Method 3: Parent label element
        if (!label) {
            const parentLabel = element.closest('label');
            if (parentLabel) label = parentLabel.textContent || '';
        }

        // Method 4: aria-label attribute
        if (!label && element.getAttribute('aria-label')) {
            label = element.getAttribute('aria-label') || '';
        }

        // Method 5: placeholder as fallback
        if (!label && element.getAttribute('placeholder')) {
            label = element.getAttribute('placeholder') || '';
        }

        // Method 6: data-label attribute (some custom components use this)
        if (!label && element.getAttribute('data-label')) {
            label = element.getAttribute('data-label') || '';
        }

        // Method 7: Check nearby text nodes (for React forms like Ashby)
        if (!label && element.parentElement) {
            // Look for labels within the same form group/container
            const formGroup = element.closest('[class*="field"], [class*="form-group"], [class*="input"], [class*="Field"], div');
            if (formGroup) {
                const labelElement = formGroup.querySelector('label, [class*="label"], [class*="Label"]');
                if (labelElement && labelElement.textContent) {
                    label = labelElement.textContent;
                }
            }
        }

        // Method 8: Check previous sibling for label (Ashby pattern)
        if (!label && element.previousElementSibling) {
            const prevSibling = element.previousElementSibling;
            if (prevSibling.textContent && prevSibling.textContent.trim().length < 100) {
                label = prevSibling.textContent;
            }
        }

        // Determine the field type
        let fieldType = 'text'; // Default
        if (element.tagName === 'INPUT') {
            fieldType = element.type || 'text';
        } else if (element.tagName === 'SELECT') {
            fieldType = 'select';
        } else if (element.tagName === 'TEXTAREA') {
            fieldType = 'textarea';
        } else if (element.getAttribute('contenteditable') === 'true') {
            fieldType = 'text'; // Treat contenteditable as text input
        } else if (element.getAttribute('role') === 'textbox') {
            fieldType = 'text';
        } else if (element.getAttribute('role') === 'combobox') {
            fieldType = 'select';
        }

        // Get options for Select or Radio
        let options: string[] = [];
        if (element.tagName === 'SELECT') {
            options = Array.from((element as HTMLSelectElement).options).map(o => o.text);
        } else if (fieldType === 'radio') {
            // Heuristic: find label text adjacent to radio
            options = [label];
        }

        // Generate a unique ID if none exists
        const fieldId = element.id || element.name || element.getAttribute('data-field-id') || `generated_id_${Math.random().toString(36).substr(2, 9)}`;

        fields.push({
            id: fieldId,
            name: element.name || '',
            label: label.trim().substring(0, 100), // Truncate for token limits
            type: fieldType,
            options: options.length > 0 ? options : undefined
        });
    });

    // Handle nested Shadow DOMs
    const allElements = Array.from(root.querySelectorAll('*'));
    allElements.forEach((el) => {
        if (el.shadowRoot) {
            fields = fields.concat(getAllFormFields(el.shadowRoot));
        }
    });

    return fields;
};

// --- Auto-Upload Logic ---

const getRelevanceScore = (text: string, positive: string[], negative: string[]): number => {
    const t = text.toLowerCase();
    if (negative.some(k => t.includes(k))) return -100;
    if (positive.some(k => t.includes(k))) return 10;
    return 0;
};

const findResumeUploadField = (): HTMLInputElement | null => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const positiveKeywords = ['resume', 'cv', 'curriculum vitae', 'upload resume', 'attach resume', 'your resume', 'upload your', 'attach your'];
    const negativeKeywords = ['cover letter', 'portfolio', 'transcript', 'photo', 'image', 'picture', 'avatar', 'logo'];

    console.log(`[Resume Detection] Found ${inputs.length} file input(s) on page`);

    let bestInput = null;
    let maxScore = 0;

    inputs.forEach((input, index) => {
        let score = 0;

        // Check accept attribute for PDF/DOC files (strong indicator)
        const accept = input.getAttribute('accept') || '';
        if (accept.includes('pdf') || accept.includes('.doc')) {
            score += 15;
        }

        // Check ID/Name
        score += getRelevanceScore(input.id || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.name || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.getAttribute('aria-label') || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.getAttribute('aria-describedby') || '', positiveKeywords, negativeKeywords);
        score += getRelevanceScore(input.getAttribute('data-testid') || '', positiveKeywords, negativeKeywords);

        // Check associated Label (via for attribute)
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) score += getRelevanceScore(label.textContent || '', positiveKeywords, negativeKeywords);
        }

        // Check parent label
        const parentLabel = input.closest('label');
        if (parentLabel) {
            score += getRelevanceScore(parentLabel.textContent || '', positiveKeywords, negativeKeywords);
        }

        // Check surrounding text (parent and grandparent)
        if (input.parentElement) {
            score += getRelevanceScore(input.parentElement.innerText || '', positiveKeywords, negativeKeywords);

            // Also check grandparent for better context
            if (input.parentElement.parentElement) {
                score += getRelevanceScore(input.parentElement.parentElement.innerText || '', positiveKeywords, negativeKeywords) * 0.5;
            }
        }

        // Check for "Upload File" button text nearby (Ashby pattern)
        const nearbyButtons = input.parentElement?.querySelectorAll('button, [role="button"]');
        if (nearbyButtons) {
            nearbyButtons.forEach(btn => {
                score += getRelevanceScore(btn.textContent || '', positiveKeywords, negativeKeywords) * 0.5;
            });
        }

        // Bonus for common ATS platforms
        const pageUrl = window.location.href.toLowerCase();
        if (pageUrl.includes('greenhouse') || pageUrl.includes('lever') || pageUrl.includes('workday') || pageUrl.includes('ashby')) {
            // On ATS platforms, the first file input is often the resume
            if (index === 0 && inputs.length === 1) {
                console.log(`[Resume Detection] Only one file input found on ATS platform - likely resume field`);
                score += 10;
            } else if (index === 0) {
                score += 5;
            }
        }

        console.log(`[Resume Detection] Input #${index}: id="${input.id}", name="${input.name}", score=${score}`);

        if (score > maxScore) {
            maxScore = score;
            bestInput = input;
        }
    });

    if (bestInput) {
        console.log(`[Resume Detection] Selected input with id="${bestInput.id}", name="${bestInput.name}", score=${maxScore}`);
    } else {
        console.log('[Resume Detection] No suitable resume upload field found');
    }

    return bestInput;
};

const injectResumeFile = (resumeBlob: string, fileName: string, mimeType: string = 'application/pdf'): boolean => {
    const input = findResumeUploadField();
    if (!input) {
        console.log("Job-Agent: No resume file input found.");
        return false;
    }

    try {
        // Convert base64 string back to binary data
        const byteCharacters = atob(resumeBlob);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Create a File object from the binary data with proper MIME type
        const file = new File([byteArray], fileName, { type: mimeType });

        // Use DataTransfer to simulate drag-and-drop file selection
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;

        // Dispatch events to trigger UI updates (progress bars, file name display)
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        console.log(`Job-Agent: Attached ${fileName} (${mimeType}) to input #${input.id || input.name}`);
        return true;
    } catch (e) {
        console.error("Job-Agent: File injection failed", e);
        return false;
    }
};

const scanPage = () => {
    const context = {
        url: window.location.href,
        title: document.title,
        siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '',
        pageText: document.body.innerText.substring(0, 5000) // Capture first 5k chars for context
    };

    // Debug: Log total inputs found
    const totalInputs = document.querySelectorAll('input, select, textarea').length;
    const hiddenInputs = document.querySelectorAll('input[type="hidden"]').length;
    const visibleInputs = totalInputs - hiddenInputs;

    console.log(`[ContentScript] Total inputs on page: ${totalInputs} (${visibleInputs} visible, ${hiddenInputs} hidden)`);

    const fields = getAllFormFields();
    console.log(`[ContentScript] Fields after filtering: ${fields.length}`);

    // Debug: Sample the first few fields
    if (fields.length > 0) {
        console.log(`[ContentScript] Sample fields:`, fields.slice(0, 3));
    } else {
        console.warn(`[ContentScript] ⚠️ No fields detected! This might be a dynamic form. Total form elements: ${totalInputs}`);
    }

    return { context, fields };
};

// Helper function to fill a field (React/Vue compatible + Greenhouse combobox support + Ashby contenteditable)
const fillFieldOnPage = (fieldId: string, value: any): boolean => {
    let element = document.getElementById(fieldId) as any;

    // If not found by ID, try finding by name or data-field-id
    if (!element) {
        element = document.querySelector(`[name="${fieldId}"]`) as any;
    }
    if (!element) {
        element = document.querySelector(`[data-field-id="${fieldId}"]`) as any;
    }

    if (!element) {
        console.warn(`Job-Agent: Field #${fieldId} not found`);
        return false;
    }

    try {
        // Check if this is a contenteditable element (Ashby pattern)
        const isContentEditable = element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox';

        if (isContentEditable) {
            console.log(`Job-Agent: Detected contenteditable/role-textbox field #${fieldId}, using advanced fill strategy`);

            // For contenteditable, set textContent or innerText
            element.textContent = String(value);

            // Dispatch events to trigger React onChange
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));

            // Also try focus/blur to trigger validation
            element.focus();
            element.blur();

            console.log(`Job-Agent: Filled contenteditable field #${fieldId} with value: ${value}`);
            return true;
        }

        // Check if this is a Greenhouse combobox (role="combobox")
        const isCombobox = element.getAttribute('role') === 'combobox';

        if (isCombobox) {
            console.log(`Job-Agent: Detected combobox field #${fieldId}, using advanced fill strategy`);
            return fillGreenhouseCombobox(element as HTMLInputElement, String(value));
        }

        // Standard HTML inputs - React/Vue Compatibility
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

        if (element.type === 'checkbox' || element.type === 'radio') {
            const inputEl = element as HTMLInputElement;
            if (inputEl.checked !== value) {
                inputEl.click(); // Click is often better for triggering listeners on toggles
            }
        } else {
            // Set value prototype bypass for React 16+
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

        console.log(`Job-Agent: Filled field #${fieldId} with value: ${value}`);
        return true;
    } catch (e) {
        console.error(`Job-Agent: Failed to fill field #${fieldId}`, e);
        return false;
    }
};

// Special handler for Greenhouse combobox components
const fillGreenhouseCombobox = (input: HTMLInputElement, targetValue: string): boolean => {
    try {
        // Step 1: Focus and click to activate the combobox
        input.focus();
        input.click();

        // Step 2: Set the value using native setter to bypass React
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) {
            nativeSetter.call(input, targetValue);
        } else {
            input.value = targetValue;
        }

        // Step 3: Dispatch input event to trigger React's onChange and filter the dropdown
        input.dispatchEvent(new Event('input', { bubbles: true }));

        // Step 4: Wait a bit for the dropdown to render, then try to select the matching option
        setTimeout(() => {
            // Look for the dropdown menu (Greenhouse uses aria-expanded and listbox)
            const listbox = document.querySelector('[role="listbox"]');
            if (listbox) {
                // Find option that matches our value
                const options = Array.from(listbox.querySelectorAll('[role="option"]'));
                const matchingOption = options.find(opt => {
                    const text = opt.textContent?.trim().toLowerCase();
                    const target = targetValue.toLowerCase();
                    return text === target || text?.includes(target);
                });

                if (matchingOption) {
                    (matchingOption as HTMLElement).click();
                    console.log(`Job-Agent: Selected combobox option: ${matchingOption.textContent}`);
                    return true;
                } else {
                    console.warn(`Job-Agent: No matching option found for "${targetValue}"`);
                    // Try pressing Enter as fallback
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
            }
        }, 300);

        return true;
    } catch (e) {
        console.error('Job-Agent: Combobox fill failed', e);
        return false;
    }
};

// Listen for messages from SidePanel
// NOTE: This content script is an ENTRY POINT and must not export anything to avoid 'Unexpected token export' in the browser.
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('[ContentScript] Initialized and listening for messages');

    chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
        console.log('[ContentScript] Received message:', request.type, request);

        if (request.type === 'GET_PAGE_CONTEXT') {
            const { context, fields } = scanPage();
            console.log(`[ContentScript] Scanned page (Frame: ${window.self === window.top ? 'TOP' : 'IFRAME'}):`, { fieldsCount: fields.length, url: window.location.href });

            // RACE CONDITION HANDLING FOR IFRAMES (Greenhouse, etc.)
            // If we found fields, respond immediately (we want to win the race).
            // If we found NO fields, delay response to let others win.
            if (fields.length > 0) {
                sendResponse({ success: true, context, fields });
            } else {
                // Check if we are in a 'likely' form iframe even if 0 fields found yet (loading?)
                const isLikelyFormFrame = window.location.href.includes('grnhse_iframe') ||
                    window.location.href.includes('ashby') ||
                    window.location.href.includes('workday');

                const delay = isLikelyFormFrame ? 200 : 500; // Shorter delay if we might be the right frame but just loading

                setTimeout(() => {
                    sendResponse({ success: true, context, fields });
                }, delay);

                return true; // Keep channel open for async response
            }
        }
        else if (request.type === 'FILL_FIELD') {
            console.log('[ContentScript] Filling field:', request.payload.fieldId, 'with value:', request.payload.value);
            const success = fillFieldOnPage(request.payload.fieldId, request.payload.value);
            console.log('[ContentScript] Fill result:', success);
            sendResponse({ success });
            return true; // Keep channel open
        }
        else if (request.type === 'ATTACH_RESUME') {
            console.log('[ContentScript] Attaching resume:', request.payload.fileName);
            const success = injectResumeFile(
                request.payload.resumeBlob,
                request.payload.fileName,
                request.payload.mimeType || 'application/pdf'
            );
            console.log('[ContentScript] Resume attach result:', success);
            sendResponse({ success });
            return true; // Keep channel open
        }
    });
}