// =======================
// SUPABASE CONFIG
// =======================
const SUPABASE_URL = "https://sebcxlpyqehsbgyalzmz.supabase.co";
const SUPABASE_KEY = "sb_publishable_8BwK3_2OGff5uaDRrdCfHQ_rNhUWCzE";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= DOM =================
const authDiv = document.getElementById("auth");
const appDiv = document.getElementById("app");

const whoami = document.getElementById("whoami");

const fullNameInput = document.getElementById("full_name"); // optional
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const form = document.getElementById("form");
const submitBtn = form?.querySelector('button[type="submit"]');
const tipo = document.getElementById("tipo");
const dataInput = document.getElementById("data");
const ora_inizio = document.getElementById("ora_inizio");
const durata = document.getElementById("durata");
const numero_partecipanti = document.getElementById("numero_partecipanti");
const persone = document.getElementById("persone");
const note = document.getElementById("note");
const allenatore = document.getElementById("allenatore");

const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

const exportExcelBtn = document.getElementById("exportExcelBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");

// Export options
const exportOptions = document.getElementById("exportOptions");
const customDatesWrap = document.getElementById("customDates");
const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const monthPickerWrap = document.getElementById("monthPicker");
const exportMonthInput = document.getElementById("exportMonth");
const applyExportBtn = document.getElementById("applyExport");
const exportRangeRadios = Array.from(document.querySelectorAll('input[name="exportRange"]'));

let lastExportIntent = null; // "excel" | "pdf"


// Views & nav
const viewIds = ["view-dashboard", "view-calendar", "view-list", "view-profile"];
const navButtons = Array.from(document.querySelectorAll(".nav-item"));


// ================= PROFILE UI (colors + avatar) =================
const PROFILE_COLORS = ["#2563eb", "#16a34a", "#0ea5e9", "#14b8a6", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#e11d48", "#db2777", "#a855f7", "#7c3aed", "#6366f1", "#334155", "#0f172a", "#9ca3af"];
const DEFAULT_PROFILE_COLOR = "#2563eb";

function normalizeHexColor(value) {
  const hex = String(value || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(hex) ? hex.toLowerCase() : null;
}

function hashString(input) {
  let hash = 0;
  const str = String(input || "default");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildFallbackUserColor(seed) {
  const hue = hashString(seed) % 360;
  return hslToHex(hue, 72, 48);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getUserColorStorageKey(userId) {
  return `calendar_color_${userId || "guest"}`;
}

function getCurrentUserIdentitySeed() {
  return currentUser?.id || currentUser?.email || currentUser?.user_metadata?.full_name || "default";
}

function getLocalUserColor(userId = currentUser?.id) {
  const saved = normalizeHexColor(localStorage.getItem(getUserColorStorageKey(userId)));
  return saved || buildFallbackUserColor(userId || getCurrentUserIdentitySeed());
}

function getEffectiveUserColor(profile = {}) {
  return normalizeHexColor(profile.trainer_color || profile._trainer_color) || buildFallbackUserColor(profile.id || profile.user_id || profile._full_name || "default");
}

function applyCalendarAccent(color) {
  const safe = normalizeHexColor(color) || DEFAULT_PROFILE_COLOR;
  document.documentElement.style.setProperty("--accent", safe);
}

function initTrainerColors(){
  applyCalendarAccent(getLocalUserColor());
}

function setMyTrainerColor(col, opts = {}){
  const safe = normalizeHexColor(col);
  if (!safe) return;
  if (currentUser?.id) {
    localStorage.setItem(getUserColorStorageKey(currentUser.id), safe);
  }
  applyCalendarAccent(safe);

  if (opts.persistRemote !== false && currentUser){
    Promise.resolve(saveTrainerColor(safe)).catch((e)=>console.warn("trainer_color update error", e));
  }

  if (opts.refreshUI !== false) {
    mountColorPalette();
    renderCalendar();
  }
}

function mountColorPalette(){
  const wrap = document.getElementById("colorPalette");
  const picker = document.getElementById("customColorPicker");
  const preview = document.getElementById("colorPreview");
  if (!wrap) return;

  const saved = getLocalUserColor();

  wrap.innerHTML = "";
  PROFILE_COLORS.forEach((col) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dotpick";
    btn.dataset.color = col;
    btn.style.setProperty("--c", col);
    btn.setAttribute("aria-label", tr("profile.selectColor", { color: col }));
    if (col === saved) btn.classList.add("active");

    btn.onclick = () => {
      setMyTrainerColor(col);
      if (picker) picker.value = col;
      if (preview) preview.style.background = col;
    };

    wrap.appendChild(btn);
  });

  if (picker) {
    picker.value = saved;
    picker.oninput = (e) => {
      const value = normalizeHexColor(e.target.value);
      if (!value) return;
      setMyTrainerColor(value);
      if (preview) preview.style.background = value;
    };
  }

  if (preview) preview.style.background = saved;
}

async function ensureProfileRow(){
  if (!currentUser) return;
  const { data: existing, error } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) { console.warn("profiles read error", error); return; }
  if (!existing) {
    const payload = {
      id: currentUser.id,
      full_name: currentUser.user_metadata?.full_name || null,
      avatar_url: null
    };
    const { error: insErr } = await supabaseClient.from("profiles").insert(payload);
    if (insErr) console.warn("profiles insert error", insErr);
  }
}

async function fetchAvatarUrl(){
  if (!currentUser) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("avatar_url")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) { console.warn("avatar_url read error", error); return null; }
  return data?.avatar_url || null;
}

async function saveAvatarUrl(url){
  if (!currentUser) return;
  const { error } = await supabaseClient
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", currentUser.id);
  if (error) console.warn("avatar_url update error", error);
}


async function fetchTrainerColor(){
  if (!currentUser) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("trainer_color")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) { console.warn("trainer_color read error", error); return null; }
  return data?.trainer_color || null;
}

async function saveTrainerColor(col){
  if (!currentUser) return;
  const safe = normalizeHexColor(col);
  if (!safe) return;
  await ensureProfileRow();
  const payload = {
    id: currentUser.id,
    full_name: currentUser.user_metadata?.full_name || null,
    trainer_color: safe
  };
  const { error } = await supabaseClient
    .from("profiles")
    .upsert(payload, { onConflict: "id" });
  if (error) console.warn("trainer_color update error", error);
}

async function syncTrainerColorFromProfile(){
  if (!currentUser) return;

  const local = getLocalUserColor(currentUser.id);
  const remote = normalizeHexColor(await fetchTrainerColor());

  if (remote) {
    localStorage.setItem(getUserColorStorageKey(currentUser.id), remote);
    setMyTrainerColor(remote, { persistRemote: false });
  } else if (local) {
    await saveTrainerColor(local);
    applyCalendarAccent(local);
  }
}

