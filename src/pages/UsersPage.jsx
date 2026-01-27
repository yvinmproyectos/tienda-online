import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
    Users as UsersIcon,
    Plus,
    Search,
    Edit2,
    Trash2,
    Key,
    Check,
    X,
    AlertCircle,
    Shield,
    User
} from 'lucide-react';
import { userService } from '../services/userService';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUser, setResetUser] = useState(null);
    const [tempPassword, setTempPassword] = useState('');

    const [formData, setFormData] = useState({
        username: '',
        displayName: '',
        password: '',
        confirmPassword: '',
        role: 'cashier'
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const data = await userService.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            setError('Error al cargar usuarios');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                displayName: user.displayName || '',
                password: '',
                confirmPassword: '',
                role: user.role
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                displayName: '',
                password: '',
                confirmPassword: '',
                role: 'cashier'
            });
        }
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validations
        if (!editingUser) {
            // Creating new user
            if (formData.password.length < 6) {
                setError('La contraseña debe tener al menos 6 caracteres');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setError('Las contraseñas no coinciden');
                return;
            }
        }

        setIsSubmitting(true);

        try {
            if (editingUser) {
                // Update existing user
                await userService.updateUser(editingUser.uid, {
                    displayName: formData.displayName,
                    role: formData.role
                });
                setSuccess('Usuario actualizado correctamente');
            } else {
                // Create new user
                await userService.createUser(
                    formData.username,
                    formData.password,
                    formData.role,
                    formData.displayName
                );
                setSuccess('Usuario creado correctamente');
            }

            setIsModalOpen(false);
            loadUsers();

            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            console.error('Error saving user:', error);
            if (error.code === 'auth/email-already-in-use') {
                setError('El nombre de usuario ya existe');
            } else {
                setError('Error al guardar usuario');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (uid) => {
        if (!window.confirm('¿Estás seguro de desactivar este usuario?')) return;

        try {
            await userService.deleteUser(uid);
            setSuccess('Usuario desactivado correctamente');
            loadUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            console.error('Error deleting user:', error);
            setError('Error al desactivar usuario');
        }
    };

    const handleResetPassword = (user) => {
        setResetUser(user);
        setTempPassword('');
        setShowResetModal(true);
    };

    const confirmResetPassword = async () => {
        if (tempPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await userService.resetUserPassword(resetUser.uid, tempPassword);
            setSuccess(`Contraseña restablecida. Nueva contraseña: ${tempPassword}`);
            setShowResetModal(false);
            setResetUser(null);
            setTempPassword('');

            setTimeout(() => setSuccess(''), 10000);
        } catch (error) {
            console.error('Error resetting password:', error);
            setError('Error al restablecer contraseña');
        } finally {
            setIsSubmitting(false);
        }
    };

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setTempPassword(password);
    };

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestión de Usuarios"
                subtitle="Administra usuarios del sistema"
                icon={UsersIcon}
                action={
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={20} />
                        Nuevo Usuario
                    </button>
                }
            />

            {/* Success/Error Messages */}
            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 text-emerald-700">
                    <Check size={20} />
                    <span className="font-medium">{success}</span>
                </div>
            )}

            {error && !isModalOpen && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar usuarios..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Usuario</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Nombre</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Rol</th>
                                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        <UsersIcon size={48} className="mx-auto text-slate-300 mb-2" />
                                        <p>No se encontraron usuarios</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                                    {user.role === 'admin' ? (
                                                        <Shield size={20} className="text-purple-600" />
                                                    ) : (
                                                        <User size={20} className="text-blue-600" />
                                                    )}
                                                </div>
                                                <span className="font-medium text-slate-900">{user.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{user.displayName || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {user.role === 'admin' ? 'Administrador' : 'Cajero'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar usuario"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(user)}
                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Restablecer contraseña"
                                                >
                                                    <Key size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.uid)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Desactivar usuario"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Nombre de Usuario
                                </label>
                                <input
                                    type="text"
                                    required
                                    disabled={editingUser}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-100"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Rol
                                </label>
                                <select
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="cashier">Cajero</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            {!editingUser && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Contraseña
                                        </label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Confirmar Contraseña
                                        </label>
                                        <input
                                            type="password"
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Key size={24} className="text-amber-600" />
                                Restablecer Contraseña
                            </h2>
                            <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-slate-600">
                                Genera una contraseña temporal para <strong>{resetUser?.username}</strong>
                            </p>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Nueva Contraseña Temporal
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono"
                                        value={tempPassword}
                                        onChange={(e) => setTempPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={generatePassword}
                                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
                                    >
                                        Generar
                                    </button>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <AlertCircle size={16} className="inline mr-2" />
                                Comparte esta contraseña con el usuario de forma segura.
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowResetModal(false)}
                                    className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmResetPassword}
                                    className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Restableciendo...' : 'Restablecer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
