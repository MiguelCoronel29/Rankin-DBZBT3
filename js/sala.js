/* Battle Room JavaScript */

let miNombre = localStorage.getItem("logged_user") || "Invitado";
let salaId = "";
let miRol = "";
let finalizado = false;

function crearSala() {
    const ftLimitEl = document.getElementById('ft-limit');
    const ft = Number.parseInt(ftLimitEl.value);
    const ref = db.ref('salas').push();
    salaId = ref.key; 
    miRol = "p1";
    ref.set({ 
        p1: miNombre, s1: 0, o1: true, 
        p2: "Esperando...", s2: 0, o2: false, 
        ft: ft, activa: true 
    });
    ref.onDisconnect().update({ o1: false }); 
    iniciar();
}

function unirseASala() {
    const roomIdInput = document.getElementById('room-id-input');
    salaId = roomIdInput.value.trim();
    if (!salaId) return;
    const ref = db.ref('salas/' + salaId);
    ref.once('value', snap => {
        const data = snap.val();
        if (!data || (data.p2 !== "Esperando..." && data.p2 !== miNombre)) {
            return alert("Sala no disponible");
        }
        miRol = "p2";
        db.ref(`salas/${salaId}/o2`).onDisconnect().set(false);
        ref.update({ p2: miNombre, o2: true });
        iniciar();
    });
}

function iniciar() {
    document.getElementById('room-selector').style.display = "none";
    document.getElementById('battle-room').style.display = "block";
    document.getElementById('display-room-id').innerText = salaId;

    db.ref('salas/' + salaId).on('value', snap => {
        const data = snap.val();
        if (!data) return;

        document.getElementById('score-p1').innerText = data.s1;
        document.getElementById('score-p2').innerText = data.s2;
        document.getElementById('name-p1').innerText = data.p1;
        document.getElementById('name-p2').innerText = data.p2;

        const hayRival = (data.p2 !== "Esperando...");
        const ambosOnline = data.o1 && data.o2;
        
        const addP1Btn = document.getElementById('add-p1');
        const addP2Btn = document.getElementById('add-p2');
        if (addP1Btn) addP1Btn.disabled = !ambosOnline;
        if (addP2Btn) addP2Btn.disabled = !ambosOnline;

        if (hayRival) {
            document.getElementById('status-msg').innerText = ambosOnline ? `PELEANDO A FT ${data.ft}` : "CONEXIÓN PERDIDA - FINALIZANDO...";
            
            const rivalSeFue = (miRol === 'p1' && !data.o2) || (miRol === 'p2' && !data.o1);
            const victoriaPorPuntos = data.s1 >= data.ft || data.s2 >= data.ft;

            if ((rivalSeFue || victoriaPorPuntos) && !finalizado) {
                finalizado = true;
                if (rivalSeFue) alert("Tu oponente se ha retirado. Se guardarán los resultados actuales.");
                db.ref('salas/' + salaId).off();
                procesarFinal(data);
            }
        }
    });
}

function sumarPunto(key) {
    db.ref('salas/' + salaId).child(key).transaction(current => (current || 0) + 1);
}

function restarPunto(key) {
    db.ref('salas/' + salaId).child(key).transaction(current => (current > 0) ? current - 1 : 0);
}

function procesarFinal(data) {
    let ganador = "Empate";
    if (data.s1 > data.s2 || (data.o2 === false && data.s1 >= data.s2)) ganador = data.p1;
    else if (data.s2 > data.s1 || (data.o1 === false && data.s2 >= data.s1)) ganador = data.p2;

    document.getElementById('winner-name').innerText = ganador;
    document.getElementById('winner-overlay').style.display = "flex";

    const soyElEncargado = (miRol === 'p1' && data.o1) || (miRol === 'p2' && data.o2);
    
    if (soyElEncargado) {
        subirDatosRanking(data);
    } else {
        setTimeout(() => globalThis.location.href = 'index.html', 3000);
    }
}

function subirDatosRanking(data) {
    db.ref('/').once('value', snap => {
        const base = snap.val();
        const players = base.players || [];
        const history = base.history || [];
        
        const p1 = players.find(p => p.name === data.p1);
        const p2 = players.find(p => p.name === data.p2);

        if (p1 && p2) {
            updatePlayerStats(p1, p2, data, history);
            db.ref('players').set(players);
            db.ref('history').set(history.slice(0, 100));
        }

        setTimeout(() => {
            db.ref('salas/' + salaId).remove();
            globalThis.location.href = 'index.html';
        }, 2000);
    });
}

function updatePlayerStats(p1, p2, data, history) {
    let s1 = data.s1, s2 = data.s2;
    if (data.o1 === false && s2 <= s1) s2 = s1 + 1;
    if (data.o2 === false && s1 <= s2) s1 = s2 + 1;

    const winObj = s1 > s2 ? p1 : p2;
    const loseObj = s1 > s2 ? p2 : p1;

    const K = 32;
    const prob = 1 / (1 + Math.pow(10, (loseObj.elo - winObj.elo) / 400));
    const pts = Math.round(K * (1 - prob));

    winObj.elo += pts;
    winObj.wins++;
    winObj.streak = (winObj.streak > 0) ? winObj.streak + 1 : 1;
    
    loseObj.elo = Math.max(0, loseObj.elo - pts);
    loseObj.losses++;
    loseObj.streak = (loseObj.streak < 0) ? loseObj.streak - 1 : -1;

    history.unshift({ p1: data.p1, p2: data.p2, s1: s1, s2: s2, date: Date.now() });
}

function abandonarSala() {
    if (confirm("¿Quieres finalizar la batalla ahora?")) {
        const refSala = db.ref('salas/' + salaId);
        
        refSala.once('value', snap => {
            const data = snap.val();
            if (!data) return;

            const estaSolo = (data.p2 === "Esperando...");

            if (estaSolo) {
                refSala.remove().then(() => {
                    globalThis.location.href = 'index.html';
                });
            } else {
                db.ref(`salas/${salaId}/${miRol === 'p1' ? 'o1' : 'o2'}`).set(false);
            }
        });
    }
}

function copiarID() {
    navigator.clipboard.writeText(salaId);
    alert("ID de Sala copiado al portapapeles");
}

// Global exports
globalThis.crearSala = crearSala;
globalThis.unirseASala = unirseASala;
globalThis.sumarPunto = sumarPunto;
globalThis.restarPunto = restarPunto;
globalThis.abandonarSala = abandonarSala;
globalThis.copiarID = copiarID;