async function uploadAvatarToStorage(file){
  const bucket = "avatars";
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${currentUser.id}/avatar.${ext}`;
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600"
  });
  if (error) throw error;
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}



function updateMiniAvatar(url){
  const el = document.getElementById("miniAvatar");
  if (!el) return;

  if (url){
    el.textContent = "";
    el.style.backgroundImage = "url('" + withCacheBust(url) + "')";
    el.classList.add("has-photo");
  } else {
    el.style.backgroundImage = "none";
    el.classList.remove("has-photo");
    el.textContent = "👤";
  }
}

function avatarHtml(url, name){
  const safeName = String(name || "").trim();
  const initial = safeName ? safeName.charAt(0).toUpperCase() : "👤";
  const style = url ? ` style="background-image:url('${withCacheBust(url)}')"` : "";
  return `<div class="athlete-avatar"${style}>${url ? "" : initial}</div>`;
}

function withCacheBust(url){
  if (!url) return url;
  const ts = localStorage.getItem(avatarKey("ts")) || String(Date.now());
  const sep = url.includes("?") ? "&" : "?";
  return url + sep + "v=" + encodeURIComponent(ts);
}

function avatarKey(suffix){
  const uid = currentUser?.id || "anon";
  return `profile_avatar_${uid}_${suffix}`;
}


async function loadAvatarIntoUI(){
  const el = document.getElementById("profileAvatar");
  if (!el) return;
  let url = await fetchAvatarUrl();
  if (!url) url = localStorage.getItem(avatarKey("data")) || null; // fallback
  if (url) {
    el.textContent = "";
    el.style.backgroundImage = "url('" + url + "')";
    el.classList.add("has-photo");
    el.classList.remove("no-photo");
  
    updateMiniAvatar(url);
} else {
    el.style.backgroundImage = "none";
    el.classList.remove("has-photo");
    el.classList.add("no-photo");
    el.textContent = "👤";
  }
}

function bindAvatarUpload(){
  const btn = document.getElementById("changeAvatarBtn");
  const input = document.getElementById("avatarInput");
  const avatar = document.getElementById("profileAvatar");
  if (!btn || !input || !avatar) return;

  const open = () => input.click();
  btn.onclick = open;
  avatar.onclick = open;

  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Seleziona un file immagine."); return; }
    if (file.size > 1500000) { alert("Immagine troppo grande (max ~1.5MB)."); return; }

    // local preview
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      localStorage.setItem(avatarKey("data"), dataUrl);
      avatar.textContent = "";
      avatar.style.backgroundImage = "url('" + dataUrl + "')";
      avatar.classList.add("has-photo");
      avatar.classList.remove("no-photo");
    };
    reader.readAsDataURL(file);

    // upload online (cross-device)
    try {
      const publicUrl = await uploadAvatarToStorage(file);
      if (publicUrl) {
        await ensureProfileRow();
        await saveAvatarUrl(publicUrl);
      
        localStorage.setItem(avatarKey("ts"), String(Date.now()));
}
    } catch (e) {
      console.warn("Avatar upload error:", e);
      alert("Upload avatar fallito. Verifica bucket \"avatars\" e policy Storage (403/404). Dettagli in console.");
    } finally {
      input.value = "";
    }
  };
}
const dashGoCalendarBtn = document.getElementById("dashGoCalendarBtn");
const dashGoListBtn = document.getElementById("dashGoListBtn");

// Dashboard fields
const dashSessions = document.getElementById("dashSessions");
const dashHours = document.getElementById("dashHours");
const dashAvgParticipants = document.getElementById("dashAvgParticipants");
const dashPeriod = document.getElementById("dashPeriod");

// Admin filter
const userFilterSelect = document.getElementById("userFilter");
const userFilterWrap = document.getElementById("userFilterWrap");
const dashCustomRange = document.getElementById("dashCustomRange");
const dashDateFrom = document.getElementById("dashDateFrom");
const dashDateTo = document.getElementById("dashDateTo");
const dashPeriodLabel = document.getElementById("dashPeriodLabel");
const dashboardCompareCard = document.getElementById("dashboardCompareCard");
const compareAthlete1 = document.getElementById("compareAthlete1");
const compareAthlete2 = document.getElementById("compareAthlete2");
const compareSummary = document.getElementById("compareSummary");
const coachNameInput = document.getElementById("coachNameInput");
const addCoachBtn = document.getElementById("addCoachBtn");
const coachList = document.getElementById("coachList");
const trainingTypeInput = document.getElementById("trainingTypeInput");
const addTrainingTypeBtn = document.getElementById("addTrainingTypeBtn");
const trainingTypeList = document.getElementById("trainingTypeList");

// List
const listaDiv = document.getElementById("lista");
const listaTitle = document.getElementById("lista-title");

// ================= STATE =================
let currentMonth = new Date();
let allenamentiMese = [];
let giornoSelezionato = null;

let currentUser = null;

    initTrainerColors();
let isAdmin = false;

let selectedUserId = "__all__"; // "__all__" = no filter
let selectedCompareUser1 = "__all__";
let selectedCompareUser2 = "__all__";

// ✅ editing mode (modifica)
let editingId = null;


const DEFAULT_COACHES = ["Coach principale", "Preparatore", "Fisioterapista"];
const DEFAULT_TRAINING_TYPES = ["Allenamento", "Cardio", "Forza", "Mobilità", "Tecnica", "Recupero"];

let sharedCoaches = [...DEFAULT_COACHES];
let sharedTrainingTypes = [...DEFAULT_TRAINING_TYPES];

function normalizeCatalogItems(items, fallback){
  const clean = Array.from(new Set((items || []).map(v => String(v || "").trim()).filter(Boolean)))
    .sort((a,b)=>a.localeCompare(b, 'it'));
  return clean.length ? clean : [...fallback];
}
function getCoaches(){ return sharedCoaches; }
function getTrainingTypes(){ return sharedTrainingTypes; }
function populateSimpleSelect(selectEl, items, placeholder){
  if (!selectEl) return;
  const opts = (items || []).map(v => `<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`);
  selectEl.innerHTML = placeholder ? `<option value="">${placeholder}</option>` + opts.join('') : opts.join('');
}

async function loadSharedCatalogs(){
  const [{ data: coachesData, error: coachesError }, { data: typesData, error: typesError }] = await Promise.all([
    supabaseClient.from("coach_options").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabaseClient.from("training_type_options").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true })
  ]);

  if (coachesError) {
    console.warn("coach_options read error", coachesError);
    sharedCoaches = [...DEFAULT_COACHES];
  } else {
    sharedCoaches = normalizeCatalogItems((coachesData || []).map(x => x.name), DEFAULT_COACHES);
  }

  if (typesError) {
    console.warn("training_type_options read error", typesError);
    sharedTrainingTypes = [...DEFAULT_TRAINING_TYPES];
  } else {
    sharedTrainingTypes = normalizeCatalogItems((typesData || []).map(x => x.name), DEFAULT_TRAINING_TYPES);
  }
}

function refreshAdminLists(){
  if (coachList) coachList.innerHTML = getCoaches().map(name => `<span class="chip">${name}<button type="button" onclick="removeCoach('${encodeURIComponent(name)}')">Rimuovi</button></span>`).join('');
  if (trainingTypeList) trainingTypeList.innerHTML = getTrainingTypes().map(name => `<span class="chip">${name}<button type="button" onclick="removeTrainingType('${encodeURIComponent(name)}')">Rimuovi</button></span>`).join('');
}
function refreshFormOptions(){
  const currentTipo = tipo?.value || "";
  const currentCoach = allenatore?.value || "";
  populateSimpleSelect(tipo, getTrainingTypes(), "Seleziona tipo allenamento");
  populateSimpleSelect(allenatore, getCoaches(), "Seleziona allenatore");
  if (tipo && currentTipo && getTrainingTypes().includes(currentTipo)) tipo.value = currentTipo;
  if (allenatore && currentCoach && getCoaches().includes(currentCoach)) allenatore.value = currentCoach;
}

async function addCatalogItem(tableName, rawName){
  const name = String(rawName || "").trim();
  if (!name) return;
  const { error } = await supabaseClient.from(tableName).upsert({ name, is_active: true }, { onConflict: "name" });
  if (error) {
    console.error(error);
    alert("Impossibile salvare il valore su Supabase.");
    return;
  }
  await loadSharedCatalogs();
  refreshAdminLists();
  refreshFormOptions();
}

async function removeCatalogItem(tableName, name){
  const { error } = await supabaseClient.from(tableName).delete().eq("name", name);
  if (error) {
    console.error(error);
    alert("Impossibile rimuovere il valore da Supabase.");
    return;
  }
  await loadSharedCatalogs();
  refreshAdminLists();
  refreshFormOptions();
}

window.removeCoach = async function(encoded){
  if (!isAdmin) return;
  const name = decodeURIComponent(encoded);
  await removeCatalogItem("coach_options", name);
};
window.removeTrainingType = async function(encoded){
  if (!isAdmin) return;
  const name = decodeURIComponent(encoded);
  await removeCatalogItem("training_type_options", name);
};
function bindAdminCatalogActions(){
  addCoachBtn && (addCoachBtn.onclick = async () => {
    if (!isAdmin) return;
    const name = (coachNameInput?.value || '').trim();
    if (!name) return;
    await addCatalogItem("coach_options", name);
    coachNameInput.value = '';
  });
  addTrainingTypeBtn && (addTrainingTypeBtn.onclick = async () => {
    if (!isAdmin) return;
    const name = (trainingTypeInput?.value || '').trim();
    if (!name) return;
    await addCatalogItem("training_type_options", name);
    trainingTypeInput.value = '';
  });
}
function getDashboardRange(){
  const mode = dashPeriod?.value || 'thisMonth';
  const now = new Date();
  let start, end;
  if (mode === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (mode === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (mode === 'thisYear') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (mode === 'custom' && dashDateFrom?.value && dashDateTo?.value) {
    start = new Date(dashDateFrom.value + 'T00:00:00');
    end = new Date(dashDateTo.value + 'T00:00:00');
  } else {
    start = new Date(2000, 0, 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { start, end, fromDate: isoDate(start), toDate: isoDate(end), mode };
}
function filterRowsByDashboardRange(rows){
  const { fromDate, toDate } = getDashboardRange();
  return (rows || []).filter(r => r.data >= fromDate && r.data <= toDate);
}
function extractCoachName(row = {}) {
  return String(row?.persone || '').split(' | ')[0]?.trim() || '';
}
function buildCoachShareMarkup(rows = []) {
  const coachCounts = {};
  rows.forEach((row) => {
    const coach = extractCoachName(row);
    if (!coach) return;
    coachCounts[coach] = (coachCounts[coach] || 0) + 1;
  });
  const total = rows.length || 0;
  const entries = Object.entries(coachCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (!total || !entries.length) {
    return `<div class="muted">${tr("compare.noCoachData")}</div>`;
  }

  return `
    <div class="compare-coach-share">
      <div class="muted" style="margin-top:8px; font-weight:700;">${tr("compare.coachShare")}</div>
      ${entries.map(([coach, count]) => {
        const pct = Math.round((count / total) * 100);
        return `<div class="muted">${escapeHtml(coach)}: ${pct}%</div>`;
      }).join('')}
    </div>
  `;
}
function getRowCalendarColor(row = {}) {
  return getEffectiveUserColor(row);
}
function buildCalendarDayBackground(rows = []) {
  const uniqueColors = Array.from(new Set(rows
    .map(getRowCalendarColor)
    .map(normalizeHexColor)
    .filter(Boolean)));

  if (!uniqueColors.length) return "";
  if (uniqueColors.length === 1) return uniqueColors[0];

  const stops = uniqueColors.map((color, index) => {
    const start = Math.round((index / uniqueColors.length) * 100);
    const end = Math.round(((index + 1) / uniqueColors.length) * 100);
    return `${color} ${start}% ${end}%`;
  }).join(', ');

  return `linear-gradient(135deg, ${stops})`;
}
async function fetchAthletes(){
  const { data, error } = await supabaseClient.from('profiles').select('id, full_name, trainer_color').order('full_name', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}
async function populateCompareSelectors(){
  if (!compareAthlete1 || !compareAthlete2) return;
  const athletes = await fetchAthletes();
  const opts = ['<option value="__all__">Seleziona atleta</option>'].concat(athletes.map(a => `<option value="${a.id}">${a.full_name || a.id}</option>`));
  compareAthlete1.innerHTML = opts.join('');
  compareAthlete2.innerHTML = opts.join('');
  if (selectedCompareUser1) compareAthlete1.value = selectedCompareUser1;
  if (selectedCompareUser2) compareAthlete2.value = selectedCompareUser2;
}
async function updateCompareDashboard(){
  if (!dashboardCompareCard || !compareSummary) return;
  dashboardCompareCard.style.display = isAdmin ? 'block' : 'none';
  if (!isAdmin) return;
  await populateCompareSelectors();
  const ids = [compareAthlete1?.value, compareAthlete2?.value].filter(v => v && v !== '__all__');
  if (ids.length < 2) {
    compareSummary.innerHTML = `<div class="muted">${tr("compare.selectTwo")}</div>`;
    return;
  }
  const { fromDate, toDate } = getDashboardRange();
  const { data, error } = await supabaseClient.from('allenamenti').select('user_id, durata, numero_partecipanti, persone').in('user_id', ids).gte('data', fromDate).lte('data', toDate);
  if (error) { compareSummary.innerHTML = `<div class="muted">${tr("compare.error")}</div>`; return; }
  const athletes = await fetchAthletes();
  const profileMap = new Map(athletes.map(a => [a.id, a]));
  const cards = ids.map(id => {
    const rows = (data || []).filter(r => r.user_id === id);
    const sessions = rows.length;
    const hours = rows.reduce((s, r) => s + safeNumber(r.durata), 0) / 60;
    const avg = sessions ? rows.reduce((s, r) => s + safeNumber(r.numero_partecipanti), 0) / sessions : 0;
    const athlete = profileMap.get(id) || {};
    const athleteName = athlete.full_name || tr("compare.athlete");
    const athleteColor = normalizeHexColor(athlete.trainer_color) || buildFallbackUserColor(id || athleteName);
    return `<div class="compare-card"><div class="stat-label" style="display:flex; align-items:center; gap:8px;"><span style="display:inline-block; width:10px; height:10px; border-radius:999px; background:${athleteColor};"></span><span>${escapeHtml(athleteName)}</span></div><div class="stat-value">${sessions}</div><div class="muted">${tr("stats.sessions")}</div><div class="muted">${tr("stats.hours")}: ${hours.toFixed(1)} · ${tr("stats.avgParticipants")}: ${avg.toFixed(1)}</div>${buildCoachShareMarkup(rows)}</div>`;
  });
  compareSummary.innerHTML = cards.join('');
}
function syncDashboardRangeUI(){
  if (dashCustomRange) dashCustomRange.style.display = (dashPeriod?.value === 'custom') ? 'flex' : 'none';
  if (dashPeriod?.value === 'custom' && dashDateFrom && dashDateTo) {
    if (!dashDateFrom.value || !dashDateTo.value) {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      dashDateFrom.value = isoDate(start);
      dashDateTo.value = isoDate(end);
    }
  }
}

// ================= UTILS =================
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  return new Intl.DateTimeFormat(currentLang, { day: "2-digit", month: "2-digit", year: "numeric" }).format(dateObj);
}
function monthLabel(dateObj) {
  return dateObj.toLocaleDateString(currentLang, { month: "long", year: "numeric" });
}
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function showView(id) {
  viewIds.forEach(v => {
    const el = document.getElementById(v);
    if (!el) return;
    el.style.display = (v === id) ? "block" : "none";
  });
  navButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.target === id));
  if (id === "view-profile") { renderProfile(); }
  if (id === "view-list" && giornoSelezionato) caricaAllenamenti(giornoSelezionato);
}

async function getIsAdmin() {
  if (!currentUser) return false;
  const { data, error } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) { console.error("Errore lettura ruolo:", error); return false; }
  return data?.role === "admin";
}

async function enrichWithProfiles(rows) {
  const ids = Array.from(new Set((rows || []).map(r => r.user_id).filter(Boolean)));
  if (ids.length === 0) return rows || [];
  const { data: profs, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, avatar_url, trainer_color")
    .in("id", ids);
  if (error) { console.error("Errore lettura profiles:", error); return rows || []; }
  const map = new Map((profs || []).map(p => [p.id, p]));
  return (rows || []).map(r => ({
    ...r,
    _full_name: map.get(r.user_id)?.full_name || null,
    _avatar_url: map.get(r.user_id)?.avatar_url || null,
    _trainer_color: map.get(r.user_id)?.trainer_color || null
  }));
}

function clearEditingMode() {
  editingId = null;
  if (submitBtn) submitBtn.textContent = "➕ Aggiungi";
  refreshFormOptions();
  if (persone) persone.value = "";
}

// ================= AUTH UI =================
document.getElementById("loginBtn").onclick = async () => {
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });
  if (error) alert(error.message);
  else await checkSession();
};

document.getElementById("registerBtn").onclick = async () => {
  const full_name = fullNameInput ? (fullNameInput.value || "").trim() : "";
  const { error } = await supabaseClient.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value,
    options: { data: { full_name } }
  });
  if (error) alert(error.message);
  else alert("Registrazione completata!");
};

document.getElementById("logoutBtn").onclick = async () => {
  await supabaseClient.auth.signOut();
  currentUser = null; 
    initTrainerColors();
isAdmin = false; selectedUserId = "__all__";
  allenamentiMese = []; giornoSelezionato = null;
  clearEditingMode();
  listaDiv.innerHTML = ""; listaTitle.textContent = tr("list.workouts");
  if (userFilterSelect) userFilterSelect.value = "__all__";
  if (userFilterWrap) userFilterWrap.style.display = "none";
  authDiv.style.display = "block";
  appDiv.style.display = "none";
};

// ================= NAV =================
navButtons.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.target)));
dashGoCalendarBtn?.addEventListener("click", () => showView("view-calendar"));
dashGoListBtn?.addEventListener("click", () => showView("view-list"));


dashPeriod?.addEventListener("change", () => updateDashboard());
dashDateFrom?.addEventListener("change", () => updateDashboard());
dashDateTo?.addEventListener("change", () => updateDashboard());
compareAthlete1?.addEventListener("change", () => { selectedCompareUser1 = compareAthlete1.value; updateCompareDashboard(); });
compareAthlete2?.addEventListener("change", () => { selectedCompareUser2 = compareAthlete2.value; updateCompareDashboard(); });

// ================= DATA LOAD =================
async function populateUserFilter() {
  if (!userFilterSelect) return;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Errore caricamento utenti:", error);
    userFilterSelect.innerHTML = `<option value="__all__">Tutti</option>`;
    userFilterSelect.value = "__all__";
    selectedUserId = "__all__";
    return;
  }

  const opts = [];
  opts.push(`<option value="__all__">Tutte le atlete</option>`);
  if (currentUser?.id) opts.push(`<option value="${currentUser.id}">Le mie sessioni</option>`);
  (data || []).forEach(p => opts.push(`<option value="${p.id}">${p.full_name || "(senza nome)"}</option>`));
  userFilterSelect.innerHTML = opts.join("\n");
  userFilterSelect.value = "__all__";
  selectedUserId = "__all__";

  userFilterSelect.onchange = async () => {
    selectedUserId = userFilterSelect.value || "__all__";
    giornoSelezionato = null;
    listaDiv.innerHTML = "";
    listaTitle.textContent = tr("list.workouts");
    await caricaAllenamentiMese();
  };
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { authDiv.style.display = "block"; appDiv.style.display = "none"; return; }

  currentUser = session.user;

  try{ await ensureProfileRow(); }catch(e){ console.warn(e); }


      
  // aggiorna colori in base all\'utente loggato
  initTrainerColors();
  try{ await syncTrainerColorFromProfile(); }catch(e){ console.warn(e); }
  try{ mountColorPalette(); }catch(e){ console.warn(e); }
try{ await loadAvatarIntoUI(); }catch(e){ console.warn(e); }
isAdmin = await getIsAdmin();

  authDiv.style.display = "none";
  appDiv.style.display = "block";

  const display = currentUser.user_metadata?.full_name || currentUser.email || "";
  whoami.textContent = isAdmin ? `👑 ${display} (admin)` : `👤 ${display}`;

  if (userFilterSelect && userFilterWrap) {
    if (isAdmin) { userFilterWrap.style.display = "flex"; await populateUserFilter(); }
    else { userFilterWrap.style.display = "none"; }
  }

  await loadSharedCatalogs();
  refreshFormOptions();
  bindAdminCatalogActions();
  refreshAdminLists();
  await caricaAllenamentiMese();
  showView("view-dashboard");
}
checkSession();

// ================= INSERT / UPDATE =================
form.onsubmit = async (e) => {
  e.preventDefault();

  const { data: { session }, error: sessErr } = await supabaseClient.auth.getSession();
  if (sessErr || !session?.user?.id) {
    console.error(sessErr);
    alert("Sessione non valida. Rifai login.");
    return;
  }

  // campi minimi
  if (!dataInput.value || !ora_inizio.value || !tipo.value) {
    alert("Compila almeno Data, Ora e Tipo.");
    return;
  }

  // Se sei admin e vuoi inserire per altri, devi scegliere un utente specifico
  if (isAdmin && selectedUserId === "__all__") {
    alert("Se sei admin, seleziona prima un utente specifico (non 'Tutti') dal menu Visualizza.");
    return;
  }

  const payload = {
    user_id: (isAdmin && selectedUserId && selectedUserId !== "__all__") ? selectedUserId : session.user.id,
    tipo: tipo.value,
    data: dataInput.value,
    ora_inizio: ora_inizio.value,
    durata: durata.value || null,
    numero_partecipanti: numero_partecipanti.value || null,
    persone: [allenatore?.value || "", persone.value || ""].filter(Boolean).join(" | ") || null,
    note: note.value || null
  };

  // ✅ se sto modificando, faccio UPDATE (non delete+insert)
  if (editingId) {
    const { error } = await supabaseClient
      .from("allenamenti")
      .update(payload)
      .eq("id", editingId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    clearEditingMode();
    form.reset();
    await caricaAllenamentiMese();
    if (giornoSelezionato) await caricaAllenamenti(giornoSelezionato);
    alert("Allenamento aggiornato ✅");
    return;
  }

  // ✅ insert normale
  const { error } = await supabaseClient.from("allenamenti").insert([payload]);
  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  form.reset();
  await caricaAllenamentiMese();
  if (giornoSelezionato) await caricaAllenamenti(giornoSelezionato);
};

// ================= CALENDAR =================
async function caricaAllenamentiMese() {
  const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  let query = supabaseClient
    .from("allenamenti")
    .select("*")
    .gte("data", isoDate(start))
    .lte("data", isoDate(end));

  if (isAdmin && selectedUserId !== "__all__") query = query.eq("user_id", selectedUserId);

  const { data, error } = await query;
  if (error) { console.error(error); allenamentiMese = []; renderCalendar(); updateDashboard(); return; }

  allenamentiMese = await enrichWithProfiles(data || []);
  renderCalendar();
  updateDashboard();
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendarTitle");
  if (!grid || !title) return;

  grid.innerHTML = "";
  title.textContent = monthLabel(currentMonth);

  let firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  firstDay = firstDay === 0 ? 7 : firstDay;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  for (let i = 1; i < firstDay; i++) {
    grid.innerHTML += '<div class="calendar-empty" aria-hidden="true"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr =
      `${currentMonth.getFullYear()}-` +
      `${String(currentMonth.getMonth() + 1).padStart(2, "0")}-` +
      `${String(d).padStart(2, "0")}`;

    const dayRows = allenamentiMese.filter(a => a.data === dateStr);
    const hasWorkout = dayRows.length > 0;

    const namesText = dayRows
      .map(r => `${r._full_name || ""} ${r.persone || ""} ${r.note || ""}`)
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const hasSophie = /\bsophie\b/.test(namesText);
    const hasVivienne = /\bvivienne\b/.test(namesText);

    let colorClass = "";
    if (hasSophie && hasVivienne) colorClass = "workout-both";
    else if (hasSophie) colorClass = "workout-sophie";
    else if (hasVivienne) colorClass = "workout-vivienne";

    grid.innerHTML += `
      <button class="calendar-day ${hasWorkout ? "has-workout" : ""} ${colorClass}"
              type="button"
              onclick="selezionaGiorno('${dateStr}')">
        <span>${d}</span>
      </button>`;
  }
}

window.selezionaGiorno = function (data) {
  giornoSelezionato = data;
  listaTitle.textContent = tr("list.workoutsOf", { date: formatDate(data) });
  showView("view-list");
  caricaAllenamenti(data);
};

prevMonthBtn.onclick = () => { currentMonth.setMonth(currentMonth.getMonth() - 1); caricaAllenamentiMese(); };
nextMonthBtn.onclick = () => { currentMonth.setMonth(currentMonth.getMonth() + 1); caricaAllenamentiMese(); };



function changeDay(offset) {
  if (!giornoSelezionato) return;

  const d = new Date(giornoSelezionato);
  d.setDate(d.getDate() + offset);

  const newDate = d.toISOString().slice(0, 10);
  giornoSelezionato = newDate;

  const monthChanged =
    d.getMonth() !== currentMonth.getMonth() ||
    d.getFullYear() !== currentMonth.getFullYear();

  if (monthChanged) {
    currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
    caricaAllenamentiMese();
  }

  if (listaTitle) {
    try {
      listaTitle.textContent = tr("list.workoutsOf", { date: formatDate(newDate) });
    } catch (e) {
      listaTitle.textContent = tr("nav.list") + " - " + formatDate(newDate);
    }
  }

  caricaAllenamenti(newDate);
}

if (prevDayBtn) {
  prevDayBtn.addEventListener("click", () => changeDay(-1));
}
if (nextDayBtn) {
  nextDayBtn.addEventListener("click", () => changeDay(1));
}

// ================= LIST + EDIT/DELETE =================
async function caricaAllenamenti(data) {
  let query = supabaseClient
    .from("allenamenti")
    .select("*")
    .eq("data", data)
    .order("ora_inizio");

  if (isAdmin && selectedUserId !== "__all__") query = query.eq("user_id", selectedUserId);

  const { data: rows, error } = await query;
  if (error) { console.error(error); listaDiv.innerHTML = "<p>Errore caricamento</p>"; return; }

  const enriched = await enrichWithProfiles(rows || []);
  listaDiv.innerHTML = "";

  if (!enriched || enriched.length === 0) {
    listaDiv.innerHTML = "<p>Nessun allenamento</p>";
    return;
  }

  enriched.forEach(a => {
    const who = (a._full_name || "-");
    const canEdit = isAdmin || (currentUser && a.user_id === currentUser.id);
    const coachName = (a.persone || '-').split(' | ')[0] || '-';
    const details = (a.persone || '').split(' | ').slice(1).join(' | ') || '-';

    listaDiv.innerHTML += `
      <div class="table-row">
        <div class="athlete-head">
          ${avatarHtml(a._avatar_url, who)}
          <div class="athlete-meta">
            <div class="athlete-name">${who}</div>
            <div class="athlete-sub">Atleta</div>
          </div>
        </div>
        <div>📅 <strong>Data:</strong> ${formatDate(a.data)}</div>
        <div>⏰ <strong>Ora:</strong> ${a.ora_inizio}</div>
        <div>🏋️ <strong>Tipo:</strong> ${a.tipo}</div>
        <div>🤝 <strong>Allenatore:</strong> ${coachName}</div>
        <div>👥 <strong>Dettagli:</strong> ${details}</div>
        <div>👥 <strong>Partecipanti:</strong> ${a.numero_partecipanti || "-"}</div>
        <div>⏱ <strong>Durata:</strong> ${a.durata ? a.durata + " min" : "-"}</div>
        <div>📝 <strong>Note:</strong> ${a.note || "-"}</div>

        ${canEdit ? `
          <div class="actions">
            <button onclick="modificaAllenamento('${a.id}')">✏️ Modifica</button>
            <button onclick="eliminaAllenamento('${a.id}')" class="btn-secondary">🗑 Elimina</button>
          </div>
        ` : ""}
      </div>
    `;
  });
}

window.eliminaAllenamento = async function (id) {
  if (!confirm("Vuoi eliminare questo allenamento?")) return;

  const { error } = await supabaseClient
    .from("allenamenti")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  await caricaAllenamentiMese();
  if (giornoSelezionato) await caricaAllenamenti(giornoSelezionato);
};

window.modificaAllenamento = async function (id) {
  const { data, error } = await supabaseClient
    .from("allenamenti")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  // set edit mode
  editingId = id;

  // riempi form
  refreshFormOptions();
  tipo.value = data.tipo || "";
  dataInput.value = data.data || "";
  ora_inizio.value = data.ora_inizio || "";
  durata.value = data.durata || "";
  numero_partecipanti.value = data.numero_partecipanti || "";
  const parts = String(data.persone || "").split(" | ");
  if (allenatore) allenatore.value = parts[0] || "";
  persone.value = parts.slice(1).join(" | ") || "";
  note.value = data.note || "";

  // porta l'utente al form del calendario
  showView("view-calendar");
  form.scrollIntoView?.({ behavior: "smooth", block: "start" });

  if (submitBtn) submitBtn.textContent = "💾 Salva";
  alert("Modalità modifica: ora modifica i campi e poi premi SALVA ✅");
};

// ================= DASHBOARD =================
async function updateDashboard() {
  syncDashboardRangeUI();
  const { start, end, fromDate, toDate, mode } = getDashboardRange();
  if (dashPeriodLabel) {
    dashPeriodLabel.textContent = `${formatDate(isoDate(start))} → ${formatDate(isoDate(end))}${mode === 'custom' ? ' (personalizzato)' : ''}`;
  }
  let query = supabaseClient.from("allenamenti").select("durata, numero_partecipanti, data, user_id").gte("data", fromDate).lte("data", toDate);
  if (isAdmin && selectedUserId !== "__all__") query = query.eq("user_id", selectedUserId);
  if (!isAdmin && currentUser?.id) query = query.eq("user_id", currentUser.id);
  const { data: rows, error } = await query;
  const safeRows = error ? [] : (rows || []);
  const sessions = safeRows.length;
  const totalMinutes = safeRows.reduce((acc, r) => acc + safeNumber(r.durata), 0);
  const hours = totalMinutes / 60;
  const participantsSum = safeRows.reduce((acc, r) => acc + safeNumber(r.numero_partecipanti), 0);
  const avgParticipants = sessions > 0 ? (participantsSum / sessions) : 0;
  dashSessions.textContent = String(sessions);
  dashHours.textContent = sessions > 0 ? hours.toFixed(1) : "0.0";
  dashAvgParticipants.textContent = sessions > 0 ? avgParticipants.toFixed(1) : "0.0";
  const ps = document.getElementById("pStatSessions");
  const ph = document.getElementById("pStatHours");
  const pa = document.getElementById("pStatAvg");
  if (ps) ps.textContent = dashSessions.textContent;
  if (ph) ph.textContent = dashHours.textContent;
  if (pa) pa.textContent = dashAvgParticipants.textContent;
  await updateCompareDashboard();
}

// ================= EXPORT HELPERS =================
function getSelectedExportMode() {
  const checked = exportRangeRadios.find(r => r.checked);
  return checked?.value || "month";
}

function syncCustomDatesVisibility() {
  const mode = getSelectedExportMode();
  if (customDatesWrap) customDatesWrap.style.display = (mode === "custom") ? "block" : "none";
  if (monthPickerWrap) monthPickerWrap.style.display = (mode === "month") ? "block" : "none";
}

function ensureDefaultCustomDates() {
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  if (exportMonthInput && !exportMonthInput.value) {
    exportMonthInput.value = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
  }

  if (dateFromInput && dateToInput) {
    if (!dateFromInput.value) dateFromInput.value = isoDate(monthStart);
    if (!dateToInput.value) dateToInput.value = isoDate(monthEnd);
  }
}

function openExportOptions(intent) {
  if (!exportOptions) return false;
  lastExportIntent = intent || null;
  ensureDefaultCustomDates();
  syncCustomDatesVisibility();
  exportOptions.style.display = "block";
  exportOptions.scrollIntoView?.({ behavior: "smooth", block: "start" });
  return true;
}

function closeExportOptions() {
  if (!exportOptions) return;
  exportOptions.style.display = "none";
}

function getExportRange() {
  // se ho cliccato un giorno, esporta quel giorno
  if (giornoSelezionato) return { fromDate: giornoSelezionato, toDate: giornoSelezionato };

  const mode = getSelectedExportMode();

  if (mode === "month") {
    let y = currentMonth.getFullYear();
    let m = currentMonth.getMonth(); // 0-based

    if (exportMonthInput?.value) {
      const [yy, mm] = exportMonthInput.value.split("-").map(Number);
      if (yy && mm) { y = yy; m = mm - 1; }
    }

    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    return { fromDate: isoDate(monthStart), toDate: isoDate(monthEnd) };
  }

  if (mode === "custom" && dateFromInput?.value && dateToInput?.value) {
    return { fromDate: dateFromInput.value, toDate: dateToInput.value };
  }

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  return { fromDate: isoDate(monthStart), toDate: isoDate(monthEnd) };
}

async function fetchExportRows() {
  const { fromDate, toDate } = getExportRange();

  let query = supabaseClient
    .from("allenamenti")
    .select("*")
    .gte("data", fromDate)
    .lte("data", toDate)
    .order("data", { ascending: true })
    .order("ora_inizio", { ascending: true });

  if (isAdmin && selectedUserId !== "__all__") query = query.eq("user_id", selectedUserId);

  const { data, error } = await query;
  if (error) throw error;
  return { rows: await enrichWithProfiles(data || []), fromDate, toDate };
}

// Export options interactions
exportRangeRadios.forEach(r => r.addEventListener("change", () => {
  syncCustomDatesVisibility();
  ensureDefaultCustomDates();
}));

applyExportBtn?.addEventListener("click", async () => {
  try {
    if (!giornoSelezionato && getSelectedExportMode() === "custom") {
      const from = dateFromInput?.value;
      const to = dateToInput?.value;
      if (!from || !to) return alert("Seleziona 'Dal' e 'Al'.");
      if (from > to) return alert("La data 'Dal' non può essere dopo 'Al'.");
    }

    closeExportOptions();

    if (lastExportIntent === "excel") await doExportExcel();
    if (lastExportIntent === "pdf") await doExportPdf();
    lastExportIntent = null;
  } catch (e) {
    console.error(e);
    alert("Errore applicazione periodo export");
  }
});

// ================= EXPORT EXCEL =================
async function doExportExcel() {
  try {
    if (typeof XLSX === "undefined") return alert("Libreria XLSX non caricata.");
    const { rows, fromDate, toDate } = await fetchExportRows();
    if (!rows || rows.length === 0) return alert("Nessun dato da esportare");

    const formatted = rows.map((a) => ({
      Data: a.data ? formatDate(a.data) : "",
      Ora: a.ora_inizio || "",
      Tipo: a.tipo || "",
      Durata_min: a.durata ?? "",
      Partecipanti: a.numero_partecipanti ?? "",
      Trainer: a.persone ?? "",
      Inserito_da: isAdmin ? (a._full_name || "-") : "",
      Note: a.note ?? "",
      ID: a.id ?? ""
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);

    const headers = Object.keys(formatted[0] || {});
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(h.length, ...formatted.map((r) => String(r[h] ?? "").length));
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, giornoSelezionato ? "Giorno" : "Periodo");

    const safeFrom = fromDate.replaceAll("-", "");
    const safeTo = toDate.replaceAll("-", "");
    const fileName = giornoSelezionato ? `allenamenti_${safeFrom}.xlsx` : `allenamenti_${safeFrom}_${safeTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (e) {
    console.error(e);
    alert("Errore export Excel");
  }
}

exportExcelBtn?.addEventListener("click", async () => {
  try {
    const isHidden = exportOptions ? (getComputedStyle(exportOptions).display === "none") : true;
    if (!giornoSelezionato && exportOptions && isHidden) {
      openExportOptions("excel");
      return;
    }
    await doExportExcel();
  } catch (e) {
    console.error(e);
    alert("Errore export Excel");
  }
});

// ================= EXPORT PDF =================
async function doExportPdf() {
  try {
    const { rows, fromDate, toDate } = await fetchExportRows();
    if (!rows || rows.length === 0) return alert("Nessun dato da esportare");

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
  orientation: "landscape",
  unit: "pt",
  format: "a4"
});

    const title = giornoSelezionato
      ? `Report Allenamenti (${fromDate})`
      : `Report Allenamenti (${monthLabel(currentMonth)})`;
    const subtitle = `Periodo: ${fromDate} → ${toDate}`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, 40, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(subtitle, 40, 70);

    const headers = ["Data", "Ora", "Tipo", "Durata", "Partecipanti", "Trainer", ...(isAdmin ? ["Inserito da"] : [])];
    const colWidths = isAdmin ? [70, 50, 140, 60, 80, 110, 90] : [70, 50, 160, 60, 80, 120];

    let y = 95;
    let x = 40;

    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
    doc.setDrawColor(200);
    doc.line(40, y + 6, 555, y + 6);

    y += 24;
    doc.setFont("helvetica", "normal");

    const pageBottom = 800;

    rows.forEach((a) => {
      const row = [
        a.data ? formatDate(a.data) : "",
        a.ora_inizio || "",
        a.tipo || "",
        a.durata ? `${a.durata}m` : "-",
        a.numero_partecipanti ?? "-",
        a.persone || "-",
        ...(isAdmin ? [a._full_name || "-"] : [])
      ];

      if (y > pageBottom) { doc.addPage(); y = 60; }

      let xx = 40;
      row.forEach((val, i) => {
        const text = String(val ?? "");
        const maxChars = Math.floor((colWidths[i] || 80) / 6);
        const clipped = text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
        doc.text(clipped, xx, y);
        xx += colWidths[i];
      });
      y += 18;
    });

    const safeFrom = fromDate.replaceAll("-", "");
    const safeTo = toDate.replaceAll("-", "");
    const filename = giornoSelezionato ? `allenamenti_${safeFrom}.pdf` : `allenamenti_${safeFrom}_${safeTo}.pdf`;
    doc.save(filename);
  } catch (e) {
    console.error(e);
    alert("Errore export PDF");
  }
}

