import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Public, read-only platform counters for the landing page.
 * Uses the Admin SDK (bypasses Firestore rules) but only ever returns two
 * aggregate numbers, never documents. Requires FIREBASE_SERVICE_ACCOUNT
 * (the service-account JSON as a single env var) on the server.
 */
function getDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  const databaseId =
    process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
  return databaseId ? getFirestore(getApps()[0], databaseId) : getFirestore(getApps()[0]);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDb();
    const [members, recoveries] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('items').where('claimed', '==', true).count().get(),
    ]);

    // Cache at the edge for 5 minutes so landing-page traffic never hammers Firestore.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      members: members.data().count,
      recoveries: recoveries.data().count,
    });
  } catch (error) {
    console.error('[stats] failed:', (error as Error).message);
    return res.status(503).json({ error: 'Stats unavailable' });
  }
}
