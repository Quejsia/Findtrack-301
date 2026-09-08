import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Initialize firebase admin
if (!getApps().length) {
  initializeApp();
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Do not advertise the underlying Express server in responses.
app.disable('x-powered-by');

// High limit payload support for high-res base64 photo uploads
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per 15 minutes per IP
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
    return;
  }
  try {
    const decodedToken = await getAuth().verifyIdToken(token);

    // Server-side API access requires a verified Firebase email.
    // Never trust a client-provided emailVerified flag.
    if (!decodedToken.email_verified) {
      res.status(403).json({ error: 'Email verification is required.' });
      return;
    }

    (req as any).user = decodedToken;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }
};

// Lazy initializer for Gemini client to prevent startup failure if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined in system secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Ensure API responses containing auth/user-derived data are not cached.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Ensure the server can provide health checks
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * API Route: Analyze Uploaded Image
 * Analyzes items from an image attachment and returns structured lost & found characteristics.
 */
app.post('/api/analyze-image', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
       res.status(400).json({ error: 'imageBase64 and mimeType fields are required.' });
       return;
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(mimeType)) {
      res.status(400).json({ error: 'Invalid image type.' });
      return;
    }

    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };

    const promptString = `Analyze this image of a lost or found item. Extract details to auto-classify it for a Lost & Found tracker app.
Return a structured representation containing:
1. a clean, descriptive title (e.g., "Silver Metal Keychain" or "Red Leather iPhone Case").
2. category (must be one of: "electronics", "keys", "wallet", "documents", "clothing", "jewelry", "bags", "others").
3. a detailed physical description listing colors, distinguishing marks, brand labels, textures, shapes.
4. suggestedLocation (where such an item is commonly lost or found based on visual clues, or default to general guess).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [imagePart, { text: promptString }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Descriptive title for the item (3-8 words)' },
            category: {
              type: Type.STRING,
              description: 'Primary category fits the item',
              enum: ["electronics", "keys", "wallet", "documents", "clothing", "jewelry", "bags", "others"]
            },
            description: { type: Type.STRING, description: 'Exhaustive physical attributes and identifying details' },
            suggestedLocation: { type: Type.STRING, description: 'Inferred location clue from image background if any' }
          },
          required: ['title', 'category', 'description', 'suggestedLocation']
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Gemini API did not return text response.');
    }

    const parsed = JSON.parse(outputText.trim());
    res.json(parsed);
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({
      error: 'Failed to analyze item image using AI engine.'
    });
  }
});

/**
 * API Route: Compare user items with opposite tracking collections using Gemini Flash.
 * Returns a list of matches sorted by confidence levels.
 */
app.post('/api/ai-matchmaker', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { itemToMatch, candidates } = req.body;
    if (!itemToMatch || !candidates || !Array.isArray(candidates)) {
       res.status(400).json({ error: 'itemToMatch and candidates array are required.' });
       return;
    }

    if (candidates.length === 0) {
       res.json({ matches: [] });
       return;
    }

    const ai = getGeminiClient();

    const instructionsPrompt = `You are the core intelligence matching engine for the Lost & Found app, FindTrack.
We have a target item that was ${itemToMatch.type === 'lost' ? 'LOST' : 'FOUND'}:
- Title: ${JSON.stringify(itemToMatch.title)}
- Category: ${JSON.stringify(itemToMatch.category)}
- Description: ${JSON.stringify(itemToMatch.description)}
- Location Tracked: ${JSON.stringify(itemToMatch.location)}
- Date Posted: ${JSON.stringify(itemToMatch.date)}

Compare this target item against the following candidates of the opposite tracking list:
${JSON.stringify(candidates.map(c => ({ id: c.id, title: c.title, category: c.category, description: c.description, location: c.location, date: c.date })))}

For each candidate, calculate:
1. A confidence score between 0 and 100 based on overlap of physical characteristics, colors, brands, categories (critical!), and logical distance of locations and dates.
2. A matchReason: a friendly explanation (max 2 sentences) describing why they are a likely match, comparing matching features.

Filter and return ONLY matches having a confidence score of 35% or higher. Sort the results with higher confidence scores of matching first.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: instructionsPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING, description: 'The unique candidate ID' },
                  confidenceScore: { type: Type.INTEGER, description: 'Percentage probability of match (0-100)' },
                  matchReason: { type: Type.STRING, description: 'Justification for the confidence index' }
                },
                required: ['itemId', 'confidenceScore', 'matchReason']
              }
            }
          },
          required: ['matches']
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Gemini API did not return comparison parameters.');
    }

    const parsed = JSON.parse(outputText.trim());
    res.json(parsed);
  } catch (error) {
    console.error('Error in AI matchmaker:', error);
    res.status(500).json({
      error: 'Match reasoning failed.'
    });
  }
});

/**
 * API Route: Verify Claim
 * Uses Gemini to evaluate if the claimer's answer matches the owner's secret answer.
 */
app.post('/api/verify-claim', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { claimerAnswer, itemId, secretAnswer: clientSecretAnswer, securityQuestion: clientSecurityQuestion } = req.body;
    if (!claimerAnswer || !itemId) {
      res.status(400).json({ error: 'Missing required fields (claimerAnswer and itemId).' });
      return;
    }

    const adminDb = getAdminFirestore();

    // Load public item details (for securityQuestion)
    const itemDoc = await adminDb.collection('items').doc(itemId).get();
    if (!itemDoc.exists) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    const itemData = itemDoc.data();
    const securityQuestion = itemData?.securityQuestion || clientSecurityQuestion || '';

    // Load private secret verification answer (with secure fallbacks for compatibility)
    const secretDoc = await adminDb.collection('itemSecrets').doc(itemId).get();
    const secretAnswer = (secretDoc.exists ? secretDoc.data()?.securityAnswer : null) || itemData?.securityAnswer || clientSecretAnswer || '';

    if (!secretAnswer) {
      res.json({ match: true, reason: 'No security question is set for this item.' });
      return;
    }

    const ai = getGeminiClient();

    // Prompt Gemini to determine if it is a match
    const promptString = `You are a verification engine for a Lost and Found system.
The owner has set a secret question (optional) and a secret answer for their item.
A claimant is trying to claim the item. Your job is to verify if their answer is correct.

Owner's Secret Question: ${securityQuestion || "N/A"}
Owner's Expected Answer: ${secretAnswer}
Claimant's Answer: ${claimerAnswer}

INSTRUCTIONS:
1. Determine if the Claimant's Answer reasonably matches the Owner's Expected Answer logically or factually.
2. Account for typos, phrasing differences, or synonymous interpretations.
3. If the claimant's answer is complete gibberish, clearly random words, or an obvious prank, or if it radically contradicts the expected answer, REJECT it.
4. If it's a plausible match, ACCEPT it.

Return ONLY a raw JSON object matching the following schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: promptString }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.BOOLEAN, description: 'True if it reasonably matches, false otherwise' },
            reason: { type: Type.STRING, description: 'Brief explanation why it was accepted or rejected (max 1 sentence)' }
          },
          required: ['match', 'reason']
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('No output from Gemini');
    }

    const parsed = JSON.parse(outputText.trim());
    res.json(parsed);
  } catch (error) {
    console.error('Claim verification error:', error);
    res.status(500).json({ error: 'Internal server error verifying claim.' });
  }
});

// Configure Vite or Serve Static build
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA Wildcard Route
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupViteMiddleware().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FindTrack Server booting successfully at http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Vite middleware hook failure:', err);
});
