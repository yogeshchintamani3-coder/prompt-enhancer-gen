import request from 'supertest';
import app from './server.js';

describe('Voter Analysis API', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app).get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toContain('Voter Analysis API');
  });

  test('POST /api/analyze-leaning should return results for valid data', async () => {
    const validData = {
      userId: "user_123",
      answers: [
        { questionId: 1, score: 1 },
        { questionId: 2, score: -1 }
      ],
      captchaToken: "mock_token"
    };
    const response = await request(app)
      .post('/api/analyze-leaning')
      .send(validData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('label');
  });

  test('POST /api/analyze-leaning should return 400 for invalid data', async () => {
    const invalidData = {
      userId: "user_123"
      // missing answers
    };
    const response = await request(app)
      .post('/api/analyze-leaning')
      .send(invalidData);
    expect(response.statusCode).toBe(400);
  });
});
