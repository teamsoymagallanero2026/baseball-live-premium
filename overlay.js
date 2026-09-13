import { mode, subscribeGame } from "./store.js";

const $ = id => document.getElementById(id);
const FX_DURATION_MS = 3600;
const FX_FRESH_WINDOW_MS = 15000;

let lastFxNonce = null;
let fxTimer = null;
let currentFxType = "";
let pendingFx = null;

function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "EQP";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

function setLights(selector, activeCount) {
  document.querySelectorAll(selector).forEach((el, index) => {
    el.classList.toggle("on", index < activeCount);
  });
}

function fxLabel(type) {
  const labels = {
    "CARRERA": "¡CARRERA!",
    "HIT": "¡HIT!",
    "ERROR": "¡ERROR!",
    "PONCHE": "¡PONCHE!",
    "OUT": "¡OUT!",
    "DOBLE": "¡DOBLE!",
    "TRIPLE": "¡TRIPLE!",
    "HOME RUN": "¡HOME RUN!",
    "BASE POR BOLAS": "BASE POR BOLAS",
    "CAMBIO DE INNING": "CAMBIO DE INNING",
    "PLAY BALL": "PLAY BALL"
  };
  return labels[type] || type;
}

function triggerFx(type) {
  if (!type) return;

  const layer = $("fxLayer");
  const text = $("fxText");
  if (!layer || !text) return;

  currentFxType = type;
  clearTimeout(fxTimer);

  text.textContent = fxLabel(type);
  layer.dataset.fx = String(type).toLowerCase().replace(/\s+/g, "-");

  // Reinicia la animación aunque el mismo tipo ocurra dos veces seguidas.
  layer.classList.remove("show");
  void layer.offsetWidth;
  layer.classList.add("show");

  fxTimer = setTimeout(() => {
    layer.classList.remove("show");
    currentFxType = "";
  }, FX_DURATION_MS);
}

function fxTimestamp(fx) {
  const at = Number(fx?.at || 0);
  if (Number.isFinite(at) && at > 0) return at;

  // Compatibilidad con la V2: el nonce anterior era Date.now().
  const legacy = Number(fx?.nonce);
  if (Number.isFinite(legacy) && legacy > 1_000_000_000_000) return legacy;
  return 0;
}

function handleFx(fx) {
  const nonce = fx?.nonce;
  const type = fx?.type;
  if (!nonce || !type || nonce === lastFxNonce) return;

  lastFxNonce = nonce;

  // Evita repetir una animación antigua al abrir /overlay mucho después.
  const timestamp = fxTimestamp(fx);
  const isFresh = !timestamp || Math.abs(Date.now() - timestamp) <= FX_FRESH_WINDOW_MS;
  if (!isFresh) return;

  // Si /overlay está en otra pestaña, no gastamos la animación mientras está oculta.
  // La reproducimos en cuanto el usuario vuelve a verla.
  if (document.hidden) {
    pendingFx = { type, nonce };
    return;
  }

  pendingFx = null;
  triggerFx(type);
}

document.addEventListener("visibilitychange", () => {
  const layer = $("fxLayer");

  if (document.hidden) {
    // Si el usuario cambia de pestaña en mitad de una animación, la dejamos pendiente
    // para que pueda verla completa al volver.
    if (currentFxType && layer?.classList.contains("show")) {
      pendingFx = { type: currentFxType, nonce: lastFxNonce };
      clearTimeout(fxTimer);
      layer.classList.remove("show");
    }
    return;
  }

  if (pendingFx?.type) {
    const type = pendingFx.type;
    pendingFx = null;
    triggerFx(type);
  }
});

function render(game) {
  const away = game.teams.away;
  const home = game.teams.home;

  $("awayName").textContent = away.name;
  $("homeName").textContent = home.name;
  $("awayBadge").textContent = initials(away.name);
  $("homeBadge").textContent = initials(home.name);

  $("awayRuns").textContent = away.runs;
  $("homeRuns").textContent = home.runs;
  $("awayR").textContent = away.runs;
  $("awayH").textContent = away.hits;
  $("awayE").textContent = away.errors;
  $("homeR").textContent = home.runs;
  $("homeH").textContent = home.hits;
  $("homeE").textContent = home.errors;

  const top = game.inning.half === "top";
  $("halfArrow").textContent = top ? "▲" : "▼";
  $("halfLabel").textContent = top ? "ALTA" : "BAJA";
  $("inningNumber").textContent = game.inning.number;
  $("battingTeam").textContent = top ? away.name : home.name;

  $("baseFirst").classList.toggle("active", game.bases.first);
  $("baseSecond").classList.toggle("active", game.bases.second);
  $("baseThird").classList.toggle("active", game.bases.third);

  setLights("[data-ball]", game.count.balls);
  setLights("[data-strike]", game.count.strikes);
  setLights("[data-out]", game.count.outs);

  $("lastPlay").textContent = game.lastPlay || "PLAY BALL";
  handleFx(game.fx);
}

$("connectionStatus").textContent = mode === "firebase" ? "EN LÍNEA" : "DEMO LOCAL";
$("connectionStatus").classList.toggle("local", mode !== "firebase");
subscribeGame(render);
