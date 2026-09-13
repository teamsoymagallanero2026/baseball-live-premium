// =============================================================
// CONFIGURACIÓN ÚNICA DEL PROYECTO
// 1) Crea tu app web en Firebase.
// 2) Copia aquí el objeto firebaseConfig que te muestra Firebase.
// 3) NO pongas contraseñas en este archivo.
// =============================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHSrsa8_b66QKmBDWBK9GzZgSWe5EP3s8",
  authDomain: "baseball-live-premium.firebaseapp.com",
  databaseURL: "https://baseball-live-premium-default-rtdb.firebaseio.com",
  projectId: "baseball-live-premium",
  storageBucket: "baseball-live-premium.firebasestorage.app",
  messagingSenderId: "628509493986",
  appId: "1:628509493986:web:e0bb6afe7dd505ea812cbb"
};

export const DEFAULT_GAME = {
  version: 1,
  teams: {
    away: { name: "MAGALLANES", runs: 0, hits: 0, errors: 0 },
    home: { name: "RIVAL", runs: 0, hits: 0, errors: 0 }
  },
  count: { balls: 0, strikes: 0, outs: 0 },
  inning: { number: 1, half: "top" },
  bases: { first: false, second: false, third: false },
  lastPlay: "PLAY BALL",
  fx: { type: "", nonce: 0 },
  updatedAt: 0
};

export function firebaseIsConfigured() {
  const values = Object.values(FIREBASE_CONFIG);
  return values.every(v => typeof v === "string" && v.length > 5 && !v.includes("PEGA_AQUI"));
}
