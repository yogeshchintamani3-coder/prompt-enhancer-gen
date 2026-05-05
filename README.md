# AI Prompt Enhancer & Auto Project Generator

An advanced full-stack application designed to transform simple project requirements into comprehensive, production-ready "Super Prompts" and complete project blueprints.

## 🚀 Features

- **Architect Mode**: Transforms basic requirements into high-scoring "Super Prompts" optimized for LLMs.
- **Auto Project Generation**: Generates full-stack code (Backend & Frontend), MVC architecture, test cases, and design specifications (Figma-style).
- **Multi-Language Support**: Supports translation into 11+ languages (Hindi, Marathi, Spanish, French, etc.).
- **Smart TTS**: Built-in Text-to-Speech that automatically detects the target language and uses appropriate voices.
- **Jira Assistant**: Analyze Jira tickets or bug logs to generate execution plans and root cause analysis.
- **Security First**: Includes built-in scoring tips for Google Cloud, Firebase, and high-security adoption.
- **Voice Typing**: Integrated voice-to-text for hands-free requirement entry.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React (Vite)
- **Styling**: Vanilla CSS (Modern design tokens)
- **Auth**: Google OAuth Integration
- **Components**: Functional components with Hooks

### Backend
- **Runtime**: Node.js (ESM)
- **Framework**: Express
- **AI Engine**: Google Generative AI (Gemini Flash Lite)
- **Logging**: Morgan
- **Security**: CORS, Dotenv, API Key protection

## 📦 Installation & Setup

### Prerequisites
- **Node.js**: v18+ (Recommended)
- **Gemini API Key**: Obtain from Google AI Studio

### Backend Setup
1. Navigate to `backend/`
2. Create a `.env` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   PORT=5000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```

### Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📝 Usage

1. **Enter Requirement**: Describe your project (e.g., "A coffee shop app").
2. **Select Stack**: Default is **Angular** + **Java (Spring Boot)**.
3. **Enhance**: Click "Generate Prompt" to get the optimized blueprint.
4. **Deploy**: Follow the generated deployment guide to host on Render or Vercel.

## 🧪 Testing
- The generator automatically provides unit and integration test code for every project it builds.
- Use the built-in "Listen" feature to verify prompt clarity.

## 📄 License
MIT License
