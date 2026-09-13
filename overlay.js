import { mode, subscribeGame } from "./store.js";

const $ = id => document.getElementById(id);

if (new URLSearchParams(location.search).get("guides") === "1") {
  document.body.classList.add("show-guides");
}

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

function isMagallanes(team) {
  const combined = `${team?.name || ""} ${team?.short || ""}`.toUpperCase();
  return combined.includes("MAGALLANES") || /\bMAG\b/.test(combined);
}

function setTeamLogo(side, team) {
  const image = $(`${side}Logo`);
  const fallback = $(`${side}Badge`);
  const shell = image?.closest(".team-logo-shell");
  if (!image || !fallback || !shell) return;

  fallback.textContent = team.short || initials(team.name);

  const logo = String(team.logo || "").trim();
  if (!logo) {
    image.removeAttribute("src");
    image.style.display = "none";
    shell.classList.remove("has-logo");
    return;
  }

  image.onload = () => {
    image.style.display = "block";
    shell.classList.add("has-logo");
  };
  image.onerror = () => {
    image.style.display = "none";
    shell.classList.remove("has-logo");
  };
  image.src = logo;
}

function setLights(selector, activeCount) {
  document.querySelectorAll(selector).forEach((el, index) => {
    el.classList.toggle("on", index < activeCount);
  });
}

function fxLabel(type) {
  const labels = {
    "CARRERA": "¡CARRERA!",
    "¡CARRERA!": "¡CARRERA!",
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
  const legacy = Number(fx?.nonce);
  if (Number.isFinite(legacy) && legacy > 1_000_000_000_000) return legacy;
  return 0;
}

function handleFx(fx) {
  const nonce = fx?.nonce;
  const type = fx?.type;
  if (!nonce || !type || nonce === lastFxNonce) return;
  lastFxNonce = nonce;

  const timestamp = fxTimestamp(fx);
  const isFresh = !timestamp || Math.abs(Date.now() - timestamp) <= FX_FRESH_WINDOW_MS;
  if (!isFresh) return;

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

  // Regla V4.5: VISITANTE siempre izquierda / HOME siempre derecha.
  $("homeName").textContent = home.name;
  $("awayName").textContent = away.name;
  $("homeShort").textContent = home.short || initials(home.name);
  $("awayShort").textContent = away.short || initials(away.name);
  setTeamLogo("home", home);
  setTeamLogo("away", away);

  $("homeCard").classList.toggle("is-magallanes", isMagallanes(home));
  $("awayCard").classList.toggle("is-magallanes", isMagallanes(away));

  $("homeRuns").textContent = home.runs;
  $("awayRuns").textContent = away.runs;
  $("homeR").textContent = home.runs;
  $("homeH").textContent = home.hits;
  $("homeE").textContent = home.errors;
  $("awayR").textContent = away.runs;
  $("awayH").textContent = away.hits;
  $("awayE").textContent = away.errors;

  const top = game.inning.half === "top";
  // Alta: batea visitante (away). Baja: batea home.
  $("awayCard").classList.toggle("is-batting", top);
  $("homeCard").classList.toggle("is-batting", !top);
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
