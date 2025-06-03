import React, { useEffect } from 'react';

/**
 * Composant Toast pour afficher des notifications temporaires.
 * @param {object} props - Les props du composant.
 * @param {string} props.message - Le message à afficher dans le toast.
 * @param {'success' | 'error'} props.type - Le type de toast (détermine la couleur de fond).
 * @param {function} props.onClose - Fonction de rappel à appeler lorsque le toast doit être fermé.
 */
const Toast = ({ message, type, onClose }) => {
    // Détermine la couleur de fond en fonction du type de toast
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const textColor = 'text-white';

    // Effet pour masquer le toast après 3 secondes
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Masque le toast après 3 secondes
        return () => clearTimeout(timer); // Nettoyage du timer
    }, [onClose]); // Dépendance à onClose pour éviter les boucles infinies

    return (
        <div key={message} className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl ${bgColor} ${textColor} text-lg font-semibold z-50 animate-fade-in-up transition-all duration-300 ease-out`}>
            {message}
        </div>
    );
};

export default Toast;
