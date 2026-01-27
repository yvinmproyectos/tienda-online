import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Lock, AlertCircle, Search, ShoppingCart, Plus, Minus, Trash2, Ticket, Package } from 'lucide-react';
import { auth } from '../config/firebase';
import { openShift, getCurrentShift } from '../services/cashService';
import { getProducts } from '../services/productService';
import { processSale, getRecentSales, voidSale } from '../services/saleService';

export default function POSPage() {
    const [currentShift, setCurrentShift] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [openingData, setOpeningData] = useState({ bs: '', usd: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sales Interface State
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO'); // EFECTIVO, QR, MIXTO
    const [currency, setCurrency] = useState('BS'); // BS, USD (Primary currency for calc)
    const [amountTendered, setAmountTendered] = useState('');

    // New Fields
    const [customerName, setCustomerName] = useState('');
    const [customerNit, setCustomerNit] = useState('');
    const [discountBs, setDiscountBs] = useState('');
    const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState('');

    const [showConfirmationModal, setShowConfirmationModal] = useState(false);

    // History Tab State
    const [activeTab, setActiveTab] = useState('POS'); // 'POS' | 'HISTORY'
    const [recentSales, setRecentSales] = useState([]);
    const [selectedSaleToVoid, setSelectedSaleToVoid] = useState(null);
    const [voidReason, setVoidReason] = useState('');

    useEffect(() => {
        checkShiftStatus();
    }, []);

    useEffect(() => {
        if (currentShift) {
            loadCatalog();
            loadHistory();
        }
    }, [currentShift]);

    const checkShiftStatus = async () => {
        setIsLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                const shift = await getCurrentShift(user.uid);
                setCurrentShift(shift);
            }
        } catch (error) {
            console.error("Error checking shift:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCatalog = async () => {
        try {
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error("Error loading products:", error);
        }
    };

    const loadHistory = async () => {
        try {
            const sales = await getRecentSales();
            setRecentSales(sales);
        } catch (error) {
            console.error("Error loading history:", error);
        }
    };

    const handleVoidSale = async (e) => {
        e.preventDefault();
        try {
            const user = auth.currentUser;
            await voidSale(selectedSaleToVoid.id, voidReason, user, currentShift.id);
            alert("Venta anulada correctamente");
            setSelectedSaleToVoid(null);
            setVoidReason('');
            loadHistory(); // Refresh list
            checkShiftStatus(); // Refresh shift balance
        } catch (error) {
            console.error(error);
            alert("Error al anular venta: " + error.message);
        }
    };

    const handleOpenShift = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No autenticado");

            await openShift(user.uid, openingData);
            await checkShiftStatus(); // Refresh to show POS
        } catch (error) {
            console.error(error);
            alert("Error al abrir caja: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- POS Logic ---

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                // Simple stock check
                if (newQty > item.stock) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const cartTotals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = parseFloat(discountBs) || 0;
        const totalBs = Math.max(0, subtotal - discount);
        // Assuming fixed exchange rate for display purposes, could be dynamic
        const totalUsd = totalBs / 6.96;
        return { subtotal, totalBs, totalUsd, discount };
    }, [cart, discountBs]);

    const printReceipt = (saleData) => {
        const win = window.open('', 'Print', 'height=600,width=400');
        win.document.write(`
            <html>
                <head>
                    <title>Ticket de Venta</title>
                    <style>
                        body { font-family: 'Courier New', monospace; font-size: 10px; max-width: 300px; margin: 0 auto; padding: 10px; }
                        table { width: 100%; border-collapse: collapse; }
                        th { text-align: left; border-bottom: 1px dashed black; padding-bottom: 2px; }
                        td { padding: 4px 0; vertical-align: top; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .bold { font-weight: bold; }
                        .border-top { border-top: 1px dashed black; margin-top: 5px; padding-top: 5px; }
                        .my-2 { margin: 8px 0; }
                    </style>
                </head>
                <body>
                    <div class="text-center">
                        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">ZAPATERÍA POS</div>
                        <p style="margin:0;">Sucursal Central</p>
                        <p style="margin:0;">${new Date().toLocaleString()}</p>
                    </div>
                    
                    <div class="my-2 border-top">
                        <p style="margin:2px 0;"><b>Vendedor:</b> ${saleData.sellerName}</p>
                        <p style="margin:2px 0;"><b>Cliente:</b> ${saleData.customerName}</p>
                        <p style="margin:2px 0;"><b>NIT/CI:</b> ${saleData.customerNit}</p>
                    </div>

                    <div class="border-top">
                        <table>
                            <thead>
                                <tr>
                                    <th width="50%">Producto</th>
                                    <th width="15%" class="text-center">Cant</th>
                                    <th width="35%" class="text-right">P.Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                 ${saleData.items.map(item => `
                                    <tr>
                                        <td>${item.brand} ${item.model}<br/><span style="font-size:9px">(${item.size})</span></td>
                                        <td class="text-center">${item.quantity}</td>
                                        <td class="text-right">${item.price.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="border-top text-right">
                        <p style="margin:2px 0;">Subtotal: Bs ${saleData.subtotalBs.toFixed(2)}</p>
                        ${saleData.discountBs > 0 ? `<p style="margin:2px 0;">Descuento: -Bs ${saleData.discountBs.toFixed(2)}</p>` : ''}
                        <h3 style="margin: 5px 0;">TOTAL: Bs ${saleData.totalBs.toFixed(2)}</h3>
                    </div>

                    <div class="border-top">
                        <p style="margin:2px 0;"><b>Forma de Pago:</b> ${saleData.method}</p>
                        ${(saleData.method === 'EFECTIVO' || saleData.method === 'MIXTO' || saleData.amountTendered.bs > 0) ? `
                            <p style="margin:2px 0;">Recibido: Bs ${saleData.amountTendered.bs.toFixed(2)}</p>
                            <p style="margin:2px 0;">Cambio: Bs ${saleData.change.bs.toFixed(2)}</p>
                        ` : ''}
                        ${saleData.discountAuthorizedBy ? `<p style="margin:5px 0; font-size: 9px;">Desc. Autorizado por: ${saleData.discountAuthorizedBy}</p>` : ''}
                    </div>

                    <div class="text-center my-2 border-top">
                        <p style="margin-top: 10px;">¡Gracias por su compra!</p>
                    </div>
                </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
        }, 500);
    };

    const handleProcessSale = () => {
        if (cart.length === 0) return;
        setShowConfirmationModal(true);
    };

    const confirmSale = async () => {
        setShowConfirmationModal(false);
        setIsSubmitting(true);
        try {
            const user = auth.currentUser;

            // Calculate change
            let tenderedBs = 0;
            if (paymentMethod === 'EFECTIVO' && currency === 'BS') {
                tenderedBs = parseFloat(amountTendered) || cartTotals.totalBs;
            } else if (paymentMethod === 'EFECTIVO' && currency === 'USD') {
                // Simplified USD handling
                tenderedBs = (parseFloat(amountTendered) || 0) * 6.96;
            } else {
                tenderedBs = cartTotals.totalBs; // QR/Mixed default to exact
            }

            const changeBs = Math.max(0, tenderedBs - cartTotals.totalBs);

            const paymentData = {
                method: paymentMethod,
                currency: currency,
                subtotalBs: cartTotals.subtotal,
                totalBs: cartTotals.totalBs,
                totalUsd: cartTotals.totalUsd,

                discountBs: cartTotals.discount,
                discountAuthorizedBy: discountAuthorizedBy,

                customerName: customerName || 'Sin Nombre',
                customerNit: customerNit || '0',

                amountBs: currency === 'BS' ? (parseFloat(amountTendered) || cartTotals.totalBs) : 0,
                amountUsd: currency === 'USD' ? (parseFloat(amountTendered) || cartTotals.totalUsd) : 0,

                changeBs: changeBs,
                changeUsd: changeBs / 6.96
            };

            await processSale(currentShift.id, cart, paymentData, user.uid);

            // Print Receipt
            printReceipt({
                ...paymentData,
                items: cart,
                sellerName: user.email || 'Vendedor',
                amountTendered: { bs: paymentData.amountBs || tenderedBs, usd: paymentData.amountUsd || 0 },
                change: { bs: changeBs, usd: 0 }
            });

            // Success & Reset
            // alert('Venta procesada correctamente'); 
            setCart([]);
            setAmountTendered('');
            setCustomerName('');
            setCustomerNit('');
            setDiscountBs('');
            setDiscountAuthorizedBy('');
            loadCatalog();
        } catch (error) {
            console.error(error);
            alert("Error al procesar venta: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // STATE 1: NO SHIFT OPEN -> SHOW OPENING FORM
    if (!currentShift) {
        return (
            <div className="max-w-md mx-auto mt-10">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
                    <div className="bg-slate-900 p-6 text-white text-center">
                        <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                            <Lock size={32} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold">Apertura de Caja</h2>
                        <p className="text-slate-400 text-sm mt-1">Inicia tu turno para comenzar a vender</p>
                    </div>

                    <form onSubmit={handleOpenShift} className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Base en Bolivianos (Bs)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs</span>
                                    <input
                                        type="number"
                                        step="0.10"
                                        min="0"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg"
                                        placeholder="0.00"
                                        value={openingData.bs}
                                        onChange={(e) => setOpeningData({ ...openingData, bs: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Base en Dólares ($us)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$us</span>
                                    <input
                                        type="number"
                                        step="0.10"
                                        min="0"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg"
                                        placeholder="0.00"
                                        value={openingData.usd}
                                        onChange={(e) => setOpeningData({ ...openingData, usd: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-4 rounded-lg flex gap-3 items-start">
                            <AlertCircle className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-indigo-700">
                                Asegúrate de contar bien el dinero base. Esto se usará para calcular el arqueo final.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Abriendo...' : 'Abrir Caja'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // STATE 2: ACTIVE SHIFT (SALES INTERFACE)
    return (
        <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
            {/* Header / Stats Info */}
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-600">
                            Caja Abierta: {currentShift.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    {/* TABS */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('POS')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'POS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Punto de Venta
                        </button>
                        <button
                            onClick={() => setActiveTab('HISTORY')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Historial / Devoluciones
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 text-sm">
                    <span className="text-slate-500">Base Bs: <strong className="text-slate-900">{currentShift.initialBalance.bs}</strong></span>
                    <span className="text-slate-500">Base $us: <strong className="text-slate-900">{currentShift.initialBalance.usd}</strong></span>
                </div>
            </div>

            {activeTab === 'HISTORY' ? (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 font-bold text-slate-700">Últimas Ventas</div>
                    <div className="flex-1 overflow-auto p-4">
                        <table className="w-full text-sm text-left">
                            <thead className="text-slate-500 text-xs uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3">Hora</th>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Total</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {recentSales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">{sale.date?.toDate().toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900">{sale.customerName}</div>
                                            <div className="text-xs text-slate-400">{sale.items.length} productos</div>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-700">Bs {sale.totalBs.toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            {sale.status === 'void' ? (
                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">ANULADO</span>
                                            ) : (
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">COMPLETADO</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {sale.status !== 'void' && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedSaleToVoid(sale)}
                                                        className="px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 text-xs font-bold transition-colors"
                                                    >
                                                        Anular
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            alert("Para realizar un cambio:\n1. Anule esta venta.\n2. El stock será restaurado.\n3. Realice una nueva venta con los productos correctos.");
                                                            setSelectedSaleToVoid(sale);
                                                        }}
                                                        className="px-3 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 text-xs font-bold transition-colors"
                                                    >
                                                        Cambio
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex gap-2 overflow-hidden">
                    {/* LEFT PANEL: PRODUCT CATALOG */}
                    <div className="w-[40%] flex flex-col gap-2 min-w-[300px]">
                        {/* Search Bar */}
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar zapatos por marca, modelo..."
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Product Grid */}
                        <div className="flex-1 overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-2">
                                {filteredProducts.map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col h-full group"
                                    >
                                        <div className="aspect-square bg-slate-100 rounded-lg mb-3 overflow-hidden border border-slate-100 relative">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.model} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                    <Package size={32} />
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                                                Stock: {product.quantity}
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-slate-900 truncate w-full">{product.brand}</h3>
                                        <p className="text-sm text-slate-500 truncate w-full mb-2">{product.model}</p>
                                        <div className="mt-auto flex justify-between items-end w-full">
                                            <div className="text-indigo-600 font-bold text-lg">Bs {product.price}</div>
                                            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <Plus size={16} />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {filteredProducts.length === 0 && (
                                <div className="text-center py-12 text-slate-400">
                                    <Search size={48} className="mx-auto mb-2 opacity-20" />
                                    <p>No se encontraron productos</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: CART & CHECKOUT */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-w-[350px]">
                        {/* Cart Header */}
                        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                <ShoppingCart size={20} />
                            </div>
                            <h2 className="font-bold text-slate-900">Carrito de Compra</h2>
                            <span className="ml-auto bg-slate-100 px-2 py-1 rounded-full text-xs font-bold text-slate-600">
                                {cart.length} items
                            </span>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[150px]">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-60">
                                    <ShoppingCart size={48} />
                                    <p>El carrito está vacío</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 group">
                                        <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 overflow-hidden shrink-0">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-full h-full p-4 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-900 truncate">{item.brand} {item.model}</h4>
                                            <p className="text-xs text-slate-500 mb-2">Talla: {item.size} | {item.color}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="text-indigo-600 font-bold">Bs {item.price * item.quantity}</div>
                                                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-0.5">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><Minus size={14} /></button>
                                                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><Plus size={14} /></button>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 self-start p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Customer & Discount Section */}
                        <div className="p-2 border-t border-slate-100 bg-slate-50/50 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="Cliente"
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="NIT / CI"
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                    value={customerNit}
                                    onChange={(e) => setCustomerNit(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        placeholder="Desc"
                                        className="w-full pl-6 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white text-red-500 font-bold"
                                        value={discountBs}
                                        onChange={(e) => setDiscountBs(e.target.value)}
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Autoriza..."
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                    value={discountAuthorizedBy}
                                    onChange={(e) => setDiscountAuthorizedBy(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Checkout Section */}
                        <div className="p-2 bg-slate-50 border-t border-slate-200 space-y-2">
                            <div className="space-y-1">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal</span>
                                    <span>Bs {cartTotals.subtotal.toFixed(2)}</span>
                                </div>
                                {cartTotals.discount > 0 && (
                                    <div className="flex justify-between text-red-500 font-medium">
                                        <span>Descuento</span>
                                        <span>- Bs {cartTotals.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end border-t border-slate-200 pt-2">
                                    <span className="font-bold text-lg text-slate-900">Total a Pagar</span>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-indigo-600">Bs {cartTotals.totalBs.toFixed(2)}</div>
                                        <div className="text-xs text-slate-500 font-medium">Approx $us {cartTotals.totalUsd.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setPaymentMethod('EFECTIVO')}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium border ${paymentMethod === 'EFECTIVO' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                >
                                    Efectivo
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('QR')}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium border ${paymentMethod === 'QR' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                >
                                    QR
                                </button>
                            </div>

                            {/* Amount Tendered & Change (Only for Cash) */}
                            {paymentMethod === 'EFECTIVO' && (
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-slate-600">Recibido (Bs):</label>
                                        <input
                                            type="number"
                                            step="0.10"
                                            className="flex-1 px-2 py-1 border border-slate-300 rounded outline-none font-bold text-slate-900 text-sm"
                                            placeholder={cartTotals.totalBs.toFixed(2)}
                                            value={amountTendered}
                                            onChange={(e) => setAmountTendered(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                        <span className="text-emerald-800 text-xs font-medium">Cambio:</span>
                                        <span className="text-lg font-bold text-emerald-700">
                                            Bs {Math.max(0, (parseFloat(amountTendered) || 0) - cartTotals.totalBs).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleProcessSale}
                                disabled={cart.length === 0 || isSubmitting}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            >
                                {isSubmitting ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        <Ticket size={24} />
                                        Cobrar Bs {cartTotals.totalBs.toFixed(2)}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
    )
}

{/* Custom Sale Confirmation Modal */ }
{
    showConfirmationModal && (
        <div className="absolute inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-center mb-4 text-emerald-100">
                    <div className="p-3 bg-emerald-100 rounded-full">
                        <Ticket className="text-emerald-600" size={32} />
                    </div>
                </div>
                <h3 className="text-lg font-bold text-center text-slate-900 mb-2">¿Confirmar Venta?</h3>
                <p className="text-slate-500 text-center mb-6">Se procesará el cobro de <b>Bs {cartTotals.totalBs.toFixed(2)}</b> y se descontará el stock.</p>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowConfirmationModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmSale}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                    >
                        {isSubmitting ? 'Procesando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

{/* Void Confirmation Modal */ }
{
    selectedSaleToVoid && (
        <div className="absolute inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-center mb-4 text-red-100">
                    <div className="p-3 bg-red-100 rounded-full">
                        <AlertCircle className="text-red-600" size={32} />
                    </div>
                </div>
                <h3 className="text-lg font-bold text-center text-slate-900 mb-2">¿Anular Venta?</h3>
                <p className="text-slate-500 text-center text-sm mb-4">
                    Se restaurará el stock de <b>{selectedSaleToVoid.items.length} productos</b> y se actualizará la caja.
                </p>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Motivo de la anulación:</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-red-500"
                        placeholder="Ej: Error de cobro, devolución..."
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => { setSelectedSaleToVoid(null); setVoidReason(''); }}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleVoidSale}
                        disabled={!voidReason.trim()}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        Confirmar Anulación
                    </button>
                </div>
            </div>
        </div>
    )
}
        </div >
    );
}
