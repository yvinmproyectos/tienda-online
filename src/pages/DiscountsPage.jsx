import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
    Tag,
    Plus,
    Search,
    Edit2,
    Trash2,
    Calendar,
    Users,
    Package,
    AlertCircle,
    Check,
    X,
    Filter
} from 'lucide-react';
import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
    where
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useInventoryStore } from '../store/inventoryStore'; // To get brands/models

// Helper for dates
const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleDateString();
};

export default function DiscountsPage() {
    const { userProfile } = useAuth();
    const { products } = useInventoryStore(); // We need products to extract brands/models

    // State
    const [discounts, setDiscounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'PERCENTAGE', // PERCENTAGE, FIXED
        value: '',
        scope: 'GLOBAL', // GLOBAL, BRAND, MODEL
        target: '', // Brand name or Model name
        startDate: '',
        endDate: '',
        isActive: true
    });

    // Derived Data for Selects
    const [brands, setBrands] = useState([]);
    const [models, setModels] = useState([]);

    useEffect(() => {
        // Extract unique brands and models from products
        const uniqueBrands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
        const uniqueModels = [...new Set(products.map(p => p.model).filter(Boolean))].sort();
        setBrands(uniqueBrands);
        setModels(uniqueModels);
    }, [products]);

    // Load Discounts
    useEffect(() => {
        const q = query(collection(db, 'discounts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDiscounts(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error loading discounts:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Handlers
    const handleOpenModal = (discount = null) => {
        if (discount) {
            setEditingDiscount(discount);
            setFormData({
                name: discount.name,
                type: discount.type,
                value: discount.value,
                scope: discount.scope,
                target: discount.target || '',
                startDate: discount.startDate ? discount.startDate.toDate().toISOString().split('T')[0] : '',
                endDate: discount.endDate ? discount.endDate.toDate().toISOString().split('T')[0] : '',
                isActive: discount.isActive
            });
        } else {
            setEditingDiscount(null);
            setFormData({
                name: '',
                type: 'PERCENTAGE',
                value: '',
                scope: 'GLOBAL',
                target: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: '',
                isActive: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSave = {
                name: formData.name,
                type: formData.type,
                value: parseFloat(formData.value),
                scope: formData.scope,
                target: formData.target,
                startDate: formData.startDate ? Timestamp.fromDate(new Date(formData.startDate)) : null,
                endDate: formData.endDate ? Timestamp.fromDate(new Date(formData.endDate)) : null,
                isActive: formData.isActive,
                updatedAt: Timestamp.now()
            };

            if (editingDiscount) {
                await updateDoc(doc(db, 'discounts', editingDiscount.id), dataToSave);
            } else {
                await addDoc(collection(db, 'discounts'), {
                    ...dataToSave,
                    createdAt: Timestamp.now()
                });
            }

            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving discount:", error);
            alert("Error al guardar descuento");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este descuento?')) {
            try {
                await deleteDoc(doc(db, 'discounts', id));
            } catch (error) {
                console.error("Error deleting discount:", error);
                alert("Error al eliminar");
            }
        }
    };

    const handleToggleStatus = async (discount) => {
        try {
            await updateDoc(doc(db, 'discounts', discount.id), {
                isActive: !discount.isActive
            });
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    const filteredDiscounts = discounts.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.target && d.target.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestión de Descuentos"
                subtitle="Configura reglas de descuentos automáticos"
                icon={Tag}
                action={
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={20} />
                        Nuevo Descuento
                    </button>
                }
            />

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar descuentos..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDiscounts.map(discount => (
                    <div key={discount.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${discount.isActive ? 'border-slate-200' : 'border-slate-100 opacity-75'}`}>
                        <div className={`p-4 border-b flex justify-between items-start ${discount.isActive ? 'bg-white' : 'bg-slate-50'}`}>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{discount.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${discount.scope === 'GLOBAL' ? 'bg-purple-100 text-purple-700' :
                                            discount.scope === 'BRAND' ? 'bg-blue-100 text-blue-700' :
                                                'bg-amber-100 text-amber-700'
                                        }`}>
                                        {discount.scope === 'GLOBAL' ? 'Todo el Catálogo' :
                                            discount.scope === 'BRAND' ? `Marca: ${discount.target}` :
                                                `Modelo: ${discount.target}`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleOpenModal(discount)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(discount.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Valor</span>
                                <span className="text-xl font-bold text-emerald-600">
                                    {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `- Bs ${discount.value}`}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar size={16} />
                                <span>{formatDate(discount.startDate)} - {formatDate(discount.endDate) || 'Indefinido'}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-400 uppercase">Estado</span>
                                <button
                                    onClick={() => handleToggleStatus(discount)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${discount.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${discount.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingDiscount ? 'Editar Descuento' : 'Nuevo Descuento'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Descuento</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                    placeholder="Ej: Promo Verano 2026"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Tipo</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="PERCENTAGE">Porcentaje (%)</option>
                                        <option value="FIXED">Monto Fijo (Bs)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                        placeholder="0.00"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700">Reglas de Aplicación</label>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Alcance</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                                        value={formData.scope}
                                        onChange={(e) => setFormData({ ...formData, scope: e.target.value, target: '' })}
                                    >
                                        <option value="GLOBAL">Global (Todo el inventario)</option>
                                        <option value="BRAND">Por Marca</option>
                                        <option value="MODEL">Por Modelo</option>
                                    </select>
                                </div>

                                {formData.scope === 'BRAND' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Seleccionar Marca</label>
                                        <select
                                            required
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                                            value={formData.target}
                                            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                                        >
                                            <option value="">Seleccione una marca...</option>
                                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                )}

                                {formData.scope === 'MODEL' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Seleccionar Modelo</label>
                                        <select
                                            required
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                                            value={formData.target}
                                            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                                        >
                                            <option value="">Seleccione un modelo...</option>
                                            {models.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Fin (Opcional)</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 mt-4"
                            >
                                {isSubmitting ? 'Guardando...' : 'Guardar Descuento'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
