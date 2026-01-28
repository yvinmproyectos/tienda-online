
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCCy-aD1EQ-IeGegOG2KjNx-WrTx6Osx90",
    authDomain: "tienda-online-d9af5.firebaseapp.com",
    projectId: "tienda-online-d9af5",
    storageBucket: "tienda-online-d9af5.firebasestorage.app",
    messagingSenderId: "401568185978",
    appId: "1:401568185978:web:a89b72db0239d52c1f85c3",
    measurementId: "G-76N6DSEN0G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testLogin() {
    console.log("Testing login for gabriel@sistema.local...");
    try {
        const userCredential = await signInWithEmailAndPassword(auth, "gabriel@sistema.local", "Tienda2025*");
        console.log("SUCCESS: Logged in as", userCredential.user.email);
    } catch (error) {
        console.error("FAILURE: Login failed:", error.code, error.message);
    }
}

testLogin().catch(console.error);
