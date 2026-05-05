# Political Leaning Analysis & Voter Education Platform

A professional, secure platform to help users discover their political alignment using weighted multi-axis algorithms.

## 🚀 Key Features
- **Leaning Quiz**: Multi-step policy-based survey with progress tracking.
- **Google Integration**: OAuth 2.0 Auth, reCAPTCHA v3 Security, and Drive API report export.
- **Security Architected**: Helmet headers, Rate limiting, Zod validation, and CSRF protection.
- **Premium Design**: Typography powered by Google Fonts (Inter & Montserrat).

## 🛠️ Tech Stack
- **Frontend**: React, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL
- **Security**: Google Cloud Security Services

## 🏗️ Getting Started

### Backend Setup
1. `cd backend`
2. `npm install`
3. Create `.env` from `.env.example`
4. `npm start`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## 🔒 Security Implementation
- **Data Privacy**: AES-256 encryption for voter preference data at rest.
- **Input Security**: Strict schema validation via Zod for all API endpoints.
- **Bot Defense**: Silent reCAPTCHA v3 verification on all critical submissions.
