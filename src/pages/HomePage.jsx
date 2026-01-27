import React from 'react';

export default function HomePage() {
    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white h-[500px] flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-blue-800/90 mix-blend-multiply" />
                <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
                        Descubre tu estilo <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            Tech & Lifestyle
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Explora nuestra colección curada de productos de alta tecnología y estilo de vida moderno.
                        Calidad premium en cada detalle.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="px-8 py-3 bg-white text-blue-900 font-bold rounded-full hover:bg-slate-100 transition-colors shadow-xl">
                            Ver Productos
                        </button>
                        <button className="px-8 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold rounded-full hover:bg-white/20 transition-all">
                            Más Información
                        </button>
                    </div>
                </div>
            </div>

            {/* Featured Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="group cursor-pointer">
                        <div className="relative overflow-hidden rounded-2xl aspect-[4/5] bg-slate-200 mb-4">
                            <div className="absolute inset-0 bg-slate-300 animate-pulse" />
                            {/* Image placeholder will go here */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                <span className="text-white font-medium">Ver Detalles</span>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Producto Destacado {i}</h3>
                        <p className="text-slate-500">$99.00 USD</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
