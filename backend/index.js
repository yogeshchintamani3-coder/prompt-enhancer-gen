import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

const defaultClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const MODEL_NAME = "gemini-flash-lite-latest";

const getClient = (req) => {
    const customKey = req.headers['x-api-key'];
    if (customKey) {
        return new GoogleGenAI({ apiKey: customKey });
    }
    return defaultClient;
};
// --- Helper to format content with optional image ---
const formatContents = (text, imageBase64, mimeType = 'image/png') => {
    const parts = [{ text }];
    if (imageBase64) {
        // Remove data:image/png;base64, prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        });
    }
    return { contents: [{ parts }] };
};

// --- Retry Logic with Exponential Backoff ---
async function retryWithBackoff(fn, maxRetries = 5, initialDelay = 2000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            // Check if it's a rate limit (429) or temporary server error (503)
            if (error.status === 429 || error.status === 503) {
                retries++;
                const delay = initialDelay * Math.pow(2, retries);
                console.log(`API Busy (${error.status}). Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached. Google API is currently under extremely high load.');
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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

        const result = await retryWithBackoff(() => getClient(req).models.generateContent({
            model: MODEL_NAME,
            ...formatContents(text, image, mimeType)
        }));
        const responseText = result.candidates[0].content.parts[0].text;
        res.json({ enhancedPrompt: responseText });
    } catch (error) {
        console.error('Enhancement error:', error);
        res.status(500).json({ error: 'Failed to enhance prompt' });
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

        const result = await retryWithBackoff(() => getClient(req).models.generateContent({
            model: MODEL_NAME,
            ...formatContents(text, image, mimeType)
        }));
        
        let responseText = result.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const projectData = JSON.parse(responseText);
        res.json(projectData);
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: 'Failed to generate project' });
    }
});

app.post('/api/translate-prompt', async (req, res) => {
    const { prompt, targetLanguage } = req.body;
    if (!prompt || !targetLanguage) return res.status(400).json({ error: 'Prompt and target language are required' });

    try {
        const result = await retryWithBackoff(() => getClient(req).models.generateContent({
            model: MODEL_NAME,
            contents: `Translate the following project prompt into ${targetLanguage}. Keep the technical terms accurate but make it sound natural in the target language.
            
            Prompt: ${prompt}
            
            Return ONLY the translated text.`
        }));
        const translatedText = result.candidates[0].content.parts[0].text;
        res.json({ translatedText });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Failed to translate prompt' });
    }
});

app.post('/api/general-chat', async (req, res) => {
    const { prompt, image, mimeType } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const result = await retryWithBackoff(() => getClient(req).models.generateContent({
            model: MODEL_NAME,
            ...formatContents(prompt, image, mimeType)
        }));
        const responseText = result.candidates[0].content.parts[0].text;
        res.json({ response: responseText });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to get response from AI' });
    }
});

app.post('/api/improve-prompt', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const result = await retryWithBackoff(() => getClient(req).models.generateContent({
            model: MODEL_NAME,
            contents: `You are a world-class Prompt Engineer. 
            Take the following simple one-liner or basic prompt and transform it into a "Master Prompt".
            
            The Master Prompt should follow the RTFC framework:
            1. **Role**: Assign a specific persona or expert role.
            2. **Task**: Clearly define the objective.
            3. **Format**: Specify the desired output structure (Markdown, Table, etc.).
            4. **Constraints/Context**: Add quality requirements, tone, and what to avoid.
            
            Simple Prompt: ${prompt}
            
            Return ONLY the improved Master Prompt in plain text format (do NOT use markdown symbols like ** or #). Keep it highly readable using clear spacing, capital letters for headers, and standard bullet points.`
        }));
        const responseText = result.candidates[0].content.parts[0].text;
        res.json({ improvedPrompt: responseText });
    } catch (error) {
        console.error('Improvement error:', error);
        res.status(500).json({ error: 'Failed to improve prompt' });
    }
});

app.post('/api/jira-prompt', async (req, res) => {
    const { ticketDetails } = req.body;
    if (!ticketDetails) return res.status(400).json({ error: 'Ticket details are required' });

    try {
        const result = await retryWithBackoff(() => getClient(req).models.generateContent({
            model: MODEL_NAME,
            contents: `You are an expert Senior Software Engineer and Tech Lead. 
            Analyze the following Jira ticket description or bug report.
            
            Your task: Create a comprehensive "Bug Fix Execution Prompt" that a developer can use to immediately understand and solve the issue.
            
            The output should include:
            1. **Root Cause Analysis (Hypothesis)**: What is likely causing this issue?
            2. **Impacted Areas**: Which components or files are probably involved?
            3. **Step-by-Step Fix Instructions**: Clear, technical steps to resolve the issue.
            4. **Testing Strategy**: How to verify the fix (unit tests, manual testing steps).
            
            Ticket Details:
            ${ticketDetails}
            
            Return ONLY the structured response in plain text format (do NOT use markdown symbols like ** or #). Keep it highly readable using clear spacing, capital letters for headers, and standard bullet points.`
        }));
        const responseText = result.candidates[0].content.parts[0].text;
        res.json({ enhancedPrompt: responseText });
    } catch (error) {
        console.error('Jira processing error:', error);
        res.status(500).json({ error: 'Failed to process Jira ticket' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
