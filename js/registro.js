/* Registration JavaScript */

function registrarJugador() {
    const nombre = document.getElementById("regNombre").value.trim();
    const pais = document.getElementById("regPais").value;
    const pin = document.getElementById("regPin").value;
    const pinConf = document.getElementById("regPinConf").value;

    if (!nombre || !pais) return alert("Por favor, ingresa nombre y país.");
    if (pin.length < 6) return alert("La contraseña debe ser de al menos 6 caracteres.");
    if (pin !== pinConf) return alert("Las contraseñas no coinciden.");

    db.ref('players').once('value', snap => {
        let players = snap.val();
        
        if (players && !Array.isArray(players)) {
            players = Object.values(players);
        }
        players = players || [];

        const existe = players.some(p => p.name.toLowerCase() === nombre.toLowerCase());

        if (existe) {
            alert("Este nombre ya está en uso. Elige otro.");
        } else {
            const nuevoJugador = {
                name: nombre,
                country: pais,
                password: pin,
                elo: 500,
                wins: 0,
                losses: 0,
                streak: 0
            };

            players.push(nuevoJugador);
            
            db.ref('players').set(players).then(() => {
                alert("¡Registro exitoso, Guerrero! Ahora puedes iniciar sesión.");
                globalThis.location.href = 'login.html';
            }).catch(err => {
                alert("Error al registrar: " + err.message);
            });
        }
    });
}

// Global export
globalThis.registrarJugador = registrarJugador;
