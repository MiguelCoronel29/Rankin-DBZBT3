/* Main JavaScript for Admin Panel */

let players = [],
  history = [];
let editingId = null;
let currentPageLogs = 1;
let currentPageRanking = 1;
let isSaving = false;

// Helpers
function getRank(elo) {
  return RANKS.find((r) => elo >= r.min && elo <= r.max) || RANKS[0];
}

function getBanderaHTML(country) {
  if (!country) return "";
  const file = BANDERAS[country.toUpperCase()];
  return file ? `<img src="Imagenes/${file}" class="player-flag">` : "";
}

// Authentication
function autenticarAdmin() {
  if (sessionStorage.getItem("admin_auth") === "true") {
    auth
      ?.signInAnonymously()
      .then(() => console.log("Admin autenticado automáticamente"))
      .catch((err) => console.error("Error en auto-auth:", err));
    return;
  }

  const password = prompt("Clave de administrador:");
  if (password === "Vicky321tyler") {
    sessionStorage.setItem("admin_auth", "true");
    auth
      ?.signInAnonymously()
      .then(() => console.log("Admin autenticado correctamente"))
      .catch((err) => console.error("Error al autenticar:", err));
  } else {
    alert("Clave incorrecta");
    globalThis.location.href = "index.html";
  }
}

// Data Listeners
auth?.onAuthStateChanged((user) => {
  if (user) {
    db.ref("/").on("value", (snapshot) => {
      if (isSaving) {
        isSaving = false;
        return;
      }

      const data = snapshot.val();
      players = data?.players || [];
      history = data?.history || [];

      history.sort((a, b) => Number.parseInt(b.id) - Number.parseInt(a.id));

      renderAll();
    });
  }
});

function saveCloud() {
  isSaving = true;
  Promise.all([db.ref("players").set(players), db.ref("history").set(history)])
    .then(() => {
      console.log("Cloud Save OK");
    })
    .catch((err) => {
      console.error("Cloud Save Error:", err);
      isSaving = false;
    });
}