exportPdfBtn?.addEventListener("click", async () => {
  try {
    const isHidden = exportOptions ? (getComputedStyle(exportOptions).display === "none") : true;
    if (!giornoSelezionato && exportOptions && isHidden) {
      openExportOptions("pdf");
      return;
    }
    await doExportPdf();
  } catch (e) {
    console.error(e);
    alert("Errore export PDF");
  }
});

/* ================= I18N ================= */
const SUPPORTED_LANGS = ["it", "de", "en", "sk"];
const FALLBACK_LANG = "en";

const I18N = {
  it: {
    "app.title": "Allenamenti",
    "app.brand": "Allenamenti",
    "auth.title": "Login / Registrazione",
    "auth.fullNamePh": "Nome completo (solo registrazione)",
    "auth.emailPh": "Email",
    "auth.passwordPh": "Password",
    "auth.loginBtn": "Login",
    "auth.registerBtn": "Registrati",
    "auth.logoutBtn": "Logout",
    "admin.viewAs": "Visualizza:",
    "admin.activeAthlete": "Atleta attiva",
    "admin.all": "Tutti",
    "admin.allFemale": "Tutte",
    "admin.title": "Admin",
    "admin.description": "Gestisci allenatori e tipi di allenamento disponibili nei menu a tendina.",
    "admin.coaches": "Allenatori",
    "admin.trainingTypes": "Tipi allenamento",
    "admin.newCoachPh": "Nuovo allenatore",
    "admin.newTrainingTypePh": "Nuovo tipo allenamento",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendario",
    "nav.list": "Lista",
    "nav.profile": "Profilo",
    "dash.sessionsMonth": "Sessioni mese",
    "dash.totalHours": "Ore totali",
    "dash.avgParticipants": "Partecipanti medi",
    "dash.period": "Periodo",
    "dash.thisMonth": "Questo mese",
    "dash.lastMonth": "Mese scorso",
    "dash.thisYear": "Quest'anno",
    "dash.all": "Tutto",
    "dash.customRange": "Intervallo personalizzato",
    "dash.goCalendar": "Vai al calendario",
    "dash.goList": "Vai alla lista",
    "cal.hint": "Tocca un giorno per visualizzare gli allenamenti.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Entrambe",
    "list.newWorkout": "Nuovo allenamento",
    "list.selectDay": "Seleziona un giorno dal calendario per vedere la lista.",
    "list.workouts": "Allenamenti",
    "list.workoutsOf": "Allenamenti del {date}",
    "form.addWorkout": "Aggiungi allenamento",
    "form.type": "Tipo allenamento",
    "form.coach": "Allenatore",
    "form.typePh": "Tipo allenamento",
    "form.date": "Data",
    "form.startTime": "Ora inizio",
    "form.time": "Ora",
    "form.duration": "Durata (minuti)",
    "form.durationPh": "Durata (min)",
    "form.participants": "Numero partecipanti",
    "form.participantsPh": "Partecipanti",
    "form.people": "Persone / dettagli aggiuntivi",
    "form.withWhomPh": "Trainer / Con chi",
    "form.notes": "Note",
    "form.notesPh": "Note",
    "form.durationExample": "Es. 60",
    "form.participantsExample": "Es. 10",
    "form.peopleExample": "Es. gruppo, assistenti, note rapide",
    "form.save": "Salva",
    "form.addBtn": "➕ Aggiungi",
    "export.sectionTitle": "Export",
    "export.excel": "📊 Esporta Excel",
    "export.pdf": "📄 Esporta PDF",
    "export.title": "Esporta:",
    "export.options": "Opzioni export",
    "export.month": "Mese",
    "export.monthLabel": "Mese:",
    "export.custom": "Intervallo date",
    "export.selectMonth": "Seleziona mese",
    "export.from": "Dal:",
    "export.to": "Al:",
    "export.apply": "Applica",
    "weekday.mon": "L",
    "weekday.tue": "M",
    "weekday.wed": "M",
    "weekday.thu": "G",
    "weekday.fri": "V",
    "weekday.sat": "S",
    "weekday.sun": "D",
    "alerts.workoutUpdated": "Allenamento aggiornato ✅",
    "compare.title": "Confronto atlete",
    "compare.athlete1": "Atleta 1",
    "compare.athlete2": "Atleta 2",
    "compare.athlete": "Atleta",
    "compare.selectTwo": "Seleziona due atlete per vedere il confronto.",
    "compare.error": "Errore nel confronto.",
    "compare.coachShare": "Percentuale allenatore",
    "compare.noCoachData": "Nessun allenatore assegnato",
    "stats.title": "Statistiche",
    "stats.sessions": "Sessioni",
    "stats.totalHours": "Ore totali",
    "stats.avgParticipants": "Media partecipanti",
    "stats.hours": "Ore",
    "stats.avg": "Media",
    "weekday.long.mon": "Lun",
    "weekday.long.tue": "Mar",
    "weekday.long.wed": "Mer",
    "weekday.long.thu": "Gio",
    "weekday.long.fri": "Ven",
    "weekday.long.sat": "Sab",
    "weekday.long.sun": "Dom",
    "profile.changeAvatar": "Cambia avatar",
    "profile.updateAvatar": "Aggiorna avatar",
    "profile.color": "Colore calendario",
    "profile.colorHint": "Ogni atleta può scegliere il proprio colore per il calendario. Il colore viene salvato automaticamente.",
    "profile.customColor": "Colore personalizzato",
    "profile.selectColor": "Seleziona colore {color}",
    "calendar.legend.personal": "Colori personali salvati",
    "calendar.legend.mixed": "Più utenti nello stesso giorno",
    "roles.admin": "admin",
    "roles.user": "utente",
    "common.add": "Aggiungi",
    "common.saveChanges": "Salva modifiche"
  },
  en: {
    "app.title": "Workouts",
    "app.brand": "Workouts",
    "auth.title": "Login / Register",
    "auth.fullNamePh": "Full name (register only)",
    "auth.emailPh": "Email",
    "auth.passwordPh": "Password",
    "auth.loginBtn": "Login",
    "auth.registerBtn": "Register",
    "auth.logoutBtn": "Logout",
    "admin.viewAs": "View:",
    "admin.activeAthlete": "Active athlete",
    "admin.all": "All",
    "admin.allFemale": "All",
    "admin.title": "Admin",
    "admin.description": "Manage coaches and workout types available in the dropdown menus.",
    "admin.coaches": "Coaches",
    "admin.trainingTypes": "Workout types",
    "admin.newCoachPh": "New coach",
    "admin.newTrainingTypePh": "New workout type",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendar",
    "nav.list": "List",
    "nav.profile": "Profile",
    "dash.sessionsMonth": "Sessions this month",
    "dash.totalHours": "Total hours",
    "dash.avgParticipants": "Average participants",
    "dash.period": "Period",
    "dash.thisMonth": "This month",
    "dash.lastMonth": "Last month",
    "dash.thisYear": "This year",
    "dash.all": "All",
    "dash.customRange": "Custom range",
    "dash.goCalendar": "Go to calendar",
    "dash.goList": "Go to list",
    "cal.hint": "Tap a day to view workouts.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Both",
    "list.newWorkout": "New workout",
    "list.selectDay": "Select a day from the calendar to view the list.",
    "list.workouts": "Workouts",
    "list.workoutsOf": "Workouts on {date}",
    "form.addWorkout": "Add workout",
    "form.type": "Workout type",
    "form.coach": "Coach",
    "form.typePh": "Workout type",
    "form.date": "Date",
    "form.startTime": "Start time",
    "form.time": "Time",
    "form.duration": "Duration (minutes)",
    "form.durationPh": "Duration (min)",
    "form.participants": "Number of participants",
    "form.participantsPh": "Participants",
    "form.people": "People / extra details",
    "form.withWhomPh": "Trainer / With whom",
    "form.notes": "Notes",
    "form.notesPh": "Notes",
    "form.durationExample": "E.g. 60",
    "form.participantsExample": "E.g. 10",
    "form.peopleExample": "E.g. group, assistants, quick notes",
    "form.save": "Save",
    "form.addBtn": "➕ Add",
    "export.sectionTitle": "Export",
    "export.excel": "📊 Export Excel",
    "export.pdf": "📄 Export PDF",
    "export.title": "Export:",
    "export.options": "Export options",
    "export.month": "Month",
    "export.monthLabel": "Month:",
    "export.custom": "Date range",
    "export.selectMonth": "Select month",
    "export.from": "From:",
    "export.to": "To:",
    "export.apply": "Apply",
    "weekday.mon": "M",
    "weekday.tue": "T",
    "weekday.wed": "W",
    "weekday.thu": "T",
    "weekday.fri": "F",
    "weekday.sat": "S",
    "weekday.sun": "S",
    "alerts.workoutUpdated": "Workout updated ✅",
    "compare.title": "Athlete comparison",
    "compare.athlete1": "Athlete 1",
    "compare.athlete2": "Athlete 2",
    "compare.athlete": "Athlete",
    "compare.selectTwo": "Select two athletes to view the comparison.",
    "compare.error": "Comparison error.",
    "compare.coachShare": "Coach percentage",
    "compare.noCoachData": "No coach assigned",
    "stats.title": "Statistics",
    "stats.sessions": "Sessions",
    "stats.totalHours": "Total hours",
    "stats.avgParticipants": "Average participants",
    "stats.hours": "Hours",
    "stats.avg": "Average",
    "weekday.long.mon": "Mon",
    "weekday.long.tue": "Tue",
    "weekday.long.wed": "Wed",
    "weekday.long.thu": "Thu",
    "weekday.long.fri": "Fri",
    "weekday.long.sat": "Sat",
    "weekday.long.sun": "Sun",
    "profile.changeAvatar": "Change avatar",
    "profile.updateAvatar": "Update avatar",
    "profile.color": "Calendar color",
    "profile.colorHint": "Each athlete can choose a personal calendar color. The choice is saved automatically.",
    "profile.customColor": "Custom color",
    "profile.selectColor": "Select color {color}",
    "calendar.legend.personal": "Saved personal colors",
    "calendar.legend.mixed": "Multiple users on the same day",
    "roles.admin": "admin",
    "roles.user": "user",
    "common.add": "Add",
    "common.saveChanges": "Save changes"
  },
  de: {
    "app.title": "Training",
    "app.brand": "Training",
    "auth.title": "Login / Registrierung",
    "auth.fullNamePh": "Vollständiger Name (nur Registrierung)",
    "auth.emailPh": "E-Mail",
    "auth.passwordPh": "Passwort",
    "auth.loginBtn": "Login",
    "auth.registerBtn": "Registrieren",
    "auth.logoutBtn": "Abmelden",
    "admin.viewAs": "Anzeigen:",
    "admin.activeAthlete": "Aktive Athletin",
    "admin.all": "Alle",
    "admin.allFemale": "Alle",
    "admin.title": "Admin",
    "admin.description": "Verwalte Trainer und Trainingsarten in den Dropdown-Menüs.",
    "admin.coaches": "Trainer",
    "admin.trainingTypes": "Trainingsarten",
    "admin.newCoachPh": "Neuer Trainer",
    "admin.newTrainingTypePh": "Neue Trainingsart",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Kalender",
    "nav.list": "Liste",
    "nav.profile": "Profil",
    "dash.sessionsMonth": "Sitzungen im Monat",
    "dash.totalHours": "Gesamtstunden",
    "dash.avgParticipants": "Ø Teilnehmer",
    "dash.period": "Zeitraum",
    "dash.thisMonth": "Dieser Monat",
    "dash.lastMonth": "Letzter Monat",
    "dash.thisYear": "Dieses Jahr",
    "dash.all": "Alles",
    "dash.customRange": "Benutzerdefinierter Zeitraum",
    "dash.goCalendar": "Zum Kalender",
    "dash.goList": "Zur Liste",
    "cal.hint": "Tippe auf einen Tag, um Trainings zu sehen.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Beide",
    "list.newWorkout": "Neues Training",
    "list.selectDay": "Wähle einen Tag im Kalender, um die Liste zu sehen.",
    "list.workouts": "Trainings",
    "list.workoutsOf": "Trainings am {date}",
    "form.addWorkout": "Training hinzufügen",
    "form.type": "Trainingsart",
    "form.coach": "Trainer",
    "form.typePh": "Trainingstyp",
    "form.date": "Datum",
    "form.startTime": "Startzeit",
    "form.time": "Uhrzeit",
    "form.duration": "Dauer (Minuten)",
    "form.durationPh": "Dauer (Min)",
    "form.participants": "Anzahl Teilnehmer",
    "form.participantsPh": "Teilnehmer",
    "form.people": "Personen / zusätzliche Details",
    "form.withWhomPh": "Trainer / Mit wem",
    "form.notes": "Notizen",
    "form.notesPh": "Notizen",
    "form.durationExample": "Z. B. 60",
    "form.participantsExample": "Z. B. 10",
    "form.peopleExample": "Z. B. Gruppe, Assistenten, kurze Notizen",
    "form.save": "Speichern",
    "form.addBtn": "➕ Hinzufügen",
    "export.sectionTitle": "Export",
    "export.excel": "📊 Excel exportieren",
    "export.pdf": "📄 PDF exportieren",
    "export.title": "Export:",
    "export.options": "Exportoptionen",
    "export.month": "Monat",
    "export.monthLabel": "Monat:",
    "export.custom": "Datumsbereich",
    "export.selectMonth": "Monat wählen",
    "export.from": "Von:",
    "export.to": "Bis:",
    "export.apply": "Anwenden",
    "weekday.mon": "M",
    "weekday.tue": "D",
    "weekday.wed": "M",
    "weekday.thu": "D",
    "weekday.fri": "F",
    "weekday.sat": "S",
    "weekday.sun": "S",
    "alerts.workoutUpdated": "Training aktualisiert ✅",
    "compare.title": "Athletinnenvergleich",
    "compare.athlete1": "Athletin 1",
    "compare.athlete2": "Athletin 2",
    "compare.athlete": "Athletin",
    "compare.selectTwo": "Wähle zwei Athletinnen für den Vergleich.",
    "compare.error": "Fehler beim Vergleich.",
    "compare.coachShare": "Traineranteil",
    "compare.noCoachData": "Kein Trainer zugewiesen",
    "stats.title": "Statistiken",
    "stats.sessions": "Einheiten",
    "stats.totalHours": "Gesamtstunden",
    "stats.avgParticipants": "Ø Teilnehmer",
    "stats.hours": "Stunden",
    "stats.avg": "Durchschnitt",
    "weekday.long.mon": "Mo",
    "weekday.long.tue": "Di",
    "weekday.long.wed": "Mi",
    "weekday.long.thu": "Do",
    "weekday.long.fri": "Fr",
    "weekday.long.sat": "Sa",
    "weekday.long.sun": "So",
    "profile.changeAvatar": "Avatar ändern",
    "profile.updateAvatar": "Avatar aktualisieren",
    "profile.color": "Kalenderfarbe",
    "profile.colorHint": "Jede Athletin kann eine eigene Kalenderfarbe wählen. Die Auswahl wird automatisch gespeichert.",
    "profile.customColor": "Benutzerdefinierte Farbe",
    "profile.selectColor": "Farbe {color} auswählen",
    "calendar.legend.personal": "Gespeicherte persönliche Farben",
    "calendar.legend.mixed": "Mehrere Nutzer am selben Tag",
    "roles.admin": "Admin",
    "roles.user": "Nutzer",
    "common.add": "Hinzufügen",
    "common.saveChanges": "Änderungen speichern"
  },
  sk: {
    "app.title": "Tréningy",
    "app.brand": "Tréningy",
    "auth.title": "Prihlásenie / Registrácia",
    "auth.fullNamePh": "Celé meno (len registrácia)",
    "auth.emailPh": "Email",
    "auth.passwordPh": "Heslo",
    "auth.loginBtn": "Prihlásiť sa",
    "auth.registerBtn": "Registrovať sa",
    "auth.logoutBtn": "Odhlásiť sa",
    "admin.viewAs": "Zobraziť:",
    "admin.activeAthlete": "Aktívna atlétka",
    "admin.all": "Všetci",
    "admin.allFemale": "Všetky",
    "admin.title": "Admin",
    "admin.description": "Spravuj trénerov a typy tréningov dostupné v rozbaľovacích menu.",
    "admin.coaches": "Tréneri",
    "admin.trainingTypes": "Typy tréningu",
    "admin.newCoachPh": "Nový tréner",
    "admin.newTrainingTypePh": "Nový typ tréningu",
    "nav.home": "Domov",
    "nav.dashboard": "Prehľad",
    "nav.calendar": "Kalendár",
    "nav.list": "Zoznam",
    "nav.profile": "Profil",
    "dash.sessionsMonth": "Tréningy tento mesiac",
    "dash.totalHours": "Celkové hodiny",
    "dash.avgParticipants": "Priemer účastníkov",
    "dash.period": "Obdobie",
    "dash.thisMonth": "Tento mesiac",
    "dash.lastMonth": "Minulý mesiac",
    "dash.thisYear": "Tento rok",
    "dash.all": "Všetko",
    "dash.customRange": "Vlastný rozsah",
    "dash.goCalendar": "Do kalendára",
    "dash.goList": "Do zoznamu",
    "cal.hint": "Ťukni na deň pre zobrazenie tréningov.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Obe",
    "list.newWorkout": "Nový tréning",
    "list.selectDay": "Vyber deň z kalendára pre zobrazenie zoznamu.",
    "list.workouts": "Tréningy",
    "list.workoutsOf": "Tréningy dňa {date}",
    "form.addWorkout": "Pridať tréning",
    "form.type": "Typ tréningu",
    "form.coach": "Tréner",
    "form.typePh": "Typ tréningu",
    "form.date": "Dátum",
    "form.startTime": "Čas začiatku",
    "form.time": "Čas",
    "form.duration": "Trvanie (minúty)",
    "form.durationPh": "Trvanie (min)",
    "form.participants": "Počet účastníkov",
    "form.participantsPh": "Účastníci",
    "form.people": "Ľudia / ďalšie detaily",
    "form.withWhomPh": "Tréner / S kým",
    "form.notes": "Poznámky",
    "form.notesPh": "Poznámky",
    "form.durationExample": "Napr. 60",
    "form.participantsExample": "Napr. 10",
    "form.peopleExample": "Napr. skupina, asistenti, krátke poznámky",
    "form.save": "Uložiť",
    "form.addBtn": "➕ Pridať",
    "export.sectionTitle": "Export",
    "export.excel": "📊 Exportovať Excel",
    "export.pdf": "📄 Exportovať PDF",
    "export.title": "Export:",
    "export.options": "Možnosti exportu",
    "export.month": "Mesiac",
    "export.monthLabel": "Mesiac:",
    "export.custom": "Rozsah dátumov",
    "export.selectMonth": "Vybrať mesiac",
    "export.from": "Od:",
    "export.to": "Do:",
    "export.apply": "Použiť",
    "weekday.mon": "P",
    "weekday.tue": "U",
    "weekday.wed": "S",
    "weekday.thu": "Š",
    "weekday.fri": "P",
    "weekday.sat": "S",
    "weekday.sun": "N",
    "alerts.workoutUpdated": "Tréning aktualizovaný ✅",
    "compare.title": "Porovnanie atlétok",
    "compare.athlete1": "Atlétka 1",
    "compare.athlete2": "Atlétka 2",
    "compare.athlete": "Atlétka",
    "compare.selectTwo": "Vyber dve atlétky pre porovnanie.",
    "compare.error": "Chyba pri porovnaní.",
    "compare.coachShare": "Percento trénera",
    "compare.noCoachData": "Nie je priradený tréner",
    "stats.title": "Štatistiky",
    "stats.sessions": "Tréningy",
    "stats.totalHours": "Celkové hodiny",
    "stats.avgParticipants": "Priemer účastníkov",
    "stats.hours": "Hodiny",
    "stats.avg": "Priemer",
    "weekday.long.mon": "Po",
    "weekday.long.tue": "Ut",
    "weekday.long.wed": "St",
    "weekday.long.thu": "Št",
    "weekday.long.fri": "Pi",
    "weekday.long.sat": "So",
    "weekday.long.sun": "Ne",
    "profile.changeAvatar": "Zmeniť avatar",
    "profile.updateAvatar": "Aktualizovať avatar",
    "profile.color": "Farba kalendára",
    "profile.colorHint": "Každá atlétka si môže zvoliť vlastnú farbu kalendára. Voľba sa uloží automaticky.",
    "profile.customColor": "Vlastná farba",
    "profile.selectColor": "Vybrať farbu {color}",
    "calendar.legend.personal": "Uložené osobné farby",
    "calendar.legend.mixed": "Viac používateľov v ten istý deň",
    "roles.admin": "admin",
    "roles.user": "používateľ",
    "common.add": "Pridať",
    "common.saveChanges": "Uložiť zmeny"
  }
};

