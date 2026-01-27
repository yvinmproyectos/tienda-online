{/* Header POS - Replaced with PageHeader */ }
<div className="mb-4">
    <PageHeader
        title="Punto de Venta"
        subtitle={currentShift ? `Caja Abierta: ${currentShift.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Caja Cerrada'}
        icon={ShoppingCart}
        action={
            <div className="flex flex-col md:flex-row items-center gap-3">
                {/* Status/Actions */}
                {currentShift ? (
                    <button
                        onClick={() => handleSafeNavigation(() => setShowCloseShiftModal(true))}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-red-300 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                    >
                        Cerrar Caja
                    </button>
                ) : (
                    globalOpenShift ? (
                        <span className="text-xs font-medium text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                            Abierto por: {globalShiftUser}
                        </span>
                    ) : (
                        userProfile?.role === 'admin' && (
                            <button
                                onClick={() => setAdminChoice('OPEN_SHIFT')}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors whitespace-nowrap"
                            >
                                Abrir Caja
                            </button>
                        )
                    )
                )}

                {/* TABS */}
                <div className="flex bg-slate-100 p-1 rounded-lg overflow-hidden border border-slate-200">
                    <button
                        onClick={() => handleSafeNavigation(() => setActiveTab('POS'))}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'POS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Punto de Venta
                    </button>
                    <button
                        onClick={() => handleSafeNavigation(() => setActiveTab('HISTORY'))}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Historial
                    </button>
                </div>
            </div>
        }
    />
</div>
