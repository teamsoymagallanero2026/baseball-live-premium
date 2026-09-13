import { DEFAULT_GAME } from "./config.js";
import {
  mode,
  normalizeGame,
  ensureGame,
  subscribeGame,
  saveGame,
  watchAuth,
  login,
  logout
} from "./store.js";

const $ = id => document.getElementById(id);
const HISTORY_KEY = "baseball-live-premium-history-v1";
const MAGALLANES_META = { name: "MAGALLANES", short: "MAG", logo: "./assets/magallanes.png" };

let game = normalizeGame(DEFAULT_GAME);
let canWrite = mode === "local";
let toastTimer = null;

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function battingKey(g = game) { return g.inning.half === "top" ? "away" : "home"; }

function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "EQP";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

function isMagallanes(team) {
  const text = `${team?.name || ""} ${team?.short || ""}`.toUpperCase();
  return text.includes("MAGALLANES") || /\bMAG\b/.test(text);
}

function showToast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").classList.add("show");
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}
function setHistory(history) { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-20))); }
function pushHistory(snapshot) {
  const h = getHistory();
  h.push(clone(snapshot));
  setHistory(h);
}

async function commit(next, message = "Actualizado", remember = true) {
  if (!canWrite) return;
  if (remember) pushHistory(game);
  game = normalizeGame(next);
  await saveGame(game);
  showToast(message);
}

