// =======================
// SUPABASE CONFIG
// =======================
// ⚠️ Non mettere chiavi direttamente in questo file: GitHub può bloccare il push.
// Metti URL/KEY in config.js (non committato) e leggili da window.*
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  alert("Config Supabase mancante. Crea config.js (vedi README) e ricarica la pagina.");
  throw new Error("Missing SUPABASE_URL / SUPABASE_KEY");
}

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
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendar-grid");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

const exportExcelBtn = document.getElementById("exportExcelBtn");

// Admin filter
const userFilterWrap = document.getElementById("userFilterWrap");
const userFilter = document.getElementById("userFilter");

// ================= STATE =================
let currentUser = null;
let isAdmin = false;

let selectedDate = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11

// ================= HELPERS =================
function formatDateIT(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${d}/${m}/${y}`;
}

function parseTimeToMinutes(t) {
  if (!t) return 0;
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

// ================= AUTH =================
async function refreshSession() {
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;

  if (!currentUser) {
    authDiv.style.display = "block";
    appDiv.style.display = "none";
    return;
  }

  authDiv.style.display = "none";
  appDiv.style.display = "grid";

  await checkAdmin();
  await renderAll();
}

async function checkAdmin() {
  isAdmin = false;
  userFilterWrap.style.display = "none";

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUser.id)
      .single();

    if (!error && data?.is_admin) {
      isAdmin = true;
      userFilterWrap.style.display = "flex";
      await loadUsersForFilter();
    }
  } catch (e) {
    console.warn("Admin check failed:", e);
  }
}

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert("Login fallito: " + error.message);
  else refreshSession();
});

registerBtn.addEventListener("click", async () => {
  const full_name = fullNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name }
    }
  });

  if (error) {
    alert("Registrazione fallita: " + error.message);
    return;
  }

  alert("Registrazione ok! Controlla email se richiesto.");
  refreshSession();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  refreshSession();
});

// ================= USERS FILTER (ADMIN) =================
async function loadUsersForFilter() {
  userFilter.innerHTML = `<option value="__all__">Tutti</option>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  if (error) return;

  (data || []).forEach(u => {
    const label = u.full_name || u.email || u.id;
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = label;
    userFilter.appendChild(opt);
  });
}

userFilter.addEventListener("change", async () => {
  await renderAll();
});

// ================= CRUD WORKOUTS =================
async function addWorkout(payload) {
  const { error } = await supabaseClient.from("workouts").insert(payload);
  if (error) alert("Errore inserimento: " + error.message);
}

async function deleteWorkout(id) {
  const { error } = await supabaseClient.from("workouts").delete().eq("id", id);
  if (error) alert("Errore eliminazione: " + error.message);
}

async function getWorkoutsForRange(startISO, endISO) {
  // Se admin e filtro specifico, filtra per user_id
  const filterUser = isAdmin ? userFilter.value : currentUser.id;

  let q = supabaseClient
    .from("workouts")
    .select("*")
    .gte("data", startISO)
    .lte("data", endISO)
    .order("data", { ascending: true })
    .order("ora_inizio", { ascending: true });

  if (!isAdmin) {
    q = q.eq("user_id", currentUser.id);
  } else if (filterUser !== "__all__") {
    q = q.eq("user_id", filterUser);
  }

  const { data, error } = await q;
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

// ================= FORM SUBMIT =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const payload = {
    user_id: currentUser.id,
    tipo: tipo.value.trim(),
    data: dataInput.value,
    ora_inizio: ora_inizio.value,
    durata: durata.value ? Number(durata.value) : null,
    numero_partecipanti: numero_partecipanti.value ? Number(numero_partecipanti.value) : null,
    persone: persone.value.trim() || null,
    note: note.value.trim() || null,
  };

  await addWorkout(payload);
  form.reset();
  selectedDate = payload.data;
  await renderAll();
});

// ================= CALENDAR =================
function getMonthRange(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startISO = first.toISOString().slice(0, 10);
  const endISO = last.toISOString().slice(0, 10);
  return { startISO, endISO, first, last };
}

function startOfCalendarGrid(firstOfMonth) {
  // Lunedì=1 ... Domenica=0 in JS, convertiamo per griglia lun->dom
  const day = firstOfMonth.getDay(); // 0 dom, 1 lun, ... 6 sab
  const offset = (day === 0) ? 6 : (day - 1);
  const d = new Date(firstOfMonth);
  d.setDate(d.getDate() - offset);
  return d;
}

