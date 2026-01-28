
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, Timestamp } from "firebase/firestore";

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

async function reactivateYvin() {
    const uid = "mJp8XYkFGifEJ54sWB8U0mu2Ckm2";
    console.log(`Reactivating user in Firestore (UID: ${uid})...`);
    try {
        await updateDoc(doc(db, "users", uid), {
            isActive: true,
            updatedAt: Timestamp.now()
        });
        console.log("SUCCESS: User reactivated.");
    } catch (error) {
        console.error("FAILURE: Reactivation failed:", error.code, error.message);
    }
}

reactivateYvin().catch(console.error);
