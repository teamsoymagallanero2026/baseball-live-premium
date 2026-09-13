import { mode, subscribeGame } from "./store.js";

const $ = id => document.getElementById(id);
let lastFxNonce = 0;
let fxTimer = null;

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

function triggerFx(type) {
  if (!type) return;
  clearTimeout(fxTimer);
  $("fxText").textContent = type;
  $("fxLayer").classList.remove("show");
  void $("fxLayer").offsetWidth;
  $("fxLayer").classList.add("show");
  fxTimer = setTimeout(() => $("fxLayer").classList.remove("show"), 2400);
}

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

  if (game.fx?.nonce && game.fx.nonce !== lastFxNonce) {
    lastFxNonce = game.fx.nonce;
    triggerFx(game.fx.type);
  }
}

$("connectionStatus").textContent = mode === "firebase" ? "EN LÍNEA" : "DEMO LOCAL";
$("connectionStatus").classList.toggle("local", mode !== "firebase");
subscribeGame(render);
