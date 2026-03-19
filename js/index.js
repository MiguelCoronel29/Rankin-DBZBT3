/* Main JavaScript for Index Page */

let alreadyMarkedOnline = {};
let players = [], history = [];
let currentPage = 1;
let chartInstance = null;

// Helper functions
function getBanderaHTML(country) {
    if (!country) return "🏳️";
    const file = BANDERAS[country.toUpperCase()];
    return file ? `<img src="Imagenes/${file}" class="player-flag">` : "🏳️";
}

function getRank(elo) {
    return RANKS.find(r => elo >= r.min && elo <= r.max) || RANKS[0];
}

function getProgress(elo, rank) {
    if (rank.name === "S") return 100;
    return Math.max(5, Math.min(100, ((elo - rank.min) / (rank.max - rank.min)) * 100));
}

// Data Listeners
db.ref('/').on('value', snapshot => {
    const data = snapshot.val();
    players = data?.players || [];
    history = data?.history || [];

    // Sort history by ID/timestamp descending
    history.sort((a, b) => {
        const timeA = a.timestamp || Number.parseInt(a.id) || 0;
        const timeB = b.timestamp || Number.parseInt(b.id) || 0;
        return timeB - timeA;
    });

    render();
    verificarSesion();

    // Secondary Listener for Status
    db.ref('status').on('value', snapshotStatus => {
        const statusData = snapshotStatus.val() || {};
        updateStatusIndicators(statusData);
        updateCounters(statusData);
    });
});

function updateStatusIndicators(statusData) {
    document.querySelectorAll('[id^="status-"]').forEach(span => {
        const rawId = span.id.replace('status-', '');
        const playerName = rawId.replaceAll('_', '-');
        const userStatus = statusData[playerName];

        span.className = 'status-dot';
        span.innerHTML = ''; // Limpiamos cualquier emoji

        if (userStatus?.online === true) {
            span.classList.add('status-online');
        } else {
            span.classList.add('status-offline');
        }
    });
}

async function updateCounters(statusData) {
    const onlinePlayers = Object.values(statusData).filter(s => s.online === true).length;
    document.getElementById('onlineCount').innerText = onlinePlayers;

    const playersSnapshot = await db.ref('players').once('value');
    const allPlayers = playersSnapshot.val() || {};
    const totalPlayers = Object.keys(allPlayers).length;
    document.getElementById('offlineCount').innerText = totalPlayers - onlinePlayers;
}

// UI Rendering
function render() {
    const rankingEl = document.getElementById('ranking');
    const busqueda = document.getElementById('searchRanking').value.toLowerCase();

    let ordenados = [...players].sort((a, b) => b.elo - a.elo);
    let filtrados = ordenados.filter(p => p.name.toLowerCase().includes(busqueda));

    const start = (currentPage - 1) * PAGE_SIZE;
    const visibles = filtrados.slice(start, start + PAGE_SIZE);

    rankingEl.innerHTML = visibles.map((p, idx) => {
        const r = getRank(p.elo);
        const pos = ordenados.findIndex(x => x.name === p.name) + 1;
        let rachaColor = 'color:var(--text-muted)';
        if (p.streak > 0) rachaColor = 'color:#4ADE80';
        else if (p.streak < 0) rachaColor = 'color:#FC8585';
        
        let rachaIcon = '';
        if (p.streak > 0) rachaIcon = '🔥';
        else if (p.streak < 0) rachaIcon = '💀';

        return `
            <tr data-position="${pos}" style="animation-delay: ${idx * 0.04}s; cursor: pointer;" onclick="openModal('${p.name}')">
                <td>${pos}</td>
                <td style="text-align: center; padding: 14px 0px 14px 10px !important;">${getBanderaHTML(p.country)}</td>
                <td style="padding-left: 24px !important; text-align: left;">
                    <span class="player-link">
                        <span id="status-${p.name.replaceAll(/[^a-zA-Z0-9]/g, '_')}" class="status-dot status-offline"></span>
                        <span class="player-name-text">${p.name}</span>
                    </span>
                </td>
                <td><span class="rank-badge ${r.class}">${r.name}</span></td>
                <td><span class="elo-value">${Math.round(p.elo)}</span></td>
                <td>
                    <div class="progress">
                        <div class="progress-fill" style="width:${getProgress(p.elo, r)}%"></div>
                    </div>
                </td>
                <td>
                    <span class="wl-cell">
                        <span class="wl-wins">${p.wins}</span>
                        <span class="wl-sep">/</span>
                        <span class="wl-losses">${p.losses}</span>
                    </span>
                </td>
                <td><span class="streak-value" style="${rachaColor};">${rachaIcon} ${Math.abs(p.streak || 0)}</span></td>
            </tr>
        `;
    }).join("");

    renderPagination(filtrados.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    const container = document.getElementById('pagination');
    container.innerHTML = "";
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.innerText = i;
        if (i === currentPage) btn.className = "active";
        btn.onclick = () => {
            currentPage = i;
            render();
            globalThis.scrollTo({ top: 0, behavior: 'smooth' });
        };
        container.appendChild(btn);
    }
}

