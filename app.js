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
const PROFILE_COLORS = ["#1d4ed8", "#2563eb", "#0ea5e9", "#06b6d4", "#14b8a6", "#16a34a", "#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#e11d48", "#db2777", "#a855f7", "#7c3aed", "#6366f1", "#334155", "#475569", "#0f172a", "#9ca3af"];

// init colori trainer (prima del login)

const LAST_TRAINER_KEY = "last_trainer_slug";

// ================= TRAINER COLORS (Option 1) =================

const DEFAULT_SOPHIE = "#2563eb";
const DEFAULT_VIVIENNE = "#16a34a";
// Ogni utente imposta SOLO il proprio colore (Sophie o Vivienne).
// I colori sono salvati sul dispositivo (localStorage).


function getTrainerSlug(){
  // 1) se siamo loggati, deduciamo dal nome/email
  const s = String(currentUser?.user_metadata?.full_name || currentUser?.email || "").toLowerCase();
  if (s.includes("vivienne")) { localStorage.setItem(LAST_TRAINER_KEY, "vivienne"); return "vivienne"; }
  if (s.includes("sophie")) { localStorage.setItem(LAST_TRAINER_KEY, "sophie"); return "sophie"; }

  // 2) se non siamo loggati, manteniamo l'ultimo trainer usato
  const last = localStorage.getItem(LAST_TRAINER_KEY);
  if (last === "vivienne" || last === "sophie") return last;

  // 3) fallback
  return "sophie";
}

function initTrainerColors(){
  const sophie = localStorage.getItem("sophie_color") || DEFAULT_SOPHIE;
  const vivi = localStorage.getItem("vivienne_color") || DEFAULT_VIVIENNE;

  document.documentElement.style.setProperty("--sophieColor", sophie);
  document.documentElement.style.setProperty("--vivienneColor", vivi);

  // accent = colore dell'utente loggato (se già loggato), altrimenti Sophie
  const slug = getTrainerSlug();
  const myColor = (slug === "vivienne") ? vivi : sophie;
  document.documentElement.style.setProperty("--accent", myColor);
}

function setMyTrainerColor(col, opts = {}){
  const slug = getTrainerSlug();
  if (slug === "vivienne") {
    localStorage.setItem("vivienne_color", col);
    document.documentElement.style.setProperty("--vivienneColor", col);
  } else {
    localStorage.setItem("sophie_color", col);
    document.documentElement.style.setProperty("--sophieColor", col);
  }
  document.documentElement.style.setProperty("--accent", col);

  // Sync su Supabase (se loggati) salvo diversa indicazione
  if (opts.persistRemote !== false && currentUser){
    Promise.resolve(saveTrainerColor(col)).catch((e)=>console.warn("trainer_color update error", e));
  }
}

function mountColorPalette(){
  const wrap = document.getElementById("colorPalette");
  if (!wrap) return;

  const slug = getTrainerSlug();
  const saved = (slug === "vivienne")
    ? (localStorage.getItem("vivienne_color") || DEFAULT_VIVIENNE)
    : (localStorage.getItem("sophie_color") || DEFAULT_SOPHIE);

  wrap.innerHTML = "";
  PROFILE_COLORS.forEach((col) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dotpick";
    btn.dataset.color = col;
    btn.style.setProperty("--c", col);
    btn.setAttribute("aria-label", "Colore " + col);
    if (col === saved) btn.classList.add("active");

    btn.onclick = () => {
      setMyTrainerColor(col);
      wrap.querySelectorAll(".dotpick").forEach(b => b.classList.toggle("active", b.dataset.color === col));
      // ricalcola gradiente "both" (solo CSS vars, quindi basta)
    };

    wrap.appendChild(btn);
  });
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
  const { error } = await supabaseClient
    .from("profiles")
    .update({ trainer_color: col })
    .eq("id", currentUser.id);
  if (error) console.warn("trainer_color update error", error);
}

