import React from 'react';

export const PageHeader = ({ title, subtitle, action, icon: Icon }) => {
    return (
        <div className="bg-white p-3 md:p-6 rounded-2xl shadow-sm border border-slate-200 mb-4 md:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
                {Icon && (
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                        <Icon size={20} className="text-blue-600 md:size-24" />
                    </div>
                )}
                <div>
                    <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
                    {subtitle && <p className="text-slate-500 text-[10px] md:text-sm mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {action}
                </div>
            )}
        </div>
    );
};
