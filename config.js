// =============================================================
// CONFIGURACIÓN ÚNICA DEL PROYECTO
// Firebase ya está configurado. No coloques contraseñas aquí.
// V4.5.4: VISITANTE izquierda / HOME derecha, logos/nombres/colores editables y look TV premium glass.
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
  version: 4,
  teams: {
    // VISITANTE = lado IZQUIERDO del overlay y batea en la ALTA.
    away: {
      name: "MAGALLANES",
      short: "MAG",
      logo: "./assets/magallanes.png",
      logoVersion: 1,
      primary: "#1d8fff",
      secondary: "#ffd54a",
      runs: 0,
      hits: 0,
      errors: 0
    },
    // HOME CLUB = lado DERECHO del overlay y batea en la BAJA.
    home: {
      name: "RIVAL",
      short: "RIV",
      logo: "",
      logoVersion: 1,
      primary: "#f4b400",
      secondary: "#fff3b0",
      runs: 0,
      hits: 0,
      errors: 0
    }
  },
  count: { balls: 0, strikes: 0, outs: 0 },
  inning: { number: 1, half: "top" },
  bases: { first: false, second: false, third: false },
  lastPlay: "PLAY BALL",
  fx: { type: "", nonce: "", at: 0 },
  updatedAt: 0
};

export function firebaseIsConfigured() {
  const values = Object.values(FIREBASE_CONFIG);
  return values.every(v => typeof v === "string" && v.length > 5 && !v.includes("PEGA_AQUI"));
}
