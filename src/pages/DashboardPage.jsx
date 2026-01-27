import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useInventoryStore } from '../store/inventoryStore';
import { getRecentSales } from '../services/saleService';
import { TrendingUp, Package, AlertTriangle, DollarSign, Clock, ShoppingCart } from 'lucide-react';

export default function DashboardPage() {
    const { products, isLoading: isProductsLoading } = useInventoryStore();
    const [recentActivity, setRecentActivity] = useState([]);
    const [isLoadingActivity, setIsLoadingActivity] = useState(true);

    useEffect(() => {
        const loadActivity = async () => {
            try {
                const sales = await getRecentSales();
                setRecentActivity(sales);
            } catch (error) {
                console.error("Error loading recent activity:", error);
            } finally {
                setIsLoadingActivity(false);
            }
        };
        loadActivity();
    }, []);

    const stats = useMemo(() => {
        const totalProducts = products.length;
        const totalStock = products.reduce((acc, p) => acc + (parseInt(p.quantity) || 0), 0);
        const lowStock = products.filter(p => (parseInt(p.quantity) || 0) < 5).length;
        const totalValue = products.reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * (parseInt(p.quantity) || 0)), 0);

        return {
            totalProducts,
            totalStock,
            lowStock,
            totalValue
        };
    }, [products]);

    const statCards = [
        {
            name: 'Total Productos',
            value: stats.totalProducts,
            icon: Package,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            name: 'Stock Total',
            value: stats.totalStock,
            icon: ShoppingCart,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
        },
        {
            name: 'Stock Bajo',
            value: stats.lowStock,
            icon: AlertTriangle,
            color: 'text-amber-600',
            bg: 'bg-amber-50'
        },
        {
            name: 'Valor Inventario',
            value: `Bs ${stats.totalValue.toLocaleString()}`,
            icon: DollarSign,
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        }
    ];

    if (isProductsLoading || isLoadingActivity) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5DADE2]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Panel de Control"
                subtitle="Resumen general de la actividad"
                icon={TrendingUp}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.name} className="bg-white p-4 rounded-3xl shadow-md shadow-slate-200/50 border-0">
                            <div className="flex items-center gap-3">
                                <div className={`${stat.bg} p-3 rounded-2xl`}>
                                    <Icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 font-medium">{stat.name}</p>
                                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Activity Section */}
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp size={20} className="text-[#5DADE2]" />
                        Actividad Reciente
                    </h2>
                </div>

                {recentActivity.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        No hay actividad reciente
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {recentActivity.map((activity) => (
                            <div key={activity.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                                        <DollarSign size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">Venta Realizada - {activity.ticketNumber}</p>
                                        <p className="text-xs text-slate-500">
                                            {activity.items?.length || 0} productos - {activity.customerName !== 'Sin Nombre' ? activity.customerName : 'Cliente General'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-600">
                                        +Bs {activity.totalBs?.toFixed(2)}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs text-slate-400 justify-end">
                                        <Clock size={12} />
                                        {activity.date?.toDate ? activity.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
