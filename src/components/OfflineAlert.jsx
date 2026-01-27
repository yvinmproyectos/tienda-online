import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

const OfflineAlert = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="bg-amber-500 text-white p-2 rounded-lg mb-3 flex items-center justify-center gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <WifiOff size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">
                Modo Offline
            </span>
        </div>
    );
};

export default OfflineAlert;