function detectLanguage() {
  const langs = navigator.languages || [navigator.language];
  for (let l of langs) {
    l = (l || "").toLowerCase();
    const base = l.split("-")[0];
    if (SUPPORTED_LANGS.includes(l)) return l;
    if (SUPPORTED_LANGS.includes(base)) return base;
  }
  return FALLBACK_LANG;
}

let currentLang = detectLanguage();
function tr(key, vars = {}) {
  const dict = I18N[currentLang] || I18N[FALLBACK_LANG];
  let s = dict[key] || (I18N[FALLBACK_LANG] && I18N[FALLBACK_LANG][key]) || key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = tr(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.setAttribute("placeholder", tr(key));
  });

  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) document.title = tr(titleEl.getAttribute("data-i18n"));

  if (submitBtn) submitBtn.textContent = editingId ? tr("common.saveChanges") : tr("form.save");
  if (listaTitle && !giornoSelezionato) listaTitle.textContent = tr("nav.list");
  if (whoami && currentUser) {
    const display = currentUser.user_metadata?.full_name || currentUser.email || "";
    whoami.textContent = isAdmin ? `👑 ${display} (${tr("roles.admin")})` : `👤 ${display}`;
  }
}

function refreshLanguageFromDevice() {
  const detected = detectLanguage();
  if (detected === currentLang) return;
  currentLang = detected;
  applyTranslations();
  try {
    const calendarTitleEl = document.getElementById("calendarTitle");
    if (calendarTitleEl) calendarTitleEl.textContent = monthLabel(currentMonth);
    if (giornoSelezionato) listaTitle.textContent = tr("list.workoutsOf", { date: formatDate(giornoSelezionato) });
    renderCalendar();
    updateDashboard();
    if (document.getElementById("view-profile")?.style.display !== "none") renderProfile();
  } catch (e) {
    console.warn("language refresh error", e);
  }
}

