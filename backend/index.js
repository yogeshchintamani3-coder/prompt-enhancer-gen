import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// ============================================================
// MULTI-PROVIDER AI CONFIGURATION
// Supports: Google Gemini + OpenAI ChatGPT
// Automatic failover: if one provider/model is busy, switches to next
// ============================================================

const GEMINI_HTTP_OPTIONS = {
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiVersion: 'v1beta'
};

const AI_PROVIDERS = {
    gemini: {
        models: [
            { name: 'gemini-2.0-flash-lite', supportsImages: true },
            { name: 'gemini-2.0-flash', supportsImages: true },
            { name: 'gemini-1.5-flash', supportsImages: true },
            { name: 'gemini-1.5-flash-8b', supportsImages: true },
        ],
        enabled: !!process.env.GEMINI_API_KEY
    },
    openai: {
        models: [
            { name: 'gpt-4o-mini', supportsImages: true },
            { name: 'gpt-4o', supportsImages: true },
            { name: 'gpt-3.5-turbo', supportsImages: false },
        ],
        enabled: !!process.env.OPENAI_API_KEY
    },
    groq: {
        models: [
            { name: 'llama-3.3-70b-versatile', supportsImages: false },
            { name: 'llama-3.1-8b-instant', supportsImages: false },
            { name: 'mixtral-8x7b-32768', supportsImages: false },
            { name: 'gemma2-9b-it', supportsImages: false },
        ],
        enabled: !!process.env.GROQ_API_KEY
    }
};

const geminiClient = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: GEMINI_HTTP_OPTIONS })
    : null;

const openaiClient = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const groqClient = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

const getGeminiClient = (req) => {
    const customKey = req.headers['x-api-key'];
    if (customKey) {
        return new GoogleGenAI({ apiKey: customKey, httpOptions: GEMINI_HTTP_OPTIONS });
    }
    return geminiClient;
};

const getOpenAIClient = (req) => {
    const customOpenAIKey = req.headers['x-openai-key'];
    if (customOpenAIKey) {
        return new OpenAI({ apiKey: customOpenAIKey });
    }
    return openaiClient;
};

// --- Helper: format content for Gemini ---
const formatGeminiContents = (text, imageBase64, mimeType = 'image/png') => {
    const parts = [{ text }];
    if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
            inlineData: { data: cleanBase64, mimeType }
        });
    }
    return { contents: [{ parts }] };
};