function fx(next, type) {
  const at = Date.now();
  const unique = (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  next.fx = { type, nonce: `${at}-${unique}`, at };
}

function resetCount(next) { next.count.balls = 0; next.count.strikes = 0; }
function clearBases(next) { next.bases = { first: false, second: false, third: false }; }

function addRuns(next, amount) {
  const key = battingKey(next);
  next.teams[key].runs = Math.max(0, next.teams[key].runs + amount);
}

function switchSideState(next) {
  resetCount(next);
  clearBases(next);
  next.count.outs = 0;
  if (next.inning.half === "top") {
    next.inning.half = "bottom";
  } else {
    next.inning.half = "top";
    next.inning.number += 1;
  }
  next.lastPlay = "CAMBIO DE LADO";
  fx(next, "CAMBIO DE INNING");
}

function recordOutState(next, label = "OUT") {
  resetCount(next);
  if (next.count.outs >= 2) {
    switchSideState(next);
  } else {
    next.count.outs += 1;
    next.lastPlay = label;
    fx(next, label === "PONCHE" ? "PONCHE" : "OUT");
  }
}

function walkState(next) {
  const { first, second, third } = next.bases;
  if (first && second && third) addRuns(next, 1);
  next.bases.third = third || (first && second);
  next.bases.second = second || first;
  next.bases.first = true;
  resetCount(next);
  next.lastPlay = "BASE POR BOLAS";
  fx(next, "BASE POR BOLAS");
}

function singleState(next) {
  const key = battingKey(next);
  next.teams[key].hits += 1;
  if (next.bases.third) addRuns(next, 1);
  next.bases.third = next.bases.second;
  next.bases.second = next.bases.first;
  next.bases.first = true;
  resetCount(next);
  next.lastPlay = "HIT — SENCILLO";
  fx(next, "HIT");
}

function doubleState(next) {
  const key = battingKey(next);
  next.teams[key].hits += 1;
  let runs = 0;
  if (next.bases.third) runs += 1;
  if (next.bases.second) runs += 1;
  if (runs) addRuns(next, runs);
  next.bases.third = next.bases.first;
  next.bases.second = true;
  next.bases.first = false;
  resetCount(next);
  next.lastPlay = "DOBLE";
  fx(next, "DOBLE");
}

function tripleState(next) {
  const key = battingKey(next);
  next.teams[key].hits += 1;
  const runners = [next.bases.first, next.bases.second, next.bases.third].filter(Boolean).length;
  if (runners) addRuns(next, runners);
  next.bases = { first: false, second: false, third: true };
  resetCount(next);
  next.lastPlay = "TRIPLE";
  fx(next, "TRIPLE");
}

function homerunState(next) {
  const key = battingKey(next);
  next.teams[key].hits += 1;
  const runners = [next.bases.first, next.bases.second, next.bases.third].filter(Boolean).length;
  addRuns(next, runners + 1);
  clearBases(next);
  resetCount(next);
  next.lastPlay = "HOME RUN";
  fx(next, "HOME RUN");
}

async function action(type) {
  const next = clone(game);
  const key = battingKey(next);
  switch (type) {
    case "ball":
      if (next.count.balls >= 3) walkState(next);
      else { next.count.balls += 1; next.lastPlay = "BOLA"; }
      break;
    case "strike":
      if (next.count.strikes >= 2) recordOutState(next, "PONCHE");
      else { next.count.strikes += 1; next.lastPlay = "STRIKE"; }
      break;
    case "out": recordOutState(next, "OUT"); break;
    case "strikeout": recordOutState(next, "PONCHE"); break;
    case "walk": walkState(next); break;
    case "single": singleState(next); break;
    case "double": doubleState(next); break;
    case "triple": tripleState(next); break;
    case "homerun": homerunState(next); break;
    default: return;
  }
  await commit(next, `${next.teams[key].name}: ${next.lastPlay}`);
}

function renderLogoPreview(side, team) {
  const img = $(`${side}LogoPreview`);
  const fallback = $(`${side}LogoFallback`);
  const shell = $(`${side}LogoShell`);
  if (!img || !fallback || !shell) return;

  fallback.textContent = team.short || initials(team.name);
  const logo = String(team.logo || "").trim();
  if (!logo) {
    img.removeAttribute("src");
    img.style.display = "none";
    shell.classList.remove("has-logo");
    return;
  }
  img.onload = () => { img.style.display = "block"; shell.classList.add("has-logo"); };
  img.onerror = () => { img.style.display = "none"; shell.classList.remove("has-logo"); };
  img.src = logo;
}

function render(g) {
  game = normalizeGame(g);
  const a = game.teams.away;
  const h = game.teams.home;

  $("homeTitle").textContent = h.name;
  $("awayTitle").textContent = a.name;

  if (document.activeElement !== $("homeNameInput")) $("homeNameInput").value = h.name;
  if (document.activeElement !== $("awayNameInput")) $("awayNameInput").value = a.name;
  if (document.activeElement !== $("homeShortInput")) $("homeShortInput").value = h.short || initials(h.name);
  if (document.activeElement !== $("awayShortInput")) $("awayShortInput").value = a.short || initials(a.name);
  if (document.activeElement !== $("homeLogoUrlInput")) $("homeLogoUrlInput").value = h.logo?.startsWith("data:") ? "" : (h.logo || "");
  if (document.activeElement !== $("awayLogoUrlInput")) $("awayLogoUrlInput").value = a.logo?.startsWith("data:") ? "" : (a.logo || "");

  renderLogoPreview("home", h);
  renderLogoPreview("away", a);

  $("homeScoreBig").textContent = h.runs;
  $("awayScoreBig").textContent = a.runs;
  $("homeRunsValue").textContent = h.runs;
  $("homeHitsValue").textContent = h.hits;
  $("homeErrorsValue").textContent = h.errors;
  $("awayRunsValue").textContent = a.runs;
  $("awayHitsValue").textContent = a.hits;
  $("awayErrorsValue").textContent = a.errors;

  $("ballsValue").textContent = game.count.balls;
  $("strikesValue").textContent = game.count.strikes;
  $("outsValue").textContent = game.count.outs;

  // Visualmente: VISITANTE a la izquierda y HOME a la derecha.
  $("liveMatch").textContent = `${a.name} ${a.runs} — ${h.runs} ${h.name}`;
  $("atBatName").textContent = game.teams[battingKey(game)].name;

  const top = game.inning.half === "top";
  $("inningDisplay").textContent = `${top ? "▲ ALTA" : "▼ BAJA"} DEL ${game.inning.number}`;
  $("topBtn").classList.toggle("active", top);
  $("bottomBtn").classList.toggle("active", !top);
  document.querySelectorAll("[data-base]").forEach(btn => btn.classList.toggle("active", Boolean(game.bases[btn.dataset.base])));
}

async function handleTeamField(key, field, value) {
  const next = clone(game);
  if (field === "name") next.teams[key].name = value.trim() || (key === "home" ? "HOME CLUB" : "VISITANTE");
  if (field === "short") next.teams[key].short = value.trim().replace(/[^A-Za-z0-9ÁÉÍÓÚÑ]/gi, "").slice(0, 5).toUpperCase() || initials(next.teams[key].name);
  if (field === "logo") next.teams[key].logo = value.trim();
  await commit(next, "Equipo actualizado");
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressLogo(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Selecciona una imagen válida");
  if (file.size > 8 * 1024 * 1024) throw new Error("El logo es demasiado pesado");

  const img = await loadImage(file);
  const maxSide = 320;
  const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * ratio));
  const height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let data = canvas.toDataURL("image/webp", .88);
  if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/png");
  if (data.length > 330000) data = canvas.toDataURL("image/webp", .72);
  if (data.length > 345000) throw new Error("El logo sigue siendo demasiado pesado. Usa una imagen más pequeña.");
  return data;
}

