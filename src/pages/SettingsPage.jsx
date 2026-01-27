import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Save, Key, Store, MapPin, Phone, Image, Users, UserPlus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { settingsService } from '../services/settingsService';
import { userService } from '../services/userService';
import { systemService } from '../services/systemService';
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

    const [logoFile, setLogoFile] = useState(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // User management state
    const [users, setUsers] = useState([]);
    const [showUserForm, setShowUserForm] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        displayName: ''
    });
    const [editingUserId, setEditingUserId] = useState(null);
    const [userError, setUserError] = useState('');

    // System Reset state
    const [isResetting, setIsResetting] = useState({ inventory: false, sales: false });
    const [resetConfirm, setResetConfirm] = useState(null); // 'inventory' | 'sales' | null

    // Load settings and users on mount
    useEffect(() => {
        loadSettings();
        loadUsers();
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

    const loadUsers = async () => {
        try {
            const userList = await userService.getUsers();
            setUsers(userList);
        } catch (error) {
            console.error('Error loading users:', error);
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

    const handleCreateUser = async () => {
        try {
            setUserError('');

            // Validation
            if (!newUser.username || !newUser.displayName) {
                setUserError('Usuario y Nombre son obligatorios');
                return;
            }

            if (!editingUserId && !newUser.password) {
                setUserError('Contraseña es obligatoria para nuevos usuarios');
                return;
            }

            if (newUser.password && newUser.password.length < 6) {
                setUserError('La contraseña debe tener al menos 6 caracteres');
                return;
            }

            if (editingUserId) {
                // Update Logic
                await userService.updateUser(editingUserId, {
                    displayName: newUser.displayName,
                    // Can also update other fields if needed, but not password directly via client SDK
                });
                showMessage('Usuario actualizado correctamente', 'success');
            } else {
                // Check if username exists
                const exists = await userService.usernameExists(newUser.username);
                if (exists) {
                    setUserError('El nombre de usuario ya existe');
                    return;
                }

                // Create user
                await userService.createUser(
                    newUser.username,
                    newUser.password,
                    'cashier',
                    newUser.displayName
                );
                showMessage('Usuario creado correctamente', 'success');
            }

            setShowUserForm(false);
            setEditingUserId(null);
            setNewUser({ username: '', password: '', displayName: '' });
            loadUsers();
        } catch (error) {
            setUserError(error.message || 'Error al guardar usuario');
        }
    };

    const handleEditUser = (user) => {
        setEditingUserId(user.uid);
        setNewUser({
            username: user.username,
            password: '', // Password placeholder
            displayName: user.displayName
        });
        setShowUserForm(true);
    };

    const [userToDelete, setUserToDelete] = useState(null);

    // ... (rest of code)

    // Replace handleDeleteUser logic
    const handleDeleteUser = (user) => {
        setUserToDelete(user);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await userService.deleteUser(userToDelete.uid);
            showMessage('Usuario eliminado', 'success');
            loadUsers();
        } catch (error) {
            console.error(error);
            showMessage('Error al eliminar usuario', 'error');
        } finally {
            setUserToDelete(null);
        }
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
                        <input
                            type="password"
                            value={settings.discountPassword}
                            onChange={(e) => setSettings(prev => ({ ...prev, discountPassword: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 mb-4"
                            placeholder="Dejar en blanco para mantener la actual"
                        />

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

                {/* User Management */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Users className="text-emerald-600" size={24} />
                            <div>
                                <h3 className="font-bold text-slate-900">Gestión de Usuarios</h3>
                                <p className="text-sm text-slate-500">Crear y administrar cajeros</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setShowUserForm(!showUserForm); setEditingUserId(null); setNewUser({ username: '', password: '', displayName: '' }); }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm"
                        >
                            <UserPlus size={18} />
                            Crear Cajero
                        </button>
                    </div>

                    {/* Create/Edit User Form */}
                    {showUserForm && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-slate-700 mb-4">{editingUserId ? 'Editar Cajero' : 'Nuevo Cajero'}</h4>
                            {userError && (
                                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                                    {userError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
                                    <input
                                        type="text"
                                        value={newUser.username}
                                        disabled={!!editingUserId}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-200 disabled:text-slate-500"
                                        placeholder="cajero1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        placeholder={editingUserId ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={newUser.displayName}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        placeholder="Juan Pérez"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={handleCreateUser}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 text-sm"
                                >
                                    {editingUserId ? 'Actualizar Usuario' : 'Crear Usuario'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowUserForm(false);
                                        setUserError('');
                                        setNewUser({ username: '', password: '', displayName: '' });
                                        setEditingUserId(null);
                                    }}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* User List */}
                    <div className="space-y-2">
                        {users.map(user => (
                            <div key={user.uid} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-blue-700 font-bold text-sm">
                                            {user.displayName?.charAt(0) || user.username?.charAt(0) || '?'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">{user.displayName || user.username}</div>
                                        <div className="text-xs text-slate-500">@{user.username}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {user.role === 'admin' ? 'Administrador' : 'Cajero'}
                                    </span>
                                    {user.role !== 'admin' && (
                                        <>
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar usuario"
                                            >
                                                <Settings size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar usuario"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {users.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                No hay usuarios registrados
                            </div>
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
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

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save size={20} />
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
                {/* Custom Delete Confirmation Modal */}
                {userToDelete && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Trash2 className="text-red-600" size={32} />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">¿Eliminar Usuario?</h3>
                            <p className="text-slate-500 text-center mb-6">
                                Estás a punto de eliminar a <b>{userToDelete.username}</b>. Esta acción no se puede deshacer.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setUserToDelete(null)}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDeleteUser}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm shadow-red-200"
                                >
                                    Sí, Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                                    Sí, eliminar datos permenantemente
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
        </div>
    );
}
