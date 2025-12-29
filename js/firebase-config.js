// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { 
    getAuth, 
    signInAnonymously, 
    signOut,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp,
    Timestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyChd3wKk1KXZNZQs8fDZRiUFbelciQnT1w",
    authDomain: "eldrex-blog.firebaseapp.com",
    projectId: "eldrex-blog",
    storageBucket: "eldrex-blog.firebasestorage.app",
    messagingSenderId: "1016235801394",
    appId: "1:1016235801394:web:c1f8d532843db7bfd1b52b",
    measurementId: "G-DHTY1BBPFP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export Firebase services
export {
    app,
    analytics,
    auth,
    db,
    googleProvider,
    // Auth Methods
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    // Firestore Methods
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp,
    Timestamp,
    runTransaction,
    // Other
    GoogleAuthProvider
};
