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

function normalizeHexColor(value) {
  const hex = String(value || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(hex) ? hex.toLowerCase() : null;
}

function getFallbackCalendarColor(seed) {
  const palette = PROFILE_COLORS;
  let hash = 0;
  const input = String(seed || "default");
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length] || LEGACY_DEFAULT_ACCENT;
}

function getRowCalendarColor(row) {
  const profileColor = normalizeHexColor(row?._trainer_color);
  if (profileColor) return profileColor;
  return getFallbackCalendarColor(row?.user_id || row?._full_name || row?.id);
}

// init colori trainer (prima del login)

const LEGACY_DEFAULT_ACCENT = "#2563eb";

function getProfileColorStorageKey(){
  const id = currentUser?.id || currentUser?.email || "guest";
  return `profile_color_${id}`;
}

function getStoredProfileColor(){
  return normalizeHexColor(localStorage.getItem(getProfileColorStorageKey())) || LEGACY_DEFAULT_ACCENT;
}

function initTrainerColors(){
  const myColor = getStoredProfileColor();
  document.documentElement.style.setProperty("--accent", myColor);
}

function setMyTrainerColor(col, opts = {}){
  const safe = normalizeHexColor(col);
  if (!safe) return;

  localStorage.setItem(getProfileColorStorageKey(), safe);
  document.documentElement.style.setProperty("--accent", safe);

  if (opts.persistRemote !== false && currentUser){
    Promise.resolve(saveTrainerColor(safe)).catch((e)=>console.warn("trainer_color update error", e));
  }

  if (opts.refreshUI !== false) {
    // aggiorna anche i dati già caricati dell'utente corrente, così il calendario cambia subito
    allenamentiMese = (allenamentiMese || []).map(row => (
      row?.user_id === currentUser?.id ? { ...row, _trainer_color: safe } : row
    ));
    mountColorPalette();
    renderCalendar();
    updateDashboard();
  }
}

