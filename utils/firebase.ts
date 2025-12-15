
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD0ppjvaOoQWiWnyQfbZcZaU6lqUPHPZzk",
  authDomain: "gstr2b-6ace7.firebaseapp.com",
  projectId: "gstr2b-6ace7",
  storageBucket: "gstr2b-6ace7.firebasestorage.app",
  messagingSenderId: "924597546568",
  appId: "1:924597546568:web:55a31d4dc6fb048047727d",
  measurementId: "G-ZW3SKDV0WG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export default app;