// Admin Actions
function addPlayer() {
  const name = document.getElementById("playerName").value.trim();
  const pass = document.getElementById("playerPass").value.trim();
  const country = document.getElementById("playerCountry").value;

  if (!name) return alert("Ingrese un nombre");
  if (pass.length < 6)
    return alert("La contraseña debe tener al menos 6 dígitos");
  if (players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return alert("El jugador ya existe");

  players.push({
    name: name,
    password: pass,
    elo: 500,
    wins: 0,
    losses: 0,
    streak: 0,
    country: country || null,
  });

  document.getElementById("playerName").value = "";
  document.getElementById("playerPass").value = "";
  document.getElementById("playerCountry").value = "";
  saveCloud();
  alert("Guerrero agregado con éxito");
}

function deletePlayer(name) {
  if (!confirm(`¿Eliminar a "${name}"?`)) return;
  players = players.filter((p) => p.name !== name);
  history = history.filter((h) => h.p1 !== name && h.p2 !== name);
  rebuild();
  saveCloud();
}

function openEdit(id) {
  editingId = id;
  let h;
  if (id.startsWith("temp-")) {
    const index = Number.parseInt(id.split("-")[1]);
    h = history[index];
  } else {
    h = history.find((x) => x.id === id);
  }

  if (h) {
    document.getElementById("editS1").value = h.s1;
    document.getElementById("editS2").value = h.s2;
    document.getElementById("editModal").classList.remove("hidden");
  }
}

function closeEdit() {
  document.getElementById("editModal").classList.add("hidden");
}

function saveEdit() {
  console.log("aqui");
  let h;
  if (editingId.startsWith("temp-")) {
    const index = parseInt(editingId.split("-")[1]);
    h = history[index];
  } else {
    h = history.find((x) => x.id === editingId);
  }

  if (h) {
    h.s1 = Number.parseInt(document.getElementById("editS1").value);
    h.s2 = Number.parseInt(document.getElementById("editS2").value);
    document.getElementById("editModal").classList.add("hidden");
    rebuild();
    saveCloud();
    alert("Resultado actualizado y estadísticas recalculadas.");
  }
}

function migrarDatosLocales() {
  const localDataRaw = localStorage.getItem("fightcade_local_data");
  if (!localDataRaw) {
    return alert("No hay datos locales para migrar.");
  }

  const localData = JSON.parse(localDataRaw);
  if (
    !confirm(
      "¿Subir datos de este navegador a Firebase? (ESTO SOBREESCRIBIRÁ TODO EN LA NUBE)",
    )
  ) {
    return;
  }

  db.ref("/")
    .set(localData)
    .then(() => alert("¡Migración exitosa!"))
    .catch((err) => alert("Error en migración: " + err.message));
}

function registerMatch() {
  const p1 = document.getElementById("p1Input").value.trim();
  const s1 = Number.parseInt(document.getElementById("s1Input").value);
  const p2 = document.getElementById("p2Input").value.trim();
  const s2 = Number.parseInt(document.getElementById("s2Input").value);

  if (!p1 || !p2 || Number.isNaN(s1) || Number.isNaN(s2))
    return alert("Complete los datos");
  if (p1 === p2) return alert("No puede ser el mismo jugador");

  const matchId = Date.now().toString();
  history.unshift({ id: matchId, p1, s1, p2, s2, timestamp: Date.now() });

  rebuild();
  saveCloud();

  document.getElementById("s1Input").value = "";
  document.getElementById("s2Input").value = "";
}

function rebuild() {
  // Reset stats
  players.forEach((p) => {
    p.elo = 500;
    p.wins = 0;
    p.losses = 0;
    p.streak = 0;
  });

  // Replay history
  [...history].reverse().forEach((match) => {
    const player1 = players.find((p) => p.name === match.p1);
    const player2 = players.find((p) => p.name === match.p2);
    if (!player1 || !player2) return;

    updateElo(player1, player2, match.s1, match.s2);
  });

  players.sort((a, b) => b.elo - a.elo);
}

function updateElo(p1, p2, s1, s2) {
  const K = 40;
  const exp1 = 1 / (1 + Math.pow(10, (p2.elo - p1.elo) / 400));
  const exp2 = 1 / (1 + Math.pow(10, (p1.elo - p2.elo) / 400));

  let score1 = 0.5,
    score2 = 0.5;
  if (s1 > s2) {
    score1 = 1;
    score2 = 0;
    p1.wins++;
    p2.losses++;
    p1.streak = Math.max(1, p1.streak + 1);
    p2.streak = Math.min(-1, p2.streak - 1);
  } else if (s2 > s1) {
    score1 = 0;
    score2 = 1;
    p2.wins++;
    p1.losses++;
    p2.streak = Math.max(1, p2.streak + 1);
    p1.streak = Math.min(-1, p1.streak - 1);
  }

  p1.elo += K * (score1 - exp1);
  p2.elo += K * (score2 - exp2);
}

// Rendering
function renderAll() {
  renderRanking();
  renderLogs();
  updateDatalist();
}

function renderRanking() {
  const el = document.getElementById("rankingPreview");
  const start = (currentPageRanking - 1) * PAGE_SIZE;
  const visibles = players.slice(start, start + PAGE_SIZE);

  el.innerHTML = visibles
    .map((p, i) => {
      const rank = getRank(p.elo);
      return `
            <tr>
                <td>${start + i + 1}</td>
                <td>${getBanderaHTML(p.country)}</td>
                <td class="player-name-col">${p.name}</td>
                <td><span class="rank-badge ${rank.class}">${rank.name}</span></td>
                <td style="font-family: var(--font-mono); font-weight: bold; color: var(--gold);">${Math.round(p.elo)}</td>
                <td style="color: var(--text-muted);"><span style="color:#4ADE80">${p.wins}</span> / <span style="color:#FC8585">${p.losses}</span></td>
                <td>${p.streak}</td>
                <td>
                    <button class="del-btn" onclick="deletePlayer('${p.name}')">🗑️</button>
                </td>
            </tr>
        `;
    })
    .join("");

  renderPagination(
    "rankingPagination",
    players.length,
    currentPageRanking,
    (p) => {
      currentPageRanking = p;
      renderRanking();
    },
  );
}

function renderLogs() {
  const el = document.getElementById("logs");
  const start = (currentPageLogs - 1) * PAGE_SIZE;
  const visibles = history.slice(start, start + PAGE_SIZE);

  el.innerHTML = visibles
    .map(
      (h, i) => `
        <div class="log">
            <span class="log-num">#${history.length - (start + i)}</span>
            <div class="log-content">
                <span class="${h.s1 > h.s2 ? "win" : "loss"}">${h.p1}</span>
                <span class="log-score">${h.s1} - ${h.s2}</span>
                <span class="${h.s2 > h.s1 ? "win" : "loss"}">${h.p2}</span>
            </div>
            <button class="edit-btn" onclick="openEdit('${h.id}')">✏️</button>
            <button class="del-btn" onclick="deleteMatch('${h.id}')">🗑️</button>
        </div>
    `,
    )
    .join("");

  renderPagination("logsPagination", history.length, currentPageLogs, (p) => {
    currentPageLogs = p;
    renderLogs();
  });
}

function renderPagination(id, totalItems, current, callback) {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const container = document.getElementById(id);
  container.innerHTML = "";
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    if (i === current) btn.className = "active";
    btn.onclick = () => callback(i);
    container.appendChild(btn);
  }
}

function updateDatalist() {
  const dl = document.getElementById("playerList");
  dl.innerHTML = players.map((p) => `<option value="${p.name}">`).join("");
}

// Global functions for inline calls
globalThis.addPlayer = addPlayer;
globalThis.deletePlayer = deletePlayer;
globalThis.registerMatch = registerMatch;
globalThis.openEdit = openEdit;
globalThis.closeEdit = closeEdit;
globalThis.saveEdit = saveEdit;
globalThis.migrarDatosLocales = migrarDatosLocales;
globalThis.deleteMatch = function (id) {
  if (!confirm("¿Eliminar pelea?")) return;
  history = history.filter((h) => h.id !== id);
  rebuild();
  saveCloud();
};

// Initialization
autenticarAdmin();