function mountColorPalette(){
  const wrap = document.getElementById("colorPalette");
  if (!wrap) return;

  const saved = getStoredProfileColor();

  wrap.innerHTML = "";
  PROFILE_COLORS.forEach((col) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dotpick";
    btn.dataset.color = col;
    btn.style.setProperty("--c", col);
    btn.setAttribute("aria-label", tr("profile.colorSwatch", { color: col }));
    if (col === saved) btn.classList.add("active");

    btn.onclick = () => {
      setMyTrainerColor(col);
      wrap.querySelectorAll(".dotpick").forEach(b => b.classList.toggle("active", b.dataset.color === col));
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

  const local = getStoredProfileColor();
  const remote = normalizeHexColor(await fetchTrainerColor());

  if (remote) {
    localStorage.setItem(getProfileColorStorageKey(), remote);
    setMyTrainerColor(remote, { persistRemote: false });
  } else if (local) {
    await saveTrainerColor(local);
    setMyTrainerColor(local, { persistRemote: false });
  }
}


async function saveAthleteColorById(userId, col){
  const safe = normalizeHexColor(col);
  if (!userId || !safe) return;
  const { error } = await supabaseClient
    .from("profiles")
    .update({ trainer_color: safe })
    .eq("id", userId);
  if (error) console.warn("athlete color update error", error);
}

async function mountAdminAthleteColorManager(){
  const panel = document.getElementById("adminAthleteColorManager");
  const select = document.getElementById("adminAthleteSelect");
  const palette = document.getElementById("adminAthleteColorPalette");
  const customInput = document.getElementById("adminAthleteCustomColor");
  const saveBtn = document.getElementById("adminAthleteSaveColorBtn");
  const preview = document.getElementById("adminAthleteColorPreview");

  if (!panel || !select || !palette || !customInput || !saveBtn || !preview) return;
  if (!isAdmin) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  const athletes = await fetchAthletes();
  const options = [`<option value="">${tr("admin.selectAthlete")}</option>`]
    .concat(athletes.map(a => {
      const name = a.full_name || a.id;
      const color = normalizeHexColor(a.trainer_color) || getFallbackCalendarColor(a.id);
      return `<option value="${a.id}" data-color="${color}">${name}</option>`;
    }));
  select.innerHTML = options.join('');

  let selectedColor = null;

  const applyPreview = (color) => {
    const safe = normalizeHexColor(color) || LEGACY_DEFAULT_ACCENT;
    selectedColor = safe;
    preview.style.background = safe;
    customInput.value = safe;
    palette.querySelectorAll('.dotpick').forEach(b => b.classList.toggle('active', b.dataset.color === safe));
  };

  palette.innerHTML = "";
  PROFILE_COLORS.forEach((col) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dotpick";
    btn.dataset.color = col;
    btn.style.setProperty("--c", col);
    btn.setAttribute("aria-label", tr("admin.athleteColorSwatch", { color: col }));
    btn.onclick = () => applyPreview(col);
    palette.appendChild(btn);
  });

  select.onchange = () => {
    const opt = select.selectedOptions?.[0];
    const color = normalizeHexColor(opt?.dataset?.color) || getFallbackCalendarColor(select.value || 'admin');
    applyPreview(color);
  };

  customInput.oninput = () => {
    const safe = normalizeHexColor(customInput.value);
    if (safe) applyPreview(safe);
  };

  saveBtn.onclick = async () => {
    const userId = select.value;
    const safe = normalizeHexColor(selectedColor || customInput.value);
    if (!userId || !safe) {
      alert(tr("admin.selectAthleteAndColor"));
      return;
    }

    await saveAthleteColorById(userId, safe);

    if (currentUser?.id === userId) {
      localStorage.setItem(getProfileColorStorageKey(), safe);
      document.documentElement.style.setProperty("--accent", safe);
    }

    allenamentiMese = (allenamentiMese || []).map(row => (
      row?.user_id === userId ? { ...row, _trainer_color: safe } : row
    ));

    const chosen = select.selectedOptions?.[0];
    if (chosen) chosen.dataset.color = safe;

    renderCalendar();
    updateDashboard();
    if (giornoSelezionato) caricaAllenamenti(giornoSelezionato);
  };

  const firstColor = normalizeHexColor(select.selectedOptions?.[0]?.dataset?.color) || LEGACY_DEFAULT_ACCENT;
  applyPreview(firstColor);
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
    if (!file.type.startsWith("image/")) { alert(tr("profile.selectImage")); return; }
    if (file.size > 1500000) { alert(tr("profile.imageTooLarge")); return; }

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
      alert(tr("profile.avatarUploadFailed"));
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
  populateSimpleSelect(tipo, getTrainingTypes(), tr("form.selectType"));
  populateSimpleSelect(allenatore, getCoaches(), tr("form.selectCoach"));
  if (tipo && currentTipo && getTrainingTypes().includes(currentTipo)) tipo.value = currentTipo;
  if (allenatore && currentCoach && getCoaches().includes(currentCoach)) allenatore.value = currentCoach;
}

async function addCatalogItem(tableName, rawName){
  const name = String(rawName || "").trim();
  if (!name) return;
  const { error } = await supabaseClient.from(tableName).upsert({ name, is_active: true }, { onConflict: "name" });
  if (error) {
    console.error(error);
    alert(tr("alerts.supabaseSaveFailed"));
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
    alert(tr("alerts.supabaseDeleteFailed"));
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
    compareSummary.innerHTML = '<div class="muted">Seleziona due atlete per vedere il confronto.</div>';
    return;
  }
  const { fromDate, toDate } = getDashboardRange();
  const { data, error } = await supabaseClient
    .from('allenamenti')
    .select('user_id, durata, numero_partecipanti, persone')
    .in('user_id', ids)
    .gte('data', fromDate)
    .lte('data', toDate);
  if (error) { compareSummary.innerHTML = `<div class="muted">${tr("compare.error")}</div>`; return; }
  const athletes = await fetchAthletes();
  const athleteMap = new Map(athletes.map(a => [a.id, a]));
  const cards = ids.map(id => {
    const rows = (data || []).filter(r => r.user_id === id);
    const athlete = athleteMap.get(id) || {};
    const athleteName = athlete.full_name || 'Atleta';
    const athleteColor = athlete.trainer_color || '#888';
    const sessions = rows.length;
    const hours = rows.reduce((s, r) => s + safeNumber(r.durata), 0) / 60;
    const avg = sessions ? rows.reduce((s, r) => s + safeNumber(r.numero_partecipanti), 0) / sessions : 0;
    const coachCounts = rows.reduce((acc, row) => {
      const coachName = ((row.persone || '').split(' | ')[0] || '').trim();
      if (!coachName) return acc;
      acc[coachName] = (acc[coachName] || 0) + 1;
      return acc;
    }, {});
    const coachLines = Object.entries(coachCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([coachName, count]) => {
        const percent = sessions ? Math.round((count / sessions) * 100) : 0;
        return `<div class="muted"><strong>${coachName}</strong>: ${percent}%</div>`;
      })
      .join('');
    const coachSection = coachLines
      ? `<div class="compare-coaches" style="margin-top:8px"><div class="muted" style="font-weight:600">Percentuale allenatore</div>${coachLines}</div>`
      : `<div class="muted" style="margin-top:8px">Percentuale allenatore: nessun dato</div>`;
    return `<div class="compare-card"><div class="stat-label" style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:12px;height:12px;border-radius:999px;background:${athleteColor}"></span>${athleteName}</div><div class="stat-value">${sessions}</div><div class="muted">Sessioni</div><div class="muted">Ore: ${hours.toFixed(1)} · Media partecipanti: ${avg.toFixed(1)}</div>${coachSection}</div>`;
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
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat(currentLang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
function monthLabel(dateObj) {
  return new Intl.DateTimeFormat(currentLang, { month: 'long', year: 'numeric' }).format(dateObj);
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
    _trainer_color: normalizeHexColor(map.get(r.user_id)?.trainer_color)
  }));
}

function clearEditingMode() {
  editingId = null;
  if (submitBtn) submitBtn.textContent = tr("actions.addWithIcon");
  const formTitle = document.getElementById("workoutFormTitle"); if (formTitle) formTitle.textContent = tr("form.addWorkout");
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
  else alert(tr("auth.registered"));
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
    userFilterSelect.innerHTML = `<option value="__all__">${tr("admin.all")}</option>`;
    userFilterSelect.value = "__all__";
    selectedUserId = "__all__";
    return;
  }

  const opts = [];
  opts.push(`<option value="__all__">${tr("admin.allAthletes")}</option>`);
  if (currentUser?.id) opts.push(`<option value="${currentUser.id}">${tr("admin.mySessions")}</option>`);
  (data || []).forEach(p => opts.push(`<option value="${p.id}">${p.full_name || tr("common.unnamed")}</option>`));
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
  whoami.textContent = isAdmin ? tr("auth.whoamiAdmin", { name: display }) : tr("auth.whoamiUser", { name: display });

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
    alert(tr("alerts.invalidSession"));
    return;
  }

  // campi minimi
  if (!dataInput.value || !ora_inizio.value || !tipo.value) {
    alert(tr("alerts.fillRequired"));
    return;
  }

  // Se sei admin e vuoi inserire per altri, devi scegliere un utente specifico
  if (isAdmin && selectedUserId === "__all__") {
    alert(tr("alerts.selectSpecificUser"));
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
    alert(tr("alerts.workoutUpdated"));
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
    const uniqueColors = [...new Set(dayRows.map(getRowCalendarColor).filter(Boolean))];

    let inlineStyle = "";
    if (uniqueColors.length === 1) {
      inlineStyle = `style="background:${uniqueColors[0]}; border-color:${uniqueColors[0]}; color:#fff;"`;
    } else if (uniqueColors.length > 1) {
      const gradient = uniqueColors.join(', ');
      inlineStyle = `style="background:linear-gradient(135deg, ${gradient}); border:none; color:#fff;"`;
    }

    const tooltip = dayRows
      .map(r => `${r._full_name || tr('common.athlete')}${r._trainer_color ? ` (${r._trainer_color})` : ''}`)
      .join(' · ')
      .replace(/"/g, '&quot;');

    grid.innerHTML += `
      <button class="calendar-day ${hasWorkout ? "has-workout" : ""}"
              type="button"
              title="${tooltip}"
              ${inlineStyle}
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
      listaTitle.textContent = tr("list.titleWithDate", { date: formatDate(newDate) });
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
  if (error) { console.error(error); listaDiv.innerHTML = `<p>${tr("list.loadError")}</p>`; return; }

  const enriched = await enrichWithProfiles(rows || []);
  listaDiv.innerHTML = "";

  if (!enriched || enriched.length === 0) {
    listaDiv.innerHTML = `<p>${tr("list.noWorkouts")}</p>`;
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
            <div class="athlete-sub">${tr('common.athlete')}</div>
          </div>
        </div>
        <div>📅 <strong>${tr("form.date")}:</strong> ${formatDate(a.data)}</div>
        <div>⏰ <strong>${tr("form.time")}:</strong> ${a.ora_inizio}</div>
        <div>🏋️ <strong>${tr("form.type")}:</strong> ${a.tipo}</div>
        <div>🤝 <strong>${tr("form.coach")}:</strong> ${coachName}</div>
        <div>👥 <strong>${tr("list.details")}:</strong> ${details}</div>
        <div>👥 <strong>${tr("form.participants")}:</strong> ${a.numero_partecipanti || "-"}</div>
        <div>⏱ <strong>${tr("form.duration")}:</strong> ${a.durata ? a.durata + " " + tr("common.minutes") : "-"}</div>
        <div>📝 <strong>${tr("form.notes")}:</strong> ${a.note || "-"}</div>

        ${canEdit ? `
          <div class="actions">
            <button onclick="modificaAllenamento('${a.id}')">${tr("actions.editWithIcon")}</button>
            <button onclick="eliminaAllenamento('${a.id}')" class="btn-secondary">${tr("actions.deleteWithIcon")}</button>
          </div>
        ` : ""}
      </div>
    `;
  });
}