async function renderCalendar(workouts) {
  calendarGrid.innerHTML = "";
  const { first, last } = getMonthRange(currentYear, currentMonth);

  const monthName = first.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  calendarTitle.textContent = monthName[0].toUpperCase() + monthName.slice(1);

  const gridStart = startOfCalendarGrid(first);
  const totalCells = 42; // 6 settimane

  const workoutByDate = new Set(workouts.map(w => w.data));

  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);

    const iso = d.toISOString().slice(0, 10);
    const dayNum = d.getDate();
    const inMonth = d.getMonth() === currentMonth;

    const cell = document.createElement("div");
    cell.className = "calendar-day";
    cell.textContent = dayNum;

    if (!inMonth) cell.style.opacity = "0.35";
    if (workoutByDate.has(iso)) cell.classList.add("has-workout");
    if (selectedDate === iso) cell.classList.add("selected");

    cell.addEventListener("click", async () => {
      selectedDate = iso;
      await renderAll();
    });

    calendarGrid.appendChild(cell);
  }
}

prevMonthBtn.addEventListener("click", async () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  selectedDate = null;
  await renderAll();
});

nextMonthBtn.addEventListener("click", async () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  selectedDate = null;
  await renderAll();
});

// ================= LIST RENDER =================
function renderList(workouts) {
  listaDiv.innerHTML = "";

  if (selectedDate) {
    listaTitle.textContent = `Allenamenti del ${formatDateIT(selectedDate)}`;
  } else {
    listaTitle.textContent = "Allenamenti";
  }

  const filtered = selectedDate
    ? workouts.filter(w => w.data === selectedDate)
    : workouts;

  if (filtered.length === 0) {
    listaDiv.innerHTML = `<p>Nessun allenamento.</p>`;
    return;
  }

  filtered.forEach(w => {
    const row = document.createElement("div");
    row.className = "table-row";

    row.innerHTML = `
      <div><strong>Tipo:</strong> ${w.tipo || ""}</div>
      <div><strong>Data:</strong> ${formatDateIT(w.data)}</div>
      <div><strong>Ora:</strong> ${w.ora_inizio || ""}</div>
      <div><strong>Durata:</strong> ${w.durata ?? ""}</div>
      <div><strong>Partecipanti:</strong> ${w.numero_partecipanti ?? ""}</div>
      <div><strong>Con chi:</strong> ${w.persone ?? ""}</div>
      <div><strong>Note:</strong> ${w.note ?? ""}</div>
      <div style="display:flex; gap:8px;">
        <button data-del="${w.id}" style="background:#ef4444;">🗑 Elimina</button>
      </div>
    `;

    row.querySelector(`[data-del="${w.id}"]`).addEventListener("click", async () => {
      if (confirm("Eliminare questo allenamento?")) {
        await deleteWorkout(w.id);
        await renderAll();
      }
    });

    listaDiv.appendChild(row);
  });
}

// ================= EXPORT EXCEL =================
exportExcelBtn.addEventListener("click", async () => {
  const { startISO, endISO } = getMonthRange(currentYear, currentMonth);
  const workouts = await getWorkoutsForRange(startISO, endISO);

  if (!window.XLSX) {
    alert("Libreria Excel non caricata (XLSX). Controlla index.html.");
    return;
  }

  const rows = (workouts || []).map(w => ({
    Tipo: w.tipo || "",
    Data: w.data || "",
    Ora: w.ora_inizio || "",
    Durata: w.durata ?? "",
    Partecipanti: w.numero_partecipanti ?? "",
    "Con chi": w.persone ?? "",
    Note: w.note ?? ""
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Allenamenti");

  XLSX.writeFile(wb, `allenamenti_${currentYear}-${String(currentMonth + 1).padStart(2, "0")}.xlsx`);
});

// ================= MAIN RENDER =================
async function renderAll() {
  if (!currentUser) return;

  const { startISO, endISO } = getMonthRange(currentYear, currentMonth);
  const workouts = await getWorkoutsForRange(startISO, endISO);

  await renderCalendar(workouts);
  renderList(workouts);
}

// ================= BOOT =================
refreshSession();
