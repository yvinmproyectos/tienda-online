import React, { useState, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import {
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    Search,
    X,
    Save,
    RotateCcw,
    FileText,
    CreditCard,
    Banknote,
    AlertCircle,
    Check,
    Clock,
    User,
    Lock,
    LogOut,
    RefreshCw,
    Ticket,
    Shield,
    Eye,
    EyeOff,
    Receipt,
    WifiOff,
    Edit2,
    ChevronLeft
} from 'lucide-react';
import { openShift, getCurrentShift, closeShift, getAnyOpenShift } from '../services/cashService';
import { getProducts, getProductsRealTime } from '../services/productService';
import { processSale, getRecentSales, voidSale } from '../services/saleService';
import { settingsService } from '../services/settingsService';
import { userService } from '../services/userService'; // Import userService to get display name
import { PageHeader } from '../components/PageHeader';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function POSPage() {
    const { userProfile, currentUser } = useAuth(); // Get currentUser from context
    const [currentShift, setCurrentShift] = useState(null);
    const [globalOpenShift, setGlobalOpenShift] = useState(null); // Valid for Admins
    const [globalShiftUser, setGlobalShiftUser] = useState(null); // Name of user who opened shift
    const [isLoading, setIsLoading] = useState(true);
    const [openingData, setOpeningData] = useState({ bs: '', usd: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [storeSettings, setStoreSettings] = useState(null);
    const [manualShiftOpen, setManualShiftOpen] = useState(false); // Legacy: use adminChoice

    // Close Shift State
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [showOpenShiftModal, setShowOpenShiftModal] = useState(false); // New Modal State
    const [closingData, setClosingData] = useState({ declaredBs: '', declaredUsd: '' });

    // Sales Interface State
    const [products, setProducts] = useState([]);
    const [activeTab, setActiveTab] = useState('POS'); // POS, HISTORY
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [amountTendered, setAmountTendered] = useState('');
    const [customerName, setCustomerName] = useState('SIN NOMBRE');
    const [customerNit, setCustomerNit] = useState('0');
    const [isFacebookSale, setIsFacebookSale] = useState(false);
    const [discountBs, setDiscountBs] = useState('');
    const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [mixedPayment, setMixedPayment] = useState({ cash: '', qr: '' });
    const [currency, setCurrency] = useState('BS'); // BS, USD
    const [isEditingTotal, setIsEditingTotal] = useState(false);
    const [discounts, setDiscounts] = useState([]); // Discounts from DB // New state for Price Override
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({}); // { groupKey: variantId }
    const [mobileStep, setMobileStep] = useState('CATALOG'); // 'CATALOG', 'CART', 'CHECKOUT'

    // History / Returns State
    const [recentSales, setRecentSales] = useState([]);
    const [selectedSaleToVoid, setSelectedSaleToVoid] = useState(null);

    const [voidReason, setVoidReason] = useState('');

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [showAuthPassword, setShowAuthPassword] = useState(false);
    const [authPurpose, setAuthPurpose] = useState('DISCOUNT'); // 'DISCOUNT' | 'VOID'
    const [tempVoidSale, setTempVoidSale] = useState(null);

    // Navigation Warning State
    const [showNavWarning, setShowNavWarning] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [adminChoice, setAdminChoice] = useState(null); // 'CONSULT' | 'OPEN_SHIFT' | null
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const handleSafeNavigation = (action) => {
        if (cart.length > 0) {
            setPendingNavigation(() => action);
            setShowNavWarning(true);
        } else {
            action();
        }
    };


    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (cart.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        // Global flag for Layout to check
        window.hasPOSUnsavedChanges = cart.length > 0;

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.hasPOSUnsavedChanges = false;
        };
    }, [cart]);

    useEffect(() => {
        // Reset mobile step when switching tabs or clearing cart for UI stability
        if (activeTab === 'HISTORY' || cart.length === 0) {
            setMobileStep('CATALOG');
        }
    }, [activeTab, cart.length]);

    useEffect(() => {
        let mounted = true;

        // Listeners en tiempo real para productos
        const unsubscribeProducts = getProductsRealTime((data) => {
            console.log("POS: Products loaded:", data.length);
            if (mounted) setProducts(data);
        });

        const init = async () => {
            // Non-blocking initialization
            loadSettings();
            checkShiftStatus();
            loadHistory();
            if (mounted) setIsLoading(false); // Stop spinner immediately/quickly
        };
        init();

        return () => {
            mounted = false;
            unsubscribeProducts();
        };
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await settingsService.getSettings();
            setStoreSettings(settings);
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    };

    const checkShiftStatus = async () => {
        try {
            const user = currentUser; // Use context user
            if (user) {
                // Check local shift first
                const shift = await getCurrentShift(user.uid);
                setCurrentShift(shift);

                // If Admin and no local shift, check if ANY shift is open
                if (!shift && userProfile?.role === 'admin') {
                    const anyShift = await getAnyOpenShift();
                    if (anyShift) {
                        setGlobalOpenShift(anyShift);
                        // Fetch user name for display
                        const users = await userService.getUsers();
                        const owner = users.find(u => u.uid === anyShift.userId);
                        setGlobalShiftUser(owner?.displayName || owner?.username || "Otro Cajero");
                    } else {
                        setGlobalOpenShift(null);
                    }
                }
            }
        } catch (error) {
            console.error("Error checking shift:", error);
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
            const user = currentUser; // Use context user
            await voidSale(selectedSaleToVoid.id, voidReason, user, currentShift?.id);
            showToast("Venta anulada correctamente");
            setSelectedSaleToVoid(null);
            setVoidReason('');
            loadHistory();
            checkShiftStatus();
        } catch (error) {
            console.error(error);
            showToast("Error al anular venta: " + error.message, 'error');
        }
    };

    const handleOpenShift = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const user = currentUser;
            if (!user) throw new Error("No autenticado");

            await openShift(user.uid, openingData);
            await checkShiftStatus();
            setShowOpenShiftModal(false);
            showToast("Caja abierta correctamente");
        } catch (error) {
            console.error(error);
            showToast("Error al abrir caja: " + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        setIsSubmitting(true);
        try {
            const latestShift = await getCurrentShift(currentUser.uid);
            if (!latestShift) throw new Error("Turno no encontrado");

            await closeShift(latestShift.id, { declaredBs: 0, declaredUsd: 0 });

            printShiftReport(latestShift);

            showToast("Caja cerrada correctamente.");
            setCurrentShift(null);
            setShowCloseShiftModal(false);
        } catch (error) {
            console.error(error);
            showToast("Error al cerrar caja: " + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const printShiftReport = (shift) => {
        const win = window.open('', 'Print', 'height=600,width=400');

        if (!win) {
            showToast("⚠️ La ventana de impresión fue bloqueada. Por favor, permite las ventanas emergentes en tu navegador.", "error");
            return;
        }

        const storeName = storeSettings?.storeName || 'ZAPATERÍA RUN';
        const logo = storeSettings?.logoBase64 ? `<img src="${storeSettings.logoBase64}" style="max-height: 50px; display: block; margin: 0 auto 5px;" />` : '';
        const userDisplayName = userProfile?.displayName || currentUser?.email || 'Cajero';

        const expectedBs = (shift.initialBalance?.bs || 0) + (shift.sales?.bs || 0);
        const expectedUsd = (shift.initialBalance?.usd || 0) + (shift.sales?.usd || 0);

        win.document.write(`
            <html>
                <head>
                    <title>Cierre de Caja</title>
                    <style>
                        body { font-family: 'Courier New', monospace; font-size: 10px; max-width: 300px; margin: 0 auto; padding: 10px; }
                        table { width: 100%; border-collapse: collapse; }
                        th { text-align: left; }
                        td { padding: 2px 0; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .bold { font-weight: bold; }
                        .border-top { border-top: 1px dashed black; margin-top: 5px; padding-top: 5px; }
                        .border-bottom { border-bottom: 1px dashed black; margin-bottom: 5px; padding-bottom: 5px; }
                        .title { font-size: 14px; font-weight: bold; margin: 10px 0; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="text-center">
                        ${logo}
                        <div style="font-size: 16px; font-weight: bold;">${storeName}</div>
                        <p style="margin:0;">${new Date().toLocaleString()}</p>
                    </div>

                    <div class="title">REPORTE DE CIERRE DE CAJA</div>
                    
                    <div class="border-bottom">
                        <p style="margin:2px 0;"><b>Cajero:</b> ${userDisplayName}</p>
                        <p style="margin:2px 0;"><b>Inicio:</b> ${shift.startTime?.toDate().toLocaleString()}</p>
                        <p style="margin:2px 0;"><b>Fin:</b> ${new Date().toLocaleString()}</p>
                    </div>

                    <table>
                        <tr><td colspan="2" class="bold" style="padding-top:5px;">MOVIMIENTOS</td></tr>
                        <tr><td>Base Inicial (Bs):</td><td class="text-right">${(shift.initialBalance?.bs || 0).toFixed(2)}</td></tr>
                        <tr><td>Base Inicial ($us):</td><td class="text-right">${(shift.initialBalance?.usd || 0).toFixed(2)}</td></tr>
                        <tr><td>Ventas (Bs):</td><td class="text-right">${(shift.sales?.bs || 0).toFixed(2)}</td></tr>
                        <tr><td>Ventas ($us):</td><td class="text-right">${(shift.sales?.usd || 0).toFixed(2)}</td></tr>
                        <tr><td>Descuentos (Bs):</td><td class="text-right">-${(shift.discounts?.bs || 0).toFixed(2)}</td></tr>
                    </table>

                    <div class="border-top">
                        <table>
                            <tr><td colspan="2" class="bold">TOTAL EN CAJA (SISTEMA)</td></tr>
                            <tr><td>Total (Bs):</td><td class="text-right bold" style="font-size:14px;">${expectedBs.toFixed(2)}</td></tr>
                            <tr><td>Total ($us):</td><td class="text-right bold" style="font-size:14px;">${expectedUsd.toFixed(2)}</td></tr>
                        </table>
                    </div>

                    <div style="margin-top: 40px; text-align: center;">
                        <div style="border-top: 1px solid black; width: 80%; margin: 0 auto;"></div>
                        <p style="margin-top: 5px;">Firma Cajero</p>
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
                if (newQty > item.stock) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const cartTotals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // 1. Calculate Automatic Discounts
        let autoDiscount = 0;
        const now = new Date();

        cart.forEach(item => {
            // Find applicable discounts
            const applicable = discounts.filter(d => {
                if (!d.isActive) return false;
                if (d.startDate && d.startDate.toDate() > now) return false;
                if (d.endDate && d.endDate.toDate() < now) return false;

                if (d.scope === 'GLOBAL') return true;
                if (d.scope === 'BRAND' && (d.target || '').toLowerCase() === (item.brand || '').toLowerCase()) return true;
                if (d.scope === 'MODEL' && (d.target || '').toLowerCase() === (item.model || '').toLowerCase()) return true;
                return false;
            });

            // Find best discount for this item
            let bestItemDiscount = 0;
            applicable.forEach(d => {
                let amount = 0;
                if (d.type === 'PERCENTAGE') {
                    amount = (item.price * item.quantity) * (d.value / 100);
                } else { // FIXED
                    // Assuming Fixed is per unit if scope is BRAND/MODEL
                    amount = d.value * item.quantity;
                }
                if (amount > bestItemDiscount) bestItemDiscount = amount;
            });
            autoDiscount += bestItemDiscount;
        });

        // 2. Resolve final discount (Manual overrides Auto)
        let discount = 0;
        if (discountBs !== '' && discountBs !== null) {
            discount = parseFloat(discountBs) || 0;
        } else {
            discount = autoDiscount;
        }

        const totalBs = Math.max(0, subtotal - discount);
        const totalUsd = totalBs / 6.96;
        return { subtotal, totalBs, totalUsd, discount, autoDiscount };
    }, [cart, discountBs, discounts]);

    const printReceipt = (saleData) => {
        const win = window.open('', 'Print', 'height=600,width=400');

        if (!win) {
            showToast("⚠️ La ventana de impresión fue bloqueada. Por favor, permite las ventanas emergentes en tu navegador.", "error");
            return;
        }

        const storeName = storeSettings?.storeName || 'ZAPATERÍA RUN';
        const storePhone = storeSettings?.storePhone || '';
        const storeAddress = storeSettings?.storeAddress || 'Sucursal Central';
        const logo = storeSettings?.logoBase64 ? `<img src="${storeSettings.logoBase64}" style="max-height: 50px; display: block; margin: 0 auto 5px;" />` : '';
        const sellerDisplayName = saleData.sellerName || 'Vendedor';
        const paymentMethodText = saleData.method || saleData.paymentMethod || 'No definido';

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
                        ${logo}
                        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">${storeName}</div>
                        <p style="margin:0;">${storeAddress}</p>
                        ${storePhone ? `<p style="margin:0;">Tel: ${storePhone}</p>` : ''}
                        <p style="margin:5px 0 0 0;">${new Date().toLocaleString()}</p>
                    </div>
                    
                    <div class="my-2 border-top">
                        <p style="margin:2px 0; font-size: 14px; text-align: center;"><b>TICKET: ${saleData.ticketNumber || 'N/A'}</b></p>
                        <div style="margin-top: 5px;">
                            <p style="margin:2px 0;"><b>Vendedor:</b> ${sellerDisplayName}</p>
                            <p style="margin:2px 0;"><b>Cliente:</b> ${saleData.customerName}</p>
                            <p style="margin:2px 0;"><b>NIT/CI:</b> ${saleData.customerNit}</p>
                        </div>
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
                                        <td>${item.brand} ${item.model}<br/><span style="font-size:9px">(${item.size}${item.color ? ` - ${item.color}` : ''})</span></td>
                                        <td class="text-center">${item.quantity}</td>
                                        <td class="text-right">${item.price.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="border-top text-right">
                        <p style="margin:2px 0;">Subtotal: Bs ${saleData.subtotalBs.toFixed(2)}</p>
                        ${Math.abs(saleData.discountBs) > 0.01 ? `<p style="margin:2px 0;">${saleData.discountBs > 0 ? 'Descuento' : 'Recargo'}: ${saleData.discountBs > 0 ? '-' : '+'}Bs ${Math.abs(saleData.discountBs).toFixed(2)}</p>` : ''}
                        <h3 style="margin: 5px 0;">TOTAL: Bs ${saleData.totalBs.toFixed(2)}</h3>
                    </div>

                    <div class="border-top">
                        <p style="margin:2px 0;"><b>Forma de Pago:</b> ${paymentMethodText}</p>
                        ${paymentMethodText === 'MIXTO' ? `
                            <p style="margin:2px 0;">Efectivo: Bs ${(saleData.mixedDetails?.cash || 0).toFixed(2)}</p>
                            <p style="margin:2px 0;">QR: Bs ${(saleData.mixedDetails?.qr || 0).toFixed(2)}</p>
                            <p style="margin:2px 0;">Total Pagado: Bs ${(saleData.amountBs || 0).toFixed(2)}</p>
                            <p style="margin:2px 0;">Cambio: Bs ${(saleData.change?.bs || 0).toFixed(2)}</p>
                        ` : (paymentMethodText === 'EFECTIVO' || (saleData.amountTendered?.bs || 0) > 0) ? `
                            <p style="margin:2px 0;">Recibido: Bs ${(saleData.amountTendered?.bs || 0).toFixed(2)}</p>
                            <p style="margin:2px 0;">Cambio: Bs ${(saleData.change?.bs || 0).toFixed(2)}</p>
                        ` : ''}
                    </div>

                    <div class="text-center my-2 border-top">
                        <p style="margin-top: 10px;">${storeSettings?.receiptFooter || '¡Gracias por su compra!'}</p>
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
        try {
            if (cart.length === 0) return;

            const discountValue = parseFloat(discountBs) || 0;
            const threshold = parseFloat(storeSettings?.discountAuthThreshold) || 20;

            // Strict check: if discount > threshold AND not authorized
            if (discountValue > threshold && discountAuthorizedBy !== 'Administrador') {
                setAuthPassword('');
                setAuthError('');
                setAuthPurpose('DISCOUNT');
                setShowPasswordModal(true);
                return;
            }

            // Validation for MIXED PAYMENT
            if (paymentMethod === 'MIXTO') {
                const cash = parseFloat(mixedPayment.cash) || 0;
                const qr = parseFloat(mixedPayment.qr) || 0;
                const totalMixed = cash + qr;
                // Allow a tiny margin for float errors, check if totalMixed is less than TotalBs - margin
                if (totalMixed < (cartTotals.totalBs - 0.10)) {
                    showToast(`El monto cubierto (Bs ${totalMixed.toFixed(2)}) es menor al total (Bs ${cartTotals.totalBs.toFixed(2)}).`, 'error');
                    return;
                }
            }

            // CHECK SHIFT BEFORE CONFIRMING
            if (!currentShift) {
                // If no shift open, force open shift modal
                // Unless admin in consult mode? No, if selling, MUST have shift.
                setShowOpenShiftModal(true);
                return;
            }

            // CHECK SHIFT BEFORE CONFIRMING
            if (!currentShift) {
                // If no shift open, force open shift modal
                // Unless admin in consult mode? No, if selling, MUST have shift.
                setShowOpenShiftModal(true);
                return;
            }

            setShowConfirmationModal(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAuthSubmit = (e) => {
        e.preventDefault();
        const requiredPass = 'Tienda2025*';
        if (authPassword === requiredPass) {

            if (authPurpose === 'DISCOUNT') {
                setDiscountAuthorizedBy('Administrador');
                setShowPasswordModal(false);
                setShowConfirmationModal(true);
            } else if (authPurpose === 'VOID') {
                setShowPasswordModal(false);
                setSelectedSaleToVoid(tempVoidSale);
                setTempVoidSale(null);
            }

        } else {
            setAuthError('Contraseña incorrecta');
        }
    };

    const confirmSale = async () => {
        // SECONDARY SAFETY CHECK FOR DISCOUNT
        const discountValue = parseFloat(discountBs) || 0;
        const threshold = parseFloat(storeSettings?.discountAuthThreshold) || 20;
        if (discountValue > threshold && discountAuthorizedBy !== 'Administrador') {
            // If we get here, it means state wasn't updated correctly or user bypassed
            // We can't use alert() per user request, so we should probably redirect to Password Modal?
            // Or just fail silently/log.
            // Let's redirect to password modal for better UX
            setShowConfirmationModal(false);
            setAuthPassword('');
            setAuthError('Autorización requerida nuevamente.');
            setAuthPurpose('DISCOUNT');
            setShowPasswordModal(true);
            return;
        }
        setShowConfirmationModal(false);
        setIsSubmitting(true);
        try {
            const user = currentUser; // Use context user

            let tenderedBs = 0;
            if (paymentMethod === 'EFECTIVO' && currency === 'BS') {
                tenderedBs = parseFloat(amountTendered) || cartTotals.totalBs;
            } else if (paymentMethod === 'EFECTIVO' && currency === 'USD') {
                tenderedBs = (parseFloat(amountTendered) || 0) * 6.96;
            } else if (paymentMethod === 'MIXTO') {
                tenderedBs = (parseFloat(mixedPayment.cash) || 0) + (parseFloat(mixedPayment.qr) || 0);
            } else {
                tenderedBs = cartTotals.totalBs;
            }

            const changeBs = Math.max(0, tenderedBs - cartTotals.totalBs);
            let sellerDisplayName = userProfile?.displayName || user.email || 'Vendedor';
            if (userProfile?.role === 'admin') {
                sellerDisplayName += ' (Admin)';
            }

            const paymentData = {
                method: paymentMethod,
                currency: currency,
                subtotalBs: cartTotals.subtotal,
                totalBs: cartTotals.totalBs,
                totalUsd: cartTotals.totalUsd,
                discountBs: cartTotals.discount,
                discountAuthorizedBy: discountAuthorizedBy,
                customerName: customerName || 'SIN NOMBRE',
                customerNit: customerNit || '0',
                isFacebookSale: isFacebookSale,
                amountBs: paymentMethod === 'MIXTO' ? tenderedBs : (currency === 'BS' ? (parseFloat(amountTendered) || cartTotals.totalBs) : 0),
                amountUsd: currency === 'USD' ? (parseFloat(amountTendered) || cartTotals.totalUsd) : 0,
                mixedDetails: paymentMethod === 'MIXTO' ? { cash: parseFloat(mixedPayment.cash) || 0, qr: parseFloat(mixedPayment.qr) || 0 } : null,
                changeBs: changeBs,
                changeUsd: changeBs / 6.96,
                sellerName: sellerDisplayName,
                username: userProfile?.username,
                userId: user.uid
            };

            // Call processSale and handle result
            const { saleId, ticketNumber } = await processSale(currentShift?.id || 'admin-sale', cart, paymentData, user.uid);

            showToast(`Venta ${ticketNumber} procesada con éxito`);

            printReceipt({
                ...paymentData,
                ticketNumber,
                items: cart,
                sellerName: sellerDisplayName,
                amountTendered: { bs: paymentData.amountBs || tenderedBs, usd: paymentData.amountUsd || 0 },
                change: { bs: changeBs, usd: 0 }
            });

            // Immediate UI cleanup
            setCart([]);
            setAmountTendered('');
            setCustomerName('SIN NOMBRE');
            setCustomerNit('0');
            setIsFacebookSale(false);
            setDiscountBs('');
            setDiscountAuthorizedBy('');
            setDiscountAuthorizedBy(null); // Reset auth
            setMobileStep('CATALOG'); // Reset mobile view
            loadHistory();
        } catch (error) {
            console.error(error);
            showToast("Error al configurar venta: " + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };


    const groupedProducts = useMemo(() => {
        const groups = {};
        products.forEach(product => {
            const key = `${product.brand}-${product.model}`.toLowerCase();
            if (!groups[key]) {
                groups[key] = {
                    key,
                    brand: product.brand,
                    model: product.model,
                    imageUrl: product.imageUrl,
                    price: product.price,
                    variants: [],
                    colors: []
                };
            }
            groups[key].variants.push(product);

            if (product.color && !groups[key].colors.includes(product.color)) {
                groups[key].colors.push(product.color);
            }
        });

        // Ordenar variantes por talla
        Object.values(groups).forEach(group => {
            group.variants.sort((a, b) => (parseFloat(a.size) || 0) - (parseFloat(b.size) || 0));
        });

        return Object.values(groups);
    }, [products]);

    const filteredGroups = groupedProducts.filter(group =>
        group.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // NEW: ADMIN MODE SELECTION SCREEN
    if (!currentShift && userProfile?.role === 'admin' && !adminChoice) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-4">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                    <div className="bg-navy-deep p-8 text-white text-center">
                        <div className="bg-white/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                            <Shield size={40} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold">Modo de Acceso (Administrador)</h2>
                        <p className="text-slate-400 mt-2">¿Cómo deseas trabajar hoy en el Punto de Venta?</p>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => setAdminChoice('CONSULT')}
                            className="flex flex-col items-center p-8 rounded-2xl border-2 border-slate-100 bg-slate-50 hover:border-blue-electric hover:bg-blue-pale transition-all group"
                        >
                            <div className="w-16 h-16 rounded-full bg-slate-200 group-hover:bg-blue-200 flex items-center justify-center mb-4 transition-colors">
                                <Search size={32} className="text-slate-500 group-hover:text-blue-electric" />
                            </div>
                            <span className="text-lg font-bold text-slate-800">Modo Consulta</span>
                            <p className="text-sm text-slate-500 text-center mt-2">Realizar reportes, devoluciones o ver stock sin abrir caja.</p>
                        </button>

                        <button
                            onClick={() => setAdminChoice('OPEN_SHIFT')}
                            className="flex flex-col items-center p-8 rounded-2xl border-2 border-slate-100 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                        >
                            <div className="w-16 h-16 rounded-full bg-slate-200 group-hover:bg-emerald-200 flex items-center justify-center mb-4 transition-colors">
                                <Banknote size={32} className="text-slate-500 group-hover:text-emerald-600" />
                            </div>
                            <span className="text-lg font-bold text-slate-800">Abrir Caja</span>
                            <p className="text-sm text-slate-500 text-center mt-2">Registrar ventas, cobrar dinero y realizar arqueo al final.</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-2 md:space-y-4 h-full flex flex-col">
            {/* Header POS - Replaced with PageHeader */}
            <PageHeader
                title="Punto de Venta"
                subtitle={currentShift ? `Caja Abierta: ${currentShift.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Caja Cerrada'}
                icon={ShoppingCart}
                action={
                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        {/* MOBILE ONLY COMPACT NAVIGATION */}
                        <div className="flex md:hidden flex-col gap-2 w-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {mobileStep !== 'CATALOG' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                console.log("[POS] Mobile Back");
                                                setMobileStep(prev => prev === 'CHECKOUT' ? 'CART' : 'CATALOG');
                                            }}
                                            className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg active:bg-slate-300 active:scale-95 transition-all cursor-pointer touch-manipulation flex items-center gap-1"
                                        >
                                            <ChevronLeft size={20} />
                                            <span className="text-[10px] font-bold">Volver</span>
                                        </button>
                                    )}
                                    {currentShift && mobileStep === 'CATALOG' && (
                                        <button
                                            type="button"
                                            onClick={() => handleSafeNavigation(() => setShowCloseShiftModal(true))}
                                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all cursor-pointer touch-manipulation"
                                        >
                                            Cerrar Caja
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {mobileStep === 'CATALOG' && cart.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setMobileStep('CART')}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-300 active:bg-blue-800 active:scale-95 transition-all cursor-pointer touch-manipulation animate-in fade-in slide-in-from-right-2"
                                        >
                                            <ShoppingCart size={14} />
                                            Ver Carrito ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                                        </button>
                                    )}

                                    {mobileStep === 'CART' && cart.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setMobileStep('CHECKOUT')}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md shadow-emerald-300 active:bg-emerald-800 active:scale-95 transition-all cursor-pointer touch-manipulation flex items-center gap-2 animate-in fade-in slide-in-from-right-2"
                                        >
                                            <CreditCard size={14} />
                                            Completar Compra
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tabs Mobile - Only in Catalog to save space */}
                            {mobileStep === 'CATALOG' && (
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => handleSafeNavigation(() => setActiveTab('POS'))}
                                        className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'POS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Punto de Venta
                                    </button>
                                    <button
                                        onClick={() => handleSafeNavigation(() => setActiveTab('HISTORY'))}
                                        className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Historial
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* DESKTOP STATUS/ACTIONS (Hidden on mobile) */}
                        <div className="hidden md:flex items-center gap-3">
                            {currentShift ? (
                                <button
                                    onClick={() => handleSafeNavigation(() => setShowCloseShiftModal(true))}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-red-300 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                                >
                                    Cerrar Caja
                                </button>
                            ) : (
                                globalOpenShift ? (
                                    <span className="text-xs font-medium text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                        Abierto por: {globalShiftUser}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setShowOpenShiftModal(true)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
                                    >
                                        <Lock size={16} />
                                        Abrir Caja
                                    </button>
                                )
                            )}

                            {/* TABS Desktop */}
                            <div className="flex bg-slate-100 p-1 rounded-lg overflow-hidden border border-slate-200">
                                <button
                                    onClick={() => handleSafeNavigation(() => setActiveTab('POS'))}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'POS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Punto de Venta
                                </button>
                                <button
                                    onClick={() => handleSafeNavigation(() => setActiveTab('HISTORY'))}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Historial
                                </button>
                            </div>
                        </div>
                    </div>
                }
            />

            {
                currentShift && (
                    <div className="flex gap-4 text-sm">
                        <span className="text-slate-500">Base Bs: <strong className="text-slate-900">{currentShift.initialBalance.bs}</strong></span>
                        <span className="text-slate-500">Base $us: <strong className="text-slate-900">{currentShift.initialBalance.usd}</strong></span>
                    </div>
                )
            }

            {
                activeTab === 'HISTORY' ? (
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
                                            <td className="px-4 py-3">{sale.customerName} ({sale.items.length} items)</td>
                                            <td className="px-4 py-3 font-bold">Bs {sale.totalBs.toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                {sale.status === 'void' ?
                                                    <span className="text-red-500 font-bold text-xs">ANULADO</span> :
                                                    <span className="text-emerald-500 font-bold text-xs">COMPLETADO</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <button onClick={() => {
                                                    const printData = {
                                                        ...sale,
                                                        sellerName: sale.sellerName || 'Reimpresión',
                                                        amountTendered: sale.amountTendered || { bs: sale.amountBs || 0, usd: sale.amountUsd || 0 },
                                                        change: sale.change || { bs: sale.changeBs || 0, usd: sale.changeUsd || 0 }
                                                    };
                                                    // Assuming printReceipt starts print job
                                                    console.log('Printing', printData);
                                                }} className="text-blue-600 font-bold hover:bg-blue-50 px-2 py-1 rounded">
                                                    Imprimir
                                                </button>
                                                {(currentShift || userProfile?.role === 'admin') && sale.status !== 'void' && (
                                                    <button onClick={() => {
                                                        setTempVoidSale(sale);
                                                        setAuthPurpose('VOID');
                                                        setShowPasswordModal(true);
                                                    }} className="text-red-600 font-bold hover:bg-red-50 px-2 py-1 rounded">
                                                        Anular
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col md:flex-row gap-2 md:overflow-hidden overflow-y-auto p-1 md:p-2 no-scrollbar">
                        {/* COLUMN 1: PRODUCT CATALOG */}
                        <div className={clsx(
                            "w-full md:w-[35%] flex flex-col gap-2 min-w-0 md:min-w-[300px] h-auto md:h-full shrink-0",
                            mobileStep !== 'CATALOG' && "hidden md:flex"
                        )}>
                            {/* Search Bar */}
                            <div className="bg-white p-1.5 rounded-full shadow-md shadow-slate-200/50 border-0 mb-3 sticky top-0 z-20">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar zapatos por marca, modelo..."
                                        className="w-full pl-10 pr-4 py-2 border-0 bg-transparent rounded-full focus:ring-0 outline-none text-slate-700 font-medium placeholder:text-slate-400 text-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Product Grid */}
                            <div className="flex-1 overflow-y-auto pr-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {filteredGroups.map(group => {
                                        const activeVariantId = selectedVariants[group.key] || group.variants[0]?.id;
                                        const activeVariant = group.variants.find(v => v.id === activeVariantId) || group.variants[0];

                                        return (
                                            <div
                                                key={group.key}
                                                className="bg-white p-3 rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all text-left flex flex-col h-full group border-0"
                                            >
                                                <div className="aspect-square bg-slate-100 rounded-lg mb-3 overflow-hidden border border-slate-100 relative">
                                                    {(activeVariant?.imageUrl || group.imageUrl) ? (
                                                        <img
                                                            src={activeVariant?.imageUrl || group.imageUrl}
                                                            alt={group.model}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                            <Ticket size={32} />
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm shadow-lg font-bold">
                                                        Stock: {activeVariant?.quantity || 0}
                                                    </div>
                                                </div>

                                                <div className="mb-2">
                                                    <h3 className="font-bold text-slate-900 truncate w-full uppercase text-xs text-blue-electric tracking-wider">{group.brand}</h3>
                                                    <p className="text-sm font-bold text-slate-700 truncate w-full">{group.model}</p>
                                                    {group.colors.length > 1 && (
                                                        <p className="text-[10px] text-slate-500 font-medium">{group.colors.length} colores disponibles</p>
                                                    )}
                                                </div>

                                                {/* Size Chips */}
                                                <div className="flex flex-wrap gap-1 mb-4">
                                                    {group.variants.map(v => (
                                                        <button
                                                            key={v.id}
                                                            onClick={() => setSelectedVariants(prev => ({ ...prev, [group.key]: v.id }))}
                                                            className={`min-w-[32px] h-8 px-1.5 text-[10px] font-bold rounded-full border transition-all flex flex-col items-center justify-center leading-tight ${activeVariantId === v.id
                                                                ? 'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-800/20'
                                                                : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'
                                                                }`}
                                                        >
                                                            <span>{v.size}</span>
                                                            {group.colors.length > 1 && (
                                                                <span className={`text-[8px] uppercase opacity-70 ${activeVariantId === v.id ? 'text-white' : 'text-slate-400'}`}>
                                                                    {v.color?.includes(' ')
                                                                        ? v.color.split(' ').map(w => w[0]).join('').substring(0, 3)
                                                                        : v.color?.substring(0, 3)}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="mt-auto flex justify-between items-center w-full pt-2 border-t border-slate-50">
                                                    <div className="text-blue-cobalt font-black text-lg">Bs {group.price}</div>
                                                    <button
                                                        onClick={() => {
                                                            if (activeVariant && activeVariant.quantity > 0) {
                                                                addToCart(activeVariant);
                                                            }
                                                        }}
                                                        disabled={!activeVariant || activeVariant.quantity <= 0}
                                                        className={`p-2.5 rounded-2xl transition-all shadow-sm ${activeVariant && activeVariant.quantity > 0
                                                            ? 'bg-slate-900 text-white hover:bg-slate-700 active:scale-95 shadow-lg shadow-slate-900/20'
                                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <Plus size={18} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {filteredGroups.length === 0 && (
                                    <div className="text-center py-12 text-slate-400">
                                        <Search size={48} className="mx-auto mb-2 opacity-20" />
                                        <p>No se encontraron productos</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 2: CART */}
                        <div className={clsx(
                            "w-full md:w-[30%] bg-white rounded-3xl shadow-xl shadow-slate-200/60 border-0 flex flex-col min-w-0 md:min-w-[280px] h-auto md:h-full shrink-0 z-10",
                            mobileStep !== 'CART' && "hidden md:flex"
                        )}>
                            {/* Cart Header */}
                            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                                <div className="bg-blue-pale p-2 rounded-lg text-blue-electric">
                                    <ShoppingCart size={20} />
                                </div>
                                <h2 className="font-bold text-slate-900">Carrito</h2>
                                <span className="ml-auto bg-slate-100 px-2 py-1 rounded-full text-xs font-bold text-slate-600">
                                    {cart.length} items
                                </span>
                            </div>

                            {/* Cart Items */}
                            <div className="flex-1 md:overflow-y-auto p-2 space-y-2 max-h-[40vh] md:max-h-none">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                        <ShoppingCart size={48} className="opacity-50" />
                                        <p className="font-medium text-sm">Tu carrito está vacío</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="flex gap-2 p-2 bg-slate-50 rounded-2xl border-0 group relative overflow-hidden">

                                            <div className="w-14 h-14 bg-white rounded-lg border border-slate-200 overflow-hidden shrink-0">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Ticket className="w-full h-full p-3 text-slate-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 truncate text-sm">{item.brand} {item.model}</h4>
                                                <p className="text-[10px] text-slate-500 mb-1">Talla: {item.size} {item.color ? ` - ${item.color}` : ''}</p>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-blue-electric font-bold text-sm">Bs {item.price * item.quantity}</div>
                                                    <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
                                                        <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 hover:bg-slate-100 rounded text-slate-600"><Minus size={12} /></button>
                                                        <span className="text-xs font-medium w-5 text-center">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 hover:bg-slate-100 rounded text-slate-600"><Plus size={12} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-red-400 hover:text-red-600 self-start p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* COLUMN 3: CHECKOUT */}
                        <div className={clsx(
                            "w-full md:flex-1 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border-0 flex flex-col min-w-0 md:min-w-[300px] relative h-auto md:h-full md:overflow-hidden mb-4 md:mb-0 z-20",
                            mobileStep !== 'CHECKOUT' && "hidden md:flex"
                        )}>
                            {cart.length === 0 && (
                                <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                                    <span className="text-slate-400 font-medium text-sm">Agrega productos para cobrar</span>
                                </div>
                            )}
                            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                                <h2 className="font-bold text-slate-900">Cobro</h2>
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto space-y-4">
                                {/* Customer */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Datos Cliente</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Nombre Cliente"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-electric bg-slate-50"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="NIT / CI"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-electric bg-slate-50"
                                            value={customerNit}
                                            onChange={(e) => setCustomerNit(e.target.value)}
                                        />
                                        <div className="flex items-center gap-2 pt-1">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={isFacebookSale}
                                                    onChange={(e) => setIsFacebookSale(e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                <span className="ml-2 text-xs font-bold text-slate-600">Venta por Facebook</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Discount */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Descuentos</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">Bs</span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white text-red-500 font-bold"
                                                value={discountBs}
                                                onChange={(e) => {
                                                    setDiscountBs(e.target.value);
                                                    setDiscountAuthorizedBy(null); // Reset auth when value changes
                                                }}
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Autorizado por..."
                                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-slate-50"
                                            value={discountAuthorizedBy}
                                            onChange={(e) => setDiscountAuthorizedBy(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                {/* Totals */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-slate-600 text-sm">
                                        <span>Subtotal</span>
                                        <span>Bs {cartTotals.subtotal.toFixed(2)}</span>
                                    </div>
                                    {Math.abs(cartTotals.discount) > 0.01 && (
                                        <div className={clsx("flex justify-between font-medium text-sm", cartTotals.discount > 0 ? "text-red-500" : "text-emerald-600")}>
                                            <span>{cartTotals.discount > 0 ? 'Descuento' : 'Recargo'}</span>
                                            <span>{cartTotals.discount > 0 ? '-' : '+'} Bs {Math.abs(cartTotals.discount).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end pt-2 border-t border-slate-100">
                                        <div className="font-bold text-slate-900">Total a Pagar</div>
                                        <div className="text-right">
                                            {isEditingTotal ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-sm font-bold text-blue-600">Bs</span>
                                                    <input
                                                        type="number"
                                                        autoFocus
                                                        className="w-32 text-right text-2xl font-bold text-blue-600 border-b-2 border-blue-600 outline-none bg-transparent p-0"
                                                        placeholder={cartTotals.totalBs.toFixed(2)}
                                                        onBlur={(e) => {
                                                            setIsEditingTotal(false);
                                                            const val = parseFloat(e.target.value);
                                                            if (!isNaN(val) && val >= 0) {
                                                                // Calculate discount needed to hit this total
                                                                // Total = Subtotal - Discount
                                                                // Discount = Subtotal - Total
                                                                const newDiscount = cartTotals.subtotal - val;
                                                                setDiscountBs(newDiscount.toFixed(2));
                                                                setDiscountAuthorizedBy(null); // Reset auth
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.target.blur();
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setIsEditingTotal(false);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="group cursor-pointer relative"
                                                    onClick={() => cart.length > 0 && setIsEditingTotal(true)}
                                                    title="Clic para modificar total manualmente"
                                                >
                                                    <div className="text-2xl font-bold text-blue-600 leading-none group-hover:text-blue-500 transition-colors flex items-center justify-end gap-2">
                                                        Bs {cartTotals.totalBs.toFixed(2)}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Edit2 size={16} />
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1">Approx $us {cartTotals.totalUsd.toFixed(2)}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Controls - Fixed at Bottom */}
                            <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setPaymentMethod('EFECTIVO')}
                                        className={`py-1.5 rounded-full text-xs font-bold transition-all ${paymentMethod === 'EFECTIVO' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        Efectivo
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('QR')}
                                        className={`py-1.5 rounded-full text-xs font-bold transition-all ${paymentMethod === 'QR' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        QR
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPaymentMethod('MIXTO');
                                            // Auto-calculate split (50/50? or full cash init?)
                                            // Good UX: Init Cash with Total, allow user to edit
                                            setMixedPayment({
                                                cash: '',
                                                qr: cartTotals.totalBs.toFixed(2) // Default all to QR or empty?
                                                // Let's leave empty so they type? Or better:
                                                // Maybe leaving empty is safer.
                                            });
                                        }}
                                        className={`py-1.5 rounded-full text-xs font-bold transition-all ${paymentMethod === 'MIXTO' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        Mixto
                                    </button>
                                </div>

                                {paymentMethod === 'EFECTIVO' && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Recibido</span>
                                            <input
                                                type="number"
                                                className="w-full pl-20 pr-4 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-base"
                                                placeholder="0.00"
                                                value={amountTendered}
                                                onChange={(e) => setAmountTendered(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center bg-emerald-50 px-3 py-1.5 rounded border border-emerald-100">
                                            <span className="text-emerald-800 text-xs font-medium">Cambio:</span>
                                            <span className="text-lg font-bold text-emerald-700">
                                                Bs {Math.max(0, (parseFloat(amountTendered) || 0) - cartTotals.totalBs).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'MIXTO' && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500">Monto Efectivo</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    placeholder="0.00"
                                                    value={mixedPayment.cash}
                                                    onChange={(e) => {
                                                        const cashVal = e.target.value;
                                                        // Auto-calculate QR remainder
                                                        const cashNum = parseFloat(cashVal) || 0;
                                                        const remainder = Math.max(0, cartTotals.totalBs - cashNum);

                                                        setMixedPayment({
                                                            cash: cashVal,
                                                            qr: remainder.toFixed(2)
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500">Monto QR</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    placeholder="0.00"
                                                    value={mixedPayment.qr}
                                                    onChange={(e) => setMixedPayment({ ...mixedPayment, qr: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded border border-slate-100">
                                            <div className="text-xs text-slate-500">
                                                Total: <b>Bs {cartTotals.totalBs.toFixed(2)}</b>
                                            </div>
                                            <div className={`text-sm font-bold flex items-center gap-2 ${((parseFloat(mixedPayment.cash) || 0) + (parseFloat(mixedPayment.qr) || 0)) >= (cartTotals.totalBs - 0.05) ? 'text-emerald-600' : 'text-red-500'}`}>
                                                <span>Suma: Bs {((parseFloat(mixedPayment.cash) || 0) + (parseFloat(mixedPayment.qr) || 0)).toFixed(2)}</span>
                                                {((parseFloat(mixedPayment.cash) || 0) + (parseFloat(mixedPayment.qr) || 0)) >= (cartTotals.totalBs - 0.05) ? <Check size={16} /> : <AlertCircle size={16} />}
                                            </div>
                                        </div>

                                        {/* Show Change if overpaid via Cash part (implicitly) */}
                                        {((parseFloat(mixedPayment.cash) || 0) + (parseFloat(mixedPayment.qr) || 0)) > cartTotals.totalBs && (
                                            <div className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded border border-emerald-100">
                                                <span className="text-emerald-800 text-sm font-medium">Cambio:</span>
                                                <span className="text-xl font-bold text-emerald-700">
                                                    Bs {(((parseFloat(mixedPayment.cash) || 0) + (parseFloat(mixedPayment.qr) || 0)) - cartTotals.totalBs).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleProcessSale}
                                    disabled={cart.length === 0}
                                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-2xl font-bold text-sm shadow-md shadow-slate-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    {isSubmitting ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <>
                                            <Ticket size={20} />
                                            Cobrar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Custom Sale Confirmation Modal */}
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

            {/* Void Confirmation Modal */}
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

            {/* Close Shift Modal - SIMPLIFIED */}
            {
                showCloseShiftModal && (
                    <div className="absolute inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="bg-red-600 p-4 text-white flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2">
                                    <LogOut size={20} /> Cerrar Caja
                                </h3>
                                <button onClick={() => setShowCloseShiftModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleCloseShift} className="p-6 space-y-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <p>Al cerrar caja se generará el reporte final del sistema.</p>
                                </div>

                                <p className="text-slate-600 text-center py-2">
                                    ¿Estás seguro de cerrar tu turno? Se imprimirá el reporte de cierre automáticamente.
                                </p>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCloseShiftModal(false)}
                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Cerrando...' : 'Confirmar Cierre'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                showNavWarning && (
                    <div className="absolute inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-center mb-4 text-amber-100">
                                <div className="p-3 bg-amber-100 rounded-full">
                                    <AlertCircle className="text-amber-600" size={32} />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Transacción en curso</h3>
                            <p className="text-slate-500 text-center mb-6">¿Desea cambiar de ventana? Se perderán los datos de la venta actual.</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowNavWarning(false);
                                        setPendingNavigation(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                                >
                                    No, Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setShowNavWarning(false);
                                        if (pendingNavigation) pendingNavigation();
                                        setPendingNavigation(null);

                                        // Clear Cart and Payment Fields
                                        setCart([]);
                                        setAmountTendered('');
                                        setCustomerName('SIN NOMBRE');
                                        setCustomerNit('0');
                                        setDiscountBs('');
                                        setDiscountAuthorizedBy(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                                >
                                    Sí, Salir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Discount Auth Modal */}
            {
                showPasswordModal && (
                    <div className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-center mb-4 text-blue-100">
                                <div className="p-3 bg-blue-100 rounded-full">
                                    <User className="text-blue-600" size={32} />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Autorización Requerida</h3>
                            <p className="text-slate-500 text-center mb-4 text-sm">Descuentos mayores a 20 Bs requieren contraseña de administrador.</p>

                            <form onSubmit={handleAuthSubmit}>
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showAuthPassword ? "text" : "password"}
                                            autoFocus
                                            className="w-full border border-slate-300 rounded-lg p-2 pr-10 text-sm outline-none focus:border-blue-500"
                                            placeholder="Ingrese contraseña..."
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowAuthPassword(!showAuthPassword)}
                                            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {authError && <p className="text-red-500 text-xs mt-1">{authError}</p>}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordModal(false)}
                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Autorizar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* OPEN SHIFT MODAL - REPLACES BLOCKING UI */}
            {
                showOpenShiftModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 w-full max-w-md animate-in fade-in zoom-in duration-200">
                            <button
                                onClick={() => setShowOpenShiftModal(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-red-500 z-10 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="bg-slate-900 p-6 text-white text-center relative">
                                <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                    <Lock size={32} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-bold">Apertura de Caja</h2>
                                <p className="text-slate-400 text-sm mt-2">Ingresa el monto inicial de tu turno</p>
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
                                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
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
                                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                                                placeholder="0.00"
                                                value={openingData.usd}
                                                onChange={(e) => setOpeningData({ ...openingData, usd: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start">
                                    <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
                                    <p className="text-sm text-blue-700">
                                        Debes abrir caja antes de registrar ventas.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Lock size={20} />
                                    {isSubmitting ? 'Abriendo Caja...' : 'Aperturar Caja'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Success/Error Toast */}
            {
                toast.show && (
                    <div className={`fixed bottom-4 right-4 z-[200] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                        {toast.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                        <span className="font-bold">{toast.message}</span>
                    </div>
                )
            }
        </div >
    );
}