window.eliminaAllenamento = async function (id) {
  if (!confirm(tr("alerts.confirmDeleteWorkout"))) return;

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

  if (submitBtn) submitBtn.textContent = tr("actions.saveWithIcon");
  const formTitle = document.getElementById("workoutFormTitle"); if (formTitle) formTitle.textContent = tr("form.editWorkout");
  alert(tr("alerts.editMode"));
};

// ================= DASHBOARD =================
async function updateDashboard() {
  syncDashboardRangeUI();
  const { start, end, fromDate, toDate, mode } = getDashboardRange();
  if (dashPeriodLabel) {
    dashPeriodLabel.textContent = `${formatDate(isoDate(start))} → ${formatDate(isoDate(end))}${mode === 'custom' ? ` (${tr("dash.customRangeLower")})` : ''}`;
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
      if (!from || !to) return alert(tr("export.selectFromTo"));
      if (from > to) return alert(tr("export.invalidRange"));
    }

    closeExportOptions();

    if (lastExportIntent === "excel") await doExportExcel();
    if (lastExportIntent === "pdf") await doExportPdf();
    lastExportIntent = null;
  } catch (e) {
    console.error(e);
    alert(tr("export.applyError"));
  }
});

// ================= EXPORT EXCEL =================
async function doExportExcel() {
  try {
    if (typeof XLSX === "undefined") return alert(tr("export.xlsxMissing"));
    const { rows, fromDate, toDate } = await fetchExportRows();
    if (!rows || rows.length === 0) return alert(tr("export.noData"));

    const formatted = rows.map((a) => ({
      [tr("export.colDate")]: a.data ? formatDate(a.data) : "",
      [tr("export.colTime")]: a.ora_inizio || "",
      [tr("export.colType")]: a.tipo || "",
      [tr("export.colDurationMin")]: a.durata ?? "",
      [tr("export.colParticipants")]: a.numero_partecipanti ?? "",
      [tr("export.colCoach")]: a.persone ?? "",
      [tr("export.colCreatedBy")]: isAdmin ? (a._full_name || "-") : "",
      [tr("form.notes")]: a.note ?? "",
      ID: a.id ?? ""
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);

    const headers = Object.keys(formatted[0] || {});
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(h.length, ...formatted.map((r) => String(r[h] ?? "").length));
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, giornoSelezionato ? tr("export.sheetDay") : tr("export.sheetPeriod"));

    const safeFrom = fromDate.replaceAll("-", "");
    const safeTo = toDate.replaceAll("-", "");
    const fileName = giornoSelezionato ? `allenamenti_${safeFrom}.xlsx` : `allenamenti_${safeFrom}_${safeTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (e) {
    console.error(e);
    alert(tr("export.excelError"));
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
    alert(tr("export.excelError"));
  }
});

// ================= EXPORT PDF =================
async function doExportPdf() {
  try {
    const { rows, fromDate, toDate } = await fetchExportRows();
    if (!rows || rows.length === 0) return alert(tr("export.noData"));

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
  orientation: "landscape",
  unit: "pt",
  format: "a4"
});

    const title = giornoSelezionato
      ? `${tr("export.reportTitle")} (${fromDate})`
      : `${tr("export.reportTitle")} (${monthLabel(currentMonth)})`;
    const subtitle = `${tr("export.periodLabel")}: ${fromDate} → ${toDate}`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, 40, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(subtitle, 40, 70);

    const headers = [tr("export.colDate"), tr("export.colTime"), tr("export.colType"), tr("export.colDuration"), tr("export.colParticipants"), tr("export.colCoach"), ...(isAdmin ? [tr("export.colCreatedBySpaced")] : [])];
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
        a.durata ? `${a.durata}${tr("common.minutesShort")}` : "-",
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
    alert(tr("export.pdfError"));
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
    alert(tr("export.pdfError"));
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
    "auth.registered": "Registrazione completata!",
    "auth.whoamiAdmin": "👑 {name} (admin)",
    "auth.whoamiUser": "👤 {name}",
    "admin.title": "Admin",
    "admin.description": "Gestisci allenatori e tipi di allenamento disponibili nei menu a tendina.",
    "admin.activeAthlete": "Atleta attiva",
    "admin.all": "Tutti",
    "admin.allFemale": "Tutte",
    "admin.allAthletes": "Tutte le atlete",
    "admin.mySessions": "Le mie sessioni",
    "admin.coaches": "Allenatori",
    "admin.trainingTypes": "Tipi allenamento",
    "admin.newCoach": "Nuovo allenatore",
    "admin.newTrainingType": "Nuovo tipo allenamento",
    "admin.athleteColor": "Colore atleta",
    "admin.saveColor": "Salva colore",
    "admin.selectAthlete": "Seleziona atleta",
    "admin.selectAthleteAndColor": "Seleziona un atleta e un colore valido.",
    "admin.athleteColorHelp": "Come admin puoi scegliere e salvare il colore del calendario per ogni atleta.",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendario",
    "nav.list": "Lista",
    "nav.profile": "Profilo",
    "stats.sessions": "Sessioni",
    "stats.totalHours": "Ore totali",
    "stats.avgParticipants": "Media partecipanti",
    "stats.hours": "Ore",
    "stats.average": "Media",
    "dash.period": "Periodo",
    "dash.thisMonth": "Questo mese",
    "dash.lastMonth": "Mese scorso",
    "dash.thisYear": "Quest'anno",
    "dash.all": "Tutto",
    "dash.customRange": "Intervallo personalizzato",
    "dash.goCalendar": "Vai al Calendario",
    "dash.goList": "Vai alla Lista",
    "compare.title": "Confronto atlete",
    "compare.athlete1": "Atleta 1",
    "compare.athlete2": "Atleta 2",
    "compare.error": "Errore nel confronto.",
    "calendar.legend": "Il colore del giorno segue il profilo dell'atleta",
    "list.selectDay": "Seleziona un giorno dal calendario per vedere la lista.",
    "list.workouts": "Allenamenti",
    "list.workoutsOf": "Allenamenti del {date}",
    "list.titleWithDate": "Lista - {date}",
    "list.noWorkouts": "Nessun allenamento",
    "list.loadError": "Errore caricamento",
    "list.details": "Dettagli",
    "form.addWorkout": "Aggiungi allenamento",
    "form.editWorkout": "Modifica allenamento",
    "form.type": "Tipo allenamento",
    "form.coach": "Allenatore",
    "form.selectType": "Seleziona tipo allenamento",
    "form.selectCoach": "Seleziona allenatore",
    "form.date": "Data",
    "form.time": "Ora",
    "form.startTime": "Ora inizio",
    "form.duration": "Durata (minuti)",
    "form.durationExample": "Es. 60",
    "form.participants": "Numero partecipanti",
    "form.participantsExample": "Es. 10",
    "form.people": "Persone / dettagli aggiuntivi",
    "form.peopleExample": "Es. gruppo, assistenti, note rapide",
    "form.notes": "Note",
    "form.notesPlaceholder": "Note...",
    "form.save": "Salva",
    "profile.stats": "Statistiche",
    "profile.changeAvatar": "Cambia avatar",
    "profile.updateAvatar": "Aggiorna avatar",
    "profile.color": "Colore profilo",
    "profile.colorSwatch": "Colore {color}",
    "profile.selectImage": "Seleziona un file immagine.",
    "profile.imageTooLarge": "Immagine troppo grande (max ~1.5MB).",
    "profile.avatarUploadFailed": "Upload avatar fallito. Verifica bucket \"avatars\" e policy Storage (403/404). Dettagli in console.",
    "actions.add": "Aggiungi",
    "actions.addWithIcon": "➕ Aggiungi",
    "actions.saveWithIcon": "💾 Salva",
    "actions.editWithIcon": "✏️ Modifica",
    "actions.deleteWithIcon": "🗑 Elimina",
    "export.section": "Export",
    "export.excel": "Esporta Excel",
    "export.pdf": "Esporta PDF",
    "export.options": "Opzioni export",
    "export.month": "Mese",
    "export.custom": "Intervallo date",
    "export.selectMonth": "Seleziona mese",
    "export.apply": "Applica",
    "export.selectFromTo": "Seleziona 'Dal' e 'Al'.",
    "export.invalidRange": "La data 'Dal' non può essere dopo 'Al'.",
    "export.applyError": "Errore applicazione periodo export",
    "export.xlsxMissing": "Libreria XLSX non caricata.",
    "export.noData": "Nessun dato da esportare",
    "export.excelError": "Errore export Excel",
    "export.pdfError": "Errore export PDF",
    "weekday.mon": "Lun",
    "weekday.tue": "Mar",
    "weekday.wed": "Mer",
    "weekday.thu": "Gio",
    "weekday.fri": "Ven",
    "weekday.sat": "Sab",
    "weekday.sun": "Dom",
    "common.athlete": "Atleta",
    "common.user": "Utente",
    "common.admin": "Admin",
    "common.unnamed": "(senza nome)",
    "alerts.invalidSession": "Sessione non valida. Rifai login.",
    "alerts.fillRequired": "Compila almeno Data, Ora e Tipo.",
    "alerts.selectSpecificUser": "Se sei admin, seleziona prima un utente specifico (non 'Tutti') dal menu Visualizza.",
    "alerts.workoutUpdated": "Allenamento aggiornato ✅",
    "alerts.confirmDeleteWorkout": "Vuoi eliminare questo allenamento?",
    "alerts.editMode": "Modalità modifica: ora modifica i campi e poi premi SALVA ✅",
    "alerts.supabaseSaveFailed": "Impossibile salvare il valore su Supabase.",
    "alerts.supabaseDeleteFailed": "Impossibile rimuovere il valore da Supabase.",
    "admin.athleteColorSwatch": "Colore atleta {color}",
    "list.prevDay": "Giorno precedente",
    "list.nextDay": "Giorno successivo",
    "profile.avatarAlt": "Avatar",
    "calendar.legendAria": "Legenda colori calendario",
    "export.colDate": "Data",
    "export.colTime": "Ora",
    "export.colType": "Tipo",
    "export.colDuration": "Durata",
    "export.colDurationMin": "Durata_min",
    "export.colParticipants": "Partecipanti",
    "export.colCoach": "Allenatore",
    "export.colCreatedBy": "Inserito_da",
    "export.colCreatedBySpaced": "Inserito da",
    "export.sheetDay": "Giorno",
    "export.sheetPeriod": "Periodo",
    "export.reportTitle": "Report allenamenti",
    "export.periodLabel": "Periodo",
    "common.minutes": "min",
    "common.minutesShort": "m",
    "dash.customRangeLower": "personalizzato",
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
    "auth.registered": "Registration completed!",
    "auth.whoamiAdmin": "👑 {name} (admin)",
    "auth.whoamiUser": "👤 {name}",
    "admin.title": "Admin",
    "admin.description": "Manage coaches and workout types available in the dropdown menus.",
    "admin.activeAthlete": "Active athlete",
    "admin.all": "All",
    "admin.allFemale": "All",
    "admin.allAthletes": "All athletes",
    "admin.mySessions": "My sessions",
    "admin.coaches": "Coaches",
    "admin.trainingTypes": "Workout types",
    "admin.newCoach": "New coach",
    "admin.newTrainingType": "New workout type",
    "admin.athleteColor": "Athlete color",
    "admin.saveColor": "Save color",
    "admin.selectAthlete": "Select athlete",
    "admin.selectAthleteAndColor": "Select an athlete and a valid color.",
    "admin.athleteColorHelp": "As admin you can choose and save the calendar color for each athlete.",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendar",
    "nav.list": "List",
    "nav.profile": "Profile",
    "stats.sessions": "Sessions",
    "stats.totalHours": "Total hours",
    "stats.avgParticipants": "Average participants",
    "stats.hours": "Hours",
    "stats.average": "Average",
    "dash.period": "Period",
    "dash.thisMonth": "This month",
    "dash.lastMonth": "Last month",
    "dash.thisYear": "This year",
    "dash.all": "All",
    "dash.customRange": "Custom range",
    "dash.goCalendar": "Go to Calendar",
    "dash.goList": "Go to List",
    "compare.title": "Athlete comparison",
    "compare.athlete1": "Athlete 1",
    "compare.athlete2": "Athlete 2",
    "compare.error": "Comparison error.",
    "calendar.legend": "The day color follows the athlete profile color",
    "list.selectDay": "Select a day from the calendar to see the list.",
    "list.workouts": "Workouts",
    "list.workoutsOf": "Workouts on {date}",
    "list.titleWithDate": "List - {date}",
    "list.noWorkouts": "No workouts",
    "list.loadError": "Loading error",
    "list.details": "Details",
    "form.addWorkout": "Add workout",
    "form.editWorkout": "Edit workout",
    "form.type": "Workout type",
    "form.coach": "Coach",
    "form.selectType": "Select workout type",
    "form.selectCoach": "Select coach",
    "form.date": "Date",
    "form.time": "Time",
    "form.startTime": "Start time",
    "form.duration": "Duration (minutes)",
    "form.durationExample": "E.g. 60",
    "form.participants": "Number of participants",
    "form.participantsExample": "E.g. 10",
    "form.people": "People / additional details",
    "form.peopleExample": "E.g. group, assistants, quick notes",
    "form.notes": "Notes",
    "form.notesPlaceholder": "Notes...",
    "form.save": "Save",
    "profile.stats": "Statistics",
    "profile.changeAvatar": "Change avatar",
    "profile.updateAvatar": "Update avatar",
    "profile.color": "Profile color",
    "profile.colorSwatch": "Color {color}",
    "profile.selectImage": "Select an image file.",
    "profile.imageTooLarge": "Image too large (max ~1.5MB).",
    "profile.avatarUploadFailed": "Avatar upload failed. Check the \"avatars\" bucket and Storage policies (403/404). Details in console.",
    "actions.add": "Add",
    "actions.addWithIcon": "➕ Add",
    "actions.saveWithIcon": "💾 Save",
    "actions.editWithIcon": "✏️ Edit",
    "actions.deleteWithIcon": "🗑 Delete",
    "export.section": "Export",
    "export.excel": "Export Excel",
    "export.pdf": "Export PDF",
    "export.options": "Export options",
    "export.month": "Month",
    "export.custom": "Date range",
    "export.selectMonth": "Select month",
    "export.apply": "Apply",
    "export.selectFromTo": "Select 'From' and 'To'.",
    "export.invalidRange": "The 'From' date cannot be after 'To'.",
    "export.applyError": "Error applying export range",
    "export.xlsxMissing": "XLSX library not loaded.",
    "export.noData": "No data to export",
    "export.excelError": "Excel export error",
    "export.pdfError": "PDF export error",
    "weekday.mon": "Mon",
    "weekday.tue": "Tue",
    "weekday.wed": "Wed",
    "weekday.thu": "Thu",
    "weekday.fri": "Fri",
    "weekday.sat": "Sat",
    "weekday.sun": "Sun",
    "common.athlete": "Athlete",
    "common.user": "User",
    "common.admin": "Admin",
    "common.unnamed": "(unnamed)",
    "alerts.invalidSession": "Invalid session. Please log in again.",
    "alerts.fillRequired": "Fill in at least Date, Time and Type.",
    "alerts.selectSpecificUser": "As admin, first select a specific user (not 'All') from the View menu.",
    "alerts.workoutUpdated": "Workout updated ✅",
    "alerts.confirmDeleteWorkout": "Do you want to delete this workout?",
    "alerts.editMode": "Edit mode: now change the fields and then press SAVE ✅",
    "alerts.supabaseSaveFailed": "Unable to save the value to Supabase.",
    "alerts.supabaseDeleteFailed": "Unable to remove the value from Supabase.",
    "admin.athleteColorSwatch": "Athlete color {color}",
    "list.prevDay": "Previous day",
    "list.nextDay": "Next day",
    "profile.avatarAlt": "Avatar",
    "calendar.legendAria": "Calendar color legend",
    "export.colDate": "Date",
    "export.colTime": "Time",
    "export.colType": "Type",
    "export.colDuration": "Duration",
    "export.colDurationMin": "Duration_min",
    "export.colParticipants": "Participants",
    "export.colCoach": "Coach",
    "export.colCreatedBy": "Created_by",
    "export.colCreatedBySpaced": "Created by",
    "export.sheetDay": "Day",
    "export.sheetPeriod": "Period",
    "export.reportTitle": "Workout report",
    "export.periodLabel": "Period",
    "common.minutes": "min",
    "common.minutesShort": "m",
    "dash.customRangeLower": "custom",
  },
  de: {
    "app.title": "Trainings",
    "app.brand": "Trainings",
    "auth.title": "Login / Registrierung",
    "auth.fullNamePh": "Vollständiger Name (nur Registrierung)",
    "auth.emailPh": "E-Mail",
    "auth.passwordPh": "Passwort",
    "auth.loginBtn": "Login",
    "auth.registerBtn": "Registrieren",
    "auth.logoutBtn": "Abmelden",
    "auth.registered": "Registrierung abgeschlossen!",
    "auth.whoamiAdmin": "👑 {name} (Admin)",
    "auth.whoamiUser": "👤 {name}",
    "admin.title": "Admin",
    "admin.description": "Verwalte Trainer und Trainingstypen in den Dropdown-Menüs.",
    "admin.activeAthlete": "Aktive Athletin",
    "admin.all": "Alle",
    "admin.allFemale": "Alle",
    "admin.allAthletes": "Alle Athletinnen",
    "admin.mySessions": "Meine Einheiten",
    "admin.coaches": "Trainer",
    "admin.trainingTypes": "Trainingstypen",
    "admin.newCoach": "Neuer Trainer",
    "admin.newTrainingType": "Neuer Trainingstyp",
    "admin.athleteColor": "Athletinnenfarbe",
    "admin.saveColor": "Farbe speichern",
    "admin.selectAthlete": "Athletin wählen",
    "admin.selectAthleteAndColor": "Wähle eine Athletin und eine gültige Farbe.",
    "admin.athleteColorHelp": "Als Admin kannst du die Kalenderfarbe für jede Athletin wählen und speichern.",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Kalender",
    "nav.list": "Liste",
    "nav.profile": "Profil",
    "stats.sessions": "Einheiten",
    "stats.totalHours": "Gesamtstunden",
    "stats.avgParticipants": "Ø Teilnehmer",
    "stats.hours": "Stunden",
    "stats.average": "Durchschnitt",
    "dash.period": "Zeitraum",
    "dash.thisMonth": "Dieser Monat",
    "dash.lastMonth": "Letzter Monat",
    "dash.thisYear": "Dieses Jahr",
    "dash.all": "Alle",
    "dash.customRange": "Benutzerdefinierter Zeitraum",
    "dash.goCalendar": "Zum Kalender",
    "dash.goList": "Zur Liste",
    "compare.title": "Athletinnenvergleich",
    "compare.athlete1": "Athletin 1",
    "compare.athlete2": "Athletin 2",
    "compare.error": "Fehler beim Vergleich.",
    "calendar.legend": "Die Tagesfarbe folgt der Profilfarbe der Athletin",
    "list.selectDay": "Wähle einen Tag im Kalender, um die Liste zu sehen.",
    "list.workouts": "Trainings",
    "list.workoutsOf": "Trainings am {date}",
    "list.titleWithDate": "Liste - {date}",
    "list.noWorkouts": "Keine Trainings",
    "list.loadError": "Fehler beim Laden",
    "list.details": "Details",
    "form.addWorkout": "Training hinzufügen",
    "form.editWorkout": "Training bearbeiten",
    "form.type": "Trainingstyp",
    "form.coach": "Trainer",
    "form.selectType": "Trainingstyp wählen",
    "form.selectCoach": "Trainer wählen",
    "form.date": "Datum",
    "form.time": "Uhrzeit",
    "form.startTime": "Startzeit",
    "form.duration": "Dauer (Minuten)",
    "form.durationExample": "Z. B. 60",
    "form.participants": "Teilnehmerzahl",
    "form.participantsExample": "Z. B. 10",
    "form.people": "Personen / zusätzliche Details",
    "form.peopleExample": "Z. B. Gruppe, Assistenten, kurze Notizen",
    "form.notes": "Notizen",
    "form.notesPlaceholder": "Notizen...",
    "form.save": "Speichern",
    "profile.stats": "Statistiken",
    "profile.changeAvatar": "Avatar ändern",
    "profile.updateAvatar": "Avatar aktualisieren",
    "profile.color": "Profilfarbe",
    "profile.colorSwatch": "Farbe {color}",
    "profile.selectImage": "Wähle eine Bilddatei.",
    "profile.imageTooLarge": "Bild zu groß (max. ~1,5 MB).",
    "profile.avatarUploadFailed": "Avatar-Upload fehlgeschlagen. Prüfe den Bucket \"avatars\" und die Storage-Richtlinien (403/404). Details in der Konsole.",
    "actions.add": "Hinzufügen",
    "actions.addWithIcon": "➕ Hinzufügen",
    "actions.saveWithIcon": "💾 Speichern",
    "actions.editWithIcon": "✏️ Bearbeiten",
    "actions.deleteWithIcon": "🗑 Löschen",
    "export.section": "Export",
    "export.excel": "Excel exportieren",
    "export.pdf": "PDF exportieren",
    "export.options": "Exportoptionen",
    "export.month": "Monat",
    "export.custom": "Datumsbereich",
    "export.selectMonth": "Monat wählen",
    "export.apply": "Anwenden",
    "export.selectFromTo": "Wähle 'Von' und 'Bis'.",
    "export.invalidRange": "Das 'Von'-Datum darf nicht nach 'Bis' liegen.",
    "export.applyError": "Fehler beim Anwenden des Exportzeitraums",
    "export.xlsxMissing": "XLSX-Bibliothek nicht geladen.",
    "export.noData": "Keine Daten zum Exportieren",
    "export.excelError": "Excel-Exportfehler",
    "export.pdfError": "PDF-Exportfehler",
    "weekday.mon": "Mo",
    "weekday.tue": "Di",
    "weekday.wed": "Mi",
    "weekday.thu": "Do",
    "weekday.fri": "Fr",
    "weekday.sat": "Sa",
    "weekday.sun": "So",
    "common.athlete": "Athletin",
    "common.user": "Benutzer",
    "common.admin": "Admin",
    "common.unnamed": "(ohne Namen)",
    "alerts.invalidSession": "Ungültige Sitzung. Bitte erneut anmelden.",
    "alerts.fillRequired": "Fülle mindestens Datum, Uhrzeit und Typ aus.",
    "alerts.selectSpecificUser": "Als Admin wähle zuerst einen bestimmten Benutzer (nicht 'Alle') im Menü Anzeigen.",
    "alerts.workoutUpdated": "Training aktualisiert ✅",
    "alerts.confirmDeleteWorkout": "Möchtest du dieses Training löschen?",
    "alerts.editMode": "Bearbeitungsmodus: Felder ändern und dann SPEICHERN drücken ✅",
    "alerts.supabaseSaveFailed": "Wert konnte nicht in Supabase gespeichert werden.",
    "alerts.supabaseDeleteFailed": "Wert konnte nicht aus Supabase entfernt werden.",
    "admin.athleteColorSwatch": "Athletinnenfarbe {color}",
    "list.prevDay": "Vorheriger Tag",
    "list.nextDay": "Nächster Tag",
    "profile.avatarAlt": "Avatar",
    "calendar.legendAria": "Legende der Kalenderfarben",
    "export.colDate": "Datum",
    "export.colTime": "Uhrzeit",
    "export.colType": "Typ",
    "export.colDuration": "Dauer",
    "export.colDurationMin": "Dauer_min",
    "export.colParticipants": "Teilnehmende",
    "export.colCoach": "Trainer",
    "export.colCreatedBy": "Erfasst_von",
    "export.colCreatedBySpaced": "Erfasst von",
    "export.sheetDay": "Tag",
    "export.sheetPeriod": "Zeitraum",
    "export.reportTitle": "Trainingsbericht",
    "export.periodLabel": "Zeitraum",
    "common.minutes": "Min",
    "common.minutesShort": "m",
    "dash.customRangeLower": "benutzerdefiniert",
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
    "auth.registered": "Registrácia dokončená!",
    "auth.whoamiAdmin": "👑 {name} (admin)",
    "auth.whoamiUser": "👤 {name}",
    "admin.title": "Admin",
    "admin.description": "Spravuj trénerov a typy tréningov dostupné v rozbaľovacích ponukách.",
    "admin.activeAthlete": "Aktívna atlétka",
    "admin.all": "Všetci",
    "admin.allFemale": "Všetky",
    "admin.allAthletes": "Všetky atlétky",
    "admin.mySessions": "Moje tréningy",
    "admin.coaches": "Tréneri",
    "admin.trainingTypes": "Typy tréningu",
    "admin.newCoach": "Nový tréner",
    "admin.newTrainingType": "Nový typ tréningu",
    "admin.athleteColor": "Farba atlétky",
    "admin.saveColor": "Uložiť farbu",
    "admin.selectAthlete": "Vyber atlétku",
    "admin.selectAthleteAndColor": "Vyber atlétku a platnú farbu.",
    "admin.athleteColorHelp": "Ako admin môžeš vybrať a uložiť farbu kalendára pre každú atlétku.",
    "nav.home": "Domov",
    "nav.dashboard": "Prehľad",
    "nav.calendar": "Kalendár",
    "nav.list": "Zoznam",
    "nav.profile": "Profil",
    "stats.sessions": "Tréningy",
    "stats.totalHours": "Celkové hodiny",
    "stats.avgParticipants": "Priemer účastníkov",
    "stats.hours": "Hodiny",
    "stats.average": "Priemer",
    "dash.period": "Obdobie",
    "dash.thisMonth": "Tento mesiac",
    "dash.lastMonth": "Minulý mesiac",
    "dash.thisYear": "Tento rok",
    "dash.all": "Všetko",
    "dash.customRange": "Vlastný rozsah",
    "dash.goCalendar": "Do kalendára",
    "dash.goList": "Do zoznamu",
    "compare.title": "Porovnanie atlétok",
    "compare.athlete1": "Atlétka 1",
    "compare.athlete2": "Atlétka 2",
    "compare.error": "Chyba porovnania.",
    "calendar.legend": "Farba dňa sa riadi profilovou farbou atlétky",
    "list.selectDay": "Vyber deň v kalendári na zobrazenie zoznamu.",
    "list.workouts": "Tréningy",
    "list.workoutsOf": "Tréningy dňa {date}",
    "list.titleWithDate": "Zoznam - {date}",
    "list.noWorkouts": "Žiadne tréningy",
    "list.loadError": "Chyba načítania",
    "list.details": "Detaily",
    "form.addWorkout": "Pridať tréning",
    "form.editWorkout": "Upraviť tréning",
    "form.type": "Typ tréningu",
    "form.coach": "Tréner",
    "form.selectType": "Vyber typ tréningu",
    "form.selectCoach": "Vyber trénera",
    "form.date": "Dátum",
    "form.time": "Čas",
    "form.startTime": "Začiatok",
    "form.duration": "Trvanie (minúty)",
    "form.durationExample": "Napr. 60",
    "form.participants": "Počet účastníkov",
    "form.participantsExample": "Napr. 10",
    "form.people": "Osoby / ďalšie detaily",
    "form.peopleExample": "Napr. skupina, asistenti, krátke poznámky",
    "form.notes": "Poznámky",
    "form.notesPlaceholder": "Poznámky...",
    "form.save": "Uložiť",
    "profile.stats": "Štatistiky",
    "profile.changeAvatar": "Zmeniť avatar",
    "profile.updateAvatar": "Aktualizovať avatar",
    "profile.color": "Farba profilu",
    "profile.colorSwatch": "Farba {color}",
    "profile.selectImage": "Vyber obrázkový súbor.",
    "profile.imageTooLarge": "Obrázok je príliš veľký (max ~1.5 MB).",
    "profile.avatarUploadFailed": "Nahratie avatara zlyhalo. Skontroluj bucket \"avatars\" a pravidlá Storage (403/404). Detaily sú v konzole.",
    "actions.add": "Pridať",
    "actions.addWithIcon": "➕ Pridať",
    "actions.saveWithIcon": "💾 Uložiť",
    "actions.editWithIcon": "✏️ Upraviť",
    "actions.deleteWithIcon": "🗑 Odstrániť",
    "export.section": "Export",
    "export.excel": "Exportovať Excel",
    "export.pdf": "Exportovať PDF",
    "export.options": "Možnosti exportu",
    "export.month": "Mesiac",
    "export.custom": "Rozsah dátumov",
    "export.selectMonth": "Vyber mesiac",
    "export.apply": "Použiť",
    "export.selectFromTo": "Vyber 'Od' a 'Do'.",
    "export.invalidRange": "Dátum 'Od' nemôže byť po dátume 'Do'.",
    "export.applyError": "Chyba pri použití rozsahu exportu",
    "export.xlsxMissing": "Knižnica XLSX nie je načítaná.",
    "export.noData": "Žiadne údaje na export",
    "export.excelError": "Chyba exportu Excel",
    "export.pdfError": "Chyba exportu PDF",
    "weekday.mon": "Po",
    "weekday.tue": "Ut",
    "weekday.wed": "St",
    "weekday.thu": "Št",
    "weekday.fri": "Pi",
    "weekday.sat": "So",
    "weekday.sun": "Ne",
    "common.athlete": "Atlétka",
    "common.user": "Používateľ",
    "common.admin": "Admin",
    "common.unnamed": "(bez mena)",
    "alerts.invalidSession": "Neplatná relácia. Prihlás sa znova.",
    "alerts.fillRequired": "Vyplň aspoň dátum, čas a typ.",
    "alerts.selectSpecificUser": "Ako admin najprv vyber konkrétneho používateľa (nie 'Všetci') v menu zobrazenia.",
    "alerts.workoutUpdated": "Tréning aktualizovaný ✅",
    "alerts.confirmDeleteWorkout": "Chceš odstrániť tento tréning?",
    "alerts.editMode": "Režim úprav: zmeň polia a potom stlač ULOŽIŤ ✅",
    "alerts.supabaseSaveFailed": "Hodnotu sa nepodarilo uložiť do Supabase.",
    "alerts.supabaseDeleteFailed": "Hodnotu sa nepodarilo odstrániť zo Supabase.",
    "admin.athleteColorSwatch": "Farba atlétky {color}",
    "list.prevDay": "Predchádzajúci deň",
    "list.nextDay": "Nasledujúci deň",
    "profile.avatarAlt": "Avatar",
    "calendar.legendAria": "Legenda farieb kalendára",
    "export.colDate": "Dátum",
    "export.colTime": "Čas",
    "export.colType": "Typ",
    "export.colDuration": "Trvanie",
    "export.colDurationMin": "Trvanie_min",
    "export.colParticipants": "Účastníci",
    "export.colCoach": "Tréner",
    "export.colCreatedBy": "Vytvoril",
    "export.colCreatedBySpaced": "Vytvoril",
    "export.sheetDay": "Deň",
    "export.sheetPeriod": "Obdobie",
    "export.reportTitle": "Report tréningov",
    "export.periodLabel": "Obdobie",
    "common.minutes": "min",
    "common.minutesShort": "m",
    "dash.customRangeLower": "vlastné",
  }
};

function detectLanguage() {
  const saved = localStorage.getItem("app_lang");
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
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

  // aria-label
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (key) el.setAttribute("aria-label", tr(key));
  });

  // alt
  document.querySelectorAll("[data-i18n-alt]").forEach(el => {
    const key = el.getAttribute("data-i18n-alt");
    if (key) el.setAttribute("alt", tr(key));
  });

  // document title
  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) document.title = tr(titleEl.getAttribute("data-i18n"));
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  document.documentElement.setAttribute("data-lang", currentLang);
});



async function renderProfile(){
  // Fill basic user info
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const roleEl = document.getElementById("profileRole");
  if (nameEl) nameEl.textContent = currentUser?.user_metadata?.full_name || currentUser?.email || tr("common.user");
  if (emailEl) emailEl.textContent = currentUser?.email || "—";

  try {
    const isAdmin = await getIsAdmin();
    if (roleEl) roleEl.textContent = isAdmin ? tr("common.admin") : tr("common.user");
    const adminPanel = document.getElementById("adminPanel");
    if (adminPanel) adminPanel.style.display = isAdmin ? "block" : "none";
    if (isAdmin) { await loadSharedCatalogs(); refreshAdminLists(); refreshFormOptions(); await mountAdminAthleteColorManager(); }
  } catch(_) {
    if (roleEl) roleEl.textContent = tr("common.user");
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
