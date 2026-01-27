import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    limit
} from 'firebase/firestore';

const SHIFTS_COLLECTION = 'cash_shifts';
const MOVEMENTS_COLLECTION = 'movements';

// --- Shift Management ---

export const openShift = async (userId, initialData) => {
    // initialData: { bs: number, usd: number }
    try {
        // 1. Check if user already has an open shift (safety check)
        const current = await getCurrentShift(userId);
        if (current) {
            throw new Error("Ya tienes un turno abierto.");
        }

        const shiftData = {
            userId,
            startTime: Timestamp.now(),
            endTime: null,
            status: 'open',
            initialBalance: {
                bs: parseFloat(initialData.bs) || 0,
                usd: parseFloat(initialData.usd) || 0
            },
            // The following will be updated by sales/movements
            finalBalance: { bs: 0, usd: 0 }, // System calculated running total
            expenses: { bs: 0, usd: 0 },
            income: { bs: 0, usd: 0 },
            sales: { bs: 0, usd: 0 } // Total sales
        };

        const docRef = await addDoc(collection(db, SHIFTS_COLLECTION), shiftData);
        return { id: docRef.id, ...shiftData };
    } catch (error) {
        console.error("Error opening shift:", error);
        throw error;
    }
};

export const getCurrentShift = async (userId) => {
    try {
        const q = query(
            collection(db, SHIFTS_COLLECTION),
            where("userId", "==", userId),
            where("status", "==", "open"),
            limit(1)
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;

        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error("Error getting current shift:", error);
        throw error;
    }
};

export const getAnyOpenShift = async () => {
    try {
        const q = query(
            collection(db, SHIFTS_COLLECTION),
            where("status", "==", "open"),
            limit(1)
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;

        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error("Error getting any open shift:", error);
        throw error;
    }
};

export const closeShift = async (shiftId, closingData) => {
    // closingData: { declaredBs: number, declaredUsd: number }
    try {
        const shiftRef = doc(db, SHIFTS_COLLECTION, shiftId);

        await updateDoc(shiftRef, {
            status: 'closed',
            endTime: Timestamp.now(),
            declaredBalance: {
                bs: parseFloat(closingData.declaredBs) || 0,
                usd: parseFloat(closingData.declaredUsd) || 0
            },
            // We can add difference calculation logic here or just store the declared
            // and let the frontend/reporting calculate the diff against system totals
        });

        return true;
    } catch (error) {
        console.error("Error closing shift:", error);
        throw error;
    }
};
