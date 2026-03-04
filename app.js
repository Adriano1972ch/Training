// =======================
// SUPABASE CONFIG
// =======================
const SUPABASE_URL = "https://sebcxlpyqehsbgyalzmz.supabase.co";
const SUPABASE_KEY = "sb_publishable_8BwK3_2OGff5uaDRrdCfHQ_rNhUWCzE";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= DOM =================
const authDiv = document.getElementById("auth");
const appDiv = document.getElementById("app");
const listaDiv = document.getElementById("lista");
const listaTitle = document.getElementById("lista-title");

const fullNameInput = document.getElementById("full_name"); // opzionale
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

const exportBtn = document.getElementById("exportExcelBtn");

// Admin filter (opzionale: se non c'è, l'app funziona uguale)
const userFilterSelect = document.getElementById("userFilter"); // <select>
const userFilterWrap = document.getElementById("userFilterWrap"); // opzionale container

// ================= STATE =================
let currentMonth = new Date();
let allenamentiMese = [];
let giornoSelezionato = null;

let currentUser = null;
let isAdmin = false;

// "__all__" = nessun filtro (tutti)
let selectedUserId = "__all__";

// ================= UTILS =================
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function isoDate(d) {
  return d.toISOString().split("T")[0];
}

async function getIsAdmin() {
  if (!currentUser) return false;
  const { data, error } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Errore lettura ruolo:", error);
    return false;
  }
  return data?.role === "admin";
}

// Enrich senza dipendere dalla FK/embedded select
async function enrichWithProfiles(rows) {
  const ids = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean)));
  if (ids.length === 0) return rows || [];

  const { data: profs, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  if (error) {
    console.error("Errore lettura profiles:", error);
    return rows || [];
  }

  const map = new Map((profs || []).map((p) => [p.id, p.full_name]));
  return (rows || []).map((r) => ({
    ...r,
    _full_name: map.get(r.user_id) || null
  }));
}

// ================= AUTH =================
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
    options: {
      data: {
        full_name
      }
    }
  });

  if (error) alert(error.message);
  else alert("Registrazione completata");
};

document.getElementById("logoutBtn").onclick = async () => {
  await supabaseClient.auth.signOut();

  // ✅ pulizia UI / state
  currentUser = null;
  isAdmin = false;
  selectedUserId = "__all__";

  allenamentiMese = [];
  giornoSelezionato = null;

  if (listaDiv) listaDiv.innerHTML = "";
  if (listaTitle) listaTitle.textContent = "Allenamenti";

  // (opzionale) reset filtro
  if (userFilterSelect) userFilterSelect.value = "__all__";
  if (userFilterWrap) userFilterWrap.style.display = "none";

  authDiv.style.display = "block";
  appDiv.style.display = "none";
};

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    authDiv.style.display = "block";
    appDiv.style.display = "none";
    return;
  }

  currentUser = session.user;
  isAdmin = await getIsAdmin();

  authDiv.style.display = "none";
  appDiv.style.display = "block";

  // Admin: prepara dropdown utenti se presente
  if (userFilterSelect) {
    if (isAdmin) {
      if (userFilterWrap) userFilterWrap.style.display = "block";

      await populateUserFilter();
      userFilterSelect.onchange = async () => {
        selectedUserId = userFilterSelect.value || "__all__";
        // reset vista giorno quando cambi filtro (più chiaro)
        giornoSelezionato = null;
        if (listaDiv) listaDiv.innerHTML = "";
        if (listaTitle) listaTitle.textContent = "Allenamenti";
        await caricaAllenamentiMese();
      };
    } else {
      // Non-admin: nascondi filtro se esiste
      if (userFilterWrap) userFilterWrap.style.display = "none";
      userFilterSelect.innerHTML = "";
    }
  }

  await caricaAllenamentiMese();
}
checkSession();

