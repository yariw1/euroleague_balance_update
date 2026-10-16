// EuroLeague Balance — compares 2026-27 results with the same games in 2025-26.
// This season's games are stored only on this device (localStorage).

const STORE_KEY = "elb.games.v1";
const BACKUP_KEY = "elb.lastBackup";
const SHORT = { "Hapoel Tel Aviv": "Hapoel", "Maccabi Tel Aviv": "Maccabi" };
const CLS = { "Hapoel Tel Aviv": "hapoel", "Maccabi Tel Aviv": "maccabi" };

// ---------- storage ----------
function loadGames() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveGames(games) {
  localStorage.setItem(STORE_KEY, JSON.stringify(games));
}
let games = loadGames(); // key "team|opponent|H" -> {team, opponent, location, result, score, saved}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const key = (team, opp, loc) => `${team}|${opp}|${loc}`;
// Display name: a replaced team shows both names, e.g. "Monaco/Besiktas".
const oppName = opp => (OPPONENT_ALIAS[opp] ? `${OPPONENT_ALIAS[opp]}/${opp}` : opp);

// ---------- season data ----------
function opponentsFor(team) {
  // This season's opponents: last season's list with aliases swapped in (Monaco -> Besiktas).
  const reverse = Object.fromEntries(Object.entries(OPPONENT_ALIAS).map(([now, then]) => [then, now]));
  const names = [...new Set(LAST_SEASON.filter(g => g.team === team).map(g => reverse[g.opponent] || g.opponent))];
  return names.sort((a, b) => oppName(a).localeCompare(oppName(b)));
}
function lastSeason(team, opp, loc) {
  const then = OPPONENT_ALIAS[opp] || opp;
  return LAST_SEASON.find(g => g.team === team && g.opponent === then && g.location === loc) || null;
}
function effect(prev, now) {
  if (!prev || !now || prev.result === now.result) return 0;
  return now.result === "W" ? 1 : -1;
}
function summary(team) {
  let bal = 0, played = 0, better = 0, worse = 0, same = 0;
  for (const g of Object.values(games)) {
    if (g.team !== team) continue;
    played++;
    const e = effect(lastSeason(g.team, g.opponent, g.location), g);
    bal += e;
    if (e > 0) better++; else if (e < 0) worse++; else same++;
  }
  return { bal, played, better, worse, same };
}

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const signed = n => (n > 0 ? "+" + n : String(n));
const tone = n => (n > 0 ? "pos" : n < 0 ? "neg" : "zero");
const locName = l => (l === "H" ? "Home" : "Away");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function makeSeg(el, options, value, onChange) {
  el.innerHTML = "";
  for (const o of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.label;
    b.dataset.value = o.value;
    if (o.cls) b.classList.add(o.cls);
    b.addEventListener("click", () => { setSeg(el, o.value); onChange(o.value); });
    el.appendChild(b);
  }
  setSeg(el, value);
}
function setSeg(el, value) {
  for (const b of el.children) b.classList.toggle("on", b.dataset.value === value);
}
function fillOpponents(select, team, keep) {
  const opps = opponentsFor(team);
  select.innerHTML = opps.map(o => `<option value="${esc(o)}">${esc(oppName(o))}</option>`).join("");
  if (keep && opps.includes(keep)) select.value = keep;
}
const TEAM_OPTS = TEAMS.map(t => ({ label: SHORT[t], value: t }));
const LOC_OPTS = [{ label: "Home", value: "H" }, { label: "Away", value: "A" }];
const RES_OPTS = [{ label: "Win", value: "W", cls: "w" }, { label: "Loss", value: "L", cls: "l" }];

