import { db } from '../config/firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';

const SETTINGS_CACHE_KEY = 'store_settings_cache';
const SETTINGS_DOC = 'settings/store';

export const settingsService = {
    /**
     * Get settings with real-time updates
     * Returns a cleanup function to unsubscribe
     */
    subscribeToSettings: (callback) => {
        const docRef = doc(db, 'settings', 'store');

        // Setup real-time listener
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const settings = docSnap.data();
                // Update localStorage cache
                localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
                callback(settings);
            } else {
                // Return default settings
                const defaults = {
                    storeName: 'Shoes Mania',
                    storeAddress: '',
                    storePhone: '',
                    logoBase64: '',
                    receiptFooter: '¡Gracias por su compra!',
                    exchangeRate: 6.96,
                    discountPassword: 'Tienda2025*',
                    updatedAt: null
                };
                callback(defaults);
            }
        }, (error) => {
            console.error('Error in settings listener:', error);
        });

        return unsubscribe;
    },

    getSettings: async () => {
        try {
            // ALWAYS fetch from server to ensure fresh data
            // Don't use localStorage cache for initial load
            const docRef = doc(db, 'settings', 'store');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const settings = docSnap.data();
                // Update cache
                localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
                return settings;
            } else {
                // Return default settings
                const defaults = {
                    storeName: 'Shoes Mania',
                    storeAddress: '',
                    storePhone: '',
                    logoBase64: '',
                    receiptFooter: '¡Gracias por su compra!',
                    exchangeRate: 6.96,
                    discountPassword: 'Tienda2025*',
                    updatedAt: null
                };
                return defaults;
            }
        } catch (error) {
            console.error('Error getting settings:', error);
            throw error;
        }
    },

    /**
     * Clear settings cache (useful for debugging)
     */
    clearCache: () => {
        localStorage.removeItem(SETTINGS_CACHE_KEY);
        console.log('[Settings] Cache cleared');
    },

    updateSettings: async (settings) => {
        try {
            const docRef = doc(db, 'settings', 'store');

            await setDoc(docRef, {
                ...settings,
                updatedAt: Timestamp.now()
            }, { merge: true });

            // Actualizar caché
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));

            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    },

    /**
     * Convert image file to base64
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            // Check file size (max 500KB)
            if (file.size > 500 * 1024) {
                reject(new Error('El archivo es demasiado grande. Máximo 500KB'));
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    /**
     * Upload logo and save as base64
     */
    uploadLogo: async (file) => {
        try {
            const base64 = await settingsService.fileToBase64(file);
            await settingsService.updateSettings({ logoBase64: base64 });
            return base64;
        } catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
        }
    }
};
