import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();
dotenv.config();

const app = express();
const PORT = 3000;
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not defined in system secrets.');
    aiClient = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  }
  return aiClient;
}

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/analyze-image', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) return void res.status(400).json({ error: 'imageBase64 and mimeType fields are required.' });
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(mimeType)) return void res.status(400).json({ error: 'Invalid image type.' });
    const response = await getGeminiClient().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: `Analyze this image of a lost or found item. Extract details to auto-classify it for a Lost & Found tracker app. Return a structured representation containing: 1. a clean, descriptive title. 2. category (must be one of: "electronics", "keys", "wallet", "documents", "clothing", "jewelry", "bags", "others"). 3. a detailed physical description listing colors, distinguishing marks, brand labels, textures, shapes. 4. suggestedLocation (where such an item is commonly lost or found based on visual clues, or default to general guess).` }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, category: { type: Type.STRING, enum: ['electronics', 'keys', 'wallet', 'documents', 'clothing', 'jewelry', 'bags', 'others'] }, description: { type: Type.STRING }, suggestedLocation: { type: Type.STRING } }, required: ['title', 'category', 'description', 'suggestedLocation'] }
      }
    });
    if (!response.text) throw new Error('Gemini API did not return text response.');
    res.json(JSON.parse(response.text.trim()));
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: 'Failed to analyze item image using AI engine.' });
  }
});

app.post('/api/ai-matchmaker', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { itemId, candidateIds } = req.body;
    const userUid = (req as any).user?.uid;
    if (typeof itemId !== 'string' || !Array.isArray(candidateIds)) return void res.status(400).json({ error: 'itemId and candidateIds array are required.' });
    if (!userUid || itemId.length > 128 || candidateIds.length > 100 || candidateIds.some((id: unknown) => typeof id !== 'string' || id.length > 128)) return void res.status(400).json({ error: 'Invalid match request.' });

    const adminDb = getAdminFirestore();
    const targetDoc = await adminDb.collection('items').doc(itemId).get();
    if (!targetDoc.exists) return void res.status(404).json({ error: 'Item not found.' });
    const target = targetDoc.data();
    if (target?.userId !== userUid || !['lost', 'found'].includes(target?.type) || target?.status !== 'active') return void res.status(403).json({ error: 'You are not authorized to match this item.' });

    if (candidateIds.length === 0) return void res.json({ matches: [] });
    const uniqueIds = [...new Set(candidateIds)];
    const refs = uniqueIds.map(id => adminDb.collection('items').doc(id));
    const snapshots = await adminDb.getAll(...refs);
    const oppositeType = target.type === 'lost' ? 'found' : 'lost';
    const candidates = snapshots.filter(doc => {
      if (!doc.exists) return false;
      const data = doc.data();
      return data?.type === oppositeType && data?.status === 'active';
    }).map(doc => {
      const data = doc.data()!;
      return { id: doc.id, title: data.title, category: data.category, description: data.description, location: data.location, date: data.date };
    });

    const targetForAI = { id: targetDoc.id, title: target?.title, category: target?.category, description: target?.description, location: target?.location, date: target?.date, type: target?.type };
    const prompt = `You are the FindTrack lost-and-found matching engine. Compare this authorized target item against the supplied opposite-type candidates. Return only candidate IDs that are plausible matches with confidence >=35. Never invent IDs. Target: ${JSON.stringify(targetForAI)} Candidates: ${JSON.stringify(candidates)} Return matches with itemId, confidenceScore (0-100), and matchReason (max 2 sentences).`;
    const response = await getGeminiClient().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { matches: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { itemId: { type: Type.STRING }, confidenceScore: { type: Type.INTEGER }, matchReason: { type: Type.STRING } }, required: ['itemId', 'confidenceScore', 'matchReason'] } } }, required: ['matches'] } }
    });
    if (!response.text) throw new Error('Gemini API did not return comparison parameters.');
    const parsed = JSON.parse(response.text.trim());
    const allowedIds = new Set(candidates.map(c => c.id));
    const matches = Array.isArray(parsed.matches) ? parsed.matches.filter((m: any) => allowedIds.has(m?.itemId) && Number.isInteger(m?.confidenceScore) && m.confidenceScore >= 35 && m.confidenceScore <= 100 && typeof m?.matchReason === 'string').slice(0, 100) : [];
    res.json({ matches });
  } catch (error) {
    console.error('Error in AI matchmaker:', error);
    res.status(500).json({ error: 'Match reasoning failed.' });
  }
});

app.post('/api/verify-claim', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { claimerAnswer, itemId } = req.body;
    const userUid = (req as any).user?.uid;
    if (typeof claimerAnswer !== 'string' || claimerAnswer.trim().length === 0 || typeof itemId !== 'string' || itemId.length > 128) return void res.status(400).json({ error: 'Missing required fields (claimerAnswer and itemId).' });
    const adminDb = getAdminFirestore();
    const itemDoc = await adminDb.collection('items').doc(itemId).get();
    if (!itemDoc.exists) return void res.status(404).json({ error: 'Item not found.' });
    const itemData = itemDoc.data();
    if (itemData?.type !== 'found' || itemData?.status !== 'active') return void res.status(400).json({ error: 'This item is not available for claim verification.' });
    if (itemData?.userId === userUid) return void res.status(403).json({ error: 'Item owners cannot verify a claim against their own item.' });
    const secretDoc = await adminDb.collection('itemSecrets').doc(itemId).get();
    const secretAnswer = secretDoc.exists ? secretDoc.data()?.securityAnswer : null;
    const securityQuestion = itemData?.securityQuestion || '';
    if (typeof secretAnswer !== 'string' || !secretAnswer.trim()) return void res.status(409).json({ error: 'No private verification answer is configured. Manual verification is required.' });
    const response = await getGeminiClient().models.generateContent({ model: 'gemini-2.0-flash', contents: [{ role: 'user', parts: [{ text: `You are a verification engine for a Lost and Found system. Determine whether the claimant answer reasonably matches the owner's expected answer. Allow reasonable typos, phrasing differences, or synonyms, but reject gibberish or contradictions. Owner's Secret Question: ${securityQuestion || 'N/A'} Owner's Expected Answer: ${secretAnswer} Claimant's Answer: ${claimerAnswer.trim()}` }] }], config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { match: { type: Type.BOOLEAN }, reason: { type: Type.STRING } }, required: ['match', 'reason'] } } });
    if (!response.text) throw new Error('No output from Gemini');
    const parsed = JSON.parse(response.text.trim());
    res.json({ match: parsed.match === true, reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : 'Verification completed.' });
  } catch (error) {
    console.error('Claim verification error:', error);
    res.status(500).json({ error: 'Internal server error verifying claim.' });
  }
});

async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
}

setupViteMiddleware().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`FindTrack Server booting successfully at http://0.0.0.0:${PORT}`));
}).catch(err => console.error('Vite middleware hook failure:', err));
