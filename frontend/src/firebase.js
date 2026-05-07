import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyB1cPI1CiSt7dbdZ5MyxTMmYZmpvnoYVBU",
    authDomain: "prompt-enhancer-ai-gen.firebaseapp.com",
    projectId: "prompt-enhancer-ai-gen",
    storageBucket: "prompt-enhancer-ai-gen.firebasestorage.app",
    messagingSenderId: "72198722809",
    appId: "1:72198722809:web:353d4296e249bf1d0afe28"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Save user's API keys to Firestore
export async function saveUserKeys(uid, keys) {
    try {
        await setDoc(doc(db, 'users', uid), {
            geminiKey: keys.geminiKey || '',
            openaiKey: keys.openaiKey || '',
            groqKey: keys.groqKey || '',
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('Failed to save keys:', e);
        return false;
    }
}

// Load user's API keys from Firestore
export async function loadUserKeys(uid) {
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
            const data = snap.data();
            return {
                geminiKey: data.geminiKey || '',
                openaiKey: data.openaiKey || '',
                groqKey: data.groqKey || ''
            };
        }
        return null;
    } catch (e) {
        console.error('Failed to load keys:', e);
        return null;
    }
}
