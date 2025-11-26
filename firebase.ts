import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAy5kYqQeJI7wJbTj9sMzPpISEADnMZwN4",
    authDomain: "chart-oracle-ai.firebaseapp.com",
    projectId: "chart-oracle-ai",
    storageBucket: "chart-oracle-ai.firebasestorage.app",
    messagingSenderId: "615321828557",
    appId: "1:615321828557:web:4bc2d7e8448a91c346bd84"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
