# AI Prompt Enhancer & Auto Project Generator - Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [AI Model Details](#ai-model-details)
5. [Text-to-Speech (TTS)](#text-to-speech-tts)
6. [Translation System](#translation-system)
7. [Cursor IDE Extension](#cursor-ide-extension)
8. [Browser Extension](#browser-extension)
9. [API Reference](#api-reference)
10. [Deployment](#deployment)
11. [Security Considerations](#security-considerations)

---

## Project Overview

AI Prompt Enhancer is a full-stack application that transforms simple project requirements into comprehensive, production-ready "Super Prompts" and complete project blueprints. It supports multiple modes of operation including prompt enhancement, project generation, general AI chat, Jira ticket analysis, and multi-language translation with text-to-speech.

### Key Features

- **Architect Mode**: Transforms basic requirements into high-scoring "Super Prompts" optimized for LLMs
- **Auto Project Generation**: Generates full-stack code (Backend & Frontend), MVC architecture, test cases, and design specifications
- **Multi-Language Support**: Translation into 11+ languages
- **Smart TTS**: Built-in Text-to-Speech with automatic language detection
- **Jira Assistant**: Analyze Jira tickets or bug logs for execution plans and root cause analysis
- **Voice Typing**: Voice-to-text for hands-free requirement entry
- **Image Analysis**: Upload screenshots for AI-powered visual context understanding
- **Cursor IDE Extension**: Enhance prompts directly within Cursor/VS Code
- **Browser Extension**: Enhance prompts on ChatGPT, Claude, and Google AI platforms

---

## System Architecture

```
+-------------------+       +-------------------+       +-------------------+
|   Frontend (Web)  |       | Cursor Extension  |       | Browser Extension |
|   React + Vite    |       |   VS Code API     |       |  Chrome MV3       |
+--------+----------+       +--------+----------+       +--------+----------+
         |                           |                           |
         |    HTTPS POST             |    HTTPS POST             |    HTTPS POST
         v                           v                           v
+------------------------------------------------------------------------+
|                        Backend API (Express.js)                          |
|                    https://prompt-enhancer-backend-vfkc.onrender.com     |
+------------------------------------------------------------------------+
         |
         |  Google GenAI SDK
         v
+-------------------+
|  Google Gemini AI |
|  (Flash Lite)    |
+-------------------+
```

### Component Breakdown

| Component | Purpose | Location |
|-----------|---------|----------|
| Backend API | Central AI processing, prompt enhancement, translation | `/backend/` |
| Frontend Web App | Full UI with all features, auth, history | `/frontend/` |
| Cursor Extension | IDE-integrated prompt enhancement | `/cursor-extension/` |
| Browser Extension | In-browser prompt enhancement on AI platforms | `/browser-extension/` |

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | v18+ | Runtime environment |
| **Express** | ^5.2.1 | Web framework for REST API |
| **@google/genai** | ^1.52.0 | Google Generative AI SDK (Gemini) |
| **cors** | ^2.8.6 | Cross-Origin Resource Sharing middleware |
| **dotenv** | ^17.4.2 | Environment variable management |
| **morgan** | ^1.10.1 | HTTP request logging |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | ^19.2.5 | UI framework |
| **Vite** | ^8.0.10 | Build tool and dev server |
| **@react-oauth/google** | ^0.13.5 | Google OAuth authentication |
| **jwt-decode** | ^4.0.0 | JWT token decoding for user profiles |
| **firebase-tools** | ^15.16.0 | Firebase hosting deployment |

### Cursor IDE Extension

| Technology | Version | Purpose |
|-----------|---------|---------|
| **VS Code Extension API** | ^1.80.0 | IDE integration |
| **node-fetch** | ^2.7.0 | HTTP client for API calls |

### Browser Extension

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Chrome Manifest V3** | 3 | Modern Chrome extension platform |
| **Content Scripts** | - | Injects UI into AI platforms |

---

## AI Model Details

### Primary Model: Google Gemini Flash Lite

| Property | Value |
|----------|-------|
| **Model Name** | `gemini-flash-lite-latest` |
| **Provider** | Google (via @google/genai SDK) |
| **Type** | Large Language Model (LLM) |
| **Use Case** | Text generation, prompt enhancement, translation, code generation |
| **API** | Google Generative AI API |
| **Authentication** | API Key (GEMINI_API_KEY) |
| **Multimodal** | Yes - supports text + image input |

### Why Gemini Flash Lite?

- **Speed**: Optimized for fast responses (lower latency than standard Gemini Pro)
- **Cost**: Most cost-effective model in the Gemini family
- **Quality**: Sufficient for prompt engineering and text transformation tasks
- **Multimodal**: Supports image input for screenshot analysis
- **Rate Limits**: Higher throughput compared to larger models

### API Key Management

- **Server Default**: `GEMINI_API_KEY` environment variable on the backend
- **Per-User Override**: Users can provide their own API key via `x-api-key` header
- **Key Storage**: Users store personal keys in browser localStorage (encrypted in transit)

### Retry Strategy

The backend implements exponential backoff for rate limiting:
- Maximum retries: 5
- Initial delay: 2000ms
- Backoff multiplier: 2x (2s, 4s, 8s, 16s, 32s)
- Handled HTTP codes: 429 (Too Many Requests), 503 (Service Unavailable)

---

## Text-to-Speech (TTS)

### Technology: Web Speech API (SpeechSynthesis)

The application uses the browser's built-in **Web Speech API** for text-to-speech functionality. No external TTS service is required.

| Property | Detail |
|----------|--------|
| **API** | `window.speechSynthesis` (Web Speech API) |
| **Type** | Client-side (runs in browser) |
| **Cost** | Free (browser-native) |
| **Voices** | Uses system-installed voices |
| **Language Detection** | Automatic based on translation target language |

### Supported Languages for TTS

| Language | Code | Voice Matching |
|----------|------|----------------|
| English | en-US | Default |
| Hindi | hi-IN | Auto-matched |
| Marathi | mr-IN | Auto-matched |
| Spanish | es-ES | Auto-matched |
| French | fr-FR | Auto-matched |
| German | de-DE | Auto-matched |
| Chinese | zh-CN | Auto-matched |
| Japanese | ja-JP | Auto-matched |
| Arabic | ar-SA | Auto-matched |
| Russian | ru-RU | Auto-matched |
| Portuguese | pt-BR | Auto-matched |

### TTS Workflow

1. User clicks "Listen" button
2. System determines current language (original English or translated language)
3. Markdown formatting is stripped from text
4. Browser voice list is queried
5. Best matching voice is selected for the target language
6. Speech synthesis begins with rate=1.0 and pitch=1.0
7. User can stop playback at any time with "Stop" button

### TTS Configuration

```
Rate: 1.0 (normal speed)
Pitch: 1.0 (normal pitch)
Voice: Auto-selected based on language code
Fallback: Browser default voice if no matching voice found
```

---

## Translation System

### Technology: Google Gemini AI (LLM-based Translation)

Unlike traditional machine translation (e.g., Google Translate API), this system uses the **Gemini LLM** for context-aware translation that preserves technical accuracy.

| Property | Detail |
|----------|--------|
| **Engine** | Google Gemini Flash Lite |
| **Approach** | LLM-based contextual translation |
| **Endpoint** | `POST /api/translate-prompt` |
| **Advantage** | Preserves technical terms while natural language flows |

### Supported Translation Languages

| # | Language | BCP-47 Code |
|---|----------|-------------|
| 1 | English | en-US |
| 2 | Hindi | hi-IN |
| 3 | Marathi | mr-IN |
| 4 | Spanish | es-ES |
| 5 | French | fr-FR |
| 6 | German | de-DE |
| 7 | Chinese | zh-CN |
| 8 | Japanese | ja-JP |
| 9 | Arabic | ar-SA |
| 10 | Russian | ru-RU |
| 11 | Portuguese | pt-BR |

### Translation Prompt Strategy

The system instructs the AI to:
- Keep technical terms accurate
- Make the output sound natural in the target language
- Return only the translated text (no explanations)

---

## Cursor IDE Extension

### Overview

A VS Code/Cursor extension that allows developers to enhance prompts directly from the editor without leaving their workflow.

### How It Works

1. **Select text** in the editor (or place cursor on a line)
2. **Trigger** via status bar button, context menu, or command palette
3. If no text is available, an **input box** appears for manual prompt entry
4. The prompt is sent to the backend API for enhancement
5. The enhanced prompt is:
   - Copied to clipboard automatically
   - Opened in a new Markdown document beside the editor

### Extension Manifest

| Field | Value |
|-------|-------|
| **Name** | prompt-enhancer-cursor |
| **Display Name** | AI Prompt Enhancer |
| **Command** | `prompt-enhancer.enhance` |
| **Activation** | Always active (wildcard) |
| **Menu** | Editor context menu (modification group) |
| **Status Bar** | Right-aligned with sparkle icon |

### Text Resolution Priority

1. Selected/highlighted text in editor
2. Current line text (if no selection)
3. Manual input box (if line is empty or no file open)

---

## Browser Extension

### Overview

A Chrome extension (Manifest V3) that adds prompt enhancement capabilities directly on AI platforms.

### Supported Platforms

| Platform | URL Pattern |
|----------|-------------|
| ChatGPT | `https://chatgpt.com/*` |
| OpenAI | `https://*.openai.com/*` |
| Claude | `https://claude.ai/*` |
| Google AI | `https://*.google.com/*` |

### Permissions

- `storage` - Save user preferences
- `activeTab` - Access current page content

---

## API Reference

### Base URL

**Production**: `https://prompt-enhancer-backend-vfkc.onrender.com/api`
**Local Development**: `http://localhost:5000/api`

### Endpoints

#### GET /api/health
Health check endpoint.

**Response**: `{ "status": "ok" }`

---

#### POST /api/enhance-prompt
Transforms a simple requirement into a production-ready "Super Prompt".

**Request Body**:
```json
{
  "prompt": "Build a coffee shop app",
  "frontendStack": "Angular",
  "backendStack": "Java (Spring Boot)",
  "includeGoogleServices": true,
  "includeLogo": true,
  "image": "<base64-string>",
  "mimeType": "image/png"
}
```

**Response**: `{ "enhancedPrompt": "..." }`

---

#### POST /api/generate-project
Generates a complete project blueprint from an enhanced prompt.

**Request Body**:
```json
{
  "enhancedPrompt": "...",
  "frontendStack": "Angular",
  "backendStack": "Java (Spring Boot)",
  "includeGoogleServices": true,
  "includeLogo": true,
  "image": "<base64-string>",
  "mimeType": "image/png"
}
```

**Response**:
```json
{
  "projectStructure": ["..."],
  "backendCode": {...},
  "uiCode": {...},
  "testCases": {...},
  "deployment": "...",
  "designSpecs": "...",
  "logoDesign": "...",
  "documentation": "...",
  "validation": "..."
}
```

---

#### POST /api/translate-prompt
Translates a prompt into the specified language.

**Request Body**:
```json
{
  "prompt": "Your enhanced prompt text...",
  "targetLanguage": "Hindi"
}
```

**Response**: `{ "translatedText": "..." }`

---

#### POST /api/improve-prompt
Enhances a simple prompt using the RTFC framework (Role, Task, Format, Constraints).

**Request Body**:
```json
{
  "prompt": "write a story about a cat"
}
```

**Response**: `{ "improvedPrompt": "..." }`

---

#### POST /api/general-chat
General-purpose AI chat with optional image input.

**Request Body**:
```json
{
  "prompt": "Explain microservices architecture",
  "image": "<base64-string>",
  "mimeType": "image/png"
}
```

**Response**: `{ "response": "..." }`

---

#### POST /api/jira-prompt
Analyzes Jira tickets or bug reports for root cause and fix instructions.

**Request Body**:
```json
{
  "ticketDetails": "Bug: Login fails when..."
}
```

**Response**: `{ "enhancedPrompt": "..." }`

---

### Custom API Key Header

All endpoints support an optional `x-api-key` header for users who want to use their own Gemini API key instead of the server default.

---

## Deployment

### Backend (Render)

| Property | Value |
|----------|-------|
| **Platform** | Render.com |
| **URL** | https://prompt-enhancer-backend-vfkc.onrender.com |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Environment** | Node.js |
| **Env Variables** | `GEMINI_API_KEY`, `PORT` |

### Frontend (Firebase Hosting / Vercel)

| Property | Value |
|----------|-------|
| **Platform** | Firebase Hosting or Vercel |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist/` |
| **Env Variables** | `VITE_API_BASE`, `VITE_GOOGLE_CLIENT_ID` |

### Cursor Extension

| Property | Value |
|----------|-------|
| **Distribution** | `.vsix` file (manually installed) |
| **Install** | `code --install-extension prompt-enhancer-cursor.vsix` |
| **Marketplace** | Not published (private distribution) |

### Browser Extension

| Property | Value |
|----------|-------|
| **Distribution** | `.zip` file (side-loaded) |
| **Install** | Chrome > Extensions > Load Unpacked |
| **Store** | Not published (private distribution) |

---

## Security Considerations

### API Key Protection
- Server-side API key stored in environment variables (never in code)
- Per-user keys transmitted over HTTPS only
- `.env` file excluded from git via `.gitignore`

### CORS Configuration
- Backend allows cross-origin requests (required for web frontend and extensions)
- Production should restrict to specific origins

### Request Size Limits
- Express body parser limited to 50MB (for image uploads)
- Image uploads validated to 5MB max on frontend

### Authentication
- Google OAuth for user identification on frontend
- JWT tokens decoded client-side for profile display
- No server-side session management (stateless API)

---

## Environment Variables

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Generative AI API key |
| `PORT` | No | Server port (default: 5000) |

### Frontend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE` | No | Backend API URL (default: http://localhost:5000/api) |
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |

---

## Development Setup

### Prerequisites
- Node.js v18+
- Google Gemini API key (from Google AI Studio)
- Google OAuth Client ID (from Google Cloud Console)

### Quick Start

```bash
# Backend
cd backend
cp .env.example .env   # Add your GEMINI_API_KEY
npm install
npm start

# Frontend (in a new terminal)
cd frontend
cp .env.example .env   # Add your VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

### Extension Development

```bash
# Cursor Extension
cd cursor-extension
npm install
# Then install via VS Code: Extensions > Install from VSIX
```

---

## Voice Input (Speech-to-Text)

### Technology: Web Speech API (SpeechRecognition)

| Property | Detail |
|----------|--------|
| **API** | `window.SpeechRecognition` / `window.webkitSpeechRecognition` |
| **Type** | Client-side (browser-native) |
| **Language** | English (en-US) |
| **Mode** | Single utterance (non-interim) |

### Workflow
1. User clicks "Talk to Write" button
2. Browser requests microphone permission
3. Speech recognition starts (button turns red "Listening...")
4. User speaks their requirement
5. Transcript is appended to the prompt input field
6. Recognition ends automatically after silence

---

## Future Enhancements (Roadmap)

- [ ] Publish Cursor extension to VS Code Marketplace
- [ ] Publish browser extension to Chrome Web Store
- [ ] Add streaming responses for real-time AI output
- [ ] Support more AI models (GPT-4, Claude)
- [ ] Add prompt templates library
- [ ] Implement rate limiting on backend
- [ ] Add user authentication on API endpoints
- [ ] Support offline TTS with downloaded voice models