// Session Management
function verificarSesion() {
    const nombre = localStorage.getItem("logged_user");
    const userBar = document.getElementById("user-bar");
    const loginPrompt = document.getElementById("login-prompt");
    const nameDisplay = document.getElementById("current-user-name");

    if (nombre) {
        userBar.style.display = "flex";
        loginPrompt.style.display = "none";
        nameDisplay.innerText = nombre;

        if (!alreadyMarkedOnline[nombre]) {
            alreadyMarkedOnline[nombre] = true;
            markUserOnline(nombre);
        }
    } else {
        userBar.style.display = "none";
        loginPrompt.style.display = "block";
    }
}

function markUserOnline(nombre) {
    const statusRef = db.ref('status/' + nombre);
    statusRef.set({
        online: true,
        lastActive: firebase.database.ServerValue.TIMESTAMP,
        device: navigator.userAgent
    }).catch(err => console.error("Error marking online:", err));

    statusRef.onDisconnect().set({
        online: false,
        lastActive: firebase.database.ServerValue.TIMESTAMP
    });
}

function cerrarSesion() {
    if (confirm("¿Cerrar sesión de guerrero?")) {
        localStorage.removeItem("logged_user");
        globalThis.location.reload();
    }
}

// Modal logic
function openModal(name) {
    const p = players.find(x => x.name === name);
    if (!p) return;

    document.getElementById('modalTitle').innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap: 12px;">
            ${getBanderaHTML(p.country)}
            <span style="background: linear-gradient(135deg, var(--gold-bright), var(--orange-fire)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.25rem; text-shadow: 0 0 20px rgba(255,184,0,0.2);">${p.name.toUpperCase()}</span>
        </div>`;

    const winRate = (p.wins + p.losses) > 0 ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0;

    document.getElementById('modalStats').innerHTML = `
        <div class="modal-profile-card">
            <div class="rank-showcase">
                <span class="rank-badge ${getRank(p.elo).class}" style="transform: scale(1.3); margin-bottom: 6px; box-shadow: 0 0 30px rgba(255,184,0,0.15);">${getRank(p.elo).name}</span>
                <div class="elo-huge">${Math.round(p.elo)}</div>
                <div class="elo-label">ELO RATING TOTAL</div>
            </div>
            <div class="stats-grid">
                <div class="stat-box wins">
                    <span class="stat-value" style="color:#4ADE80">${p.wins}</span>
                    <span class="stat-label">VICTORIAS</span>
                </div>
                <div class="stat-box losses">
                    <span class="stat-value" style="color:#FC8585">${p.losses}</span>
                    <span class="stat-label">DERROTAS</span>
                </div>
                <div class="stat-box winrate">
                    <span class="stat-value" style="color:#38BDF8">${winRate}%</span>
                    <span class="stat-label">WIN RATE</span>
                </div>
            </div>
        </div>
    `;

    const ultimasPeleas = history.filter(h => h.p1 === name || h.p2 === name).slice(0, 5);
    document.getElementById('modalHistory').innerHTML = ultimasPeleas.map(h => {
        const gano = (h.p1 === name && h.s1 > h.s2) || (h.p2 === name && h.s2 > h.s1);
        return `
            <li style="padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
                <span style="color:${gano ? '#4ADE80' : '#FC8585'}; font-family:var(--font-mono); font-weight:bold;">${gano ? 'WIN ' : 'LOSS'}</span> | 
                <span style="color:var(--text-muted);">${h.p1}</span> <strong style="color:var(--gold);">${h.s1} - ${h.s2}</strong> <span style="color:var(--text-muted);">${h.p2}</span>
            </li>
        `;
    }).join("");

    document.getElementById('modalActionContainer').innerHTML = `
        <button onclick="window.location.href='perfil.html?player=${encodeURIComponent(name)}'" class="btn-primary" style="width:100%; margin-top:12px; padding: 10px;">
            VER PERFIL COMPLETO
        </button>
    `;

    document.getElementById('modal').classList.remove("hidden");
}

function closeModal() {
    document.getElementById('modal').classList.add("hidden");
}

// Event Listeners
document.getElementById('searchRanking').addEventListener('input', () => {
    currentPage = 1;
    render();
});
