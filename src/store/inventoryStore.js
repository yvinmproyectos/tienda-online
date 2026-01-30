import { create } from 'zustand';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    Timestamp,
    addDoc,
    updateDoc,
    doc,
    setDoc,
    writeBatch,
    increment,
    collection as firestoreCollection
} from 'firebase/firestore';

const COLLECTION_NAME = 'products';

export const useInventoryStore = create((set, get) => ({
    products: [],
    isLoading: true,
    error: null,
    isOffline: !navigator.onLine,
    _unsubscribe: null,
    lastUpdateSource: null, // Track whether data is from 'cache' or 'server'
    lastUpdateTime: null, // Track when last update occurred

    init: () => {
        console.log("Initializing inventory store (Firestore)...");

        // Listen for online/offline status
        window.addEventListener('online', () => set({ isOffline: false }));
        window.addEventListener('offline', () => set({ isOffline: true }));
        set({ isOffline: !navigator.onLine });

        // Setup Real-time Listener with Metadata Tracking
        const q = query(collection(db, COLLECTION_NAME), where("status", "==", "active"));

        const unsubscribe = onSnapshot(q,
            { includeMetadataChanges: true }, // Enable metadata tracking for cache detection
            (snapshot) => {
                const products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const source = snapshot.metadata.fromCache ? 'cache' : 'server';
                const hasPendingWrites = snapshot.metadata.hasPendingWrites;

                console.log(`[Store] Received ${products.length} products (Source: ${source}, PendingWrites: ${hasPendingWrites})`);

                // Update UI with products, but keep loading state until server confirms
                // This ensures fast initial render from cache, then updates with fresh server data
                set({
                    products,
                    isLoading: snapshot.metadata.fromCache, // Keep loading until server data arrives
                    lastUpdateSource: source,
                    lastUpdateTime: new Date().toISOString()
                });
            },
            (error) => {
                console.error("Error in products listener:", error);
                set({ error: error.message, isLoading: false });
            }
        );

        set({ _unsubscribe: unsubscribe });

        // SAFETY: Force loading false after 3 seconds if Firestore is slow
        setTimeout(() => {
            const { isLoading } = get();
            if (isLoading) {
                console.warn("[Store] Initialization timed out (3s), forcing UI render.");
                set({ isLoading: false });
            }
        }, 3000);
    },

    cleanup: () => {
        const { _unsubscribe } = get();
        if (_unsubscribe) {
            _unsubscribe();
            set({ _unsubscribe: null });
        }
    },

    forceRefresh: () => {
        console.log("[Store] Force refresh requested - reinitializing listener...");
        const { cleanup, init } = get();
        set({ isLoading: true });
        cleanup();
        init();
    },

    // --- Actions with Optimistic Updates ---

    addProduct: async (productData) => {
        const { products } = get();

        // Check for existing product (brand, model, size, color)
        const existingProduct = products.find(p =>
            p.brand?.toLowerCase() === productData.brand?.toLowerCase() &&
            p.model?.toLowerCase() === productData.model?.toLowerCase() &&
            p.size?.toString() === productData.size?.toString() &&
            p.color?.toLowerCase() === productData.color?.toLowerCase()
        );

        if (existingProduct) {
            // Update existing product stock
            const originalQty = existingProduct.quantity;
            const newQty = originalQty + (parseInt(productData.quantity) || 0);

            // Optimistic update
            const updatedProducts = products.map(p =>
                p.id === existingProduct.id ? { ...p, quantity: newQty, updatedAt: Timestamp.now() } : p
            );
            set({ products: updatedProducts });

            try {
                const productRef = doc(db, COLLECTION_NAME, existingProduct.id);
                const movementRef = doc(firestoreCollection(db, 'inventoryMovements'));

                // Non-blocking update
                updateDoc(productRef, {
                    quantity: increment(parseInt(productData.quantity) || 0),
                    updatedAt: Timestamp.now(),
                    ...(productData.price && { price: productData.price }),
                    ...(productData.entryDate && { entryDate: productData.entryDate })
                }).catch(err => console.error("Async update error:", err));

                // Non-blocking movement log
                addDoc(firestoreCollection(db, 'inventoryMovements'), {
                    type: 'IN',
                    date: productData.entryDate || new Date().toISOString().split('T')[0],
                    productId: existingProduct.id,
                    brand: productData.brand,
                    model: productData.model,
                    size: productData.size,
                    color: productData.color,
                    quantity: parseInt(productData.quantity) || 0,
                    costUnit: parseFloat(productData.costUnit) || 0,
                    totalCost: (parseFloat(productData.costUnit) || 0) * (parseInt(productData.quantity) || 0),
                    supplierId: productData.supplierId || '',
                    supplierName: productData.supplierName || '',
                    createdAt: Timestamp.now()
                }).catch(err => console.error("Async movement error:", err));

                return { id: existingProduct.id, ...productData, quantity: newQty };
            } catch (error) {
                console.error("Error setting up update:", error);
                // Rollback
                set({ products });
                throw error;
            }
        }

        // --- NEW PRODUCT LOGIC ---
        // Pre-generate ID to avoid awaiting addDoc
        const newProductRef = doc(collection(db, COLLECTION_NAME));
        const finalId = newProductRef.id;

        const optimisticDoc = {
            ...productData,
            id: finalId,
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        set({ products: [...products, optimisticDoc] });

        try {
            // Non-blocking add
            setDoc(newProductRef, {
                ...productData,
                status: 'active',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }).catch(err => console.error("Async add error:", err));

            // Non-blocking movement log
            addDoc(firestoreCollection(db, 'inventoryMovements'), {
                type: 'IN',
                date: productData.entryDate || new Date().toISOString().split('T')[0],
                productId: finalId,
                brand: productData.brand,
                model: productData.model,
                size: productData.size,
                color: productData.color,
                quantity: parseInt(productData.quantity) || 0,
                costUnit: parseFloat(productData.costUnit) || 0,
                totalCost: (parseFloat(productData.costUnit) || 0) * (parseInt(productData.quantity) || 0),
                supplierId: productData.supplierId || '',
                supplierName: productData.supplierName || '',
                createdAt: Timestamp.now()
            }).catch(err => console.error("Async movement error:", err));

            return { id: finalId, ...productData };
        } catch (error) {
            console.error("Error setting up add:", error);
            // Rollback
            set({ products: products.filter(p => p.id !== finalId) });
            throw error;
        }
    },

    updateProduct: async (id, data) => {
        const { products } = get();
        const productIndex = products.findIndex(p => p.id === id);
        if (productIndex === -1) return;

        const originalProduct = { ...products[productIndex] };
        const updatedProduct = { ...originalProduct, ...data, updatedAt: Timestamp.now() };

        // Optimistic Update
        const newProducts = [...products];
        newProducts[productIndex] = updatedProduct;
        set({ products: newProducts });

        try {
            const productRef = doc(db, COLLECTION_NAME, id);
            // Non-blocking update
            updateDoc(productRef, {
                ...data,
                updatedAt: Timestamp.now()
            }).catch(err => console.error("Async update error:", err));
        } catch (error) {
            console.error("Error setting up update:", error);
            // Rollback
            const restoredProducts = [...get().products];
            const idx = restoredProducts.findIndex(p => p.id === id);
            if (idx !== -1) {
                restoredProducts[idx] = originalProduct;
                set({ products: restoredProducts });
            }
            throw error;
        }
    },

    deleteProduct: async (id) => {
        const { products } = get();
        const productToDelete = products.find(p => p.id === id);
        if (!productToDelete) return;

        // Optimistic Update (Soft Delete)
        set({ products: products.filter(p => p.id !== id) });

        try {
            const productRef = doc(db, COLLECTION_NAME, id);
            // Non-blocking update
            updateDoc(productRef, {
                status: 'inactive',
                updatedAt: Timestamp.now()
            }).catch(err => console.error("Async delete error:", err));
        } catch (error) {
            console.error("Error setting up delete:", error);
            // Rollback
            set({ products: [...get().products, productToDelete] });
            throw error;
        }
    },

    addProductsBatch: async (productsArray) => {
        const { products: currentProducts } = get();
        const batch = writeBatch(db);
        const productsToSet = [...currentProducts];

        // We will separate existing from new for the batch
        for (const productData of productsArray) {
            const existingIdx = productsToSet.findIndex(p =>
                p.brand?.toLowerCase() === productData.brand?.toLowerCase() &&
                p.model?.toLowerCase() === productData.model?.toLowerCase() &&
                p.size?.toString() === productData.size?.toString() &&
                p.color?.toLowerCase() === productData.color?.toLowerCase()
            );

            if (existingIdx !== -1) {
                const existing = productsToSet[existingIdx];
                const newQty = (existing.quantity || 0) + (parseInt(productData.quantity) || 0);

                // Optimistic
                productsToSet[existingIdx] = {
                    ...existing,
                    quantity: newQty,
                    updatedAt: Timestamp.now()
                };

                // Batch Update
                const productRef = doc(db, COLLECTION_NAME, existing.id);
                batch.update(productRef, {
                    quantity: increment(parseInt(productData.quantity) || 0),
                    updatedAt: Timestamp.now()
                });
            } else {
                // New Product
                const docRef = doc(collection(db, COLLECTION_NAME));
                const newProduct = {
                    ...productData,
                    id: docRef.id,
                    status: 'active',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };
                productsToSet.push(newProduct);
                batch.set(docRef, {
                    ...productData,
                    status: 'active',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
            }
        }

        // Optimistic Set
        set({ products: productsToSet });

        try {
            // Non-blocking batch commit
            batch.commit().catch(err => console.error("Async batch error:", err));

            // Record movements after successful batch setup
            const movementBatch = writeBatch(db);
            for (const productData of productsArray) {
                const movementRef = doc(firestoreCollection(db, 'inventoryMovements'));
                movementBatch.set(movementRef, {
                    type: 'IN',
                    date: productData.entryDate || new Date().toISOString().split('T')[0],
                    brand: productData.brand,
                    model: productData.model,
                    size: productData.size,
                    color: productData.color,
                    quantity: parseInt(productData.quantity) || 0,
                    costUnit: parseFloat(productData.costUnit) || 0,
                    totalCost: (parseFloat(productData.costUnit) || 0) * (parseInt(productData.quantity) || 0),
                    supplierId: productData.supplierId || '',
                    supplierName: productData.supplierName || '',
                    createdAt: Timestamp.now()
                });
            }
            // Non-blocking movement batch
            movementBatch.commit().catch(err => console.error("Async movement batch error:", err));

        } catch (error) {
            console.error("Error setting up batch:", error);
            // Rollback (Simplified)
            set({ products: currentProducts });
            throw error;
        }
    },

    // Update price and costs for all variants of a product group (same brand + model)
    updateProductGroupPrice: async (brand, model, updateData) => {
        const { products } = get();

        // Find all variants that match this brand + model
        const variantsToUpdate = products.filter(p =>
            p.brand?.toLowerCase() === brand?.toLowerCase() &&
            p.model?.toLowerCase() === model?.toLowerCase()
        );

        if (variantsToUpdate.length === 0) {
            throw new Error('No se encontraron productos para actualizar');
        }

        console.log(`[Store] Updating data for ${variantsToUpdate.length} variants:`, updateData);

        // Optimistic update
        const updatedProducts = products.map(p => {
            if (p.brand?.toLowerCase() === brand?.toLowerCase() &&
                p.model?.toLowerCase() === model?.toLowerCase()) {
                return { ...p, ...updateData, updatedAt: Timestamp.now() };
            }
            return p;
        });

        set({ products: updatedProducts });

        try {
            // Batch update in Firestore
            const batch = writeBatch(db);

            variantsToUpdate.forEach(variant => {
                const productRef = doc(db, COLLECTION_NAME, variant.id);
                batch.update(productRef, {
                    ...updateData,
                    updatedAt: Timestamp.now()
                });
            });

            // Non-blocking commit
            batch.commit().catch(err => {
                console.error("Async batch update error:", err);
                // Rollback on error
                set({ products });
            });

            return variantsToUpdate.length;
        } catch (error) {
            console.error("Error updating group data:", error);
            // Rollback
            set({ products });
            throw error;
        }
    }
}));
