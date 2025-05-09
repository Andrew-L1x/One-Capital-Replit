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
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Add these settings to help with local development environment
  emulator: {
    auth: {
      disableWarnings: true
    }
  }
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error: any) {
  // If already initialized, use the existing app
  if (error.code === 'app/duplicate-app') {
    app = getApp();
  } else {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

export const auth = getAuth(app);
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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create account");
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
