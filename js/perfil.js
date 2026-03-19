/* Player Profile JavaScript */

const urlParams = new URL(globalThis.location.href).searchParams;
const targetName = urlParams.get('player');
let allHistoryForPlayer = [];
let currentPage = 1;
let chartInstance = null;
let playersList = [];

if (!targetName) {
    globalThis.location.href = 'index.html';
}

// Function to handle icons/flags
function getBanderaImg(country) {
    if (!country) return "";
    const file = BANDERAS[country.toUpperCase()];
    return file ? `<img src="Imagenes/${file}" style="width:40px; border-radius:4px; border:1px solid #555;">` : "";
}

// Function to calculate delta ELO per match
function calcularDeltaELO(miELO, rivalELO, miScore, rivalScore) {
    const K = 32;
    const diff = Math.abs(miScore - rivalScore);
    const expected = 1 / (1 + Math.pow(10, (rivalELO - miELO) / 400));
    const gain = K * (miScore > rivalScore ? (1 - expected) : -expected) + (diff * 2);
    return Math.round(gain);
}

// Firebase listener
db.ref('/').on('value', snapshot => {
    const data = snapshot.val();
    playersList = data.players || [];
    const fullHistory = data.history || [];
    const player = playersList.find(p => p.name === targetName);

    if (!player) {
        document.getElementById('pName').textContent = "Guerrero no encontrado";
        return;
    }

    // Header with Flag
    document.getElementById('pName').innerHTML = `${getBanderaImg(player.country)} <span>${player.name}</span>`;

    let rachaIcon = '-';
    if (player.streak > 0) rachaIcon = '🔥 ' + player.streak;
    else if (player.streak < 0) rachaIcon = '💀 ' + Math.abs(player.streak);

    document.getElementById('pStats').innerHTML = `
        <div class="stat-card"><b>Poder Total</b><span class="highlight">${Math.round(player.elo)}</span></div>
        <div class="stat-card"><b>Victorias</b><span>${player.wins}</span></div>
        <div class="stat-card"><b>Derrotas</b><span>${player.losses}</span></div>
        <div class="stat-card"><b>Racha Actual</b><span>${rachaIcon}</span></div>
    `;

    allHistoryForPlayer = fullHistory.filter(h => h.p1 === targetName || h.p2 === targetName);
   
    renderHistory();
    renderChart(playersList, fullHistory);
});

function renderHistory() {
    const listEl = document.getElementById('pHistory');
    const pagEl = document.getElementById('pPagination');
    listEl.innerHTML = "";
   
    const start = (currentPage - 1) * PAGE_SIZE;
    const currentItems = allHistoryForPlayer.slice(start, start + PAGE_SIZE);

    currentItems.forEach(h => {
        const isP1 = h.p1 === targetName;
        const win = (isP1 && h.s1 > h.s2) || (!isP1 && h.s2 > h.s1);
        const rivalName = isP1 ? h.p2 : h.p1;
        const miScore = isP1 ? h.s1 : h.s2;
        const rivalScore = isP1 ? h.s2 : h.s1;
        const marcador = `${h.s1} - ${h.s2}`;

        // Calculate delta ELO
        const playerData = playersList.find(p => p.name === targetName);
        const rivalData = playersList.find(p => p.name === rivalName);
        const miELO = playerData ? playerData.elo : 500;
        const rivalELO = rivalData ? rivalData.elo : 500;
        const delta = calcularDeltaELO(miELO, rivalELO, miScore, rivalScore);
        const deltaText = win 
            ? `<div class="delta positive">+${delta} ELO</div>`
            : `<div class="delta negative">${delta} ELO</div>`;

        const li = document.createElement('li');
        li.className = `history-item ${win ? 'win' : 'loss'}`;
        li.innerHTML = `
            <div style="flex:1;">
                <b style="color:${win ? '#4caf50' : '#f44336'}">${win ? 'VICTORIA' : 'DERROTA'}</b><br>
                <small style="color:#888">vs ${rivalName}</small>
            </div>
            ${deltaText}
            <div style="text-align:right; font-size:1.1rem; font-weight:bold;">
                ${marcador}
            </div>
        `;
        listEl.appendChild(li);
    });

    // Pagination
    const totalPages = Math.ceil(allHistoryForPlayer.length / PAGE_SIZE);
    pagEl.innerHTML = "";
    if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            if (i === currentPage) btn.className = "active";
            btn.onclick = () => { currentPage = i; renderHistory(); };
            pagEl.appendChild(btn);
        }
    }
}

function renderChart(playersList, history) {
    const eloMap = new Map();
    playersList.forEach(p => eloMap.set(p.name, 500));
    const timeline = [{ label: 'Inicio', elo: 500 }];

    [...history].reverse().forEach(h => {
        const player1 = h.p1;
        const player2 = h.p2;
        const s1 = Number.parseInt(h.s1);
        const s2 = Number.parseInt(h.s2);
        const diff = Math.abs(s1 - s2);
       
        const pointsWin = 20 + (diff * 2);
        const pointsLoss = 15 + (diff * 2);

        if (s1 > s2) {
            if (eloMap.has(player1)) eloMap.set(player1, eloMap.get(player1) + pointsWin);
            if (eloMap.has(player2)) eloMap.set(player2, Math.max(0, eloMap.get(player2) - pointsLoss));
        } else {
            if (eloMap.has(player2)) eloMap.set(player2, eloMap.get(player2) + pointsWin);
            if (eloMap.has(player1)) eloMap.set(player1, Math.max(0, eloMap.get(player1) - pointsLoss));
        }

        if (player1 === targetName || player2 === targetName) {
            timeline.push({
                label: `vs ${player1 === targetName ? player2 : player1}`,
                elo: Math.round(eloMap.get(targetName))
            });
        }
    });

    const ctx = document.getElementById('pChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeline.map(data => data.label),
            datasets: [{
                label: 'ELO',
                data: timeline.map(data => data.elo),
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#FFD700'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#555', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}
