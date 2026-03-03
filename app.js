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
const tipo = document.getElementById("tipo");
const dataInput = document.getElementById("data");
const ora_inizio = document.getElementById("ora_inizio");
const durata = document.getElementById("durata");
const numero_partecipanti = document.getElementById("numero_partecipanti");
const persone = document.getElementById("persone");
const note = document.getElementById("note");

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
const viewIds = ["view-dashboard", "view-calendar", "view-list"];
const navButtons = Array.from(document.querySelectorAll(".nav-item"));
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

// List
const listaDiv = document.getElementById("lista");
const listaTitle = document.getElementById("lista-title");

// ================= STATE =================
let currentMonth = new Date();
let allenamentiMese = [];
let giornoSelezionato = null;

let currentUser = null;
let isAdmin = false;

let selectedUserId = "__all__"; // "__all__" = no filter

// ✅ editing mode (modifica)
let editingId = null;

// ================= UTILS =================
function isoDate(d) { return d.toISOString().split("T")[0]; }
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
    .select("id, full_name")
    .in("id", ids);
  if (error) { console.error("Errore lettura profiles:", error); return rows || []; }
  const map = new Map((profs || []).map(p => [p.id, p.full_name]));
  return (rows || []).map(r => ({ ...r, _full_name: map.get(r.user_id) || null }));
}

function clearEditingMode() {
  editingId = null;
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
  currentUser = null; isAdmin = false; selectedUserId = "__all__";
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
  opts.push(`<option value="__all__">Tutti</option>`);
  if (currentUser?.id) opts.push(`<option value="${currentUser.id}">Admin</option>`);
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
  isAdmin = await getIsAdmin();

  authDiv.style.display = "none";
  appDiv.style.display = "block";

  const display = currentUser.user_metadata?.full_name || currentUser.email || "";
  whoami.textContent = isAdmin ? `👑 ${display} (admin)` : `👤 ${display}`;

  if (userFilterSelect && userFilterWrap) {
    if (isAdmin) { userFilterWrap.style.display = "flex"; await populateUserFilter(); }
    else { userFilterWrap.style.display = "none"; }
  }

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

  const payload = {
    user_id: session.user.id, // ✅ fondamentale per FK
    tipo: tipo.value,
    data: dataInput.value,
    ora_inizio: ora_inizio.value,
    durata: durata.value || null,
    numero_partecipanti: numero_partecipanti.value || null,
    persone: persone.value || null,
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

  for (let i = 1; i < firstDay; i++) grid.innerHTML += "<div></div>";

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr =
      `${currentMonth.getFullYear()}-` +
      `${String(currentMonth.getMonth() + 1).padStart(2, "0")}-` +
      `${String(d).padStart(2, "0")}`;

    const dayRows = allenamentiMese.filter(a => a.data === dateStr);
    const hasWorkout = dayRows.length > 0;

    // Color coding by people (persone + note) robusto
    const namesText = dayRows
      .map(r => `${r.persone || ""} ${r.note || ""}`)
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
      <div class="calendar-day ${hasWorkout ? "has-workout" : ""} ${colorClass}"
           onclick="selezionaGiorno('${dateStr}')">
        ${d}
      </div>`;
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

    listaDiv.innerHTML += `
      <div class="table-row">
        <div>📅 <strong>Data:</strong> ${formatDate(a.data)}</div>
        <div>⏰ <strong>Ora:</strong> ${a.ora_inizio}</div>
        <div>🏋️ <strong>Tipo:</strong> ${a.tipo}</div>
        <div>🤝 <strong>Trainer:</strong> ${a.persone || "-"}</div>
        <div>👥 <strong>Partecipanti:</strong> ${a.numero_partecipanti || "-"}</div>
        <div>⏱ <strong>Durata:</strong> ${a.durata ? a.durata + " min" : "-"}</div>
        ${isAdmin ? `<div>👤 <strong>Inserito da:</strong> ${who}</div>` : ""}
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
  tipo.value = data.tipo || "";
  dataInput.value = data.data || "";
  ora_inizio.value = data.ora_inizio || "";
  durata.value = data.durata || "";
  numero_partecipanti.value = data.numero_partecipanti || "";
  persone.value = data.persone || "";
  note.value = data.note || "";

  // porta l'utente dove vede il form (di solito dashboard)
  showView("view-dashboard");
  form.scrollIntoView?.({ behavior: "smooth", block: "start" });

  alert("Modalità modifica: ora premi SALVA per aggiornare ✅");
};

// ================= DASHBOARD =================
function updateDashboard() {
  const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  dashPeriod.textContent = `${formatDate(isoDate(start))} → ${formatDate(isoDate(end))} (${monthLabel(currentMonth)})`;

  const rows = allenamentiMese || [];
  const sessions = rows.length;
  const totalMinutes = rows.reduce((acc, r) => acc + safeNumber(r.durata), 0);
  const hours = totalMinutes / 60;

  const participantsSum = rows.reduce((acc, r) => acc + safeNumber(r.numero_partecipanti), 0);
  const avgParticipants = sessions > 0 ? (participantsSum / sessions) : 0;

  dashSessions.textContent = String(sessions);
  dashHours.textContent = sessions > 0 ? hours.toFixed(1) : "0.0";
  dashAvgParticipants.textContent = sessions > 0 ? avgParticipants.toFixed(1) : "0.0";
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
    const doc = new jsPDF({ unit: "pt", format: "a4" });

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
