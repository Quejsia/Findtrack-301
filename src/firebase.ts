import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const hasCompleteEnvConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim().length > 0,
);

// AI Studio's generated placeholder config is not a usable Firebase configuration.
// Keep the fallback only for environments that provide a real applet config.
const activeConfig = hasCompleteEnvConfig
  ? {
      ...firebaseConfig,
      firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '',
    }
  : appletConfig;

const hasUsableConfig = Object.entries(activeConfig).every(([key, value]) => {
  if (key === 'measurementId' || key === 'firestoreDatabaseId') return true;
  return typeof value === 'string' && value.trim().length > 0 && !value.includes('SEE_ENV') && !value.includes('PASTE_YOUR_');
});

if (!hasUsableConfig) {
  console.warn('Firebase configuration is incomplete. Set the VITE_FIREBASE_* environment variables for this deployment.');
}

const app = initializeApp(activeConfig);
export const auth = getAuth(app);
export const db = activeConfig.firestoreDatabaseId
  ? getFirestore(app, activeConfig.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const registerWithEmail = async (email: string, password: string, displayName: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  return result.user;
};

export const loginWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const logOut = async () => {
  await signOut(auth);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const rawCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const code = rawCode.startsWith('permission-denied') ? 'permission-denied' : rawCode || 'unknown';

  console.error('[Firestore operation failed]', {
    code,
    operationType,
    path,
  });

  throw new Error(`Firestore operation failed: ${code}`);
}