// ---------- tabs ----------
function show(view) {
  for (const s of document.querySelectorAll(".view")) s.hidden = s.id !== "view-" + view;
  for (const b of document.querySelectorAll(".tabs button")) b.classList.toggle("active", b.dataset.view === view);
  if (view === "balance") renderBalance();
  if (view === "table") renderTable();
  if (view === "lookup") renderLookup();
  if (view === "add") renderPreview();
  window.scrollTo(0, 0);
}
for (const b of document.querySelectorAll(".tabs button")) {
  b.addEventListener("click", () => {
    if (b.dataset.view === "add") resetAdd();
    show(b.dataset.view);
  });
}

// ---------- balance ----------
function renderBalance() {
  $("balance-cards").innerHTML = TEAMS.map(t => {
    const s = summary(t);
    return `<div class="card team-card ${CLS[t]}">
      <div class="name">${esc(t)}</div>
      <div class="num ${tone(s.bal)}">${signed(s.bal)}</div>
      <div class="stats">
        <div><b>${s.played}</b><span>of 38 played</span></div>
        <div><b class="pos">${s.better}</b><span>better</span></div>
        <div><b class="neg">${s.worse}</b><span>worse</span></div>
        <div><b>${s.same}</b><span>same</span></div>
      </div>
    </div>`;
  }).join("");
  renderBackupStatus();
}

// ---------- add / edit ----------
const add = { team: TEAMS[0], loc: "H", res: null, editing: false };

function resetAdd() {
  add.editing = false;
  add.res = null;
  $("add-s1").value = $("add-s2").value = "";
  $("add-msg").textContent = "";
  armDelete(false);
  syncAddForm();
}
function openEdit(team, opp, loc) {
  const g = games[key(team, opp, loc)];
  add.team = team; add.loc = loc; add.editing = !!g;
  add.res = g ? g.result : null;
  const [s1, s2] = g && g.score ? g.score.split("-") : ["", ""];
  $("add-s1").value = s1 || ""; $("add-s2").value = s2 || "";
  $("add-msg").textContent = "";
  armDelete(false);
  syncAddForm(opp);
  show("add");
}
function syncAddForm(opp) {
  makeSeg($("add-team"), TEAM_OPTS, add.team, v => { add.team = v; fillOpponents($("add-opp"), v, $("add-opp").value); slotChanged(); });
  fillOpponents($("add-opp"), add.team, opp || $("add-opp").value);
  makeSeg($("add-loc"), LOC_OPTS, add.loc, v => { add.loc = v; slotChanged(); });
  makeSeg($("add-res"), RES_OPTS, add.res, v => { add.res = v; renderPreview(); });
  renderPreview();
}
// When team/opponent/location changes, load that slot's existing entry (if any).
function slotChanged() {
  const g = games[key(add.team, $("add-opp").value, add.loc)];
  add.editing = !!g;
  add.res = g ? g.result : null;
  const [s1, s2] = g && g.score ? g.score.split("-") : ["", ""];
  $("add-s1").value = s1 || ""; $("add-s2").value = s2 || "";
  setSeg($("add-res"), add.res);
  $("add-msg").textContent = "";
  armDelete(false);
  renderPreview();
}
$("add-opp").addEventListener("change", slotChanged);

function renderPreview() {
  const opp = $("add-opp").value;
  const prev = lastSeason(add.team, opp, add.loc);
  const existing = games[key(add.team, opp, add.loc)];
  $("add-title").textContent = existing ? "Edit game" : "Add a game";
  $("btn-save").textContent = existing ? "Save changes" : "Save game";
  $("edit-actions").hidden = !existing;
  $("btn-save").disabled = !add.res;

  let html = prev
    ? `Last season (${locName(add.loc)}): <b>${prev.result === "W" ? "Win" : "Loss"}</b> <span class="muted">${esc(prev.score)}</span>`
    : `No matching game last season.`;
  if (add.res) {
    const e = effect(prev, { result: add.res });
    html += `<br>Effect on balance: <span class="eff ${tone(e)}">${signed(e)}</span>`;
  }
  if (existing) html += `<br><span class="muted">Already entered this season: ${existing.result === "W" ? "Win" : "Loss"}.</span>`;
  $("add-preview").innerHTML = html;
}

