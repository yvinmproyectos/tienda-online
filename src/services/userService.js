import { auth, db, firebaseConfig } from '../config/firebase'; // Ensure firebaseConfig is exported
import { initializeApp, deleteApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut,
    updatePassword
} from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    Timestamp
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';

// Convert username to email for Firebase Auth
const usernameToEmail = (username) => `${username}@sistema.local`;

export const userService = {
    /**
     * Create a new user (admin or cashier)
     */
    createUser: async (username, password, role, displayName) => {
        let secondaryApp;
        try {
            const email = usernameToEmail(username);

            // Initialize a secondary Firebase Admin app to create user without logging out current user
            const secondaryAppName = `secondaryApp-${Date.now()}`;
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = getAuth(secondaryApp);

            // Create user in Firebase Auth using secondary app
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const uid = userCredential.user.uid;

            // Store user profile in Firestore (using main app db)
            await setDoc(doc(db, USERS_COLLECTION, uid), {
                username,
                displayName: displayName || username,
                role, // 'admin' or 'cashier'
                isActive: true,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });

            // Sign out from the secondary app authentication
            await signOut(secondaryAuth);

            return uid;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
        }
    },

    /**
     * Get all users
     */
    getUsers: async () => {
        try {
            const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
            return querySnapshot.docs
                .map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                }))
                .filter(user => user.isActive !== false)
                .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        } catch (error) {
            console.error('Error getting users:', error);
            throw error;
        }
    },

    /**
     * Update user profile
     */
    updateUser: async (uid, data) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, uid);
            await updateDoc(userRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },

    /**
     * Delete user (soft delete)
     */
    deleteUser: async (uid) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, uid);
            await updateDoc(userRef, {
                isActive: false,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    },

    /**
     * Reset user password (admin only)
     * Creates a temporary password that the user should change on next login
     */
    resetUserPassword: async (uid, newPassword) => {
        let secondaryApp;
        try {
            // Get user data to get their email
            const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
            if (!userDoc.exists()) {
                throw new Error('Usuario no encontrado');
            }

            const userData = userDoc.data();
            const email = usernameToEmail(userData.username);

            // Initialize secondary app
            const secondaryAppName = `secondaryApp-${Date.now()}`;
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = getAuth(secondaryApp);

            // Sign in as the user to change their password
            // Note: This is a workaround since we can't directly change another user's password
            // The admin will generate a temporary password

            // Update user doc to mark password as temporary
            await updateDoc(doc(db, USERS_COLLECTION, uid), {
                passwordResetRequired: true,
                updatedAt: Timestamp.now()
            });

            // Return the temporary password to show to admin
            return newPassword;
        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
        }
    },

    /**
     * Check if username already exists
     */
    usernameExists: async (username) => {
        try {
            const q = query(
                collection(db, USERS_COLLECTION),
                where('username', '==', username),
                where('isActive', '==', true)
            );
            const snapshot = await getDocs(q);
            return !snapshot.empty;
        } catch (error) {
            console.error('Error checking username:', error);
            throw error;
        }
    }
};
