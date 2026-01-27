import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, Image as ImageIcon, Upload, Store, Plus, Calendar } from 'lucide-react';
import { supplierService } from '../services/supplierService';
import { useInventoryStore } from '../store/inventoryStore';

export default function StockEntryModal({ isOpen, onClose, onSave, initialData = null }) {
    const [formData, setFormData] = useState({
        brand: '',
        model: '',
        costDozen: '',
        costUnit: '',
        quantity: '',
        totalCost: '',
        price: '',
        imageUrl: '',
        supplierId: '',
        entryDate: new Date().toISOString().split('T')[0]
    });

    const { products } = useInventoryStore();

    const [sizeEntries, setSizeEntries] = useState([]);

    const [suppliers, setSuppliers] = useState([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');

    // Cleanup preview URL on unmount or close
    useEffect(() => {
        return () => {
            if (previewUrl && !previewUrl.startsWith('data:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    brand: initialData.brand || '',
                    model: initialData.model || '',
                    costDozen: initialData.costDozen || '',
                    costUnit: initialData.costUnit || '',
                    quantity: initialData.quantity || '',
                    totalCost: initialData.totalCost || '',
                    price: initialData.price || '',
                    imageUrl: initialData.imageUrl || '',
                    supplierId: initialData.supplierId || '',
                    entryDate: initialData.entryDate || new Date().toISOString().split('T')[0]
                });
                // Base sizes to show 33-41
                const baseSizes = [33, 34, 35, 36, 37, 38, 39, 40, 41];
                const initialEntries = baseSizes.map(s => {
                    const isOriginalSize = s.toString() === initialData.size?.toString();
                    return {
                        size: s.toString(),
                        quantity: isOriginalSize ? (initialData.quantity?.toString() || '') : '',
                        color: isOriginalSize ? (initialData.color || '') : ''
                    };
                });

                // If initialData.size is NOT in the base range, add it as extra row
                if (initialData.size && !baseSizes.includes(parseInt(initialData.size))) {
                    initialEntries.push({
                        size: initialData.size.toString(),
                        quantity: initialData.quantity?.toString() || '',
                        color: initialData.color || ''
                    });
                }

                setSizeEntries(initialEntries);
                setPreviewUrl(initialData.imageUrl || '');
            } else {
                setFormData({
                    brand: '',
                    model: '',
                    costDozen: '',
                    costUnit: '',
                    quantity: '',
                    totalCost: '',
                    price: '',
                    imageUrl: '',
                    supplierId: '',
                    entryDate: new Date().toISOString().split('T')[0]
                });
                setSizeEntries([33, 34, 35, 36, 37, 38, 39, 40, 41].map(s => ({
                    size: s.toString(),
                    quantity: '',
                    color: ''
                })));
                setPreviewUrl('');
            }
            setIsSubmitting(false);
            setStatusText('');
            loadSuppliers();
        }
    }, [isOpen, initialData]);

    // Calculate total quantity from entries
    useEffect(() => {
        const totalQty = sizeEntries.reduce((sum, entry) => sum + (parseInt(entry.quantity) || 0), 0);
        setFormData(prev => ({ ...prev, quantity: totalQty > 0 ? totalQty.toString() : '' }));
    }, [sizeEntries]);

    // Calculate derived values
    useEffect(() => {
        const dozen = parseFloat(formData.costDozen) || 0;
        const qty = parseInt(formData.quantity) || 0;
        const unit = dozen > 0 ? (dozen / 12) : 0;
        const total = unit * qty;

        setFormData(prev => ({
            ...prev,
            costUnit: unit > 0 ? unit.toFixed(2) : '',
            totalCost: total > 0 ? total.toFixed(2) : ''
        }));
    }, [formData.costDozen, formData.quantity]);

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Limit width to saving space
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.6 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(dataUrl);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileChange = async (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setStatusText('Procesando imagen...');
            try {
                // Compress immediately upon selection
                const compressedBase64 = await compressImage(file);

                // Update form state with base64 string
                setFormData(prev => ({ ...prev, imageUrl: compressedBase64 }));
                setPreviewUrl(compressedBase64);
                setStatusText('');
            } catch (error) {
                console.error("Error compressing image:", error);
                alert("Error al procesar la imagen. Intenta con otra.");
                setStatusText('');
            }
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await supplierService.getSuppliers();
            setSuppliers(data);
        } catch (error) {
            console.error("Error loading suppliers:", error);
        }
    };

    const handleSizeEntryChange = (index, field, value) => {
        setSizeEntries(prev => {
            const newEntries = [...prev];
            newEntries[index] = { ...newEntries[index], [field]: value };
            return newEntries;
        });
    };

    const addSizeEntry = () => {
        setSizeEntries(prev => [...prev, { size: '', quantity: '', color: '' }]);
    };

    const removeSizeEntry = (index) => {
        if (sizeEntries.length === 1) return;
        setSizeEntries(prev => prev.filter((_, i) => i !== index));
    };

    const applyColorToAll = () => {
        const firstColor = sizeEntries.find(e => e.color)?.color || '';
        if (!firstColor) return;
        setSizeEntries(prev => prev.map(e => ({ ...e, color: firstColor })));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusText('Guardando en base de datos...');

        try {
            const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);

            // Prepare common data
            const commonData = {
                ...formData,
                supplierName: selectedSupplier ? selectedSupplier.name : '',
                costDozen: parseFloat(formData.costDozen) || 0,
                costUnit: parseFloat(formData.costUnit) || 0,
                price: parseFloat(formData.price) || 0
            };

            if (initialData) {
                // When editing, we might have added more sizes too
                const productsToSave = sizeEntries
                    .filter(e => e.size !== '' && (parseInt(e.quantity) > 0 || e.size.toString() === initialData.size?.toString()))
                    .map(entry => {
                        const isOriginal = entry.size.toString() === initialData.size?.toString();
                        return {
                            ...(isOriginal ? { id: initialData.id } : {}), // Keep ID for the original one
                            ...commonData,
                            color: entry.color,
                            size: entry.size,
                            quantity: parseInt(entry.quantity) || 0,
                            totalCost: (parseFloat(formData.costUnit) || 0) * (parseInt(entry.quantity) || 0),
                        };
                    });

                onSave(productsToSave.length > 1 ? productsToSave : productsToSave[0]);
            } else {
                const productsToSave = sizeEntries
                    .filter(e => parseInt(e.quantity) > 0 && e.size !== '')
                    .map(entry => ({
                        ...commonData,
                        brand: formData.brand,
                        model: formData.model,
                        color: entry.color,
                        size: entry.size,
                        quantity: parseInt(entry.quantity) || 0,
                        totalCost: (parseFloat(formData.costUnit) || 0) * (parseInt(entry.quantity) || 0),
                        imageUrl: formData.imageUrl,
                        entryDate: formData.entryDate
                    }));

                if (productsToSave.length === 0) {
                    alert("Por favor ingresa cantidad para al menos una talla.");
                    setIsSubmitting(false);
                    return;
                }

                // Non-blocking call
                onSave(productsToSave.length > 1 ? productsToSave : productsToSave[0]);
            }

            // Reset state BEFORE closing to ensure clean UI transition
            setIsSubmitting(false);
            setStatusText('');

            // Close immediately - don't wait for Firestore (the store handles non-blocking writes now)
            onClose();
        } catch (error) {
            console.error("Error saving product: ", error);
            alert(`Error: ${error.message || 'Error desconocido al guardar'}`);
            setIsSubmitting(false);
            setStatusText('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row">

                {/* Left Side: Image Upload */}
                <div className="w-full md:w-1/3 bg-slate-50 p-6 border-r border-slate-200 flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <ImageIcon size={20} />
                        Imagen del Producto
                    </h3>

                    <div className="flex-1 bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex items-center justify-center relative aspect-square md:aspect-auto group hover:border-blue-400 transition-colors">
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt="Vista previa"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-center text-slate-400 p-4">
                                <Upload size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium">Subir Imagen</p>
                                <p className="text-xs mt-1">Clic para seleccionar</p>
                            </div>
                        )}

                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            title="Seleccionar imagen"
                        />
                    </div>

                    <p className="text-xs text-slate-400 mt-4 text-center">
                        La imagen se guardará comprimida para uso sin conexión.
                    </p>
                    {statusText && (
                        <p className="text-xs text-blue-600 mt-2 text-center font-medium animate-pulse">
                            {statusText}
                        </p>
                    )}
                </div>

                {/* Right Side: Form Data */}
                <div className="w-full md:w-2/3 flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-slate-200">
                        <h2 className="text-xl font-bold text-slate-900">
                            {initialData ? 'Editar Producto' : 'Nuevo Ingreso'}
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Marca</label>
                                <input
                                    list="brand-suggestions"
                                    type="text"
                                    name="brand"
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.brand}
                                    onChange={handleChange}
                                    placeholder="Ej. Nike"
                                    autoComplete="off"
                                />
                                <datalist id="brand-suggestions">
                                    {[...new Set((products || []).map(p => p.brand).filter(Boolean))].sort().map(brand => (
                                        <option key={`brand-${brand}`} value={brand} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                                <input
                                    list="model-suggestions"
                                    type="text"
                                    name="model"
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.model}
                                    onChange={handleChange}
                                    placeholder="Ej. Air Force 1"
                                    autoComplete="off"
                                />
                                <datalist id="model-suggestions">
                                    {[...new Set((products || [])
                                        .filter(p => !formData.brand || p.brand?.toLowerCase() === formData.brand.toLowerCase())
                                        .map(p => p.model)
                                        .filter(Boolean)
                                    )].sort().map(model => (
                                        <option key={`model-${model}`} value={model} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de Ingreso</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="date"
                                        name="entryDate"
                                        required
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={formData.entryDate}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Size Selection Table */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700">Tallas, Cantidades y Colores</span>
                                    {!initialData && (
                                        <button
                                            type="button"
                                            onClick={addSizeEntry}
                                            className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 transition-colors font-bold uppercase tracking-wider ml-2"
                                        >
                                            <Plus size={12} />
                                            Adicionar talla
                                        </button>
                                    )}
                                </div>
                                {!initialData && (
                                    <button
                                        type="button"
                                        onClick={applyColorToAll}
                                        className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors font-bold uppercase tracking-wider"
                                        title="Copia el primer color a todas las tallas"
                                    >
                                        Aplicar color a todos
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white shadow-sm text-[10px] text-slate-400 uppercase font-bold">
                                        <tr>
                                            <th className="px-4 py-2">Talla</th>
                                            <th className="px-4 py-2">Cantidad</th>
                                            <th className="px-4 py-2">Color</th>
                                            {!initialData && <th className="px-4 py-2 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sizeEntries.map((entry, index) => (
                                            <tr key={index} className={parseInt(entry.quantity) > 0 ? 'bg-blue-50/30' : ''}>
                                                <td className="px-4 py-2">
                                                    <select
                                                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm font-bold text-slate-700"
                                                        value={entry.size}
                                                        onChange={(e) => handleSizeEntryChange(index, 'size', e.target.value)}
                                                    >
                                                        <option value="">-- Talla --</option>
                                                        {[33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        className="w-20 px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                        value={entry.quantity}
                                                        onChange={(e) => handleSizeEntryChange(index, 'quantity', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Ej. Blanco"
                                                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                        value={entry.color}
                                                        onChange={(e) => handleSizeEntryChange(index, 'color', e.target.value)}
                                                    />
                                                </td>
                                                {!initialData && (
                                                    <td className="px-4 py-2">
                                                        {sizeEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSizeEntry(index)}
                                                                className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Supplier Selection */}
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Proveedor</label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    name="supplierId"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white font-medium"
                                    value={formData.supplierId}
                                    onChange={handleChange}
                                >
                                    <option value="">-- Seleccionar Proveedor --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} {s.contactName ? `(${s.contactName})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 my-4"></div>

                        {/* Cost & Quantity Calculations */}
                        <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-200">
                            <div className="flex items-center gap-2 mb-2 text-blue-700 font-medium">
                                <Calculator size={18} />
                                <span>Cálculo de Costos</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Costo Docena (Bs)</label>
                                    <input
                                        type="number"
                                        name="costDozen"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                        value={formData.costDozen}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Unidades (Pares)</label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        required
                                        min="1"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-2">Costo Unitario (Bs)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 outline-none font-medium"
                                        value={formData.costUnit}
                                        placeholder="Auto-calculado"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Costo Total Compra (Bs)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-blue-50 text-blue-700 outline-none font-bold"
                                        value={formData.totalCost}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Precio de Venta (Bs)</label>
                                    <input
                                        type="number"
                                        name="price"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                        value={formData.price}
                                        onChange={handleChange}
                                        placeholder="Precio al público"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        {statusText || 'Guardando...'}
                                    </>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        {initialData ? 'Actualizar' : 'Guardar Ingreso'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