async function populateUserFilter() {
  if (!userFilterSelect) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Errore caricamento utenti:", error);
    // fallback: almeno "Tutti"
    userFilterSelect.innerHTML = `<option value="__all__">Tutti</option>`;
    selectedUserId = "__all__";
    return;
  }

  const options = [];
  options.push(`<option value="__all__">Tutti</option>`);

  // opzionale: mostra anche "Admin (solo miei)" come scelta rapida
  if (currentUser?.id) {
    options.push(`<option value="${currentUser.id}">Admin</option>`);
  }

  (data || []).forEach((p) => {
    const label = p.full_name || "(senza nome)";
    options.push(`<option value="${p.id}">${label}</option>`);
  });

  userFilterSelect.innerHTML = options.join("\n");

  // default: tutti
  selectedUserId = "__all__";
  userFilterSelect.value = "__all__";
}

// ================= INSERIMENTO =================
form.onsubmit = async (e) => {
  e.preventDefault();

  const allenamento = {
    tipo: tipo.value,
    data: dataInput.value,
    ora_inizio: ora_inizio.value,
    durata: durata.value || null,
    numero_partecipanti: numero_partecipanti.value || null,
    persone: persone.value || null,
    note: note.value || null
    // user_id: non lo passiamo, lo mette il DB con default auth.uid()
  };

  const { error } = await supabaseClient
    .from("allenamenti")
    .insert(allenamento);

  if (error) return alert(error.message);

  form.reset();
  await caricaAllenamentiMese();
  if (giornoSelezionato) await caricaAllenamenti(giornoSelezionato);
};

// ================= CALENDARIO =================
async function caricaAllenamentiMese() {
  const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  // Provo embedded select (se hai FK), ma non ci conto: faccio enrich dopo
  let query = supabaseClient
    .from("allenamenti")
    .select("*, profiles(full_name)")
    .gte("data", isoDate(start))
    .lte("data", isoDate(end));

  if (isAdmin && selectedUserId && selectedUserId !== "__all__") {
    query = query.eq("user_id", selectedUserId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    allenamentiMese = [];
    renderCalendar();
    return;
  }

  // Enrich robusto (anche se profiles non viene embedded)
  allenamentiMese = await enrichWithProfiles(data || []);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendarTitle");
  if (!grid || !title) return;

  grid.innerHTML = "";

  title.textContent = currentMonth.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay() || 7;

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  for (let i = 1; i < firstDay; i++) grid.innerHTML += "<div></div>";

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr =
      `${currentMonth.getFullYear()}-` +
      `${String(currentMonth.getMonth() + 1).padStart(2, "0")}-` +
      `${String(d).padStart(2, "0")}`;

    const hasWorkout = allenamentiMese.some(a => a.data === dateStr);

    grid.innerHTML += `
      <div class="calendar-day ${hasWorkout ? "has-workout" : ""}"
           onclick="selezionaGiorno('${dateStr}')">
        ${d}
      </div>`;
  }
}

window.selezionaGiorno = function (data) {
  giornoSelezionato = data;
  listaTitle.textContent = `Allenamenti del ${formatDate(data)}`;
  caricaAllenamenti(data);
};

prevMonthBtn.onclick = () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  caricaAllenamentiMese();
};

nextMonthBtn.onclick = () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  caricaAllenamentiMese();
};