// --- Helper: format content for OpenAI ---
const formatOpenAIMessages = (text, imageBase64, mimeType = 'image/png') => {
    const content = [{ type: 'text', text }];
    if (imageBase64) {
        const base64Url = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:${mimeType};base64,${imageBase64}`;
        content.push({
            type: 'image_url',
            image_url: { url: base64Url, detail: 'auto' }
        });
    }
    return [{ role: 'user', content }];
};

// --- Call Gemini Model ---
async function callGemini(client, model, text, imageBase64, mimeType) {
    const result = await client.models.generateContent({
        model: model.name,
        ...formatGeminiContents(text, imageBase64, mimeType)
    });
    return result.candidates[0].content.parts[0].text;
}

// --- Call OpenAI Model ---
async function callOpenAI(client, model, text, imageBase64, mimeType) {
    const messages = formatOpenAIMessages(text, imageBase64, mimeType);
    const response = await client.chat.completions.create({
        model: model.name,
        messages,
        max_tokens: 4096
    });
    return response.choices[0].message.content;
}

// --- Call Groq Model (OpenAI-compatible API) ---
async function callGroq(client, model, text, imageBase64, mimeType) {
    const response = await client.chat.completions.create({
        model: model.name,
        messages: [{ role: 'user', content: text }],
        max_tokens: 4096
    });
    return response.choices[0].message.content;
}

// --- Multi-Provider Failover Engine ---
// Priority: Gemini models first (free/cheaper), then OpenAI as fallback.
// ANY failure on one model/provider automatically moves to the next — never stops early.
async function callWithFailover(req, text, imageBase64 = null, mimeType = 'image/png') {
    const hasImage = !!imageBase64;
    const errors = [];

    const gemini = getGeminiClient(req);
    const openai = getOpenAIClient(req);

    const attempts = [];

    if (gemini) {
        for (const model of AI_PROVIDERS.gemini.models) {
            if (hasImage && !model.supportsImages) continue;
            attempts.push({ provider: 'gemini', client: gemini, model, callFn: callGemini });
        }
    }

    if (openai) {
        for (const model of AI_PROVIDERS.openai.models) {
            if (hasImage && !model.supportsImages) continue;
            attempts.push({ provider: 'openai', client: openai, model, callFn: callOpenAI });
        }
    }

    // Add Groq models (generous free tier — best fallback when Gemini and OpenAI are exhausted)
    if (groqClient) {
        for (const model of AI_PROVIDERS.groq.models) {
            if (hasImage && !model.supportsImages) continue;
            attempts.push({ provider: 'groq', client: groqClient, model, callFn: callGroq });
        }
    }

    // Add OpenAI from user-provided key as extra fallback
    if (req.headers['x-openai-key'] && !openai) {
        const userOpenAI = new OpenAI({ apiKey: req.headers['x-openai-key'] });
        for (const model of AI_PROVIDERS.openai.models) {
            if (hasImage && !model.supportsImages) continue;
            attempts.push({ provider: 'openai', client: userOpenAI, model, callFn: callOpenAI });
        }
    }

    // Add Gemini from user-provided key as extra fallback
    if (req.headers['x-api-key'] && !gemini) {
        const userGemini = new GoogleGenAI({ apiKey: req.headers['x-api-key'], httpOptions: GEMINI_HTTP_OPTIONS });
        for (const model of AI_PROVIDERS.gemini.models) {
            if (hasImage && !model.supportsImages) continue;
            attempts.push({ provider: 'gemini', client: userGemini, model, callFn: callGemini });
        }
    }

    if (attempts.length === 0) {
        throw new Error('No AI providers configured. Set GEMINI_API_KEY or OPENAI_API_KEY environment variable on the server.');
    }

    const maxPasses = 2;

    for (let pass = 0; pass < maxPasses; pass++) {
        for (const attempt of attempts) {
            try {
                const result = await attempt.callFn(attempt.client, attempt.model, text, imageBase64, mimeType);
                if (pass > 0 || attempt !== attempts[0]) {
                    console.log(`[FAILOVER] Succeeded with ${attempt.provider}/${attempt.model.name} (pass ${pass + 1})`);
                }
                return result;
            } catch (error) {
                const status = error.status || error.httpStatusCode || error.code;
                const errorMessage = error.message || '';
                console.warn(`[${attempt.provider}/${attempt.model.name}] Failed (${status || 'unknown'}): ${errorMessage.slice(0, 150)}`);
                errors.push({ provider: attempt.provider, model: attempt.model.name, status, error: errorMessage });
                // ALWAYS continue to next model — never throw here
                continue;
            }
        }

        if (pass < maxPasses - 1) {
            const delay = 3000;
            console.log(`All models failed in pass ${pass + 1}. Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All attempts exhausted — provide a meaningful error
    const allLocationErrors = errors.length > 0 && errors.every(e => e.error.includes('location'));
    if (allLocationErrors) {
        throw new Error(
            'AI service not available in the current server region. ' +
            'Please provide your own API key in settings.'
        );
    }

    const allAuthErrors = errors.length > 0 && errors.every(e => e.status === 401 || e.status === 403);
    if (allAuthErrors) {
        throw new Error('AI API key is invalid or expired. Please check your API key configuration.');
    }

    const lastError = errors[errors.length - 1];
    throw new Error(
        `All AI models failed after ${maxPasses} passes. Last error: ${lastError?.error?.slice(0, 100) || 'Unknown'}. Please try again.`
    );
}

app.get('/api/health', (req, res) => {
    const providers = {};
    if (AI_PROVIDERS.gemini.enabled) providers.gemini = AI_PROVIDERS.gemini.models.map(m => m.name);
    if (AI_PROVIDERS.openai.enabled) providers.openai = AI_PROVIDERS.openai.models.map(m => m.name);
    if (AI_PROVIDERS.groq.enabled) providers.groq = AI_PROVIDERS.groq.models.map(m => m.name);
    res.json({ status: 'ok', providers });
});

app.post('/api/enhance-prompt', async (req, res) => {
    const { prompt, frontendStack, backendStack, includeGoogleServices, includeLogo, image, mimeType } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const text = `You are a prompt engineering expert. Enhance the following simple project requirement into a "Super Prompt".
            
            TECH STACK PREFERENCE:
            - Frontend: ${frontendStack || 'Modern React'}
            - Backend: ${backendStack || 'Node.js/Express'}
            
            MANDATORY ARCHITECTURAL REQUIREMENTS:
            1. Use a strict Model-View-Controller (MVC) structure.
            2. Use Google Fonts (Inter & Montserrat).
            3. ${includeGoogleServices ? 'Implement Google reCAPTCHA & Google Auth/Services.' : 'Focus on standalone security best practices.'}
            4. ${includeLogo ? 'BRANDING & LOGO: Define a clear visual identity including logo concept, color psychology, and iconography.' : ''}
            5. GENERATE COMPREHENSIVE AUTOMATED TEST CASES.
            6. DESIGN SPECIFICATION: Include a detailed section describing the UI/UX layout, components, and user flow as if designing in Figma.
            7. Follow proper design patterns and clean code principles.
            
            Original Requirement: ${prompt}
            ${image ? 'NOTE: I have also attached a screenshot for reference. Please analyze it carefully to understand the UI layout or error details.' : ''}
            
            Return ONLY the enhanced prompt in plain text format (do NOT use markdown symbols like ** or #). Keep it highly readable using clear spacing, capital letters for headers, and standard bullet points.`;

        const responseText = await callWithFailover(req, text, image, mimeType);
        res.json({ enhancedPrompt: responseText });
    } catch (error) {
        console.error('Enhancement error:', error);
        res.status(500).json({ error: error.message || 'Failed to enhance prompt. Please try again.' });
    }
});

