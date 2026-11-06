// One-time: moves contact details of EXISTING reports from the public item into the private
// "itemContacts" collection, then blanks them on the item.
// Dry run:  FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/migrate-contact-info.mjs
// Apply:    FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/migrate-contact-info.mjs --apply
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT to the service-account JSON.');
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const apply = process.argv.includes('--apply');

const snap = await db.collection('items').get();
let moved = 0;
for (const d of snap.docs) {
  const data = d.data();
  if (typeof data.contactInfo !== 'string' || !data.contactInfo.trim()) continue;
  moved++;
  console.log(`${apply ? 'moving' : 'would move'} ${d.id}`);
  if (!apply) continue;
  await db.collection('itemContacts').doc(d.id).set({
    ownerId: data.userId,
    contactInfo: data.contactInfo.slice(0, 300),
    updatedAt: new Date(),
  });
  await d.ref.update({ contactInfo: '' });
}
console.log(`${snap.size} items checked, ${moved} ${apply ? 'moved' : 'to move (run with --apply)'}.`);
