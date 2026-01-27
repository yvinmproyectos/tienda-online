import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!username || !password) {
            setError('Por favor ingrese usuario y contraseña');
            return;
        }

        try {
            setError('');
            setLoading(true);
            const { profile } = await login(username, password);

            // Redirect based on role
            if (profile?.role === 'cashier' || profile?.role === 'cajero') {
                navigate('/pos');
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setError('Usuario o contraseña incorrectos');
            } else if (error.code === 'auth/invalid-credential') {
                setError('Usuario o contraseña incorrectos');
            } else {
                setError('Error al iniciar sesión. Intente nuevamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#ECF0F1] via-white to-[#BDC3C7] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#5DADE2] rounded-2xl mb-4 shadow-lg">
                        <LogIn className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-[#2C3E50]">Zapatería POS</h1>
                    <p className="text-slate-500 mt-2">Ingrese sus credenciales para continuar</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Username Input */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Usuario
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="text-slate-400" size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent"
                                    placeholder="Ingrese su usuario"
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="text-slate-400" size={20} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent"
                                    placeholder="Ingrese su contraseña"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#5DADE2] hover:bg-[#3498DB] text-white font-bold py-3 rounded-lg transition-colors disabled:bg-[#85C1E9] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Ingresando...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    <span>Iniciar Sesión</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-500 text-center">
                            Usuario por defecto: <span className="font-mono font-bold">admin</span>
                        </p>
                    </div>
                </div>

                {/* Version Info */}
                <p className="text-center text-xs text-slate-400 mt-6">
                    Sistema de Gestión v1.0
                </p>
            </div>
        </div>
    );
}
