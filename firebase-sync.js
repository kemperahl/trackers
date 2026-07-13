// Shared Firebase backend for the Boat / House / Yard trackers.
// Fill in firebaseConfig below with the values from Firebase console
// (Project settings -> General -> Your apps -> Web app).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, onSnapshot, setDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA1XvzWrswBDgDgym1amG5lBy9K4DW-XGM",
  authDomain: "ahl-trackers.firebaseapp.com",
  projectId: "ahl-trackers",
  storageBucket: "ahl-trackers.firebasestorage.app",
  messagingSenderId: "697578055862",
  appId: "1:697578055862:web:5b30b77a71fa4702f11e17"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---------- Auth ----------
export function onAuth(cb) { return onAuthStateChanged(auth, cb); }
export function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export function logout() { return signOut(auth); }

// ---------- Live document sync ----------
// cb(data, isLocalEcho) — isLocalEcho is true for the snapshot that immediately
// follows our own write, so callers can skip re-rendering/clobbering local edits.
export function watchDoc(path, cb) {
  return onSnapshot(doc(db, path), (snap) => {
    cb(snap.exists() ? snap.data() : null, snap.metadata.hasPendingWrites);
  });
}
export function saveDoc(path, data) {
  return setDoc(doc(db, path), data);
}

// ---------- Attachments (Storage stands in for the old local folders) ----------
export async function uploadFile(storagePath, file, originalName) {
  const r = ref(storage, storagePath);
  await uploadBytes(r, file, { customMetadata: { originalName: originalName || file.name } });
  return getDownloadURL(r);
}
export async function listFiles(storagePath) {
  const r = ref(storage, storagePath);
  const res = await listAll(r);
  return Promise.all(res.items.map(async (item) => {
    const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item).catch(() => null)]);
    return { name: item.name, originalName: meta?.customMetadata?.originalName || item.name, url };
  }));
}
export function deleteFile(storagePath) {
  return deleteObject(ref(storage, storagePath)).catch(() => {});
}
