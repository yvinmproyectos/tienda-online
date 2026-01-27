import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';

export const getDashboardStats = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        // 1. Get Today's Sales
        const salesRef = collection(db, 'sales');
        const todaySalesQuery = query(
            salesRef,
            where('date', '>=', todayTimestamp)
        );
        const salesSnapshot = await getDocs(todaySalesQuery);

        let totalSalesBs = 0;
        let todayOrders = 0;

        salesSnapshot.forEach(doc => {
            const data = doc.data();
            totalSalesBs += data.totalBs || 0;
            todayOrders += 1;
        });

        // 2. Get Products Stats (Total Stock & Low Stock)
        const productsRef = collection(db, 'products');
        const activeProductsQuery = query(productsRef, where('status', '==', 'active'));
        const productsSnapshot = await getDocs(activeProductsQuery);

        let totalStock = 0;
        let lowStockCount = 0;
        const lowStockThreshold = 5;

        productsSnapshot.forEach(doc => {
            const data = doc.data();
            const qty = data.quantity || 0;
            totalStock += qty;
            if (qty <= lowStockThreshold) {
                lowStockCount++;
            }
        });

        // 3. Get Recent Sales (Activity)
        const recentSalesQuery = query(
            salesRef,
            orderBy('date', 'desc'),
            limit(5)
        );
        const recentSalesSnapshot = await getDocs(recentSalesQuery);
        const recentActivity = recentSalesSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'sale',
            ...doc.data()
        }));

        return {
            todaySalesBs: totalSalesBs,
            todayOrders: todayOrders,
            totalStock: totalStock,
            lowStockCount: lowStockCount,
            recentActivity: recentActivity
        };

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
    }
};
