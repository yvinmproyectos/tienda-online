import React, { useState, useEffect, useMemo } from 'react';
import { reportService } from '../services/reportService';
import { userService } from '../services/userService';
import { BarChart3, TrendingUp, Package, AlertTriangle, Calendar, Building2, Store, Users, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('SALES'); // SALES, INVENTORY, SUPPLIERS, VOIDS, USERS
    const [isLoading, setIsLoading] = useState(false);

    // SALES STATE
    const getTodayDateString = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [dateRange, setDateRange] = useState({
        start: getTodayDateString(),
        end: getTodayDateString()
    });
    const [salesData, setSalesData] = useState(null);
    const [cashiers, setCashiers] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState('ALL');
    const [facebookFilter, setFacebookFilter] = useState('ALL'); // ALL, FACEBOOK, REGULAR

    // INVENTORY STATE
    const [inventoryData, setInventoryData] = useState(null);
    const [inventoryMovements, setInventoryMovements] = useState([]);
    const [inventorySubTab, setInventorySubTab] = useState('CURRENT'); // CURRENT, HISTORY
    const [historySearchTerm, setHistorySearchTerm] = useState('');

    // SUPPLIERS STATE
    const [supplierData, setSupplierData] = useState([]);

    // VOIDS STATE
    const [voidsData, setVoidsData] = useState([]);
    const [voidsFilter, setVoidsFilter] = useState({
        ticketNumber: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    // PRODUCT RANKING STATE
    const [productRanking, setProductRanking] = useState(null);
    const [rankingLimit, setRankingLimit] = useState(10);

    // AUTHORIZATIONS STATE
    const [authorizationsData, setAuthorizationsData] = useState(null);

    useEffect(() => {
        loadData();
        loadUsers();
    }, [activeTab, dateRange, inventorySubTab]);

    const loadUsers = async () => {
        try {
            const users = await userService.getUsers();
            setCashiers(users);
        } catch (error) {
            console.error("Error loading users", error);
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'SALES') {
                const data = await reportService.getSalesReport(dateRange.start, dateRange.end);
                setSalesData(data);

                const ranking = await reportService.getProductRanking(dateRange.start, dateRange.end, rankingLimit);
                setProductRanking(ranking);

                // Load authorizations
                const auths = await reportService.getAuthorizationsReport(dateRange.start, dateRange.end);
                setAuthorizationsData(auths);
            } else if (activeTab === 'USERS') {
                const data = await reportService.getSalesReport(dateRange.start, dateRange.end);
                setSalesData(data);
            } else if (activeTab === 'INVENTORY') {
                if (inventorySubTab === 'CURRENT') {
                    const data = await reportService.getInventoryReport();
                    setInventoryData(data);
                } else {
                    const data = await reportService.getStockMovementsReport(dateRange.start, dateRange.end);
                    setInventoryMovements(data);
                }
            } else if (activeTab === 'SUPPLIERS') {
                const data = await reportService.getSupplierStats();
                setSupplierData(data);
            } else if (activeTab === 'VOIDS') {
                const data = await reportService.getVoidsReport();
                setVoidsData(data);
            }
        } catch (error) {
            console.error("Error loading report:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter Sales Data by Cashier
    const filteredSalesData = useMemo(() => {
        if (!salesData) return null;
        let filteredSales = salesData.sales.filter(s => {
            // Match by username if filter is active, to consolidate re-created accounts
            const cashierMatch = selectedCashier === 'ALL' || s.username === selectedCashier || s.userId === selectedCashier;
            const facebookMatch = facebookFilter === 'ALL' ||
                (facebookFilter === 'FACEBOOK' && s.isFacebookSale) ||
                (facebookFilter === 'REGULAR' && !s.isFacebookSale);
            return cashierMatch && facebookMatch;
        });

        const activeSales = filteredSales.filter(s => s.status !== 'void');

        const totalBs = activeSales.reduce((sum, s) => sum + (s.totalBs || 0), 0);
        const totalUsd = activeSales.reduce((sum, s) => sum + (s.totalUsd || 0), 0);
        const discountTotal = activeSales.reduce((sum, s) => sum + (s.discountBs || 0), 0);

        let totalCost = 0;
        activeSales.forEach(sale => {
            sale.items.forEach(item => {
                const cost = item.cost || 0;
                const qty = item.quantity || 0;
                totalCost += cost * qty;
            });
        });

        return {
            sales: filteredSales,
            activeSalesCount: activeSales.length,
            totalBs,
            totalUsd,
            discountTotal,
            totalCost,
            grossProfit: totalBs - totalCost
        };
    }, [salesData, selectedCashier]);

    // Aggregate stats by user for comparative report
    const userComparativeData = useMemo(() => {
        if (!salesData || !cashiers) return [];

        const stats = {};

        // Initialize with all users to show those with zero sales too
        // Group by username to consolidate re-created accounts
        cashiers.forEach(user => {
            const nameKey = user.username;
            if (!stats[nameKey]) {
                stats[nameKey] = {
                    uid: user.uid, // Keep latest UID for reference
                    name: user.displayName || user.username || 'Usuario',
                    username: user.username,
                    role: user.role || 'Cajero',
                    salesCount: 0,
                    totalBs: 0,
                    totalUsd: 0,
                    totalDiscount: 0,
                    totalCost: 0,
                    grossProfit: 0
                };
            }
        });

        const activeSales = salesData.sales.filter(s => s.status !== 'void');

        activeSales.forEach(sale => {
            // Find user in stats by username if available in sale record
            // Legacy sales might not have 'username' saved at root, check POSPage save logic
            // Note: In saleService.js, only sellerName and userId were saved.
            // But we can check if sellerName matches or if userId matches 
            // Better: use username mapping or rely on sellerName if it's the identifier.

            // Let's check for username in sale record first
            const nameKey = sale.username || sale.sellerName?.replace(' (Admin)', '') || 'Desconocido';

            if (!stats[nameKey]) {
                stats[nameKey] = {
                    uid: sale.userId,
                    name: sale.sellerName || 'Desconocido',
                    username: nameKey,
                    role: 'N/A',
                    salesCount: 0,
                    totalBs: 0,
                    totalUsd: 0,
                    totalDiscount: 0,
                    totalCost: 0,
                    grossProfit: 0
                };
            }

            stats[nameKey].salesCount += 1;
            stats[nameKey].totalBs += (sale.totalBs || 0);
            stats[nameKey].totalUsd += (sale.totalUsd || 0);
            stats[nameKey].totalDiscount += (sale.discountBs || 0);
            stats[nameKey].totalCost += (sale.totalCost || 0);
        });

        return Object.values(stats).map(u => ({
            ...u,
            grossProfit: u.totalBs - u.totalCost
        })).sort((a, b) => b.totalBs - a.totalBs);
    }, [salesData, cashiers]);


    // Filter voids based on filters
    const filteredVoids = voidsData.filter(voidTx => {
        const matchesTicket = !voidsFilter.ticketNumber ||
            (voidTx.ticketNumber && voidTx.ticketNumber.toLowerCase().includes(voidsFilter.ticketNumber.toLowerCase()));

        let matchesDate = true;
        if (voidsFilter.startDate || voidsFilter.endDate) {
            const voidDate = voidTx.voidedAt?.toDate();
            if (voidDate) {
                if (voidsFilter.startDate) {
                    // Parse as local timezone
                    const [year, month, day] = voidsFilter.startDate.split('-').map(Number);
                    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                    matchesDate = matchesDate && voidDate >= startDate;
                }
                if (voidsFilter.endDate) {
                    // Parse as local timezone  
                    const [year, month, day] = voidsFilter.endDate.split('-').map(Number);
                    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
                    matchesDate = matchesDate && voidDate <= endDate;
                }
            }
        }

        return matchesTicket && matchesDate;
    });

    return (
        <div className="space-y-6">

            <PageHeader
                title="Reportes y Estadísticas"
                subtitle="Análisis detallado de ventas e inventario"
                icon={BarChart3}
                action={
                    (activeTab === 'SALES' || activeTab === 'USERS' || (activeTab === 'INVENTORY' && inventorySubTab === 'HISTORY')) && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                            {/* Cashier Filter */}
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex-1 sm:flex-initial">
                                <Users size={16} className="text-slate-400 ml-1" />
                                <select
                                    value={selectedCashier}
                                    onChange={(e) => setSelectedCashier(e.target.value)}
                                    className="text-xs md:text-sm border-none outline-none text-slate-600 font-medium bg-transparent py-0.5 pr-2 w-full"
                                >
                                    <option value="ALL">Todo el Personal</option>
                                    {cashiers.map(user => (
                                        <option key={user.uid} value={user.username}>
                                            {user.displayName || user.username || user.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Facebook Filter */}
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex-1 sm:flex-initial">
                                <Search size={16} className="text-slate-400 ml-1" />
                                <select
                                    value={facebookFilter}
                                    onChange={(e) => setFacebookFilter(e.target.value)}
                                    className="text-xs md:text-sm border-none outline-none text-slate-600 font-medium bg-transparent py-0.5 pr-2 w-full"
                                >
                                    <option value="ALL">Todo Origen</option>
                                    <option value="FACEBOOK">Facebook</option>
                                    <option value="REGULAR">Venta Local</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex-1 sm:flex-initial">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="text-xs md:text-sm border-none outline-none text-slate-600 font-medium px-1 py-0.5 w-full"
                                />
                                <span className="text-slate-400 font-bold">-</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="text-xs md:text-sm border-none outline-none text-slate-600 font-medium px-1 py-0.5 w-full"
                                />
                            </div>
                        </div>
                    )
                }
            />

            {/* TABS */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('SALES')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 justify-center ${activeTab === 'SALES' ? 'bg-[#5DADE2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <BarChart3 size={16} />
                    Ventas
                </button>
                <button
                    onClick={() => setActiveTab('INVENTORY')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 justify-center ${activeTab === 'INVENTORY' ? 'bg-[#5DADE2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <Package size={16} />
                    Inventario
                </button>
                <button
                    onClick={() => setActiveTab('SUPPLIERS')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 justify-center ${activeTab === 'SUPPLIERS' ? 'bg-[#5DADE2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <Building2 size={16} />
                    Prov.
                </button>
                <button
                    onClick={() => setActiveTab('VOIDS')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 justify-center ${activeTab === 'VOIDS' ? 'bg-[#5DADE2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <AlertTriangle size={16} />
                    Anul.
                </button>
                <button
                    onClick={() => setActiveTab('USERS')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 justify-center ${activeTab === 'USERS' ? 'bg-[#5DADE2] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <Users size={16} />
                    Personal
                </button>
            </div>

            {/* CONTENT */}
            {isLoading ? (
                <div className="h-64 flex items-center justify-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5DADE2]"></div>
                </div>
            ) : (
                <>
                    {/* --- SALES REPORT --- */}
                    {activeTab === 'SALES' && filteredSalesData && (
                        <div className="space-y-6">
                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Ventas (Bs)</div>
                                    <div className="text-2xl font-bold text-slate-900">Bs {filteredSalesData.totalBs.toFixed(2)}</div>
                                    <div className="text-xs text-emerald-600 flex items-center gap-1 mt-1 font-medium">
                                        <TrendingUp size={12} /> {filteredSalesData.activeSalesCount} transacciones
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total USD ($us)</div>
                                    <div className="text-2xl font-bold text-slate-900">$us {filteredSalesData.totalUsd.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Costo Mercadería</div>
                                    <div className="text-2xl font-bold text-slate-700">Bs {filteredSalesData.totalCost.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100 bg-emerald-50/50">
                                    <div className="text-emerald-700 text-xs font-bold uppercase mb-1">Utilidad Bruta</div>
                                    <div className="text-2xl font-bold text-emerald-600">Bs {filteredSalesData.grossProfit.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Product Ranking Section - MOVED HERE */}
                            {productRanking && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Top Products */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                            <span className="font-bold text-slate-700">🏆 Productos Más Vendidos</span>
                                            <select
                                                value={rankingLimit}
                                                onChange={(e) => setRankingLimit(parseInt(e.target.value))}
                                                className="text-sm border border-slate-300 rounded px-2 py-1"
                                            >
                                                <option value={5}>Top 5</option>
                                                <option value={10}>Top 10</option>
                                                <option value={20}>Top 20</option>
                                            </select>
                                        </div>
                                        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                                            {productRanking.topProducts.map((product, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-sm">{product.brand} {product.model}</div>
                                                            <div className="text-xs text-slate-500">{product.size} - {product.color}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-emerald-600">{product.quantitySold} vendidos</div>
                                                        <div className="text-xs text-slate-500">Bs {product.revenue.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {productRanking.topProducts.length === 0 && (
                                                <div className="text-center py-8 text-slate-400">No hay datos</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Products */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100">
                                            <span className="font-bold text-slate-700">📦 Productos Menos Vendidos</span>
                                        </div>
                                        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                                            {productRanking.bottomProducts.map((product, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-sm">{product.brand} {product.model}</div>
                                                            <div className="text-xs text-slate-500">{product.size} - {product.color}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-amber-600">{product.quantitySold} vendidos</div>
                                                        <div className="text-xs text-slate-500">Bs {product.revenue.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {productRanking.bottomProducts.length === 0 && (
                                                <div className="text-center py-8 text-slate-400">No hay datos</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Sales Detail Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 font-bold text-slate-700">Detalle de Ventas</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Fecha/Hora</th>
                                                <th className="px-4 py-3">Cliente</th>
                                                <th className="px-4 py-3">Método</th>
                                                <th className="px-4 py-3 text-right">Bs</th>
                                                <th className="px-4 py-3 text-right">USD</th>
                                                <th className="px-4 py-3 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredSalesData.sales.map(sale => (
                                                <tr key={sale.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">{sale.date?.toDate().toLocaleString()}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-900">{sale.customerName}</td>
                                                    <td className="px-4 py-3 uppercase text-xs">{sale.paymentMethod}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                        {sale.totalBs > 0 ? sale.totalBs.toFixed(2) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-500">
                                                        {sale.totalUsd > 0 ? sale.totalUsd.toFixed(2) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            {sale.status === 'void' ? (
                                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">ANULADO</span>
                                                            ) : (
                                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">OK</span>
                                                            )}
                                                            {sale.isFacebookSale && (
                                                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
                                                                    Facebook
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Authorizations Section */}
                            {authorizationsData && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100">
                                        <span className="font-bold text-slate-700">🔐 Autorizaciones (Descuentos y Anulaciones)</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                                <tr>
                                                    <th className="px-4 py-3">Tipo</th>
                                                    <th className="px-4 py-3">Ticket</th>
                                                    <th className="px-4 py-3">Fecha/Hora</th>
                                                    <th className="px-4 py-3">Cliente</th>
                                                    <th className="px-4 py-3 text-right">Monto</th>
                                                    <th className="px-4 py-3">Autorizado Por</th>
                                                    <th className="px-4 py-3">Detalles</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {authorizationsData.all.map((auth, index) => (
                                                    <tr key={index} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${auth.type === 'DESCUENTO' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                                {auth.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs font-bold">{auth.ticketNumber || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-xs">{auth.date?.toDate().toLocaleString()}</td>
                                                        <td className="px-4 py-3">{auth.customerName}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-700">Bs {auth.amount.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-xs">
                                                            {auth.authorizedBy}
                                                            {auth.requiredPassword && <span className="ml-1 text-amber-600">🔒</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs italic text-slate-500">
                                                            {auth.reason || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {authorizationsData.all.length === 0 && (
                                                    <tr>
                                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                                            No hay autorizaciones en este período
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- INVENTORY REPORT --- */}
                    {activeTab === 'INVENTORY' && (
                        <div className="space-y-6">
                            {/* Inventory Sub-Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                                <button
                                    onClick={() => setInventorySubTab('CURRENT')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${inventorySubTab === 'CURRENT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Stock Actual
                                </button>
                                <button
                                    onClick={() => setInventorySubTab('HISTORY')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${inventorySubTab === 'HISTORY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Historial de Ingresos
                                </button>
                            </div>

                            {inventorySubTab === 'CURRENT' && inventoryData && (
                                <>
                                    {/* Valuation Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Ítems (Stock)</div>
                                            <div className="text-3xl font-bold text-[#5DADE2]">{inventoryData.totalItems}</div>
                                        </div>
                                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">Valor Costo (Inversión)</div>
                                            <div className="text-2xl font-bold text-slate-900">Bs {inventoryData.totalCost.toFixed(2)}</div>
                                            <p className="text-xs text-slate-400 mt-1">Capital invertido en almacén</p>
                                        </div>
                                        <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100 bg-emerald-50/30">
                                            <div className="text-emerald-700 text-xs font-bold uppercase mb-1">Valor Venta (Proyección)</div>
                                            <div className="text-2xl font-bold text-emerald-600">Bs {inventoryData.totalRetail.toFixed(2)}</div>
                                            <p className="text-xs text-emerald-600/70 mt-1">
                                                Ganancia Potencial: <strong>Bs {inventoryData.potentialProfit.toFixed(2)}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stock List */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 font-bold text-slate-700">Inventario Actual y Valoración</div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                                    <tr>
                                                        <th className="px-4 py-3">Producto</th>
                                                        <th className="px-4 py-3">Stock</th>
                                                        <th className="px-4 py-3 text-right">Costo Unit.</th>
                                                        <th className="px-4 py-3 text-right">Total Costo</th>
                                                        <th className="px-4 py-3 text-right">Precio Venta</th>
                                                        <th className="px-4 py-3 text-right">Total Venta</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {inventoryData.products.slice(0, 100).map(product => (
                                                        <tr key={product.id} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-slate-900">{product.brand}</div>
                                                                <div className="text-xs text-slate-500">{product.model} - {product.color}</div>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium">
                                                                <span className={product.quantity < 5 ? 'text-red-500' : 'text-slate-700'}>
                                                                    {product.quantity}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-500">
                                                                Bs {parseFloat(product.costUnit || 0).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                                Bs {(window.parseFloat(product.costUnit || 0) * (product.quantity || 0)).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                                                                Bs {product.price}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                                                Bs {((parseFloat(product.price) || 0) * (product.quantity || 0)).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {inventorySubTab === 'HISTORY' && (
                                <div className="space-y-4">
                                    {/* History Toolbar */}
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Buscar por marca, modelo o proveedor..."
                                                value={historySearchTerm}
                                                onChange={(e) => setHistorySearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 font-bold text-slate-700 flex justify-between items-center">
                                            <span>Historial de Ingresos de Mercadería</span>
                                            <div className="text-xs font-normal text-slate-400">
                                                Mostrando registros del {dateRange.start} al {dateRange.end}
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                                    <tr>
                                                        <th className="px-4 py-3">Fecha</th>
                                                        <th className="px-4 py-3">Producto</th>
                                                        <th className="px-4 py-3">Talla/Color</th>
                                                        <th className="px-4 py-3 text-center">Cant.</th>
                                                        <th className="px-4 py-3 text-right">Costo Unit.</th>
                                                        <th className="px-4 py-3 text-right">Total</th>
                                                        <th className="px-4 py-3">Proveedor</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {inventoryMovements
                                                        .filter(move => {
                                                            const search = historySearchTerm.toLowerCase();
                                                            return !search ||
                                                                move.brand?.toLowerCase().includes(search) ||
                                                                move.model?.toLowerCase().includes(search) ||
                                                                move.supplierName?.toLowerCase().includes(search);
                                                        })
                                                        .map((move) => (
                                                            <tr key={move.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    {move.date.split('-').reverse().join('/')}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="font-bold text-slate-900 uppercase text-xs">{move.brand}</div>
                                                                    <div className="text-xs text-slate-500">{move.model}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-xs">
                                                                    T: <span className="font-bold">{move.size}</span> | C: {move.color}
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-bold text-[#5DADE2]">
                                                                    +{move.quantity}
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-slate-500">
                                                                    Bs {parseFloat(move.costUnit || 0).toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                                    Bs {parseFloat(move.totalCost || 0).toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-1.5 text-xs">
                                                                        <Store size={12} className="text-slate-400" />
                                                                        {move.supplierName || 'N/A'}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    {inventoryMovements
                                                        .filter(move => {
                                                            const search = historySearchTerm.toLowerCase();
                                                            return !search ||
                                                                move.brand?.toLowerCase().includes(search) ||
                                                                move.model?.toLowerCase().includes(search) ||
                                                                move.supplierName?.toLowerCase().includes(search);
                                                        }).length === 0 && (
                                                            <tr key="no-results">
                                                                <td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">
                                                                    {inventoryMovements.length === 0
                                                                        ? "No se encontraron registros de ingreso para este período."
                                                                        : "No se encontraron resultados para la búsqueda."}
                                                                </td>
                                                            </tr>
                                                        )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- SUPPLIERS REPORT --- */}
                    {activeTab === 'SUPPLIERS' && supplierData && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-700 mb-6">Comparativa de Inversión por Proveedor</h3>
                                <div className="space-y-4">
                                    {supplierData.map((supplier) => {
                                        // Calculate percentage for progress bar (relative to the top supplier)
                                        const maxVal = supplierData[0]?.totalCost || 1;
                                        const percentage = (supplier.totalCost / maxVal) * 100;

                                        return (
                                            <div key={supplier.id} className="group">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-slate-900 flex items-center gap-2">
                                                        <Store size={14} className="text-blue-500" />
                                                        {supplier.name}
                                                    </span>
                                                    <span className="font-bold text-slate-700">Bs {supplier.totalCost.toFixed(2)}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                    <div
                                                        className="bg-[#5DADE2] h-full rounded-full transition-all duration-500 ease-out group-hover:bg-[#3498DB]"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                                <div className="flex justify-between mt-1 text-xs text-slate-400">
                                                    <span>{supplier.productCount} Modelos</span>
                                                    <span>Stock: {supplier.totalStock} pares</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {supplierData.length === 0 && (
                                        <div className="text-center py-8 text-slate-400">No hay datos de proveedores para comparar</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VOIDS REPORT --- */}
                    {activeTab === 'VOIDS' && voidsData && (
                        <div className="space-y-4">
                            {/* Filters */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Buscar por Ticket</label>
                                        <input
                                            type="text"
                                            placeholder="V-0001"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            value={voidsFilter.ticketNumber}
                                            onChange={(e) => setVoidsFilter(prev => ({ ...prev, ticketNumber: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Fecha Inicio</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            value={voidsFilter.startDate}
                                            onChange={(e) => setVoidsFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Fecha Fin</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            value={voidsFilter.endDate}
                                            onChange={(e) => setVoidsFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                    <span className="font-bold text-slate-700">Historial de Anulaciones</span>
                                    <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                        {filteredVoids.length} de {voidsData.length} Total
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Ticket</th>
                                                <th className="px-4 py-3">Fecha/Hora</th>
                                                <th className="px-4 py-3">Cliente</th>
                                                <th className="px-4 py-3">Productos Devueltos</th>
                                                <th className="px-4 py-3 text-right">Monto</th>
                                                <th className="px-4 py-3">Motivo</th>
                                                <th className="px-4 py-3">Autorizado Por</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredVoids.map(voidTx => (
                                                <tr key={voidTx.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-mono text-xs font-bold">
                                                        {voidTx.ticketNumber || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {voidTx.voidedAt?.toDate().toLocaleString() || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {voidTx.customerName}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs space-y-1">
                                                            {voidTx.items?.map((item, idx) => (
                                                                <div key={idx} className="text-slate-600">
                                                                    {item.brand} {item.model} ({item.size}) x{item.quantity}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-red-600 line-through decoration-red-300 text-right">
                                                        Bs {voidTx.totalBs.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 italic text-slate-500 text-xs">
                                                        {voidTx.voidReason || 'Sin motivo registrado'}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs uppercase bg-slate-100 rounded text-slate-600">
                                                        {voidTx.voidedBy || 'Sistema'}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredVoids.length === 0 && (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <AlertTriangle size={32} opacity={0.5} />
                                                            <p>No hay anulaciones registradas</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- USERS COMPARATIVE REPORT --- */}
                    {activeTab === 'USERS' && (
                        <div className="space-y-6">
                            {/* Comparison Charts (Progress Bars) */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-[#5DADE2]" />
                                    Ranking de Ventas por Usuario
                                </h3>
                                <div className="space-y-6">
                                    {userComparativeData.filter(u => u.salesCount > 0).map((user, idx) => {
                                        const maxSales = Math.max(...userComparativeData.map(u => u.totalBs)) || 1;
                                        const percentage = (user.totalBs / maxSales) * 100;

                                        return (
                                            <div key={user.uid} className="group">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-400 mr-2">#{idx + 1}</span>
                                                        <span className="font-bold text-slate-900">{user.name}</span>
                                                        <span className="ml-2 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">{user.role}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-slate-900">Bs {user.totalBs.toFixed(2)}</span>
                                                        <span className="ml-2 text-xs text-slate-500">({user.salesCount} ventas)</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                                    <div
                                                        className="bg-gradient-to-r from-[#5DADE2] to-[#3498DB] h-full rounded-full transition-all duration-1000 ease-out group-hover:from-[#3498DB] group-hover:to-[#2980B9]"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {userComparativeData.filter(u => u.salesCount > 0).length === 0 && (
                                        <div className="text-center py-12 text-slate-400 italic">
                                            No hay registros de venta en este período.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Stats Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 font-bold text-slate-700">Métricas Detalladas por Personal</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Usuario</th>
                                                <th className="px-6 py-4 text-center">Ventas</th>
                                                <th className="px-6 py-4 text-right">Total Ventas (Bs)</th>
                                                <th className="px-6 py-4 text-right text-amber-600">Descuentos (Bs)</th>
                                                <th className="px-6 py-4 text-right text-emerald-600">Utilidad (Bs)</th>
                                                <th className="px-6 py-4 text-right">Prom. Venta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {userComparativeData.map(user => (
                                                <tr key={user.uid} className={`hover:bg-slate-50 transition-colors ${user.salesCount === 0 ? 'opacity-50' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900">{user.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-medium uppercase">{user.role}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${user.salesCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                                            {user.salesCount}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-700">
                                                        Bs {user.totalBs.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-amber-600">
                                                        - Bs {user.totalDiscount.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                                        Bs {user.grossProfit.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-slate-500 italic">
                                                        Bs {user.salesCount > 0 ? (user.totalBs / user.salesCount).toFixed(2) : '0.00'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
