import { signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    hd: 'gmail.com'
});

export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Error signing in:", error);
        throw error;
    }
};

export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
        useAuthStore.getState().logout();
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
};

// Initialize listener
export const initAuthListener = () => {
    onAuthStateChanged(auth, (user) => {
        useAuthStore.getState().setUser(user);
    });
};
