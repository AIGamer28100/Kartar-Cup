import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

const projectId: string = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'kartar-cup';

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? (useEmulators ? 'demo-key' : undefined),
  // signInWithPopup throws before opening a window when authDomain is missing, so always derive one.
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app);
export const db = getFirestore(app);

declare global {
  interface Window {
    __e2eLogin?: (email: string) => Promise<UserCredential>;
  }
}

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  window.__e2eLogin = (email: string) =>
    signInWithCredential(
      auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })),
    );
}

export function signInGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, new GoogleAuthProvider()).catch((e: { code?: string; message?: string }) => {
    console.error('[auth] Google sign-in failed:', e.code, e.message);
    throw e;
  });
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}
