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
            // Generate a unique internal email to avoid collisions if a user with the same name was deleted/re-created
            const timestamp = Date.now();
            const internalEmail = `${username}_${timestamp}@sistema.local`;

            // Initialize a secondary Firebase Admin app to create user without logging out current user
            const secondaryAppName = `secondaryApp-${Date.now()}`;
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = getAuth(secondaryApp);

            // Create user in Firebase Auth using secondary app
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, password);
            const uid = userCredential.user.uid;

            // Store user profile in Firestore (using main app db)
            await setDoc(doc(db, USERS_COLLECTION, uid), {
                username,
                email: internalEmail, // Store the internal email for login lookup
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
     * Note: In a client-only Firebase app, administrators cannot directly change
     * another user's authentication credentials.
     * This function sets a "Reset Required" flag and stores a notification.
     * In a real production app with a backend, this would call a Cloud Function
     * which has Admin SDK privileges to actually update the Auth password.
     */
    resetUserPassword: async (uid, newPassword) => {
        try {
            // Get user data to verify existence
            const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
            if (!userDoc.exists()) {
                throw new Error('Usuario no encontrado');
            }

            const userData = userDoc.data();
            console.log(`Reset requested for ${userData.username}. Password to be set: ${newPassword}`);

            // Update user doc to mark password change as pending
            // Since we can't change Auth password here, we notify the admin
            // that a manual reset (Delete/Recreate) or a Cloud Function is required.
            await updateDoc(doc(db, USERS_COLLECTION, uid), {
                passwordResetRequired: true,
                tempPasswordValue: newPassword, // Store temporarily so admin can see/confirm
                updatedAt: Timestamp.now()
            });

            return newPassword;
        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
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
