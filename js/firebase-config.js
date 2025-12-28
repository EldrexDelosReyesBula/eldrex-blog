// Get environment variables (they will be replaced at build time)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app, db, auth, rtdb, analytics;

export function initializeFirebase() {
    if (!firebaseConfig.apiKey) {
        console.error('Firebase configuration is missing');
        alert('Firebase configuration is missing. Please check your environment variables.');
        return;
    }
    
    try {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        rtdb = firebase.database();
        analytics = firebase.analytics();
        
        console.log('Firebase initialized successfully');
        
        // Enable offline persistence
        db.enablePersistence().catch((err) => {
            console.warn('Firestore offline persistence not supported:', err.code);
        });
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        alert('Failed to initialize Firebase. Please check your configuration.');
    }
}

export function getFirebase() {
    return { app, db, auth, rtdb, analytics };
}

export { db, auth, rtdb, analytics };