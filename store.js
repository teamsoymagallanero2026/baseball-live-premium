import { FIREBASE_CONFIG, DEFAULT_GAME, firebaseIsConfigured } from "./config.js";

const LOCAL_KEY = "baseball-live-premium-game-v1";
const CHANNEL_NAME = "baseball-live-premium-channel";

export const mode = firebaseIsConfigured() ? "firebase" : "local";

let db = null;
let auth = null;
let channel = null;
let initPromise = null;
let firebaseFns = null;

if (mode === "local" && "BroadcastChannel" in window) {
  channel = new BroadcastChannel(CHANNEL_NAME);
}

async function initFirebase() {
  if (mode !== "firebase") return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const appMod = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js");
    const dbMod = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js");

    const app = appMod.initializeApp(FIREBASE_CONFIG);
    db = dbMod.getDatabase(app);
    auth = authMod.getAuth(app);
    firebaseFns = {
      ref: dbMod.ref,
      onValue: dbMod.onValue,
      set: dbMod.set,
      get: dbMod.get,
      signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
      onAuthStateChanged: authMod.onAuthStateChanged,
      signOut: authMod.signOut
    };
    return true;
  })();

  return initPromise;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeGame(input) {
  const g = clone(DEFAULT_GAME);
  if (!input || typeof input !== "object") return g;

  g.version = 4;
  g.teams.away = { ...g.teams.away, ...(input.teams?.away || {}) };
  g.teams.home = { ...g.teams.home, ...(input.teams?.home || {}) };
  g.count = { ...g.count, ...(input.count || {}) };
  g.inning = { ...g.inning, ...(input.inning || {}) };
  g.bases = { ...g.bases, ...(input.bases || {}) };
  g.lastPlay = typeof input.lastPlay === "string" ? input.lastPlay : g.lastPlay;
  g.fx = { ...g.fx, ...(input.fx || {}) };
  g.updatedAt = Number(input.updatedAt || 0);

  for (const key of ["away", "home"]) {
    const inputTeam = input.teams?.[key] || {};
    g.teams[key].name = String(g.teams[key].name || (key === "away" ? "VISITANTE" : "HOME CLUB")).slice(0, 24);

    const words = g.teams[key].name.trim().split(/\s+/).filter(Boolean);
    const derivedShort = words.length <= 1
      ? (words[0] || (key === "away" ? "VIS" : "HOM")).slice(0, 3).toUpperCase()
      : words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
    const rawShort = typeof inputTeam.short === "string" && inputTeam.short.trim() ? inputTeam.short : derivedShort;
    g.teams[key].short = String(rawShort).replace(/[^A-Za-z0-9ÁÉÍÓÚÑ]/gi, "").slice(0, 5).toUpperCase() || derivedShort;

    if (typeof inputTeam.logo === "string") {
      g.teams[key].logo = inputTeam.logo.slice(0, 350000);
    } else {
      const looksMagallanes = g.teams[key].name.toUpperCase().includes("MAGALLANES");
      g.teams[key].logo = looksMagallanes ? "./assets/magallanes.png" : "";
    }
    g.teams[key].logoVersion = Math.max(1, Number(inputTeam.logoVersion || g.teams[key].logoVersion || 1));

    g.teams[key].runs = Math.max(0, Number(g.teams[key].runs || 0));
    g.teams[key].hits = Math.max(0, Number(g.teams[key].hits || 0));
    g.teams[key].errors = Math.max(0, Number(g.teams[key].errors || 0));
  }

  g.count.balls = Math.max(0, Math.min(3, Number(g.count.balls || 0)));
  g.count.strikes = Math.max(0, Math.min(2, Number(g.count.strikes || 0)));
  g.count.outs = Math.max(0, Math.min(2, Number(g.count.outs || 0)));
  g.inning.number = Math.max(1, Math.min(99, Number(g.inning.number || 1)));
  g.inning.half = g.inning.half === "bottom" ? "bottom" : "top";
  g.bases.first = Boolean(g.bases.first);
  g.bases.second = Boolean(g.bases.second);
  g.bases.third = Boolean(g.bases.third);
  return g;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return clone(DEFAULT_GAME);
    return normalizeGame(JSON.parse(raw));
  } catch {
    return clone(DEFAULT_GAME);
  }
}

function writeLocal(game) {
  const normalized = normalizeGame(game);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
  channel?.postMessage({ type: "game", game: normalized });
  window.dispatchEvent(new CustomEvent("baseball-local-game", { detail: normalized }));
}

export async function ensureGame() {
  if (mode === "firebase") {
    await initFirebase();
    const gameRef = firebaseFns.ref(db, "game");
    const snap = await firebaseFns.get(gameRef);
    if (!snap.exists()) {
      await firebaseFns.set(gameRef, { ...clone(DEFAULT_GAME), updatedAt: Date.now() });
    }
    return;
  }
  if (!localStorage.getItem(LOCAL_KEY)) writeLocal(DEFAULT_GAME);
}

export function subscribeGame(callback) {
  if (mode === "firebase") {
    let unsubscribe = () => {};
    let cancelled = false;
    initFirebase()
      .then(() => {
        if (cancelled) return;
        unsubscribe = firebaseFns.onValue(firebaseFns.ref(db, "game"), snap => {
          callback(normalizeGame(snap.val()));
        });
      })
      .catch(error => console.error("Firebase subscribe error", error));
    return () => { cancelled = true; unsubscribe(); };
  }

  const sendCurrent = () => callback(readLocal());
  const onStorage = event => {
    if (event.key === LOCAL_KEY) sendCurrent();
  };
  const onCustom = event => callback(normalizeGame(event.detail));
  const onChannel = event => {
    if (event.data?.type === "game") callback(normalizeGame(event.data.game));
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("baseball-local-game", onCustom);
  if (channel) channel.addEventListener("message", onChannel);
  sendCurrent();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("baseball-local-game", onCustom);
    if (channel) channel.removeEventListener("message", onChannel);
  };
}

export async function saveGame(game) {
  const normalized = normalizeGame({ ...game, updatedAt: Date.now() });
  if (mode === "firebase") {
    await initFirebase();
    await firebaseFns.set(firebaseFns.ref(db, "game"), normalized);
  } else {
    writeLocal(normalized);
  }
  return normalized;
}

export function watchAuth(callback) {
  if (mode !== "firebase") {
    callback({ localDemo: true });
    return () => {};
  }

  let unsubscribe = () => {};
  let cancelled = false;
  initFirebase()
    .then(() => {
      if (cancelled) return;
      unsubscribe = firebaseFns.onAuthStateChanged(auth, callback);
    })
    .catch(error => {
      console.error("Firebase auth error", error);
      callback(null);
    });
  return () => { cancelled = true; unsubscribe(); };
}

export async function login(email, password) {
  if (mode !== "firebase") return { localDemo: true };
  await initFirebase();
  return firebaseFns.signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  if (mode === "firebase") {
    await initFirebase();
    await firebaseFns.signOut(auth);
  }
}

export function getLocalSnapshot() {
  return mode === "local" ? readLocal() : null;
}