app.post('/api/generate-project', async (req, res) => {
    const { enhancedPrompt, frontendStack, backendStack, includeGoogleServices, includeLogo, image, mimeType } = req.body;
    if (!enhancedPrompt) return res.status(400).json({ error: 'Enhanced prompt is required' });

    try {
        const text = `You are an expert full-stack developer and UI Designer. Based on the following requirement, generate a complete project plan, code, and design specs.
            
            STRICT ARCHITECTURAL RULES:
            - Use ${frontendStack} for the frontend and ${backendStack} for the backend.
            - Follow the Model-View-Controller (MVC) pattern exactly.
            - ${includeGoogleServices ? 'Incorporate Google Fonts, reCAPTCHA, and Google APIs.' : 'Use professional typography and standard security.'}
            - Include comprehensive unit and integration tests (ensure they are runnable).
            - DEPLOYMENT READINESS: Provide a deployment guide assuming the user will deploy using platforms that only require a GitHub repository URL (like Render, Vercel, or Netlify).
            
            Requirement: ${enhancedPrompt}
            ${image ? 'NOTE: I have also attached a screenshot for reference. Use this image to guide the UI design and layout.' : ''}
            
            Please provide the following in a structured JSON format:
            1. projectStructure: A list of files and folders (showing MVC).
            2. backendCode: Key backend files (Models, Controllers, Routes, Config) and their contents.
            3. uiCode: Key frontend components and their contents.
            4. testCases: Comprehensive unit and integration test code.
            5. deployment: A Markdown guide explaining how to commit the code to a GitHub URL, and how to deploy the frontend and backend by simply providing that GitHub URL to hosting platforms (e.g. Render, Vercel). Do NOT generate Dockerfiles or complex CI/CD scripts.
            6. designSpecs: A HIGHLY DETAILED description of the UI layout (Figma-like specs) as a MARKDOWN STRING (including HEX colors, spacing, typography, and component details).
            7. logoDesign: ${includeLogo ? 'A comprehensive description of the logo design, branding elements, and visual identity (Markdown format).' : 'Not requested.'}
            8. documentation: A README.md content with setup instructions.
            9. validation: A detailed explanation of why the architecture, tests, and design are robust.
            
            Format the response as a valid JSON object. Do not include markdown code blocks around the JSON.`;

        let responseText = await callWithFailover(req, text, image, mimeType);
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const projectData = JSON.parse(responseText);
        res.json(projectData);
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate project. Please try again.' });
    }
});

app.post('/api/translate-prompt', async (req, res) => {
    const { prompt, targetLanguage } = req.body;
    if (!prompt || !targetLanguage) return res.status(400).json({ error: 'Prompt and target language are required' });

    try {
        const translateText = `Translate the following project prompt into ${targetLanguage}. Keep the technical terms accurate but make it sound natural in the target language.\n\nPrompt: ${prompt}\n\nReturn ONLY the translated text.`;
        const translatedText = await callWithFailover(req, translateText);
        res.json({ translatedText });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: error.message || 'Failed to translate prompt. Please try again.' });
    }
});

app.post('/api/general-chat', async (req, res) => {
    const { prompt, image, mimeType } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const responseText = await callWithFailover(req, prompt, image, mimeType);
        res.json({ response: responseText });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message || 'Failed to get response from AI. Please try again.' });
    }
});

app.post('/api/improve-prompt', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const improveText = `You are a world-class Prompt Engineer. 
            Take the following simple one-liner or basic prompt and transform it into a "Master Prompt".
            
            The Master Prompt should follow the RTFC framework:
            1. **Role**: Assign a specific persona or expert role.
            2. **Task**: Clearly define the objective.
            3. **Format**: Specify the desired output structure (Markdown, Table, etc.).
            4. **Constraints/Context**: Add quality requirements, tone, and what to avoid.
            
            Simple Prompt: ${prompt}
            
            Return ONLY the improved Master Prompt in plain text format (do NOT use markdown symbols like ** or #). Keep it highly readable using clear spacing, capital letters for headers, and standard bullet points.`;

        const responseText = await callWithFailover(req, improveText);
        res.json({ improvedPrompt: responseText });
    } catch (error) {
        console.error('Improvement error:', error);
        res.status(500).json({ error: error.message || 'Failed to improve prompt. Please try again.' });
    }
});