async function handleLogoFile(key, file) {
  try {
    showToast("Procesando logo...");
    const dataUrl = await compressLogo(file);
    const next = clone(game);
    next.teams[key].logo = dataUrl;
    await commit(next, "Logo actualizado");
  } catch (error) {
    showToast(error?.message || "No se pudo cargar el logo");
  }
}

async function clearLogo(key) {
  const next = clone(game);
  next.teams[key].logo = "";
  await commit(next, "Logo eliminado");
}

async function swapTeams(message = "VISITANTE y HOME intercambiados") {
  const next = clone(game);
  const temp = next.teams.home;
  next.teams.home = next.teams.away;
  next.teams.away = temp;
  next.lastPlay = "EQUIPOS CONFIGURADOS";
  await commit(next, message);
}

async function moveMagallanesTo(target) {
  const other = target === "home" ? "away" : "home";
  if (isMagallanes(game.teams[target])) return showToast(`Magallanes ya está como ${target === "home" ? "HOME" : "VISITANTE"}`);

  if (isMagallanes(game.teams[other])) {
    await swapTeams(`Magallanes configurado como ${target === "home" ? "HOME" : "VISITANTE"}`);
    return;
  }

  const next = clone(game);
  next.teams[target] = { ...next.teams[target], ...MAGALLANES_META };
  next.lastPlay = "EQUIPOS CONFIGURADOS";
  await commit(next, `Magallanes configurado como ${target === "home" ? "HOME" : "VISITANTE"}`);
}

