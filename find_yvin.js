
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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
const db = getFirestore(app);

async function findYvin() {
    console.log("Searching for 'yvin' in Firestore...");
    const q = query(collection(db, "users"), where("username", "==", "yvin"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log("No user with username 'yvin' found in Firestore.");
    } else {
        snapshot.forEach(doc => {
            console.log("User found in Firestore:", {
                uid: doc.id,
                ...doc.data()
            });
        });
    }

    console.log("Searching for any user with email yvin@sistema.local would require Auth Admin SDK, but let's check for yvin variants in Firestore.");
}

findYvin().catch(console.error);
