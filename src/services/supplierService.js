import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    orderBy,
    Timestamp,
    where
} from 'firebase/firestore';

const SUPPLIERS_COLLECTION = 'suppliers';

export const supplierService = {
    // Agregar un nuevo proveedor
    addSupplier: async (supplierData) => {
        try {
            const docRef = await addDoc(collection(db, SUPPLIERS_COLLECTION), {
                ...supplierData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                isActive: true
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding supplier:", error);
            throw error;
        }
    },

    // Obtener todos los proveedores activos
    getSuppliers: async () => {
        try {
            const querySnapshot = await getDocs(collection(db, SUPPLIERS_COLLECTION));
            return querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(supplier => supplier.isActive !== false) // Filter out deleted
                .sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort by name
        } catch (error) {
            console.error("Error getting suppliers:", error);
            throw error;
        }
    },

    // Actualizar proveedor
    updateSupplier: async (id, data) => {
        try {
            const supplierRef = doc(db, SUPPLIERS_COLLECTION, id);
            await updateDoc(supplierRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Error updating supplier:", error);
            throw error;
        }
    },

    // Eliminar proveedor (Soft Delete)
    deleteSupplier: async (id) => {
        try {
            const supplierRef = doc(db, SUPPLIERS_COLLECTION, id);
            await updateDoc(supplierRef, {
                isActive: false,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Error deleting supplier:", error);
            throw error;
        }
    }
};
