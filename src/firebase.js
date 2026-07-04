import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// 1) CONFIG FIREBASE
// Console Firebase → Paramètres du projet (⚙) → "Tes applications" →
// choisis l'app Web → "Configuration du SDK". Colle les valeurs ici.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyC0JFBIG0zsY2YT1w8N-AnVuZgfdGSi5jQ",
  authDomain: "bientot-chez-nous.firebaseapp.com",
  projectId: "bientot-chez-nous",
  storageBucket: "bientot-chez-nous.firebasestorage.app",
  messagingSenderId: "1085765934675",
  appId: "1:1085765934675:web:01c55f63369da4873470a6"
};

// ─────────────────────────────────────────────────────────────
// 2) QUI EST QUI
// Associe l'e-mail Google de chacune à un rôle interne.
// La clé = l'e-mail utilisé pour se connecter ; la valeur = "anais" ou "copine".
// (On garde "copine" comme identifiant interne d'Audrey pour rester cohérent
//  avec le reste du code — le prénom affiché reste modifiable dans l'app.)
// ─────────────────────────────────────────────────────────────
export const MEMBERS = {
 "jaussaud.anais@gmail.com": "anais",
 "tabet.audrey@gmail.com": "copine",
};

export function memberRole(email) {
  if (!email) return null;
  return MEMBERS[email.toLowerCase()] || null;
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
