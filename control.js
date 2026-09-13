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
let game = normalizeGame(DEFAULT_GAME);
let canWrite = mode === "local";
let toastTimer = null;

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function battingKey(g = game) { return g.inning.half === "top" ? "away" : "home"; }
function fieldingKey(g = game) { return battingKey(g) === "away" ? "home" : "away"; }

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
  next.fx = { type, nonce: Date.now() };
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

function render(g) {
  game = normalizeGame(g);
  const a = game.teams.away;
  const h = game.teams.home;
  $("awayTitle").textContent = a.name;
  $("homeTitle").textContent = h.name;
  if (document.activeElement !== $("awayNameInput")) $("awayNameInput").value = a.name;
  if (document.activeElement !== $("homeNameInput")) $("homeNameInput").value = h.name;
  $("awayScoreBig").textContent = a.runs;
  $("homeScoreBig").textContent = h.runs;
  $("awayRunsValue").textContent = a.runs;
  $("awayHitsValue").textContent = a.hits;
  $("awayErrorsValue").textContent = a.errors;
  $("homeRunsValue").textContent = h.runs;
  $("homeHitsValue").textContent = h.hits;
  $("homeErrorsValue").textContent = h.errors;
  $("ballsValue").textContent = game.count.balls;
  $("strikesValue").textContent = game.count.strikes;
  $("outsValue").textContent = game.count.outs;
  $("liveMatch").textContent = `${a.name} ${a.runs} — ${h.runs} ${h.name}`;
  $("atBatName").textContent = game.teams[battingKey(game)].name;
  const top = game.inning.half === "top";
  $("inningDisplay").textContent = `${top ? "▲ ALTA" : "▼ BAJA"} DEL ${game.inning.number}`;
  $("topBtn").classList.toggle("active", top);
  $("bottomBtn").classList.toggle("active", !top);
  document.querySelectorAll("[data-base]").forEach(btn => btn.classList.toggle("active", Boolean(game.bases[btn.dataset.base])));
}

async function handleTeamName(key, value) {
  const next = clone(game);
  next.teams[key].name = value.trim() || (key === "away" ? "VISITANTE" : "LOCAL");
  await commit(next, "Nombre actualizado");
}

function bindEvents() {
  document.querySelectorAll("[data-step]").forEach(button => {
    button.addEventListener("click", async () => {
      const [team, stat, delta] = button.dataset.step.split(":");
      const next = clone(game);
      next.teams[team][stat] = Math.max(0, Number(next.teams[team][stat]) + Number(delta));
      next.lastPlay = `${next.teams[team].name}: ${stat.toUpperCase()} ${Number(delta) > 0 ? "+1" : "-1"}`;
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

  $("awayNameInput").addEventListener("change", e => handleTeamName("away", e.target.value));
  $("homeNameInput").addEventListener("change", e => handleTeamName("home", e.target.value));

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
    if (!confirm("¿Reiniciar todo el partido? Se pondrán carreras, hits, errores, conteo y bases en cero.")) return;
    const next = normalizeGame(DEFAULT_GAME);
    next.teams.away.name = game.teams.away.name;
    next.teams.home.name = game.teams.home.name;
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