// ================= LISTA (CARD MOBILE) =================
async function caricaAllenamenti(data) {
  let query = supabaseClient
    .from("allenamenti")
    .select("*, profiles(full_name)")
    .eq("data", data)
    .order("ora_inizio");

  if (isAdmin && selectedUserId && selectedUserId !== "__all__") {
    query = query.eq("user_id", selectedUserId);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error(error);
    listaDiv.innerHTML = "<p>Errore caricamento</p>";
    return;
  }

  const enriched = await enrichWithProfiles(rows || []);

  listaDiv.innerHTML = "";
  if (!enriched || enriched.length === 0) {
    listaDiv.innerHTML = "<p>Nessun allenamento</p>";
    return;
  }

  enriched.forEach(a => {
    const who = (a.profiles?.full_name || a._full_name || "-");

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

        <div class="actions">
          <button onclick="modificaAllenamento('${a.id}')">✏️</button>
          <button onclick="eliminaAllenamento('${a.id}')">🗑️</button>
        </div>

      </div>
    `;
  });
}

// ================= MODIFICA =================
window.modificaAllenamento = async function (id) {
  const { data: a, error } = await supabaseClient
    .from("allenamenti")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !a) return;

  const newTipo = prompt("Tipo:", a.tipo);
  if (newTipo === null) return;

  const newData = prompt("Data (YYYY-MM-DD):", a.data);
  if (newData === null) return;

  const newOra = prompt("Ora:", a.ora_inizio);
  if (newOra === null) return;

  const newDurata = prompt("Durata (min):", a.durata ?? "");
  if (newDurata === null) return;

  const newPartecipanti = prompt("Partecipanti:", a.numero_partecipanti ?? "");
  if (newPartecipanti === null) return;

  const newTrainer = prompt("Trainer:", a.persone ?? "");
  if (newTrainer === null) return;

  const newNote = prompt("Note:", a.note ?? "");
  if (newNote === null) return;

  const { error: upErr } = await supabaseClient
    .from("allenamenti")
    .update({
      tipo: newTipo,
      data: newData,
      ora_inizio: newOra,
      durata: newDurata || null,
      numero_partecipanti: newPartecipanti || null,
      persone: newTrainer || null,
      note: newNote || null
    })
    .eq("id", id);

  if (upErr) alert(upErr.message);

  await caricaAllenamentiMese();
  if (giornoSelezionato) await caricaAllenamenti(giornoSelezionato);
};

// ================= ELIMINA =================
window.eliminaAllenamento = async function (id) {
  if (!confirm("Eliminare allenamento?")) return;

  const { error } = await supabaseClient
    .from("allenamenti")
    .delete()
    .eq("id", id);

  if (error) alert(error.message);

  await caricaAllenamentiMese();
  if (giornoSelezionato) await caricaAllenamenti(giornoSelezionato);
};

// ===============================
// EXPORT EXCEL
// ===============================
exportBtn?.addEventListener("click", async () => {
  try {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const fromDate = giornoSelezionato || isoDate(monthStart);
    const toDate = giornoSelezionato || isoDate(monthEnd);

    let query = supabaseClient
      .from("allenamenti")
      .select("*")
      .gte("data", fromDate)
      .lte("data", toDate)
      .order("data", { ascending: true })
      .order("ora_inizio", { ascending: true });

    if (isAdmin && selectedUserId && selectedUserId !== "__all__") {
      query = query.eq("user_id", selectedUserId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error(error);
      alert("Errore durante l'export");
      return;
    }
    if (!rows || rows.length === 0) {
      alert("Nessun dato da esportare");
      return;
    }

    const enriched = await enrichWithProfiles(rows);

    exportAllenamentiToExcel(enriched, { fromDate, toDate });
  } catch (err) {
    console.error(err);
    alert("Errore imprevisto durante l'export");
  }
});

function exportAllenamentiToExcel(rows, { fromDate, toDate }) {
  if (typeof XLSX === "undefined") {
    alert("Libreria XLSX non caricata. Controlla lo script in index.html.");
    return;
  }

  const formatted = rows.map((a) => {
    const who = (a._full_name || "-");
    return {
      Data: a.data ? formatDate(a.data) : "",
      Ora: a.ora_inizio || "",
      Tipo: a.tipo || "",
      Durata_min: a.durata ?? "",
      Partecipanti: a.numero_partecipanti ?? "",
      Trainer: a.persone ?? "",
      Inserito_da: isAdmin ? who : "", // admin-only
      Note: a.note ?? "",
      ID: a.id ?? ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(formatted);

  // Auto-width semplice
  const headers = Object.keys(formatted[0] || {});
  ws["!cols"] = headers.map((h) => {
    const maxLen = Math.max(h.length, ...formatted.map((r) => String(r[h] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  const wb = XLSX.utils.book_new();
  const sheetName = giornoSelezionato ? "Giorno" : "Periodo";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeFrom = fromDate.replaceAll("-", "");
  const safeTo = toDate.replaceAll("-", "");

  const fileName = giornoSelezionato
    ? `allenamenti_${safeFrom}.xlsx`
    : `allenamenti_${safeFrom}_${safeTo}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
