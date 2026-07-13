// Shared Firebase backend for the Boat / House / Yard trackers.
// Fill in firebaseConfig below with the values from Firebase console
// (Project settings -> General -> Your apps -> Web app).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, onSnapshot, setDoc
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

// Wires the standard sign-in panel + #signedOutGate/#appContent toggle + live doc
// subscription that every tracker page uses identically. `onData` is the app's
// onSnapshot handler; `onSignedIn`/`onSignedOut` let the app track its own
// currentUser reference and clear its own timers/state.
export function bindAuthUI({ docPath, onData, onSignedIn, onSignedOut }) {
  const qs = (s) => document.querySelector(s);
  let unsubscribeDoc = null;

  function setConnStatus(text) {
    const el = qs("#connStatus");
    if (el) el.textContent = text;
  }
  function showSignedIn(user) {
    qs("#signedOutRow").style.display = "none";
    qs("#signedInRow").style.display = "";
    qs("#signedOutGate").style.display = "none";
    qs("#appContent").style.display = "";
    setConnStatus("Signed in: " + user.email);
    if (unsubscribeDoc) unsubscribeDoc();
    unsubscribeDoc = watchDoc(docPath, onData);
    if (onSignedIn) onSignedIn(user);
  }
  function showSignedOut() {
    if (unsubscribeDoc) { unsubscribeDoc(); unsubscribeDoc = null; }
    qs("#signedOutRow").style.display = "";
    qs("#signedInRow").style.display = "none";
    qs("#signedOutGate").style.display = "";
    qs("#appContent").style.display = "none";
    if (onSignedOut) onSignedOut();
  }
  async function handleLogin() {
    const email = qs("#loginEmail").value.trim();
    const password = qs("#loginPassword").value;
    const errEl = qs("#loginError");
    errEl.style.display = "none";
    try {
      await login(email, password);
      qs("#loginPassword").value = "";
    } catch (e) {
      errEl.textContent = "Sign-in failed: " + e.message;
      errEl.style.display = "";
    }
  }

  qs("#loginBtn").addEventListener("click", handleLogin);
  qs("#loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
  qs("#logoutBtn").addEventListener("click", () => logout());
  onAuth((user) => { if (user) showSignedIn(user); else showSignedOut(); });

  return { isSignedIn: () => !!auth.currentUser };
}

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
// Reads the doc once — used by one-time tools (e.g. the migration script) that
// need to check what's already there before deciding whether to overwrite it.
export async function readDocOnce(path) {
  const snap = await getDoc(doc(db, path));
  return snap.exists() ? snap.data() : null;
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
  return deleteObject(ref(storage, storagePath)).catch((e) => {
    console.warn("Storage delete failed for", storagePath, e);
  });
}

// ---------- Path-safety helpers (shared so all apps sanitize identically) ----------
export const sanitizeFolderName = (name) => (name || "").replace(/[<>:"/\\|?*]/g, "").trim().slice(0, 100) || "Untitled";
export const sanitizeFileName = (name) => (name || "file").replace(/[<>:"/\\|?*]/g, "_").trim().slice(0, 150);
