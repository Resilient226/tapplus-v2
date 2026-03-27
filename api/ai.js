// api/ai.js
// POST /api/ai
// Body: { prompt, cacheKey? }
// Auth: any valid session token
// Uses GROQ_API_KEY from environment — never exposed to frontend

const { handleCors, ok, err, getSession } = require('../lib/utils');

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 400;

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  // Require a valid session
  const session = getSession(req);
  if (!session) return err(res, 'Unauthorized', 401);

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return err(res, 'Prompt required');
  if (prompt.length > 2000) return err(res, 'Prompt too long');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return err(res, 'AI service not configured', 503);

  try {
    const response = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      GROQ_MODEL,
        max_tokens: MAX_TOKENS,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Groq error:', response.status, text);
      return err(res, 'AI service error', 502);
    }

    const data   = await response.json();
    const text   = data.choices?.[0]?.message?.content || '';
    return ok(res, { text });

  } catch (e) {
    console.error('AI fetch error:', e);
    return err(res, 'AI service unavailable', 503);
  }
};
