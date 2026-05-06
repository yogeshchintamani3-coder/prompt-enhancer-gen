import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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
