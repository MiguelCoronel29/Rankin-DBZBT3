/* Login JavaScript */

let players = [];

// Escuchar cambios en la lista de jugadores de Firebase
db.ref('players').on('value', snapshot => {
    players = snapshot.val() || [];
});

function intentarLogin() {
    const userVal = document.getElementById("userLogin").value.trim();
    const passVal = document.getElementById("passLogin").value.trim();
    const errorMsg = document.getElementById("errorMessage");

    if (!userVal || !passVal) return;

    const encontrado = players.find(p => 
        p.name.toLowerCase() === userVal.toLowerCase() && 
        String(p.password) === String(passVal)
    );

    if (encontrado) {
        localStorage.setItem("logged_user", encontrado.name);
        globalThis.location.href = "index.html";
    } else {
        errorMsg.style.display = "block";
        setTimeout(() => { errorMsg.style.display = "none"; }, 3000);
    }
}

// Global export
globalThis.intentarLogin = intentarLogin;
