import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, connectAuthEmulator, getAuth, signInWithCredential, signInWithPopup, signOut, } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'kartar-cup-baku';
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
if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    window.__e2eLogin = (email) => signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}
export function signInGoogle() {
    return signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
        console.error('[auth] Google sign-in failed:', e.code, e.message);
        throw e;
    });
}
export function signOutUser() {
    return signOut(auth);
}
