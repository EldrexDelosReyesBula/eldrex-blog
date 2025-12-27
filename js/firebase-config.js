// Firebase configuration 
const firebaseConfig = {
    apiKey: window.FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: window.FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: window.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    storageBucket: window.FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    measurementId: window.FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rtdb = firebase.database();
const auth = firebase.auth();
const analytics = firebase.analytics();

// Firestore collections
const postsCollection = db.collection('posts');
const commentsCollection = db.collection('comments');
const likesCollection = db.collection('likes');

// Realtime Database refs for active users
const activeUsersRef = rtdb.ref('activeUsers');

// Export Firebase instances
window.firebaseApp = app;
window.firestore = db;
window.rtdb = rtdb;
window.firebaseAuth = auth;
window.firebaseAnalytics = analytics;
