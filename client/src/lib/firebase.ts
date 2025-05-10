import { initializeApp } from "firebase/app";
import { getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User
} from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: "", // Empty string is fine if we don't use messaging
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Log the configuration (without sensitive values)
console.log("Initializing Firebase with project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);

// Initialize Firebase
let app;
try {
  // Check if we have required config values
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.error('Firebase configuration incomplete. Missing required fields.');
    throw new Error('Firebase configuration incomplete');
  }
  
  // Try to initialize the app
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error: any) {
  // If already initialized, use the existing app
  if (error.code === 'app/duplicate-app') {
    console.log('Firebase already initialized, getting existing app');
    app = getApp();
  } else {
    console.error('Firebase initialization error:', error);
    // Don't throw, as this would break the app for users
    // Instead, we'll gracefully handle auth failures in the components
    app = {} as any; // Provide a stub to prevent crashes
  }
}

// Get Auth instance with error handling
let auth;
try {
  auth = getAuth(app);
  console.log('Firebase auth initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase auth:', error);
  // Create a mock auth object with methods that gracefully fail
  auth = {
    currentUser: null,
    onAuthStateChanged: (callback: any) => {
      callback(null);
      return () => {}; // Return an unsubscribe function
    },
    signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase auth not available')),
    createUserWithEmailAndPassword: () => Promise.reject(new Error('Firebase auth not available')),
    signOut: () => Promise.reject(new Error('Firebase auth not available'))
  } as any;
}

export { auth };

// Initialize Google provider for signin
const googleProvider = new GoogleAuthProvider();

export const firebaseLogin = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign in with email and password");
  }
};

export const firebaseRegister = async (email: string, password: string) => {
  try {
    console.log("Registering with Firebase auth:", email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("Firebase registration successful");
    return userCredential.user;
  } catch (error: any) {
    console.error("Firebase registration error:", error);
    
    // Preserve the original error code and message for better error handling upstream
    if (error.code && error.message) {
      const enhancedError = new Error(error.message);
      (enhancedError as any).code = error.code;
      throw enhancedError;
    }
    
    throw error;
  }
};

export const firebaseLogout = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign out");
  }
};

import { signInWithRedirect, getRedirectResult } from "firebase/auth";

export const firebaseGoogleLogin = async () => {
  try {
    // Use redirect for more reliable authentication in a Replit environment
    await signInWithRedirect(auth, googleProvider);
    // The page will redirect and we'll handle the response in a separate function
    return null;
  } catch (error: any) {
    console.error("Google login redirect error:", error);
    throw new Error(error.message || "Failed to sign in with Google");
  }
};

// Function to handle redirect result
export const handleGoogleRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    return result.user;
  } catch (error: any) {
    console.error("Google redirect result error:", error); 
    throw new Error(error.message || "Failed to sign in with Google");
  }
};

export const linkFirebaseWithBackend = async (firebaseUser: User) => {
  try {
    const idToken = await firebaseUser.getIdToken();
    
    const response = await fetch("/api/auth/firebase-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        idToken,
      }),
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Failed to link Firebase account with backend");
    }
    
    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || "Failed to link accounts");
  }
};

export const onFirebaseAuthStateChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