app.post('/api/jira-prompt', async (req, res) => {
    const { ticketDetails } = req.body;
    if (!ticketDetails) return res.status(400).json({ error: 'Ticket details are required' });

    try {
        const jiraText = `You are an expert Senior Software Engineer and Tech Lead. 
            Analyze the following Jira ticket description or bug report.
            
            Your task: Create a comprehensive "Bug Fix Execution Prompt" that a developer can use to immediately understand and solve the issue.
            
            The output should include:
            1. **Root Cause Analysis (Hypothesis)**: What is likely causing this issue?
            2. **Impacted Areas**: Which components or files are probably involved?
            3. **Step-by-Step Fix Instructions**: Clear, technical steps to resolve the issue.
            4. **Testing Strategy**: How to verify the fix (unit tests, manual testing steps).
            
            Ticket Details:
            ${ticketDetails}
            
            Return ONLY the structured response in plain text format (do NOT use markdown symbols like ** or #). Keep it highly readable using clear spacing, capital letters for headers, and standard bullet points.`;

        const responseText = await callWithFailover(req, jiraText);
        res.json({ enhancedPrompt: responseText });
    } catch (error) {
        console.error('Jira processing error:', error);
        res.status(500).json({ error: error.message || 'Failed to process Jira ticket. Please try again.' });
    }
});

app.post('/api/analyze-image', async (req, res) => {
    const { image, mimeType, analysisType, customPrompt } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });

    const analysisPrompts = {
        describe: `Analyze this image in detail. Describe what you see including:
            - Main subject and content
            - Colors, layout, and composition
            - Text visible in the image (if any)
            - Overall context and purpose
            Provide a clear, structured description.`,

        ocr: `Extract ALL text visible in this image. Return the text exactly as it appears, preserving:
            - Line breaks and formatting
            - Headers and labels
            - Any code or technical content
            Return ONLY the extracted text, nothing else.`,

        ui_review: `Analyze this UI/UX screenshot and provide:
            1. LAYOUT ANALYSIS: Describe the page structure, sections, and component hierarchy.
            2. DESIGN ASSESSMENT: Evaluate colors, typography, spacing, and visual consistency.
            3. UX ISSUES: Identify potential usability problems or improvements.
            4. ACCESSIBILITY: Note any accessibility concerns (contrast, text size, etc.).
            5. SUGGESTIONS: Provide 3-5 specific improvement recommendations.
            Return in plain text with clear headers.`,

        debug: `Analyze this screenshot for errors or bugs. Look for:
            1. ERROR MESSAGES: Identify and transcribe any error text, stack traces, or warnings.
            2. ROOT CAUSE: Suggest what might be causing the issue.
            3. FIX SUGGESTIONS: Provide specific steps to resolve the problem.
            4. RELEVANT CODE: If code is visible, identify the problematic section.
            Return a structured analysis in plain text.`,

        code_review: `Analyze the code visible in this screenshot:
            1. LANGUAGE & FRAMEWORK: Identify the programming language and any frameworks.
            2. CODE QUALITY: Assess readability, naming conventions, and structure.
            3. BUGS & ISSUES: Identify potential bugs, security issues, or anti-patterns.
            4. IMPROVEMENTS: Suggest specific improvements with code examples.
            5. BEST PRACTICES: Note which best practices are followed or missing.
            Return a detailed code review in plain text.`,

        diagram: `Analyze this diagram/flowchart/architecture image:
            1. TYPE: What kind of diagram is this (flowchart, sequence, ER, architecture, etc.)?
            2. COMPONENTS: List all entities, services, or nodes visible.
            3. RELATIONSHIPS: Describe the connections and data flow between components.
            4. SUMMARY: Provide a high-level summary of what the diagram represents.
            5. TEXT REPRESENTATION: Convert the diagram into a text-based representation.
            Return a structured analysis.`,

        custom: customPrompt || 'Analyze this image and describe what you see in detail.'
    };

    const promptText = analysisPrompts[analysisType] || analysisPrompts.describe;

    try {
        const responseText = await callWithFailover(req, promptText, image, mimeType || 'image/png');
        res.json({ analysis: responseText, type: analysisType || 'describe' });
    } catch (error) {
        console.error('Image analysis error:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze image. Please try again.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
