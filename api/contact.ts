import { cert, getApps, initializeApp } from 'firebase-admin/app';
// @ts-ignore - no bundled types needed
import * as jwtLib from 'jsonwebtoken';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  // Vercel has no default Google credentials, so use the service-account JSON from the
  // FIREBASE_SERVICE_ACCOUNT env var when it is set; otherwise fall back to default credentials.
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential: ReturnType<typeof cert> | undefined;
  if (rawServiceAccount) {
    try {
      credential = cert(JSON.parse(rawServiceAccount));
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON; falling back to default credentials.');
    }
  }
  initializeApp(credential ? { credential } : undefined);
}


// Verifies a Firebase ID token WITHOUT firebase-admin/auth. That module pulls in jwks-rsa,
// which crashes on Vercel (it require()s the ESM-only "jose" package), so every request 500s.
let certCache: { certs: Record<string, string>; exp: number } | null = null;
async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.exp > Date.now()) return certCache.certs;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('Could not load Google signing certificates');
  const certs = (await r.json()) as Record<string, string>;
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certCache = { certs, exp: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
  return certs;
}
function getProjectId(): string {
  const fromEnv = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (fromEnv) return fromEnv;
  try {
    const id = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}').project_id;
    if (id) return id;
  } catch {}
  throw new Error('Firebase project id is not configured');
}
async function verifyFirebaseToken(token: string): Promise<any> {
  const jwt: any = (jwtLib as any).verify ? jwtLib : (jwtLib as any).default;
  const header = jwt.decode(token, { complete: true })?.header;
  const certs = await getGoogleCerts();
  const cert = header?.kid ? certs[header.kid] : undefined;
  if (!cert) throw new Error('Unknown signing key');
  const projectId = getProjectId();
  const payload: any = jwt.verify(token, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid subject');
  return { ...payload, uid: payload.sub };
}

async function authenticate(req: any, res: any) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
    return null;
  }
  try {
    const decoded = await verifyFirebaseToken(token);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'Email verification is required.' });
      return null;
    }
    return decoded;
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    return null;
  }
}


export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = await authenticate(req, res);
  if (!user) return;

  try {
    const db = getFirestore();

    // POST: the item owner stores contact details privately (clients can never read this collection).
    if (req.method === 'POST') {
      const { itemId, contactInfo } = req.body || {};
      if (
        typeof itemId !== 'string' || itemId.length === 0 || itemId.length > 128 ||
        typeof contactInfo !== 'string' || contactInfo.trim().length === 0 || contactInfo.length > 300
      ) {
        return res.status(400).json({ error: 'Missing or invalid fields (itemId and contactInfo).' });
      }
      const ref = db.collection('itemContacts').doc(itemId);
      const existing = await ref.get();
      if (existing.exists && existing.data()?.ownerId !== user.uid) {
        return res.status(403).json({ error: 'Not allowed.' });
      }
      await ref.set({ ownerId: user.uid, contactInfo: contactInfo.trim(), updatedAt: new Date() });
      return res.status(200).json({ ok: true });
    }

    // GET: only the owner, a claimant with an approved claim, or anyone when the item has no
    // security question (same rule the app UI uses to unlock contact details).
    const itemId = typeof req.query?.itemId === 'string' ? req.query.itemId : '';
    if (!itemId || itemId.length > 128) {
      return res.status(400).json({ error: 'Missing itemId.' });
    }
    const itemDoc = await db.collection('items').doc(itemId).get();
    if (!itemDoc.exists) return res.status(404).json({ error: 'Item not found.' });
    const item = itemDoc.data() || {};

    let allowed = item.userId === user.uid;
    if (!allowed) {
      const hasQuestion = typeof item.securityQuestion === 'string' && item.securityQuestion.trim().length > 0;
      allowed = !hasQuestion;
    }
    if (!allowed) {
      const approved = await db
        .collection('claims')
        .where('itemId', '==', itemId)
        .where('claimerId', '==', user.uid)
        .where('status', '==', 'approved')
        .limit(1)
        .get();
      allowed = !approved.empty;
    }
    if (!allowed) return res.status(403).json({ error: 'Contact details are locked.' });

    const contactDoc = await db.collection('itemContacts').doc(itemId).get();
    // Older reports still carry the contact text on the item itself.
    const contactInfo = contactDoc.exists ? contactDoc.data()?.contactInfo : item.contactInfo;
    return res.status(200).json({ contactInfo: typeof contactInfo === 'string' ? contactInfo : '' });
  } catch (error) {
    console.error('Contact details error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
