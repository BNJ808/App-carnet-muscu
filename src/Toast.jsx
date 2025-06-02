import React, { useEffect } from 'react';

// Composant Toast pour les notifications
const Toast = ({ message, type, onClose }) => {
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const textColor = 'text-white';

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Masque le toast après 3 secondes
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl ${bgColor} ${textColor} text-lg font-semibold z-50 animate-fade-in-up`}>
            {message}
        </div>
    );
};

export default Toast;