$("btn-save").addEventListener("click", () => {
  if (!add.res) return;
  const opp = $("add-opp").value;
  const s1 = $("add-s1").value.trim(), s2 = $("add-s2").value.trim();
  const score = s1 && s2 ? `${parseInt(s1, 10)}-${parseInt(s2, 10)}` : "";
  const wasEdit = !!games[key(add.team, opp, add.loc)];
  games[key(add.team, opp, add.loc)] = { team: add.team, opponent: opp, location: add.loc, result: add.res, score, saved: new Date().toISOString() };
  saveGames(games);
  const e = effect(lastSeason(add.team, opp, add.loc), { result: add.res });
  $("add-msg").innerHTML = `${wasEdit ? "Updated" : "Saved"}: ${SHORT[add.team]} vs ${esc(oppName(opp))} (${locName(add.loc)}) — balance now <span class="${tone(summary(add.team).bal)}">${signed(summary(add.team).bal)}</span> (${signed(e)})`;
  armDelete(false);
  renderPreview();
});

let deleteArmed = false;
function armDelete(on) {
  deleteArmed = on;
  $("btn-delete").textContent = on ? "Tap again to delete" : "Delete this game";
  $("btn-delete").classList.toggle("ghost", !on);
}
$("btn-delete").addEventListener("click", () => {
  if (!deleteArmed) { armDelete(true); return; }
  const opp = $("add-opp").value;
  delete games[key(add.team, opp, add.loc)];
  saveGames(games);
  add.res = null; add.editing = false;
  setSeg($("add-res"), null);
  $("add-s1").value = $("add-s2").value = "";
  $("add-msg").textContent = `Deleted ${SHORT[add.team]} vs ${oppName(opp)} (${locName(add.loc)}).`;
  armDelete(false);
  renderPreview();
});

// ---------- lookup ----------
const lk = { team: TEAMS[0], loc: "H" };
function initLookup() {
  makeSeg($("lk-team"), TEAM_OPTS, lk.team, v => { lk.team = v; fillOpponents($("lk-opp"), v, $("lk-opp").value); renderLookup(); });
  fillOpponents($("lk-opp"), lk.team);
  makeSeg($("lk-loc"), LOC_OPTS, lk.loc, v => { lk.loc = v; renderLookup(); });
  $("lk-opp").addEventListener("change", renderLookup);
}
function renderLookup() {
  const opp = $("lk-opp").value;
  const prev = lastSeason(lk.team, opp, lk.loc);
  const now = games[key(lk.team, opp, lk.loc)];
  const box = (season, g, extra) => `<div class="box"><div class="season">${season}</div>
    <div class="res">${g ? `<span class="chip ${g.result}">${g.result}</span>` : `<span class="dash">—</span>`}</div>
    <div class="det">${g ? esc(g.score || "") + (extra ? " · " + extra : "") : "Not played yet"}</div></div>`;
  let html = box("2025-26", prev, prev ? "Rd " + prev.round : "")
           + box("2026-27", now, "");
  if (prev && now) { const e = effect(prev, now); html += `<div class="eff ${tone(e)}">Effect: ${signed(e)}</div>`; }
  $("lk-result").innerHTML = html;
}

