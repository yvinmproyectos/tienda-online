import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    Timestamp,
    writeBatch,
    onSnapshot
} from 'firebase/firestore';

const COLLECTION_NAME = 'products';

// Schema implied:
// {
//   brand: string,
//   model: string,
//   color: string,
//   size: number,
//   costDozen: number, // Costo por docena
//   costUnit: number, // Costo unitario
//   quantity: number, // Unidades
//   totalCost: number, // calculated: costUnit * quantity
//   price: number, // Precio de venta
//   status: 'active' | 'inactive',
//   createdAt: Timestamp,
//   updatedAt: Timestamp
// }

export const addProduct = async (productData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...productData,
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        return { id: docRef.id, ...productData };
    } catch (error) {
        console.error("Error adding product: ", error);
        throw error;
    }
};

export const addProductsBatch = async (productsArray) => {
    try {
        const batch = writeBatch(db);
        const results = [];

        productsArray.forEach(productData => {
            const docRef = doc(collection(db, COLLECTION_NAME));
            const dataWithMeta = {
                ...productData,
                status: 'active',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            batch.set(docRef, dataWithMeta);
            results.push({ id: docRef.id, ...dataWithMeta });
        });

        await batch.commit();
        return results;
    } catch (error) {
        console.error("Error adding products batch: ", error);
        throw error;
    }
};

export const getProducts = async () => {
    try {
        const q = query(collection(db, COLLECTION_NAME), where("status", "==", "active"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting products: ", error);
        throw error;
    }
};

export const getProductsRealTime = (callback) => {
    const q = query(collection(db, COLLECTION_NAME), where("status", "==", "active"));
    return onSnapshot(q, (querySnapshot) => {
        const products = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(products);
    }, (error) => {
        console.error("Error in real-time products: ", error);
    });
};

export const updateProduct = async (id, data) => {
    try {
        const productRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(productRef, {
            ...data,
            updatedAt: Timestamp.now()
        });
        return { id, ...data };
    } catch (error) {
        console.error("Error updating product: ", error);
        throw error;
    }
};

export const deleteProduct = async (id) => {
    try {
        const productRef = doc(db, COLLECTION_NAME, id);
        // Soft delete
        await updateDoc(productRef, {
            status: 'inactive',
            updatedAt: Timestamp.now()
        });
        return id;
    } catch (error) {
        console.error("Error deleting product: ", error);
        throw error;
    }
};
