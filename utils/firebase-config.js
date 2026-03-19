// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD_eT9VlLk_b1toTcva8w9NwU-FGjrEtEI",
    authDomain: "ranking-dbz-bt3.firebaseapp.com",
    databaseURL: "https://ranking-dbz-bt3-default-rtdb.firebaseio.com",
    projectId: "ranking-dbz-bt3",
    storageBucket: "ranking-dbz-bt3.firebasestorage.app",
    messagingSenderId: "228731370543",
    appId: "1:228731370543:web:ff3e418be283b6387edada"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
