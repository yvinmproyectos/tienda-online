import { db } from '../config/firebase';
import {
    collection,
    getDocs,
    writeBatch,
    query,
    limit
} from 'firebase/firestore';

/**
 * System Service
 * Handles administrative tasks like data resetting
 */
export const systemService = {
    /**
     * Deletes all documents in a collection in batches of 500
     * @param {string} collectionName 
     */
    clearCollection: async (collectionName) => {
        try {
            let deletedCount = 0;
            let hasMore = true;

            while (hasMore) {
                const q = query(collection(db, collectionName), limit(500));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    hasMore = false;
                    break;
                }

                const batch = writeBatch(db);
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                deletedCount += snapshot.size;

                // If less than 500 were returned, we reached the end
                if (snapshot.size < 500) {
                    hasMore = false;
                }
            }

            console.log(`Successfully cleared ${deletedCount} documents from ${collectionName}`);
            return deletedCount;
        } catch (error) {
            console.error(`Error clearing collection ${collectionName}:`, error);
            throw error;
        }
    },

    /**
     * Resets inventory data
     */
    resetInventory: async () => {
        await systemService.clearCollection('products');
        await systemService.clearCollection('inventoryMovements');
        return true;
    },

    /**
     * Resets sales and cash data
     */
    resetSales: async () => {
        await systemService.clearCollection('sales');
        await systemService.clearCollection('cash_shifts');
        await systemService.clearCollection('movements');
        return true;
    }
};
