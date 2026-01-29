import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  LogOut,
  Menu,
  X,
  Building2,
  BarChart3,
  User,
  Users as UsersIcon,
  Settings,
  AlertCircle,
  HelpCircle,
  Tag,
  Key,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { settingsService } from '../services/settingsService';
import OfflineAlert from './OfflineAlert';
import ymtLogo from '../assets/ymt-logo.png';

export default function Layout({ children }) {
  const { userProfile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // Clear any stale localStorage cache on mount
    settingsService.clearCache();

    // Subscribe to real-time settings updates
    const unsubscribe = settingsService.subscribeToSettings((settings) => {
      console.log('[Layout] Settings updated:', settings.storeName);
      setStoreSettings(settings);
    });

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /* Logout Warning State */
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    // If POS has changes, show custom modal instead of browser confirm
    if (window.hasPOSUnsavedChanges) {
      setShowLogoutConfirm(true);
      return;
    }
    await performLogout();
  };

  const performLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
      alert("Error al cerrar sesión.");
    }
  };

  // Define menu items with role permissions
  const allMenuItems = [
    { name: 'Caja y Ventas', href: '/pos', icon: ShoppingCart, roles: ['admin', 'cashier'] },
    { name: 'Inventario', href: '/inventory', icon: Package, roles: ['admin'] },
    { name: 'Proveedores', href: '/suppliers', icon: Building2, roles: ['admin'] },
    { name: 'Reportes', href: '/reports', icon: BarChart3, roles: ['admin'] },
    { name: 'Descuentos', href: '/discounts', icon: Tag, roles: ['admin'] },
    { name: 'Usuarios', href: '/users', icon: UsersIcon, roles: ['admin'] },
    { name: 'Configuración', href: '/settings', icon: Settings, roles: ['admin'] },
  ];

  // Filter menu items based on user role
  let navigation = userProfile?.role
    ? allMenuItems.filter(item => item.roles.includes(userProfile.role))
    : allMenuItems;

  // Strict check for "admin" username to show Super User module
  // Check for both simple 'admin' and full email format which might be stored in legacy profiles
  const isSuperUser = userProfile?.username?.toLowerCase() === 'admin' ||
    userProfile?.username?.toLowerCase() === 'admin@sistema.local';

  if (isSuperUser) {
    navigation.push({ name: 'Súper Usuario', href: '/superuser', icon: Shield, roles: ['admin'] });
  }

  return (
    <div className="h-full min-h-screen bg-[#ECF0F1] flex overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 bg-[#2C3E50] border-r border-[#34495E] shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-[#34495E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5DADE2] rounded-xl flex items-center justify-center overflow-hidden shrink-0">
              {storeSettings?.logoBase64 ? (
                <img src={storeSettings.logoBase64} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ShoppingCart className="text-white" size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-lg truncate leading-tight">
                {storeSettings?.storeName || 'Zapatería POS'}
              </h1>
              <p className="text-slate-400 text-xs truncate">Sistema de Gestión</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto no-scrollbar">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-full text-sm font-bold transition-all',
                  isActive
                    ? 'bg-[#5DADE2] text-white shadow-md shadow-[#5DADE2]/30'
                    : 'text-slate-300 hover:bg-[#34495E] hover:text-white'
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-[#34495E]">
          <OfflineAlert />
          <div className="flex items-center gap-3 p-3 bg-[#34495E] rounded-2xl mb-2">
            <div className="w-10 h-10 bg-[#5DADE2] rounded-full flex items-center justify-center shrink-0">
              <User className="text-white" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {userProfile?.displayName || userProfile?.username}
              </p>
              <p className="text-slate-400 text-xs capitalize">
                {userProfile?.role === 'admin' ? 'Administrador' : 'Cajero'}
              </p>
            </div>
          </div>


          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#233545] hover:bg-red-600/90 text-slate-300 hover:text-white rounded-lg text-sm font-bold transition-all group"
          >
            <LogOut size={18} className="text-slate-400 group-hover:text-white transition-colors" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* YMT Logo Footer */}
        <div className="p-4 pt-0 flex justify-center pb-4">
          <img
            src={ymtLogo}
            alt="YMT Soporte y Tecnología"
            className="w-24 opacity-60 hover:opacity-100 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-300 cursor-pointer"
            title="Soporte y Tecnología"
          />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#2C3E50] border-b border-[#34495E] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#5DADE2] rounded-lg flex items-center justify-center overflow-hidden">
            {storeSettings?.logoBase64 ? (
              <img src={storeSettings.logoBase64} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ShoppingCart className="text-white" size={16} />
            )}
          </div>
          <h1 className="text-white font-bold truncate">
            {storeSettings?.storeName || 'Zapatería POS'}
          </h1>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-white p-2"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        >
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#2C3E50] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[#34495E]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5DADE2] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                  {storeSettings?.logoBase64 ? (
                    <img src={storeSettings.logoBase64} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="text-white" size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-white font-bold text-lg truncate leading-tight">
                    {storeSettings?.storeName || 'Zapatería POS'}
                  </h1>
                  <p className="text-slate-400 text-xs truncate">Sistema de Gestión</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-full text-sm font-bold transition-all',
                      isActive
                        ? 'bg-[#5DADE2] text-white shadow-lg shadow-[#5DADE2]/50'
                        : 'text-slate-300 hover:bg-[#34495E] hover:text-white'
                    )}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t border-[#34495E]">
              <OfflineAlert />
              <div className="flex items-center gap-3 p-3 bg-[#34495E] rounded-lg mb-2">
                <div className="w-10 h-10 bg-[#5DADE2] rounded-full flex items-center justify-center shrink-0">
                  <User className="text-white" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {userProfile?.displayName || userProfile?.username}
                  </p>
                  <p className="text-slate-300 text-xs capitalize">
                    {userProfile?.role === 'admin' ? 'Administrador' : 'Cajero'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#233545] hover:bg-red-600/90 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all group"
              >
                <LogOut size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-center mb-4 text-amber-100">
              <div className="p-3 bg-amber-100 rounded-full">
                <AlertCircle className="text-amber-600" size={32} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Transacción en curso</h3>
            <p className="text-slate-500 text-center mb-6">Tienes una transacción en curso. ¿Deseas salir?</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar, Seguir Aquí
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  performLogout();
                }}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
              >
                Sí, Salir
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
