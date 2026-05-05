from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Project Architect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "gemini-1.5-flash"
DEFAULT_API_KEY = os.getenv("GEMINI_API_KEY", "")

def get_client(x_api_key: Optional[str] = Header(None)):
    api_key = x_api_key if x_api_key else DEFAULT_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(MODEL_NAME)

async def retry_with_backoff(coro_fn, max_retries=5, initial_delay=2.0):
    retries = 0
    while retries < max_retries:
        try:
            return await coro_fn()
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "503" in err_msg or "Too Many Requests" in err_msg:
                retries += 1
                delay = initial_delay * (2 ** retries)
                print(f"API Busy. Retrying in {delay}s... (Attempt {retries}/{max_retries})")
                await asyncio.sleep(delay)
            else:
                raise e
    raise HTTPException(status_code=503, detail="Max retries reached. API is currently under high load.")

class EnhanceRequest(BaseModel):
    prompt: str
    frontendStack: Optional[str] = "Angular"
    backendStack: Optional[str] = "Python"
    includeGoogleServices: Optional[bool] = True
    includeLogo: Optional[bool] = True

class GenerateRequest(BaseModel):
    enhancedPrompt: str
    frontendStack: Optional[str] = "Angular"
    backendStack: Optional[str] = "Python"
    includeGoogleServices: Optional[bool] = True
    includeLogo: Optional[bool] = True

class TranslateRequest(BaseModel):
    prompt: str
    targetLanguage: str

class ChatRequest(BaseModel):
    prompt: str

class JiraRequest(BaseModel):
    ticketDetails: str

COMMON_RULES = """
CRITICAL ENFORCEMENTS (MUST BE STRICTLY FOLLOWED):
1. **METHOD LENGTH LIMIT**: No single method or function can exceed 50 lines of code. Break down logic into smaller helper functions.
2. **CODE QUALITY & EFFICIENCY**: Ensure highly optimized algorithms, clean code principles, DRY, and SOLID design.
3. **SECURITY**: Implement robust input validation, secure authentication, and prevent common vulnerabilities (XSS, CSRF, SQLi).
4. **PROBLEM ALIGNMENT**: Directly and exclusively solve the stated problem statement.
5. **TESTING**: Generate comprehensive, runnable unit and integration tests for every component.
6. **ACCESSIBILITY (a11y)**: Frontend code must use semantic HTML, ARIA attributes, and adhere to WCAG standards.
7. **GOOGLE SERVICES**: Efficiently integrate Google APIs/Services where applicable.
"""

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/enhance-prompt")
async def enhance_prompt(req: EnhanceRequest, client = Depends(get_client)):
    prompt_content = f"""You are a prompt engineering expert. Enhance the following simple project requirement into a "Super Prompt".
    
    TECH STACK PREFERENCE:
    - Frontend: {req.frontendStack}
    - Backend: {req.backendStack}
    
    MANDATORY ARCHITECTURAL REQUIREMENTS:
    1. Use a strict Model-View-Controller (MVC) structure.
    2. Use Google Fonts (Inter & Montserrat).
    3. {'Implement Google reCAPTCHA & Google Auth/Services.' if req.includeGoogleServices else 'Focus on standalone security best practices.'}
    4. {'BRANDING & LOGO: Define a clear visual identity including logo concept, color psychology, and iconography.' if req.includeLogo else ''}
    5. DESIGN SPECIFICATION: Include a detailed section describing the UI/UX layout, components, and user flow as if designing in Figma.
    
    {COMMON_RULES}
    
    Original Requirement: {req.prompt}
    
    Return ONLY the enhanced prompt in Markdown format."""
    
    async def call_api():
        response = await asyncio.to_thread(client.generate_content, prompt_content)
        return response.text

    try:
        text = await retry_with_backoff(call_api)
        return {"enhancedPrompt": text}
    except Exception as e:
        print(f"Enhancement error: {e}")
        raise HTTPException(status_code=500, detail="Failed to enhance prompt")

