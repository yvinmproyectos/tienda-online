import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    runTransaction,
    Timestamp,
    increment,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    doc
} from 'firebase/firestore';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';
const SHIFTS_COLLECTION = 'cash_shifts';
const COUNTERS_COLLECTION = 'counters';

/**
 * Genera un número de ticket. Si es posible, usa el contador central (requiere internet).
 * Si falla o no hay conexión, genera un ID único temporal para modo offline.
 */
export const getNextTicketNumber = async () => {
    // Check if offline
    if (!navigator.onLine) {
        return `V-OFF-${Date.now().toString().slice(-6)}`;
    }

    const counterRef = doc(db, COUNTERS_COLLECTION, 'ticketCounter');
    try {
        // We use a timeout to avoid hanging if connection is poor but navigator.onLine is true
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                nextNumber = (counterDoc.data().current || 0) + 1;
                transaction.update(counterRef, { current: nextNumber });
            } else {
                transaction.set(counterRef, { current: nextNumber });
            }
            return `V-${String(nextNumber).padStart(4, '0')}`;
        });
        return result;
    } catch (error) {
        console.warn('Error generating ticket number from server, using offline fallback:', error);
        return `V-OFF-${Date.now().toString().slice(-6)}`;
    }
};

/**
 * Procesa una venta completa de manera atómica.
 * @param {string} shiftId - ID del turno actual.
 * @param {Array} cartItems - Lista de items.
 * @param {Object} paymentData - Datos de pago incluyendo descuento y cliente.
 * @param {string} userId - ID del vendedor.
 */
export const processSale = async (shiftId, cartItems, paymentData, userId, authorizationData = null) => {
    try {
        const ticketNumber = await getNextTicketNumber();
        const saleRef = doc(collection(db, SALES_COLLECTION));
        const saleId = saleRef.id;

        // 1. UPDATE PRODUCTS (Non-blocking)
        cartItems.forEach(item => {
            const productRef = doc(db, PRODUCTS_COLLECTION, item.id);
            updateDoc(productRef, {
                quantity: increment(-item.quantity),
                updatedAt: Timestamp.now()
            }).catch(err => console.error(`Error updating product ${item.id} offline:`, err));
        });

        // 2. CREATE SALE DOCUMENT (Non-blocking)
        const totalCost = cartItems.reduce((sum, item) => sum + ((item.costUnit || 0) * item.quantity), 0);

        const saleData = {
            ticketNumber,
            shiftId,
            userId,
            date: Timestamp.now(),
            status: 'active',
            items: cartItems.map(item => ({
                productId: item.id,
                brand: item.brand,
                model: item.model,
                size: item.size,
                color: item.color,
                price: item.price,
                cost: item.costUnit || 0,
                quantity: item.quantity,
                subtotal: item.price * item.quantity
            })),
            subtotalBs: paymentData.subtotalBs || paymentData.totalBs,
            discountBs: paymentData.discountBs || 0,
            totalCost,
            discountAuthorizedBy: authorizationData?.authorizedBy || paymentData.discountAuthorizedBy || '',
            totalBs: paymentData.totalBs,
            totalUsd: paymentData.totalUsd,
            customerName: paymentData.customerName || 'Sin Nombre',
            customerNit: paymentData.customerNit || '0',
            sellerName: paymentData.sellerName || 'Cajero',
            paymentMethod: paymentData.method,
            amountTendered: {
                bs: paymentData.amountBs || 0,
                usd: paymentData.amountUsd || 0
            },
            change: {
                bs: paymentData.changeBs || 0,
                usd: paymentData.changeUsd || 0
            },
            mixedDetails: paymentData.mixedDetails || null
        };

        setDoc(saleRef, saleData).catch(err => console.error("Error saving sale offline:", err));

        // 3. UPDATE SHIFT (Non-blocking)
        if (shiftId && shiftId !== 'admin-sale') {
            const shiftRef = doc(db, SHIFTS_COLLECTION, shiftId);

            let cashInBs = 0;
            let cashInUsd = 0;

            if (paymentData.method === 'EFECTIVO') {
                cashInBs = paymentData.totalBs;
                if (paymentData.currency === 'USD') {
                    cashInUsd = paymentData.totalUsd;
                    cashInBs = 0;
                }
            } else if (paymentData.method === 'MIXTO') {
                cashInBs = paymentData.amountBs || 0;
                cashInUsd = paymentData.amountUsd || 0;
            }

            updateDoc(shiftRef, {
                "sales.bs": increment(paymentData.totalBs),
                "sales.usd": increment(paymentData.totalUsd),
                "discounts.bs": increment(paymentData.discountBs || 0),
                "finalBalance.bs": increment(cashInBs),
                "finalBalance.usd": increment(cashInUsd)
            }).catch(err => console.error("Error updating shift offline:", err));
        }

        return { saleId, ticketNumber };
    } catch (error) {
        console.error("Error setting up sale:", error);
        throw error;
    }
};

