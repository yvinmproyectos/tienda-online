import React, { useState, useEffect } from 'react';
import { supplierService } from '../services/supplierService';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, User, Building2, X, Save } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
    });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        setIsLoading(true);
        try {
            const data = await supplierService.getSuppliers();
            setSuppliers(data);
        } catch (error) {
            console.error("Error loading suppliers:", error);
            alert("Error al cargar proveedores");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name || '',
                contactName: supplier.contactName || '',
                phone: supplier.phone || '',
                email: supplier.email || '',
                address: supplier.address || '',
                notes: supplier.notes || ''
            });
        } else {
            setEditingSupplier(null);
            setFormData({
                name: '',
                contactName: '',
                phone: '',
                email: '',
                address: '',
                notes: ''
            });
        }
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este proveedor?')) return;
        try {
            await supplierService.deleteSupplier(id);
            loadSuppliers();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingSupplier) {
                await supplierService.updateSupplier(editingSupplier.id, formData);
            } else {
                await supplierService.addSupplier(formData);
            }
            setShowModal(false);
            loadSuppliers();
        } catch (error) {
            console.error(error);
            alert("Error al guardar proveedor");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Proveedores"
                subtitle="Gestión de proveedores y contactos"
                icon={Building2}
                action={
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-[#2C3E50] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#34495E] transition-colors flex items-center gap-2 shadow-lg shadow-[#2C3E50]/20"
                    >
                        <Plus size={20} />
                        Nuevo Proveedor
                    </button>
                }
            />

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por empresa o contacto..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid/List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-slate-400">Cargando proveedores...</div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                        No se encontraron proveedores
                    </div>
                ) : (
                    filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-[#D6EAF8] text-[#5DADE2] rounded-lg">
                                        <Building2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{supplier.name}</h3>
                                        {supplier.contactName && (
                                            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                                                <User size={14} />
                                                <span>{supplier.contactName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 invisible group-hover:visible transition-all">
                                    <button
                                        onClick={() => handleOpenModal(supplier)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(supplier.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                {supplier.phone && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Phone size={16} className="text-slate-400 shrink-0" />
                                        <span>{supplier.phone}</span>
                                    </div>
                                )}
                                {supplier.email && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Mail size={16} className="text-slate-400 shrink-0" />
                                        <span className="truncate">{supplier.email}</span>
                                    </div>
                                )}
                                {supplier.address && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <MapPin size={16} className="text-slate-400 shrink-0" />
                                        <span className="truncate">{supplier.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Empresa *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Distribuidora XYZ"
                                    />
                                </div>

                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Contacto</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                                        value={formData.contactName}
                                        onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                        placeholder="Nombre del vendedor"
                                    />
                                </div>

                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+591 ..."
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="contacto@empresa.com"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Dirección</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Av. Principal #123"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Notas</label>
                                    <textarea
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 h-24 resize-none"
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Detalles adicionales..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-[#5DADE2] text-white rounded-lg font-bold hover:bg-[#3498DB] disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Save size={20} />
                                            Guardar
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
