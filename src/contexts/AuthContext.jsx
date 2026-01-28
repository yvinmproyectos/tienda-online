import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../config/firebase';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Convert username to email format for Firebase
    const usernameToEmail = (username) => `${username}@sistema.local`;

    // Login with username and password
    const login = async (username, password) => {
        try {
            let email;

            try {
                // Find the correct Auth Email for this username
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('username', '==', username), where('isActive', '==', true));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // If found in Firestore, use the stored email (which includes the unique timestamp for newer users)
                    email = querySnapshot.docs[0].data().email || usernameToEmail(username);
                } else {
                    // Fallback for edge cases or legacy admin creation logic
                    email = usernameToEmail(username);
                }
            } catch (firestoreError) {
                // If Firestore query fails (e.g., permission denied for unauthenticated users),
                // fall back to legacy email format
                console.warn('Firestore query failed, using legacy email format:', firestoreError);
                email = usernameToEmail(username);
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Load user profile from Firestore
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (userDoc.exists()) {
                setUserProfile(userDoc.data());
            }

            return { user: userCredential.user, profile: userDoc.exists() ? userDoc.data() : null };
        } catch (error) {
            // If user not found and trying to login as admin, create it
            if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') &&
                username === 'admin' && password === 'Tienda2025*') {

                console.log('Admin user not found. Creating default admin...');

                // Import userService inline to avoid circular dependency
                const { createUserWithEmailAndPassword } = await import('firebase/auth');
                const { doc: firestoreDoc, setDoc } = await import('firebase/firestore');
                const { Timestamp } = await import('firebase/firestore');

                try {
                    const email = usernameToEmail('admin');
                    const userCredential = await createUserWithEmailAndPassword(auth, email, 'Tienda2025*');
                    const uid = userCredential.user.uid;

                    // Create user profile
                    await setDoc(firestoreDoc(db, 'users', uid), {
                        username: 'admin',
                        displayName: 'Administrador',
                        role: 'admin',
                        isActive: true,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });

                    console.log('✅ Admin user created successfully!');

                    // Load profile and return
                    const userDoc = await getDoc(firestoreDoc(db, 'users', uid));
                    if (userDoc.exists()) {
                        setUserProfile(userDoc.data());
                    }

                    return { user: userCredential.user, profile: userDoc.exists() ? userDoc.data() : null };
                } catch (createError) {
                    console.error('Error creating admin user:', createError);
                    throw error; // throw original login error
                }
            }

            throw error;
        }
    };

    // Logout
    const logout = async () => {
        try {
            await signOut(auth);
            // Auth state listener will handle redirect to login
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    // Check if user is admin
    const isAdmin = () => userProfile?.role === 'admin';

    // Check if user is cashier
    const isCashier = () => userProfile?.role === 'cashier';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                try {
                    // Load user profile
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        setUserProfile(userDoc.data());
                    } else {
                        console.warn('User profile not found in Firestore');
                        // Set default profile if document doesn't exist
                        setUserProfile({ role: 'admin', username: user.email });
                    }
                } catch (error) {
                    console.error('Error loading user profile:', error);
                    // Set default profile on error to allow app to continue
                    setUserProfile({ role: 'admin', username: user.email || 'admin' });
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userProfile,
        login,
        logout,
        isAdmin,
        isCashier,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
