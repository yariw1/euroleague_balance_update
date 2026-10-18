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
const key = (team, opp, loc) => `${team}|${opp}|${loc}`;
// Opponents that were renamed in the app (old saved name -> current name).
const RENAMED = { "ASVEL": "Villeurbanne" };
function migrate(list) {
  const out = {};
  for (const g of list) {
    if (RENAMED[g.opponent]) g.opponent = RENAMED[g.opponent];
    out[key(g.team, g.opponent, g.location)] = g;
  }
  return out;
}

let games = loadGames(); // key "team|opponent|H" -> {team, opponent, location, result, score, date, saved}
if (Object.values(games).some(g => RENAMED[g.opponent])) { games = migrate(Object.values(games)); saveGames(games); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
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
// Dates: last season uses "4 December 2025", this season "2026-10-16" (read as a local date).
const toTime = d => (!d ? NaN : new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T00:00" : d).getTime());
const shortDate = d => { const t = toTime(d); return isNaN(t) ? (d || "") : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }); };
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

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
  $("add-date").value = todayISO();
  $("add-msg").textContent = "";
  armDelete(false);
  syncAddForm();
}
// Fill the score and date fields from a saved game (or blank score + today's date for a new one).
function fillDetails(g) {
  const [s1, s2] = g && g.score ? g.score.split("-") : ["", ""];
  $("add-s1").value = s1 || ""; $("add-s2").value = s2 || "";
  $("add-date").value = g ? g.date || "" : todayISO();
}
function openEdit(team, opp, loc) {
  const g = games[key(team, opp, loc)];
  add.team = team; add.loc = loc; add.editing = !!g;
  add.res = g ? g.result : null;
  fillDetails(g);
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
  fillDetails(g);
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
    ? `Last season (${locName(add.loc)}): <b>${prev.result === "W" ? "Win" : "Loss"}</b> <span class="muted">${esc(shortDate(prev.date))}</span>`
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
  const date = $("add-date").value; // "YYYY-MM-DD" or "" if left empty
  const wasEdit = !!games[key(add.team, opp, add.loc)];
  games[key(add.team, opp, add.loc)] = { team: add.team, opponent: opp, location: add.loc, result: add.res, score, date, saved: new Date().toISOString() };
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
  fillDetails(null);
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
  const box = (season, g, details) => `<div class="box"><div class="season">${season}</div>
    <div class="res">${g ? `<span class="chip ${g.result}">${g.result}</span>` : `<span class="dash">—</span>`}</div>
    <div class="det">${g ? esc(details.filter(Boolean).join(" · ")) : "Not played yet"}</div></div>`;
  // Last season's scores are kept in the data but not shown.
  let html = box("2025-26", prev, prev ? [shortDate(prev.date), "Rd " + prev.round] : [])
           + box("2026-27", now, now ? [now.score, shortDate(now.date)] : []);
  if (prev && now) { const e = effect(prev, now); html += `<div class="eff ${tone(e)}">Effect: ${signed(e)}</div>`; }
  $("lk-result").innerHTML = html;
}

// ---------- table ----------
let tbTeam = TEAMS[0];
let tbSort = "opp";
const SORT_OPTS = [{ label: "Opponent", value: "opp" }, { label: "Date 25-26", value: "date" }, { label: "Date 26-27", value: "date-now" }];
function renderTable() {
  makeSeg($("tb-team"), TEAM_OPTS, tbTeam, v => { tbTeam = v; renderTable(); });
  makeSeg($("tb-sort"), SORT_OPTS, tbSort, v => { tbSort = v; renderTable(); });
  const slots = [];
  for (const opp of opponentsFor(tbTeam)) {
    for (const loc of ["H", "A"]) slots.push({ opp, loc, prev: lastSeason(tbTeam, opp, loc), now: games[key(tbTeam, opp, loc)] });
  }
  // Actual game date (some games were postponed, so round order isn't always date order).
  const prevWhen = s => (s.prev ? toTime(s.prev.date) || 0 : Infinity);
  const byPrev = (a, b) => prevWhen(a) - prevWhen(b) || (a.prev?.round || 0) - (b.prev?.round || 0);
  const nowWhen = s => (s.now ? toTime(s.now.date) : NaN);
  if (tbSort === "date") slots.sort(byPrev);
  if (tbSort === "date-now") {
    // This season's games by their date first, then the rest by last season's date.
    slots.sort((a, b) => {
      const ta = nowWhen(a), tb = nowWhen(b);
      if (!isNaN(ta) && !isNaN(tb)) return ta - tb || byPrev(a, b);
      if (!isNaN(ta)) return -1;
      if (!isNaN(tb)) return 1;
      return byPrev(a, b);
    });
  }
  let rows = "", total = 0;
  for (const { opp, loc, prev, now } of slots) {
    const e = now ? effect(prev, now) : null;
    if (e) total += e;
    const chip = g => g ? `<span class="chip ${g.result}">${g.result}</span>` : `<span class="dash">·</span>`;
    let subText = "";
    if (tbSort === "date" && prev) subText = `${shortDate(prev.date)} · Rd ${prev.round}`;
    if (tbSort === "date-now") {
      if (now && now.date) subText = [shortDate(now.date), now.score].filter(Boolean).join(" · ");
      else if (prev) subText = `25-26: ${shortDate(prev.date)}`;
    }
    const sub = subText ? `<div class="sub-date">${esc(subText)}</div>` : "";
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
// Android's share menu only accepts certain file types (not .json), so on phones the
// backup is shared as a .txt file (same JSON content). Computers get a normal download.
const isPhone = /Android|iPhone|iPad/i.test(navigator.userAgent);
function downloadBackup(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function backupMsg(text, isError) {
  $("backup-msg").textContent = text;
  $("backup-msg").className = "msg" + (isError ? " neg" : "");
}
$("btn-export").addEventListener("click", async () => {
  const data = { app: "euroleague-balance", version: 1, exported: new Date().toISOString(), games: Object.values(games) };
  const text = JSON.stringify(data, null, 2);
  const base = `euroleague-balance-${new Date().toISOString().slice(0, 10)}`;
  backupMsg("");
  try {
    const file = new File([text], base + ".txt", { type: "text/plain" });
    if (isPhone && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "EuroLeague Balance backup" });
        backupMsg("Backup shared. Save it somewhere safe, e.g. Google Drive.");
      } catch (err) {
        if (err && err.name === "AbortError") { backupMsg("Backup cancelled."); return; }
        downloadBackup(text, base + ".json");
        backupMsg("Sharing didn't work, so the backup was downloaded instead (check Downloads).");
      }
    } else {
      downloadBackup(text, base + ".json");
      backupMsg("Backup downloaded (check your Downloads folder).");
    }
    try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch {}
  } catch (err) {
    backupMsg("Backup failed: " + (err && err.message ? err.message : err), true);
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
    const valid = data.games.filter(g => TEAMS.includes(g.team) && opponentsFor(g.team).includes(RENAMED[g.opponent] || g.opponent)
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
  games = migrate(pendingImport);
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