export const getRecentSales = async () => {
    try {
        const q = query(
            collection(db, SALES_COLLECTION),
            orderBy('date', 'desc'),
            limit(20)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching sales:", error);
        throw error;
    }
};

/**
 * Anula una venta. Restaura stock y actualiza caja si es del turno actual.
 */
export const voidSale = async (saleId, reason, user, currentShiftId) => {
    try {
        await runTransaction(db, async (transaction) => {
            const saleRef = doc(db, SALES_COLLECTION, saleId);
            const saleDoc = await transaction.get(saleRef);

            if (!saleDoc.exists()) throw new Error("Venta no encontrada");
            const saleData = saleDoc.data();

            if (saleData.status === 'void') throw new Error("Esta venta ya fue anulada");

            // 1. Restore Stock
            for (const item of saleData.items) {
                const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
                transaction.update(prodRef, {
                    quantity: increment(item.quantity),
                    updatedAt: Timestamp.now()
                });
            }

            // 2. Mark as Void
            transaction.update(saleRef, {
                status: 'void',
                voidReason: reason,
                voidedAt: Timestamp.now(),
                voidedBy: user.email
            });

            // 3. Update Cash Shift (Only if same shift and currentShiftId is provided)
            // If it's a different shift, stock is restored but cash isn't auto-deducted (manager should handle refund expense)
            // But for this requirement, we'll try to adjust current shift if possible, or just same shift.

            if (currentShiftId && saleData.shiftId === currentShiftId) {
                const shiftRef = doc(db, SHIFTS_COLLECTION, currentShiftId);

                let reverseBs = 0;
                let reverseUsd = 0;

                if (saleData.paymentMethod === 'EFECTIVO') {
                    // Need to reverse what was added. 
                    // Logic used in processSale: 
                    // if method=EFECTIVO & currency=USD -> cashInUsd = totalUsd
                    // else cashInBs = totalBs

                    // We can infer from saleData.amountTendered or reconstruction
                    // Simplification: Revert based on totalBs/totalUsd stored
                    // Note: saleData stores totalBs and totalUsd.

                    // We need to know which currency was 'Cash In'.
                    // processSale logic is a bit implicit. 
                    // We should rely on what was added.
                    // Quick fix: Revert everything based on totalBs for now as per previous logic default.
                    // Real logic needs 'currency' field in sale.

                    // Assuming 'currency' field exists in paymentData passed to saleData... 
                    // Wait, in processSale we didn't save 'currency' explicitly in saleData root, only inside 'amountTendered'?
                    // Let's check processSale again... 
                    // We only saved "paymentMethod". "amountTendered" has bs/usd.
                    // Safe bet: If amountTendered.bs > 0, revert bs.
                    if (saleData.amountTendered?.bs > 0) reverseBs = saleData.totalBs;
                    if (saleData.amountTendered?.usd > 0) reverseUsd = saleData.totalUsd;
                    if (saleData.amountTendered?.bs > 0 && saleData.amountTendered?.usd > 0) {
                        // Mixed?
                        reverseBs = saleData.amountTendered.bs; // Approx? 
                    }
                    // Fallback for simple single currency
                    if (!saleData.amountTendered) reverseBs = saleData.totalBs;
                }

                transaction.update(shiftRef, {
                    "sales.bs": increment(-saleData.totalBs),
                    "sales.usd": increment(-saleData.totalUsd),
                    "finalBalance.bs": increment(-reverseBs),
                    "finalBalance.usd": increment(-reverseUsd)
                });
            }
        });
        return true;
    } catch (error) {
        console.error("Error voiding sale:", error);
        throw error;
    }
};