// translate known alerts without rewriting the whole file
const __nativeAlert = window.alert.bind(window);
window.alert = (msg) => {
  if (msg === "Allenamento aggiornato ✅") return __nativeAlert(tr("alerts.workoutUpdated"));
  return __nativeAlert(msg);
};

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  refreshLanguageFromDevice();
});
window.addEventListener("languagechange", refreshLanguageFromDevice);



async function renderProfile(){
  // Fill basic user info
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const roleEl = document.getElementById("profileRole");
  if (nameEl) nameEl.textContent = currentUser?.user_metadata?.full_name || currentUser?.email || "Utente";
  if (emailEl) emailEl.textContent = currentUser?.email || "—";

  try {
    const isAdmin = await getIsAdmin();
    if (roleEl) roleEl.textContent = isAdmin ? tr("roles.admin") : tr("roles.user");
    const adminPanel = document.getElementById("adminPanel");
    if (adminPanel) adminPanel.style.display = isAdmin ? "block" : "none";
    if (isAdmin) { await loadSharedCatalogs(); refreshAdminLists(); refreshFormOptions(); }
  } catch(_) {
    if (roleEl) roleEl.textContent = tr("roles.user");
  }

  // Stats: mirror dashboard
  const ps = document.getElementById("pStatSessions");
  const ph = document.getElementById("pStatHours");
  const pa = document.getElementById("pStatAvg");
  if (ps) ps.textContent = document.getElementById("dashSessions")?.textContent || "—";
  if (ph) ph.textContent = document.getElementById("dashHours")?.textContent || "—";
  if (pa) pa.textContent = document.getElementById("dashAvgParticipants")?.textContent || "—";

  mountColorPalette();
  bindAvatarUpload();
  await ensureProfileRow();
  await loadAvatarIntoUI();

  // secondary logout
  const lb2 = document.getElementById("logoutBtn2");
  if (lb2) lb2.onclick = () => document.getElementById("logoutBtn")?.click();
}