@app.post("/api/generate-project")
async def generate_project(req: GenerateRequest, client = Depends(get_client)):
    prompt_content = f"""You are an expert full-stack developer and UI Designer. Based on the following requirement, generate a complete project plan, code, and design specs.
    
    STRICT ARCHITECTURAL RULES:
    - Use {req.frontendStack} for the frontend and {req.backendStack} for the backend.
    - Follow the Model-View-Controller (MVC) pattern exactly.
    - {'Incorporate Google Fonts, reCAPTCHA, and Google APIs.' if req.includeGoogleServices else 'Use professional typography and standard security.'}
    - DEPLOYMENT READINESS: Provide a deployment guide assuming the user will deploy using platforms that only require a GitHub repository URL (like Render, Vercel, or Netlify).
    
    {COMMON_RULES}
    
    Requirement: {req.enhancedPrompt}
    
    Please provide the following in a structured JSON format:
    1. projectStructure: A list of files and folders.
    2. backendCode: Key backend files and their contents.
    3. uiCode: Key frontend components and their contents.
    4. testCases: Comprehensive unit and integration test code.
    5. deployment: A Markdown guide explaining how to commit the code to a GitHub URL, and how to deploy by simply providing that GitHub URL to hosting platforms (e.g. Render, Vercel). Do NOT generate Dockerfiles or complex CI/CD scripts.
    6. designSpecs: A HIGHLY DETAILED description of the UI layout (Figma-like specs) as a MARKDOWN STRING.
    7. logoDesign: {'A comprehensive description of the logo design, branding elements, and visual identity (Markdown format).' if req.includeLogo else 'Not requested.'}
    8. documentation: A README.md content with setup instructions.
    9. validation: A detailed explanation of why the architecture, tests, and design are robust.
    
    Format the response as a valid JSON object. Do not include markdown code blocks around the JSON."""

    async def call_api():
        response = await asyncio.to_thread(client.generate_content, prompt_content)
        return response.text

    try:
        text = await retry_with_backoff(call_api)
        text = text.replace('```json', '').replace('```', '').strip()
        import json
        return json.loads(text)
    except Exception as e:
        print(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate project")

@app.post("/api/translate-prompt")
async def translate_prompt(req: TranslateRequest, client = Depends(get_client)):
    prompt_content = f"""Translate the following project prompt into {req.targetLanguage}. Keep the technical terms accurate but make it sound natural in the target language.
    
    Prompt: {req.prompt}
    
    Return ONLY the translated text."""
    
    async def call_api():
        response = await asyncio.to_thread(client.generate_content, prompt_content)
        return response.text

    try:
        text = await retry_with_backoff(call_api)
        return {"translatedText": text}
    except Exception as e:
        print(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to translate prompt")

@app.post("/api/general-chat")
async def general_chat(req: ChatRequest, client = Depends(get_client)):
    async def call_api():
        response = await asyncio.to_thread(client.generate_content, req.prompt)
        return response.text

    try:
        text = await retry_with_backoff(call_api)
        return {"response": text}
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get response from AI")

@app.post("/api/jira-prompt")
async def jira_prompt(req: JiraRequest, client = Depends(get_client)):
    prompt_content = f"""You are an expert Senior Software Engineer and Tech Lead. 
    Analyze the following Jira ticket description or bug report.
    
    Your task: Create a comprehensive "Bug Fix Execution Prompt" that a developer can use to immediately understand and solve the issue.
    
    {COMMON_RULES}
    
    The output should include:
    1. **Root Cause Analysis (Hypothesis)**: What is likely causing this issue?
    2. **Impacted Areas**: Which components or files are probably involved?
    3. **Step-by-Step Fix Instructions**: Clear, technical steps to resolve the issue.
    4. **Testing Strategy**: How to verify the fix (unit tests, manual testing steps).
    
    Ticket Details:
    {req.ticketDetails}
    
    Return ONLY the structured markdown response."""
    
    async def call_api():
        response = await asyncio.to_thread(client.generate_content, prompt_content)
        return response.text

    try:
        text = await retry_with_backoff(call_api)
        return {"enhancedPrompt": text}
    except Exception as e:
        print(f"Jira processing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process Jira ticket")
