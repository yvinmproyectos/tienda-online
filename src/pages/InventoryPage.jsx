import React, { useEffect, useState } from 'react';
import { Package, Plus, Search, Filter, Pencil, Trash2, X, ChevronDown, ChevronRight, WifiOff } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useInventoryStore } from '../store/inventoryStore';
import StockEntryModal from '../components/StockEntryModal';

export default function InventoryPage() {
    const { products, isLoading, addProduct, updateProduct, deleteProduct, addProductsBatch, updateProductGroupPrice, isOffline } = useInventoryStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productToDelete, setProductToDelete] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [bulkPriceGroup, setBulkPriceGroup] = useState(null);
    const [newBulkPrice, setNewBulkPrice] = useState('');

    const handleSaveProduct = (productData) => {
        try {
            if (Array.isArray(productData)) {
                // If it's an array, it's multi-save (works for both new and edit additions)
                addProductsBatch(productData);
            } else if (editingProduct) {
                // Single product update
                updateProduct(editingProduct.id, productData);
            } else {
                // Single product creation
                addProduct(productData);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving product:", error);
        }
    };

    const confirmDelete = async () => {
        if (!productToDelete) return;

        try {
            await deleteProduct(productToDelete);
            setProductToDelete(null);
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Error al eliminar el producto.");
        }
    };

    const handleDeleteClick = (id) => {
        setProductToDelete(id);
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const toggleGroup = (groupKey) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupKey)) {
                newSet.delete(groupKey);
            } else {
                newSet.add(groupKey);
            }
            return newSet;
        });
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleBulkPriceEdit = (group) => {
        setBulkPriceGroup(group);
        setNewBulkPrice(group.price || '');
    };

    const handleBulkPriceUpdate = async () => {
        if (!bulkPriceGroup || !newBulkPrice) return;

        const price = parseFloat(newBulkPrice);
        if (isNaN(price) || price <= 0) {
            alert('Por favor ingrese un precio válido');
            return;
        }

        try {
            const count = await updateProductGroupPrice(bulkPriceGroup.brand, bulkPriceGroup.model, price);
            setBulkPriceGroup(null);
            setNewBulkPrice('');
        } catch (error) {
            console.error('Error updating bulk price:', error);
            alert('Error al actualizar el precio: ' + error.message);
        }
    };

    const groupedProducts = React.useMemo(() => {
        const filtered = (products || []).filter(p =>
            p.brand?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
            p.model?.toLowerCase()?.includes(searchTerm.toLowerCase())
        );

        const groups = {};
        filtered.forEach(product => {
            const key = `${product.brand}-${product.model}`.toLowerCase();
            if (!groups[key]) {
                groups[key] = {
                    key,
                    brand: product.brand,
                    model: product.model,
                    imageUrl: product.imageUrl,
                    totalStock: 0,
                    price: product.price,
                    sizes: [],
                    colors: [],
                    variants: []
                };
            }
            groups[key].totalStock += (parseInt(product.quantity) || 0);
            groups[key].variants.push(product);

            if (!groups[key].sizes.includes(product.size)) {
                groups[key].sizes.push(product.size);
            }
            if (product.color && !groups[key].colors.includes(product.color)) {
                groups[key].colors.push(product.color);
            }
        });

        return Object.values(groups).map(g => ({
            ...g,
            sizes: g.sizes.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)),
            variants: g.variants.sort((a, b) => (parseFloat(a.size) || 0) - (parseFloat(b.size) || 0))
        }));
    }, [products, searchTerm]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Inventario de Zapatos"
                subtitle="Gestiona el stock, precios y variantes de tus productos"
                icon={Package}
                action={
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#2C3E50] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#34495E] transition-colors flex items-center gap-2 shadow-lg shadow-[#2C3E50]/20"
                    >
                        <Plus size={20} />
                        Nuevo Ingreso
                    </button>
                }
            />

            {/* Filters */}
            <div className="bg-white p-4 rounded-3xl shadow-lg shadow-slate-200/50 border-0 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por marca, modelo..."
                        className="w-full pl-12 pr-4 py-2 border-0 bg-slate-50 rounded-full focus:ring-2 focus:ring-slate-200 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 px-6 py-2 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-50 font-medium">
                    <Filter size={20} />
                    Filtros
                </button>
            </div>

            {/* Product List - Mobile View (Cards) */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5DADE2]"></div>
                    </div>
                ) : groupedProducts.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
                        <Package size={48} className="mx-auto text-slate-300 mb-2" />
                        <p>No se encontraron productos</p>
                    </div>
                ) : (
                    groupedProducts.map((group) => (
                        <div key={group.key} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex gap-4 items-center border-b border-slate-100" onClick={() => toggleGroup(group.key)}>
                                {group.imageUrl ? (
                                    <img
                                        src={group.imageUrl}
                                        alt={group.model}
                                        className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400">
                                        <Package size={24} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 truncate">{group.brand}</h3>
                                    <p className="text-sm text-slate-500 truncate">{group.model}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-600 font-bold">Bs {group.price}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleBulkPriceEdit(group);
                                                }}
                                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                title="Editar precio de todas las tallas"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                            {group.totalStock} Pares
                                        </span>
                                    </div>
                                </div>
                                <div className="text-slate-400">
                                    {expandedGroups.has(group.key) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </div>
                            </div>

                            {expandedGroups.has(group.key) && (
                                <div className="bg-slate-50 p-3 space-y-2">
                                    {group.variants.map((v) => (
                                        <div key={v.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-[#5DADE2]">Talla {v.size}</p>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                                    <div className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: v.color }} />
                                                    {v.color}
                                                </div>
                                                <p className={`text-xs mt-1 font-medium ${v.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    Stock: {v.quantity} unid.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditProduct(v)}
                                                    className="p-2 text-[#5DADE2] bg-[#D6EAF8] rounded-lg"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(v.id)}
                                                    className="p-2 text-red-600 bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Add New Size Button - Mobile */}
                                    <div className="px-3 pb-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingProduct({
                                                    brand: group.brand,
                                                    model: group.model,
                                                    imageUrl: group.imageUrl,
                                                    price: group.price
                                                });
                                                setIsModalOpen(true);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#5DADE2] text-white rounded-lg font-medium hover:bg-[#4A9DD1] transition-colors"
                                        >
                                            <Plus size={18} />
                                            Agregar Nueva Talla
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Product Table - Desktop View */}
            <div className="hidden md:block bg-white rounded-3xl shadow-lg shadow-slate-200/50 border-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 font-semibold text-slate-700">Producto</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Talla</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Color</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Stock</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Precio Venta</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5DADE2]"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : groupedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Package size={48} className="text-slate-300" />
                                            <p>No se encontraron productos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                groupedProducts.map((group) => (
                                    <React.Fragment key={group.key}>
                                        <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => toggleGroup(group.key)}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-slate-400 group-hover:text-[#5DADE2] transition-colors">
                                                        {expandedGroups.has(group.key) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                    </div>
                                                    {group.imageUrl ? (
                                                        <img
                                                            src={group.imageUrl}
                                                            alt={group.model}
                                                            onClick={(e) => { e.stopPropagation(); setSelectedImage(group.imageUrl); }}
                                                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400">
                                                            <Package size={20} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-900">{group.brand}</p>
                                                        <p className="text-sm text-slate-500">{group.model}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {group.sizes.map(size => (
                                                        <span key={size} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{size}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    {group.colors.length === 1 ? (
                                                        <>
                                                            <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: group.colors[0] }} />
                                                            {group.colors[0]}
                                                        </>
                                                    ) : (
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                                            {group.colors.length} colores
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-bold ${group.totalStock > 0 ? 'text-slate-900' : 'text-red-500'}`}>
                                                    {group.totalStock} <span className="text-[10px] text-slate-400 font-normal ml-1">total</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-600 font-bold text-lg">Bs {group.price}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleBulkPriceEdit(group);
                                                        }}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Editar precio de todas las tallas"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 italic text-xs">
                                                Clic p/ detalle
                                            </td>
                                        </tr>
                                        {expandedGroups.has(group.key) && (
                                            <tr className="bg-slate-50/50">
                                                <td colSpan="6" className="px-12 py-4">
                                                    <div className="bg-white rounded-lg border border-slate-200 shadow-inner overflow-hidden">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                                                                <tr>
                                                                    <th className="px-4 py-2 border-b">Talla</th>
                                                                    <th className="px-4 py-2 border-b">Color</th>
                                                                    <th className="px-4 py-2 border-b text-center">Stock</th>
                                                                    <th className="px-4 py-2 border-b text-right">Acciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {group.variants.map((v) => (
                                                                    <tr key={v.id} className="hover:bg-blue-50/30 transition-colors">
                                                                        <td className="px-4 py-3 font-bold text-[#5DADE2] text-lg">Talla {v.size}</td>
                                                                        <td className="px-4 py-3">
                                                                            <div className="flex items-center gap-2 text-xs">
                                                                                <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: v.color }} />
                                                                                {v.color}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${v.quantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                                {v.quantity} unidades
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right">
                                                                            <div className="flex justify-end gap-2">
                                                                                <button
                                                                                    onClick={() => handleEditProduct(v)}
                                                                                    className="p-1.5 text-[#5DADE2] hover:bg-[#D6EAF8] rounded-md transition-colors"
                                                                                    title="Editar esta talla"
                                                                                >
                                                                                    <Pencil size={16} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteClick(v.id)}
                                                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                                                                                    title="Eliminar esta talla"
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {/* Add New Size Button */}
                                                        <div className="bg-slate-50 border-t border-slate-200 p-3">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Pre-fill with brand and model from the group
                                                                    setEditingProduct({
                                                                        brand: group.brand,
                                                                        model: group.model,
                                                                        imageUrl: group.imageUrl,
                                                                        price: group.price
                                                                    });
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#5DADE2] text-white rounded-lg font-medium hover:bg-[#4A9DD1] transition-colors"
                                                            >
                                                                <Plus size={18} />
                                                                Agregar Nueva Talla
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <StockEntryModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveProduct}
                initialData={editingProduct}
            />

            {/* Custom Delete Confirmation Modal */}
            {productToDelete && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-center mb-4 text-red-100">
                            <div className="p-3 bg-red-100 rounded-full">
                                <Trash2 className="text-red-600" size={32} />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-900 mb-2">¿Eliminar Producto?</h3>
                        <p className="text-slate-500 text-center mb-6">Esta acción no se puede deshacer. El producto dejará de estar visible en el inventario.</p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setProductToDelete(null)}
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Price Edit Modal */}
            {bulkPriceGroup && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Editar Precio Global</h3>
                            <button
                                onClick={() => setBulkPriceGroup(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-slate-600 mb-2">
                                <span className="font-semibold">{bulkPriceGroup.brand}</span> - {bulkPriceGroup.model}
                            </p>
                            <p className="text-xs text-slate-500 mb-4">
                                Se actualizarán <span className="font-bold text-emerald-600">{bulkPriceGroup.variants.length} tallas</span>
                            </p>

                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nuevo Precio (Bs)
                            </label>
                            <input
                                type="number"
                                value={newBulkPrice}
                                onChange={(e) => setNewBulkPrice(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                placeholder="Ingrese el nuevo precio"
                                step="0.01"
                                min="0"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setBulkPriceGroup(null)}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkPriceUpdate}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                            >
                                Actualizar Todo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Zoom Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={selectedImage}
                        alt="Zoom"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in duration-200"
                    />
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
                    >
                        <X size={32} />
                    </button>
                </div>
            )}
        </div>
    );
}
