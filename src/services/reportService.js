import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp
} from 'firebase/firestore';

export const reportService = {
    /**
     * Get Sales Report for a date range
     */
    getSalesReport: async (startDate, endDate) => {
        try {
            // Parse dates as LOCAL timezone by explicitly constructing Date with components
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const startDateTime = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
            const start = Timestamp.fromDate(startDateTime);


            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            const endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
            const end = Timestamp.fromDate(endDateTime);

            const q = query(
                collection(db, 'sales'),
                where('date', '>=', start),
                where('date', '<=', end),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            const sales = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out voids for "Active Sales" calculations
            const activeSales = sales.filter(s => s.status !== 'void');

            const totalBs = activeSales.reduce((sum, s) => sum + (s.totalBs || 0), 0);
            const totalUsd = activeSales.reduce((sum, s) => sum + (s.totalUsd || 0), 0);
            const discountTotal = activeSales.reduce((sum, s) => sum + (s.discountBs || 0), 0);

            // Calculate Gross Profit (Sales - Cost) usando el campo pre-calculado totalCost
            const totalCostSum = activeSales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
            const grossProfit = totalBs - totalCostSum;

            return {
                sales, // All sales (including voids for list)
                activeSalesCount: activeSales.length,
                totalBs,
                totalUsd,
                discountTotal,
                totalCost: totalCostSum,
                grossProfit
            };
        } catch (error) {
            console.error("Error fetching sales report:", error);
            throw error;
        }
    },

    /**
     * Get Inventory Valuation Report
     */
    getInventoryReport: async () => {
        try {
            const q = query(collection(db, 'products'));
            const snapshot = await getDocs(q);
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            let totalItems = 0;
            let totalCost = 0; // Purchase Value
            let totalRetail = 0; // Sales Value

            products.forEach(p => {
                const qty = parseInt(p.quantity) || 0;
                const cost = parseFloat(p.costUnit) || 0;
                const price = parseFloat(p.price) || 0;

                totalItems += qty;
                totalCost += cost * qty;
                totalRetail += price * qty;
            });

            return {
                products,
                totalItems,
                totalCost,
                totalRetail,
                potentialProfit: totalRetail - totalCost
            };
        } catch (error) {
            console.error("Error fetching inventory report:", error);
            throw error;
        }
    },

    /**
     * Get Voids Report
     */
    getVoidsReport: async () => {
        try {
            const q = query(
                collection(db, 'sales'),
                where('status', '==', 'void'),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching voids:", error);
            throw error;
        }
    },

    /**
     * Get Supplier Statistics
     */
    getSupplierStats: async () => {
        try {
            // Get all products to aggregate
            const qProducts = query(collection(db, 'products'));
            const pSnapshot = await getDocs(qProducts);
            const products = pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Group by Supplier
            const stats = {};

            products.forEach(p => {
                const supplierName = p.supplierName || 'Desconocido/Sin Proveedor';
                const supplierId = p.supplierId || 'unknown';

                if (!stats[supplierId]) {
                    stats[supplierId] = {
                        id: supplierId,
                        name: supplierName,
                        productCount: 0,
                        totalStock: 0,
                        totalCost: 0, // Inversion con este proveedor
                        totalRetail: 0
                    };
                }

                const qty = parseInt(p.quantity) || 0;
                const cost = parseFloat(p.costUnit) || 0;
                const price = parseFloat(p.price) || 0;

                stats[supplierId].productCount += 1; // Unique models
                stats[supplierId].totalStock += qty;
                stats[supplierId].totalCost += cost * qty;
                stats[supplierId].totalRetail += price * qty;
            });

            return Object.values(stats).sort((a, b) => b.totalCost - a.totalCost); // Top suppliers by investment
        } catch (error) {
            console.error("Error getting supplier stats:", error);
            throw error;
        }
    },

    /**
     * Get Top/Bottom Selling Products
     */
    getProductRanking: async (startDate, endDate, limit = 10) => {
        try {
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const startDateTime = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
            const start = Timestamp.fromDate(startDateTime);

            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            const endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
            const end = Timestamp.fromDate(endDateTime);

            const q = query(
                collection(db, 'sales'),
                where('date', '>=', start),
                where('date', '<=', end),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            const sales = snapshot.docs
                .map(doc => doc.data())
                .filter(sale => sale.status !== 'void'); // Filter voids in memory

            // Aggregate products
            const productStats = {};

            sales.forEach(sale => {
                sale.items.forEach(item => {
                    const key = `${item.brand}-${item.model}-${item.size}`;

                    if (!productStats[key]) {
                        productStats[key] = {
                            brand: item.brand,
                            model: item.model,
                            size: item.size,
                            quantitySold: 0,
                            revenue: 0
                        };
                    }

                    productStats[key].quantitySold += item.quantity;
                    productStats[key].revenue += item.subtotal;
                });
            });

            const productsArray = Object.values(productStats);

            // Sort by quantity sold
            const topProducts = [...productsArray]
                .sort((a, b) => b.quantitySold - a.quantitySold)
                .slice(0, limit);

            const bottomProducts = [...productsArray]
                .sort((a, b) => a.quantitySold - b.quantitySold)
                .slice(0, limit);

            return {
                topProducts,
                bottomProducts
            };
        } catch (error) {
            console.error("Error getting product ranking:", error);
            throw error;
        }
    },

    /**
     * Get Authorizations Report (Discounts & Voids)
     */
    getAuthorizationsReport: async (startDate, endDate) => {
        try {
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const startDateTime = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
            const start = Timestamp.fromDate(startDateTime);

            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            const endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
            const end = Timestamp.fromDate(endDateTime);

            const q = query(
                collection(db, 'sales'),
                where('date', '>=', start),
                where('date', '<=', end),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter sales with discounts
            const discountAuthorizations = sales.filter(s =>
                s.discountBs > 0
            ).map(s => ({
                type: 'DESCUENTO',
                ticketNumber: s.ticketNumber,
                date: s.date,
                amount: s.discountBs,
                authorizedBy: s.discountAuthorizedBy || 'Sistema / Vendedor',
                requiredPassword: s.discountRequiredPassword || false,
                customerName: s.customerName
            }));

            const voidAuthorizations = sales.filter(s =>
                s.status === 'void'
            ).map(s => ({
                type: 'ANULACIÓN',
                ticketNumber: s.ticketNumber,
                date: s.voidedAt || s.date,
                amount: s.totalBs,
                authorizedBy: s.voidedBy,
                reason: s.voidReason,
                customerName: s.customerName
            }));

            const allAuthorizations = [...discountAuthorizations, ...voidAuthorizations]
                .sort((a, b) => b.date?.seconds - a.date?.seconds);

            return {
                discounts: discountAuthorizations,
                voids: voidAuthorizations,
                all: allAuthorizations
            };
        } catch (error) {
            console.error("Error getting authorizations:", error);
            throw error;
        }
    },

    /**
     * Get Voids Report
     */
    getVoidsReport: async () => {
        try {
            console.log('DEBUG getVoidsReport: Starting query...');

            const q = query(
                collection(db, 'sales'),
                where('status', '==', 'void')
            );

            const snapshot = await getDocs(q);
            console.log('DEBUG getVoidsReport: Found', snapshot.docs.length, 'void sales');

            const voids = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('DEBUG void sale:', doc.id, 'voidedAt:', data.voidedAt?.toDate());
                return {
                    id: doc.id,
                    ...data
                };
            });

            // Sort in memory by voidedAt
            const sorted = voids.sort((a, b) => {
                const aTime = a.voidedAt?.seconds || 0;
                const bTime = b.voidedAt?.seconds || 0;
                return bTime - aTime; // Descending
            });

            console.log('DEBUG getVoidsReport: Returning', sorted.length, 'voids');
            return sorted;
        } catch (error) {
            console.error("Error getting voids:", error);
            throw error;
        }
    },
    /**
     * Get Stock Movements Report (Inventory Entries)
     */
    getStockMovementsReport: async (startDate, endDate) => {
        try {
            // Query by date string for the provided 'date' field (which is YYYY-MM-DD from StockEntryModal)
            const q = query(
                collection(db, 'inventoryMovements'),
                where('date', '>=', startDate),
                where('date', '<=', endDate),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching stock movements:", error);
            throw error;
        }
    }
};