// ---------- table ----------
let tbTeam = TEAMS[0];
let tbSort = "opp";
const SORT_OPTS = [{ label: "By opponent", value: "opp" }, { label: "By date (25-26)", value: "date" }];
const shortDate = d => { const t = new Date(d); return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }); };
function renderTable() {
  makeSeg($("tb-team"), TEAM_OPTS, tbTeam, v => { tbTeam = v; renderTable(); });
  makeSeg($("tb-sort"), SORT_OPTS, tbSort, v => { tbSort = v; renderTable(); });
  const slots = [];
  for (const opp of opponentsFor(tbTeam)) {
    for (const loc of ["H", "A"]) slots.push({ opp, loc, prev: lastSeason(tbTeam, opp, loc) });
  }
  if (tbSort === "date") {
    // Actual game date (some games were postponed, so round order isn't always date order).
    const when = s => (s.prev ? new Date(s.prev.date).getTime() || 0 : Infinity);
    slots.sort((a, b) => when(a) - when(b) || (a.prev?.round || 0) - (b.prev?.round || 0));
  }
  let rows = "", total = 0;
  for (const { opp, loc, prev } of slots) {
    const now = games[key(tbTeam, opp, loc)];
    const e = now ? effect(prev, now) : null;
    if (e) total += e;
    const chip = g => g ? `<span class="chip ${g.result}">${g.result}</span>` : `<span class="dash">·</span>`;
    const sub = tbSort === "date" && prev ? `<div class="sub-date">${shortDate(prev.date)} · Rd ${prev.round} · ${esc(prev.score)}</div>` : "";
    rows += `<tr data-opp="${esc(opp)}" data-loc="${loc}">
      <td>${esc(oppName(opp))}${sub}</td><td>${loc}</td><td>${chip(prev)}</td><td>${chip(now)}</td>
      <td class="${e === null ? "dash" : tone(e)}">${e === null ? "" : signed(e)}</td></tr>`;
  }
  $("tb-body").innerHTML = rows;
  const s = summary(tbTeam);
  $("tb-foot").innerHTML = `<tr><td colspan="3">Balance (${s.played} played)</td><td></td><td class="${tone(total)}">${signed(total)}</td></tr>`;
}
$("tb-body").addEventListener("click", e => {
  const tr = e.target.closest("tr");
  if (tr) openEdit(tbTeam, tr.dataset.opp, tr.dataset.loc);
});

// ---------- backup ----------
function renderBackupStatus() {
  let last = null;
  try { last = localStorage.getItem(BACKUP_KEY); } catch {}
  const n = Object.keys(games).length;
  if (!last) { $("backup-status").textContent = n ? `${n} games saved on this phone. No backup yet.` : "Nothing to back up yet."; return; }
  const days = Math.floor((Date.now() - new Date(last)) / 864e5);
  $("backup-status").textContent = `${n} games saved. Last backup: ${days === 0 ? "today" : days + " day" + (days > 1 ? "s" : "") + " ago"}.`;
}
$("btn-export").addEventListener("click", async () => {
  const data = { app: "euroleague-balance", version: 1, exported: new Date().toISOString(), games: Object.values(games) };
  const name = `euroleague-balance-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "EuroLeague Balance backup" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  } catch (err) {
    if (err && err.name === "AbortError") return; // user closed the share sheet
  }
  renderBackupStatus();
});

let pendingImport = null;
$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== "euroleague-balance" || !Array.isArray(data.games)) throw new Error("bad");
    const valid = data.games.filter(g => TEAMS.includes(g.team) && opponentsFor(g.team).includes(g.opponent)
      && (g.location === "H" || g.location === "A") && (g.result === "W" || g.result === "L"));
    pendingImport = valid;
    $("import-msg").textContent = `This backup has ${valid.length} games (from ${String(data.exported || "").slice(0, 10)}). It will replace the ${Object.keys(games).length} games on this phone.`;
    $("import-confirm").hidden = false;
  } catch {
    pendingImport = null;
    $("import-msg").textContent = "That file isn't a EuroLeague Balance backup.";
    $("import-confirm").hidden = false;
    $("btn-import-yes").hidden = true;
    return;
  }
  $("btn-import-yes").hidden = false;
});
$("btn-import-yes").addEventListener("click", () => {
  if (!pendingImport) return;
  games = {};
  for (const g of pendingImport) games[key(g.team, g.opponent, g.location)] = g;
  saveGames(games);
  pendingImport = null;
  $("import-confirm").hidden = true;
  renderBalance();
});
$("btn-import-no").addEventListener("click", () => { pendingImport = null; $("import-confirm").hidden = true; });

// ---------- start ----------
syncAddForm();
initLookup();
show("balance");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