function bindEvents() {
  document.querySelectorAll("[data-step]").forEach(button => {
    button.addEventListener("click", async () => {
      const [team, stat, delta] = button.dataset.step.split(":");
      const change = Number(delta);
      const next = clone(game);
      next.teams[team][stat] = Math.max(0, Number(next.teams[team][stat]) + change);

      const labels = { runs: "CARRERA", hits: "HIT", errors: "ERROR" };
      const label = labels[stat] || stat.toUpperCase();
      next.lastPlay = `${next.teams[team].name}: ${label} ${change > 0 ? "+1" : "-1"}`;

      if (change > 0) {
        if (stat === "runs") fx(next, "CARRERA");
        if (stat === "hits") fx(next, "HIT");
        if (stat === "errors") fx(next, "ERROR");
      }
      await commit(next, "Marcador actualizado");
    });
  });

  document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => action(button.dataset.action)));

  document.querySelectorAll("[data-base]").forEach(button => {
    button.addEventListener("click", async () => {
      const next = clone(game);
      const base = button.dataset.base;
      next.bases[base] = !next.bases[base];
      next.lastPlay = "BASES ACTUALIZADAS";
      await commit(next, "Base actualizada");
    });
  });

  document.querySelectorAll("[data-fx]").forEach(button => {
    button.addEventListener("click", async () => {
      const next = clone(game);
      fx(next, button.dataset.fx);
      next.lastPlay = button.dataset.fx;
      await commit(next, "Animación enviada");
    });
  });

  $("homeNameInput").addEventListener("change", e => handleTeamField("home", "name", e.target.value));
  $("awayNameInput").addEventListener("change", e => handleTeamField("away", "name", e.target.value));
  $("homeShortInput").addEventListener("change", e => handleTeamField("home", "short", e.target.value));
  $("awayShortInput").addEventListener("change", e => handleTeamField("away", "short", e.target.value));
  $("homeLogoUrlInput").addEventListener("change", e => { if (e.target.value.trim()) handleTeamField("home", "logo", e.target.value); });
  $("awayLogoUrlInput").addEventListener("change", e => { if (e.target.value.trim()) handleTeamField("away", "logo", e.target.value); });
  $("homeLogoFile").addEventListener("change", e => { const f = e.target.files?.[0]; if (f) handleLogoFile("home", f); e.target.value = ""; });
  $("awayLogoFile").addEventListener("change", e => { const f = e.target.files?.[0]; if (f) handleLogoFile("away", f); e.target.value = ""; });
  $("homeLogoClearBtn").addEventListener("click", () => clearLogo("home"));
  $("awayLogoClearBtn").addEventListener("click", () => clearLogo("away"));

  $("swapTeamsBtn").addEventListener("click", () => swapTeams());
  $("magHomeBtn").addEventListener("click", () => moveMagallanesTo("home"));
  $("magAwayBtn").addEventListener("click", () => moveMagallanesTo("away"));

  $("resetCountBtn").addEventListener("click", async () => {
    const next = clone(game); resetCount(next); next.lastPlay = "CONTEO LIMPIO"; await commit(next, "Conteo limpio");
  });
  $("clearBasesBtn").addEventListener("click", async () => {
    const next = clone(game); clearBases(next); next.lastPlay = "BASES VACÍAS"; await commit(next, "Bases vacías");
  });
  $("switchSideBtn").addEventListener("click", async () => {
    const next = clone(game); switchSideState(next); await commit(next, "Cambio de lado");
  });
  $("inningPlusBtn").addEventListener("click", async () => {
    const next = clone(game); next.inning.number += 1; next.lastPlay = `INNING ${next.inning.number}`; await commit(next, "Inning actualizado");
  });
  $("inningMinusBtn").addEventListener("click", async () => {
    const next = clone(game); next.inning.number = Math.max(1, next.inning.number - 1); next.lastPlay = `INNING ${next.inning.number}`; await commit(next, "Inning actualizado");
  });
  $("topBtn").addEventListener("click", async () => {
    const next = clone(game); next.inning.half = "top"; resetCount(next); next.count.outs = 0; next.lastPlay = "ALTA DEL INNING"; await commit(next, "Alta del inning");
  });
  $("bottomBtn").addEventListener("click", async () => {
    const next = clone(game); next.inning.half = "bottom"; resetCount(next); next.count.outs = 0; next.lastPlay = "BAJA DEL INNING"; await commit(next, "Baja del inning");
  });

  $("undoBtn").addEventListener("click", async () => {
    const h = getHistory();
    if (!h.length) return showToast("No hay cambios para deshacer");
    const previous = h.pop();
    setHistory(h);
    await commit(previous, "Último cambio deshecho", false);
  });

  $("newGameBtn").addEventListener("click", async () => {
    if (!confirm("¿Reiniciar todo el partido? Se pondrán carreras, hits, errores, conteo y bases en cero. Los nombres y logos se conservarán.")) return;
    const next = normalizeGame(DEFAULT_GAME);
    // Conserva toda la identidad de ambos equipos; solo reinicia las estadísticas.
    for (const key of ["home", "away"]) {
      next.teams[key].name = game.teams[key].name;
      next.teams[key].short = game.teams[key].short;
      next.teams[key].logo = game.teams[key].logo;
    }
    next.lastPlay = "PLAY BALL";
    fx(next, "PLAY BALL");
    await commit(next, "Partido reiniciado");
  });

  $("logoutBtn").addEventListener("click", () => logout());

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("loginError").textContent = "";
    try {
      await login($("emailInput").value.trim(), $("passwordInput").value);
    } catch (err) {
      $("loginError").textContent = "No se pudo entrar. Revisa correo, contraseña y Firebase Authentication.";
    }
  });
}

bindEvents();
subscribeGame(render);

watchAuth(async user => {
  canWrite = Boolean(user);
  if (mode === "local") {
    $("modeBadge").textContent = "DEMO LOCAL";
    $("modeBadge").classList.add("local");
    $("controlApp").classList.remove("locked");
    $("loginScreen").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    await ensureGame();
    return;
  }

  $("modeBadge").textContent = user ? "FIREBASE EN LÍNEA" : "SIN SESIÓN";
  $("modeBadge").classList.toggle("local", !user);
  $("loginScreen").classList.toggle("hidden", Boolean(user));
  $("controlApp").classList.toggle("locked", !user);
  $("logoutBtn").classList.toggle("hidden", !user);
  if (user) {
    try { await ensureGame(); }
    catch { showToast("Conectado, pero revisa las reglas de Firebase"); }
  }
});