async function syncTrainerColorFromProfile(){
  if (!currentUser) return;

  const slug = getTrainerSlug();
  const local = (slug === "vivienne")
    ? (localStorage.getItem("vivienne_color") || DEFAULT_VIVIENNE)
    : (localStorage.getItem("sophie_color") || DEFAULT_SOPHIE);

  const remote = await fetchTrainerColor();

  if (remote) {
    // Applica il colore remoto senza riscriverlo subito (evita update inutile)
    setMyTrainerColor(remote, { persistRemote: false });
  } else if (local) {
    // Prima volta: carica su Supabase il valore locale
    await saveTrainerColor(local);
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
const COACHES_KEY = "training_app_coaches";
const TRAINING_TYPES_KEY = "training_app_types";

function getStoredArray(key, fallback){
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(raw) && raw.length) return Array.from(new Set(raw.map(v => String(v || "").trim()).filter(Boolean)));
  } catch(_) {}
  return [...fallback];
}
function setStoredArray(key, arr){
  const clean = Array.from(new Set((arr || []).map(v => String(v || "").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b, 'it'));
  localStorage.setItem(key, JSON.stringify(clean));
  return clean;
}
function getCoaches(){ return getStoredArray(COACHES_KEY, DEFAULT_COACHES); }
function getTrainingTypes(){ return getStoredArray(TRAINING_TYPES_KEY, DEFAULT_TRAINING_TYPES); }
function populateSimpleSelect(selectEl, items, placeholder){
  if (!selectEl) return;
  const opts = (items || []).map(v => `<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`);
  selectEl.innerHTML = placeholder ? `<option value="">${placeholder}</option>` + opts.join('') : opts.join('');
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
  if (tipo && currentTipo) tipo.value = currentTipo;
  if (allenatore && currentCoach) allenatore.value = currentCoach;
}
window.removeCoach = function(encoded){
  const name = decodeURIComponent(encoded);
  setStoredArray(COACHES_KEY, getCoaches().filter(v => v !== name));
  refreshAdminLists(); refreshFormOptions();
};
window.removeTrainingType = function(encoded){
  const name = decodeURIComponent(encoded);
  setStoredArray(TRAINING_TYPES_KEY, getTrainingTypes().filter(v => v !== name));
  refreshAdminLists(); refreshFormOptions();
};
function bindAdminCatalogActions(){
  addCoachBtn && (addCoachBtn.onclick = () => {
    const name = (coachNameInput?.value || '').trim();
    if (!name) return;
    setStoredArray(COACHES_KEY, [...getCoaches(), name]);
    coachNameInput.value = '';
    refreshAdminLists(); refreshFormOptions();
  });
  addTrainingTypeBtn && (addTrainingTypeBtn.onclick = () => {
    const name = (trainingTypeInput?.value || '').trim();
    if (!name) return;
    setStoredArray(TRAINING_TYPES_KEY, [...getTrainingTypes(), name]);
    trainingTypeInput.value = '';
    refreshAdminLists(); refreshFormOptions();
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
async function fetchAthletes(){
  const { data, error } = await supabaseClient.from('profiles').select('id, full_name').order('full_name', { ascending: true });
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
    compareSummary.innerHTML = '<div class="muted">Seleziona due atlete per vedere il confronto.</div>';
    return;
  }
  const { fromDate, toDate } = getDashboardRange();
  const { data, error } = await supabaseClient.from('allenamenti').select('user_id, durata, numero_partecipanti').in('user_id', ids).gte('data', fromDate).lte('data', toDate);
  if (error) { compareSummary.innerHTML = '<div class="muted">Errore nel confronto.</div>'; return; }
  const athletes = await fetchAthletes();
  const nameMap = new Map(athletes.map(a => [a.id, a.full_name || 'Atleta']));
  const cards = ids.map(id => {
    const rows = (data || []).filter(r => r.user_id === id);
    const sessions = rows.length;
    const hours = rows.reduce((s, r) => s + safeNumber(r.durata), 0) / 60;
    const avg = sessions ? rows.reduce((s, r) => s + safeNumber(r.numero_partecipanti), 0) / sessions : 0;
    return `<div class="compare-card"><div class="stat-label">${nameMap.get(id) || 'Atleta'}</div><div class="stat-value">${sessions}</div><div class="muted">Sessioni</div><div class="muted">Ore: ${hours.toFixed(1)} · Media partecipanti: ${avg.toFixed(1)}</div></div>`;
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
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}
function monthLabel(dateObj) {
  return dateObj.toLocaleDateString(currentLang, { month: "long", year: "numeric" });
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
    .select("id, full_name, avatar_url")
    .in("id", ids);
  if (error) { console.error("Errore lettura profiles:", error); return rows || []; }
  const map = new Map((profs || []).map(p => [p.id, p]));
  return (rows || []).map(r => ({
    ...r,
    _full_name: map.get(r.user_id)?.full_name || null,
    _avatar_url: map.get(r.user_id)?.avatar_url || null
  }));
}


function avatarHtml(url, name){
  const safeName = String(name || "").trim();
  const initial = safeName ? safeName.charAt(0).toUpperCase() : "👤";
  const style = url ? ` style="background-image:url('${withCacheBust(url)}')"` : "";
  return `<div class="athlete-avatar"${style}>${url ? "" : initial}</div>`;
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

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() || 7;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  for (let i = 1; i < firstDay; i++) grid.innerHTML += '<div class="calendar-empty" aria-hidden="true"></div>';

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
    "admin.all": "Tutti",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendario",
    "nav.list": "Lista",
    "dash.sessionsMonth": "Sessioni mese",
    "dash.totalHours": "Ore totali",
    "dash.avgParticipants": "Partecipanti medi",
    "dash.period": "Periodo",
    "dash.goCalendar": "Vai al calendario",
    "dash.goList": "Vai alla lista",
    "cal.hint": "Tocca un giorno per visualizzare gli allenamenti.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Entrambe",
    "list.newWorkout": "Nuovo allenamento",
    "list.workouts": "Allenamenti",
    "list.workoutsOf": "Allenamenti del {date}",
    "form.typePh": "Tipo allenamento",
    "form.date": "Data",
    "form.time": "Ora",
    "form.durationPh": "Durata (min)",
    "form.participantsPh": "Partecipanti",
    "form.withWhomPh": "Trainer / Con chi",
    "form.notesPh": "Note",
    "form.addBtn": "➕ Aggiungi",
    "export.excel": "📊 Esporta Excel",
    "export.pdf": "📄 Esporta PDF",
    "export.title": "Esporta:",
    "export.month": "Mese",
    "export.monthLabel": "Mese:",
    "export.custom": "Periodo personalizzato",
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
    "alerts.workoutUpdated": "Allenamento aggiornato ✅"
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
    "admin.all": "All",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendar",
    "nav.list": "List",
    "dash.sessionsMonth": "Sessions this month",
    "dash.totalHours": "Total hours",
    "dash.avgParticipants": "Average participants",
    "dash.period": "Period",
    "dash.goCalendar": "Go to calendar",
    "dash.goList": "Go to list",
    "cal.hint": "Tap a day to view workouts.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Both",
    "list.newWorkout": "New workout",
    "list.workouts": "Workouts",
    "list.workoutsOf": "Workouts on {date}",
    "form.typePh": "Workout type",
    "form.date": "Date",
    "form.time": "Time",
    "form.durationPh": "Duration (min)",
    "form.participantsPh": "Participants",
    "form.withWhomPh": "Trainer / With whom",
    "form.notesPh": "Notes",
    "form.addBtn": "➕ Add",
    "export.excel": "📊 Export Excel",
    "export.pdf": "📄 Export PDF",
    "export.title": "Export:",
    "export.month": "Month",
    "export.monthLabel": "Month:",
    "export.custom": "Custom period",
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
    "alerts.workoutUpdated": "Workout updated ✅"
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
    "admin.all": "Alle",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Kalender",
    "nav.list": "Liste",
    "dash.sessionsMonth": "Sitzungen im Monat",
    "dash.totalHours": "Gesamtstunden",
    "dash.avgParticipants": "Ø Teilnehmer",
    "dash.period": "Zeitraum",
    "dash.goCalendar": "Zum Kalender",
    "dash.goList": "Zur Liste",
    "cal.hint": "Tippe auf einen Tag, um Trainings zu sehen.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Beide",
    "list.newWorkout": "Neues Training",
    "list.workouts": "Trainings",
    "list.workoutsOf": "Trainings am {date}",
    "form.typePh": "Trainingstyp",
    "form.date": "Datum",
    "form.time": "Uhrzeit",
    "form.durationPh": "Dauer (Min)",
    "form.participantsPh": "Teilnehmer",
    "form.withWhomPh": "Trainer / Mit wem",
    "form.notesPh": "Notizen",
    "form.addBtn": "➕ Hinzufügen",
    "export.excel": "📊 Excel exportieren",
    "export.pdf": "📄 PDF exportieren",
    "export.title": "Export:",
    "export.month": "Monat",
    "export.monthLabel": "Monat:",
    "export.custom": "Benutzerdefinierter Zeitraum",
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
    "alerts.workoutUpdated": "Training aktualisiert ✅"
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
    "admin.all": "Všetci",
    "nav.dashboard": "Prehľad",
    "nav.calendar": "Kalendár",
    "nav.list": "Zoznam",
    "dash.sessionsMonth": "Tréningy tento mesiac",
    "dash.totalHours": "Celkové hodiny",
    "dash.avgParticipants": "Priemer účastníkov",
    "dash.period": "Obdobie",
    "dash.goCalendar": "Do kalendára",
    "dash.goList": "Do zoznamu",
    "cal.hint": "Ťukni na deň pre zobrazenie tréningov.",
    "people.sophie": "Sophie",
    "people.vivienne": "Vivienne",
    "people.both": "Obe",
    "list.newWorkout": "Nový tréning",
    "list.workouts": "Tréningy",
    "list.workoutsOf": "Tréningy dňa {date}",
    "form.typePh": "Typ tréningu",
    "form.date": "Dátum",
    "form.time": "Čas",
    "form.durationPh": "Trvanie (min)",
    "form.participantsPh": "Účastníci",
    "form.withWhomPh": "Tréner / S kým",
    "form.notesPh": "Poznámky",
    "form.addBtn": "➕ Pridať",
    "export.excel": "📊 Exportovať Excel",
    "export.pdf": "📄 Exportovať PDF",
    "export.title": "Export:",
    "export.month": "Mesiac",
    "export.monthLabel": "Mesiac:",
    "export.custom": "Vlastné obdobie",
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
    "alerts.workoutUpdated": "Tréning aktualizovaný ✅"
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

const currentLang = detectLanguage();
function tr(key, vars = {}) {
  const dict = I18N[currentLang] || I18N[FALLBACK_LANG];
  let s = dict[key] || (I18N[FALLBACK_LANG] && I18N[FALLBACK_LANG][key]) || key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  // text nodes
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = tr(key);
  });

  // placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.setAttribute("placeholder", tr(key));
  });

  // document title
  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) document.title = tr(titleEl.getAttribute("data-i18n"));
}

// translate known alerts without rewriting the whole file
const __nativeAlert = window.alert.bind(window);
window.alert = (msg) => {
  if (msg === "Allenamento aggiornato ✅") return __nativeAlert(tr("alerts.workoutUpdated"));
  return __nativeAlert(msg);
};

document.addEventListener("DOMContentLoaded", applyTranslations);



async function renderProfile(){
  // Fill basic user info
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const roleEl = document.getElementById("profileRole");
  if (nameEl) nameEl.textContent = currentUser?.user_metadata?.full_name || currentUser?.email || "Utente";
  if (emailEl) emailEl.textContent = currentUser?.email || "—";

  try {
    const isAdmin = await getIsAdmin();
    if (roleEl) roleEl.textContent = isAdmin ? "Admin" : "Utente";
    const adminPanel = document.getElementById("adminPanel");
    if (adminPanel) adminPanel.style.display = isAdmin ? "block" : "none";
    if (isAdmin) { refreshAdminLists(); refreshFormOptions(); }
  } catch(_) {
    if (roleEl) roleEl.textContent = "Utente";
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
