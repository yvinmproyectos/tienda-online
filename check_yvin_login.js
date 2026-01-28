
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

async function checkYvinState() {
    console.log("Checking Firestore for 'yvin' (unauthenticated)...");
    try {
        const q = query(collection(db, "users"), where("username", "==", "yvin"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No user with username 'yvin' found.");
        } else {
            snapshot.forEach(doc => {
                console.log("Found record:", {
                    uid: doc.id,
                    email: doc.data().email,
                    username: doc.data().username,
                    isActive: doc.data().isActive
                });
            });
        }
    } catch (error) {
        console.error("FAILED:", error.message);
    }
}

checkYvinState().catch(console.error);
