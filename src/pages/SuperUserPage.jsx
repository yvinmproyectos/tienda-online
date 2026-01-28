import React, { useState } from 'react';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { systemService } from '../services/systemService';
import { PageHeader } from '../components/PageHeader';

export default function SuperUserPage() {
    const [isResetting, setIsResetting] = useState({ inventory: false, sales: false });
    const [resetConfirm, setResetConfirm] = useState(null); // 'inventory' | 'sales' | null
    const [message, setMessage] = useState(null);

    const showMessage = (msg, type = 'success') => {
        setMessage({ text: msg, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleReset = async (type) => {
        try {
            setIsResetting(prev => ({ ...prev, [type]: true }));
            if (type === 'inventory') {
                await systemService.resetInventory();
                showMessage('Inventario borrado correctamente', 'success');
            } else if (type === 'sales') {
                await systemService.resetSales();
                showMessage('Ventas y cierres borrados correctamente', 'success');
            }
        } catch (error) {
            showMessage(`Error al reiniciar ${type}: ${error.message}`, 'error');
        } finally {
            setIsResetting(prev => ({ ...prev, [type]: false }));
            setResetConfirm(null);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Súper Usuario"
                subtitle="Administración Avanzada y Zona de Peligro"
                icon={Shield}
            />

            {message && (
                <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle className="text-red-600" size={24} />
                    <div>
                        <h3 className="font-bold text-red-900">Zona de Peligro</h3>
                        <p className="text-sm text-red-700">Acciones críticas y permanentes</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-red-100 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-1">Borrar Inventario</h4>
                            <p className="text-xs text-slate-500 mb-4">
                                Elimina todos los productos y el historial de ingresos. Esta acción NO elimina los usuarios ni las ventas realizadas.
                            </p>
                        </div>
                        <button
                            onClick={() => setResetConfirm('inventory')}
                            disabled={isResetting.inventory}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all text-sm"
                        >
                            <RefreshCw size={16} className={isResetting.inventory ? 'animate-spin' : ''} />
                            {isResetting.inventory ? 'Borrando...' : 'Borrar Todo el Inventario'}
                        </button>
                    </div>

                    <div className="p-4 bg-white rounded-lg border border-red-100 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-1">Borrar Ventas</h4>
                            <p className="text-xs text-slate-500 mb-4">
                                Elimina todas las transacciones de ventas, cierres de caja y movimientos de efectivo. Mantiene el inventario intacto.
                            </p>
                        </div>
                        <button
                            onClick={() => setResetConfirm('sales')}
                            disabled={isResetting.sales}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all text-sm"
                        >
                            <RefreshCw size={16} className={isResetting.sales ? 'animate-spin' : ''} />
                            {isResetting.sales ? 'Borrando...' : 'Borrar Todas las Ventas'}
                        </button>
                    </div>
                </div>
            </div>

            {/* System Reset Confirmation Modal */}
            {resetConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 scale-100 animate-in zoom-in-95 duration-200 border-t-4 border-red-600">
                        <div className="flex justify-center mb-4 text-red-600">
                            <AlertTriangle size={48} />
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-900 mb-2">
                            ¿Estás absolutamente seguro?
                        </h3>
                        <p className="text-slate-500 text-center mb-6 text-sm">
                            Estás a punto de borrar permanentemente todos los datos de
                            <b className="text-red-600"> {resetConfirm === 'inventory' ? 'Inventario y Productos' : 'Ventas y Movimientos'}</b>.
                            Esta acción no se puede deshacer.
                        </p>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleReset(resetConfirm)}
                                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm"
                            >
                                Sí, eliminar datos permanentemente
                            </button>
                            <button
                                onClick={() => setResetConfirm(null)}
                                className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                            >
                                No, cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
