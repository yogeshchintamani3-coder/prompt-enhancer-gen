import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// --- Security Middleware ---
app.use(helmet()); // Secure headers
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// --- Zod Schemas ---
const SurveyResponseSchema = z.object({
  userId: z.string(),
  answers: z.array(z.object({
    questionId: z.number(),
    score: z.number().min(-2).max(2) // Likert scale mapping
  })),
  captchaToken: z.string()
});

// --- Routes ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'Voter Analysis API is online', secure: true });
});

// Submit Survey with reCAPTCHA validation (Conceptual)
app.post('/api/analyze-leaning', async (req, res) => {
  try {
    const validatedData = SurveyResponseSchema.parse(req.body);
    
    // In a real app: 
    // 1. Verify reCAPTCHA token with Google
    // 2. Run the weighted multi-axis algorithm
    // 3. Save to PostgreSQL
    
    const mockResult = {
      axis: {
        economic: 0.45,
        social: -0.25,
        foreign: 0.1
      },
      label: "Center-Right leaning",
      recommendations: ["Learn more about Economic Liberalism", "Voter Education: Foreign Policy 101"]
    };

    res.json(mockResult);
  } catch (error) {
    res.status(400).json({ error: error.errors || 'Validation Failed' });
  }
});

// Google Drive Export Placeholder
app.post('/api/export-report', async (req, res) => {
  // Logic for Google Drive API integration would go here
  res.json({ message: "Report generated and uploaded to Google Drive" });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Security Architect: Server running on port ${PORT}`);
  });
}

export default app;
