import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyApZFxD36ApNOyU88rnOkMHQ1w1E4jJj0Y",
    authDomain: "lost-and-found-644e8.firebaseapp.com",
    projectId: "lost-and-found-644e8",
    storageBucket: "lost-and-found-644e8.firebasestorage.app",
    messagingSenderId: "161578644449",
    appId: "1:161578644449:web:2b51562c54f135053558a0",
    measurementId: "G-W6ZHY7G71Q"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

