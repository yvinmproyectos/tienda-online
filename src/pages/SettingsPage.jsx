import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Save, Key, Store, Eye, EyeOff } from 'lucide-react';
import { settingsService } from '../services/settingsService';

import { PageHeader } from '../components/PageHeader';

export default function SettingsPage() {
    // Settings state
    const [settings, setSettings] = useState({
        storeName: '',
        storeAddress: '',
        storePhone: '',
        logoBase64: '',
        receiptFooter: '',
        exchangeRate: '6.96',
        discountPassword: '',
        discountAuthThreshold: '20'
    });
    const [showDiscountPassword, setShowDiscountPassword] = useState(false);

    const [logoFile, setLogoFile] = useState(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);



    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setIsLoading(true);
            const data = await settingsService.getSettings();
            setSettings({
                storeName: data.storeName || '',
                storeAddress: data.storeAddress || '',
                storePhone: data.storePhone || '',
                logoBase64: data.logoBase64 || '',
                receiptFooter: data.receiptFooter || '¡Gracias por su compra!',
                exchangeRate: data.exchangeRate?.toString() || '6.96',
                discountPassword: '',  // Don't show password
                discountAuthThreshold: data.discountAuthThreshold?.toString() || '20'
            });
        } catch (error) {
            showMessage('Error al cargar configuración', 'error');
        } finally {
            setIsLoading(false);
        }
    };



    const handleSave = async () => {
        try {
            setIsSaving(true);

            // Upload logo if changed
            if (logoFile) {
                const base64 = await settingsService.fileToBase64(logoFile);
                settings.logoBase64 = base64;
            }

            // Save all settings
            await settingsService.updateSettings({
                storeName: settings.storeName,
                storeAddress: settings.storeAddress,
                storePhone: settings.storePhone,
                logoBase64: settings.logoBase64,
                receiptFooter: settings.receiptFooter,
                exchangeRate: parseFloat(settings.exchangeRate) || 6.96,
                discountAuthThreshold: parseFloat(settings.discountAuthThreshold) || 20,
                ...(settings.discountPassword && { discountPassword: settings.discountPassword })
            });

            showMessage('Configuración guardada correctamente', 'success');
            setLogoFile(null);
        } catch (error) {
            showMessage(error.message || 'Error al guardar configuración', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024) {
                showMessage('El logo debe ser menor a 500KB', 'error');
                return;
            }
            setLogoFile(file);

            // Preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setSettings(prev => ({ ...prev, logoBase64: e.target.result }));
            };
            reader.readAsDataURL(file);
        }
    };



    const showMessage = (msg, type = 'success') => {
        setMessage({ text: msg, type });
        setTimeout(() => setMessage(''), 3000);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            <PageHeader
                title="Configuración"
                subtitle="Ajustes generales del sistema"
                icon={Settings}
            />

            {message && (
                <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-6">
                {/* Store Information */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Store className="text-blue-600" size={24} />
                        <div>
                            <h3 className="font-bold text-slate-900">Información de la Tienda</h3>
                            <p className="text-sm text-slate-500">Aparece en los tickets de venta</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Logo */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Logo de la Tienda
                            </label>
                            {settings.logoBase64 && (
                                <div className="mb-3">
                                    <img src={settings.logoBase64} alt="Logo" className="h-20 object-contain border rounded p-2" />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <p className="text-xs text-slate-500 mt-1">Máximo 500KB. Formatos: JPG, PNG, GIF</p>
                        </div>

                        {/* Store Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nombre de la Tienda
                            </label>
                            <input
                                type="text"
                                value={settings.storeName}
                                onChange={(e) => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Zapatería Mi Tienda"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                value={settings.storePhone}
                                onChange={(e) => setSettings(prev => ({ ...prev, storePhone: e.target.value }))}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="77123456"
                            />
                        </div>

                        {/* Address */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Dirección
                            </label>
                            <textarea
                                value={settings.storeAddress}
                                onChange={(e) => setSettings(prev => ({ ...prev, storeAddress: e.target.value }))}
                                rows={2}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Av. Principal #123, Zona Centro"
                            />
                        </div>

                        {/* Receipt Footer */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Leyenda Inferior del Recibo (Pie de Ticket)
                            </label>
                            <textarea
                                value={settings.receiptFooter}
                                onChange={(e) => setSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                                rows={2}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="¡Gracias por su compra!"
                            />
                            <p className="text-xs text-slate-500 mt-1">Este mensaje aparecerá al final de todos los tickets impresos.</p>
                        </div>
                    </div>
                </div>

                {/* Exchange Rate */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <DollarSign className="text-blue-600" size={24} />
                        <div>
                            <h3 className="font-bold text-slate-900">Tipo de Cambio</h3>
                            <p className="text-sm text-slate-500">Tasa de conversión Bs a $us</p>
                        </div>
                    </div>
                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Tasa $us 1 = Bs
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.exchangeRate}
                            onChange={(e) => setSettings(prev => ({ ...prev, exchangeRate: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="6.96"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Esta tasa se usa para calcular conversiones de moneda en ventas
                        </p>
                    </div>
                </div>

                {/* Discount Password */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Key className="text-amber-600" size={24} />
                        <div>
                            <h3 className="font-bold text-slate-900">Contraseña de Descuentos</h3>
                            <p className="text-sm text-slate-500">Seguridad para descuentos mayores al 20%</p>
                        </div>
                    </div>
                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nueva Contraseña
                        </label>
                        <div className="relative mb-4">
                            <input
                                type={showDiscountPassword ? "text" : "password"}
                                value={settings.discountPassword}
                                onChange={(e) => setSettings(prev => ({ ...prev, discountPassword: e.target.value }))}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 pr-10"
                                placeholder="Dejar en blanco para mantener la actual"
                            />
                            <button
                                type="button"
                                onClick={() => setShowDiscountPassword(!showDiscountPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showDiscountPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Monto Umbral para Contraseña (Bs)
                        </label>
                        <input
                            type="number"
                            value={settings.discountAuthThreshold}
                            onChange={(e) => setSettings(prev => ({ ...prev, discountAuthThreshold: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            placeholder="20"
                        />
                        <p className="text-xs text-slate-500 mt-1">Descuentos mayores a este monto requerirán contraseña de administrador.</p>
                    </div>
                </div>


            </div>
        </div>
    );
}
