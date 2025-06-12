// BottomNavigationBar.jsx
import React from 'react';
import { Dumbbell, History, BarChart3 } from 'lucide-react';

/**
 * Composant de barre de navigation inférieure pour l'application mobile.
 * @param {object} props - Les props du composant.
 * @param {string} props.currentView - La vue actuellement sélectionnée.
 * @param {function} props.setCurrentView - Fonction pour changer la vue.
 * @param {string} props.currentTheme - Le thème actuel ('light' ou 'dark').
 */
const BottomNavigationBar = ({ currentView, setCurrentView, currentTheme = 'dark' }) => {
    // Définition des éléments de navigation
    const navItems = [
        {
            name: 'Entraînement',
            icon: Dumbbell, // Icône pour la vue d'entraînement
            view: 'workout', // Nom de la vue correspondante
            color: 'text-blue-400' // Couleur associée à la vue
        },
        {
            name: 'Statistiques',
            icon: BarChart3, // Icône pour la vue des statistiques
            view: 'stats', // Nom de la vue correspondante
            color: 'text-purple-400' // Couleur associée à la vue
        },
        {
            name: 'Historique',
            icon: History, // Icône pour la vue historique
            view: 'history', // Nom de la vue correspondante
            color: 'text-yellow-400' // Couleur associée à la vue
        }
    ];

    return (
        <nav className={`fixed bottom-0 left-0 right-0 border-t shadow-lg z-40 ${
            currentTheme === 'light' 
                ? 'bg-white border-gray-300' 
                : 'bg-gray-900 border-gray-700'
        }`}>
            <div className="flex justify-around h-16">
                {navItems.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={`flex flex-col items-center justify-center text-sm p-2 rounded-lg transition-all duration-200 ease-in-out min-w-0 flex-1 mx-1 ${
                            currentView === item.view
                                ? `${item.color} scale-105 ${
                                    currentTheme === 'light' ? 'bg-gray-100' : 'bg-gray-800/50'
                                }` // Styles pour l'élément sélectionné
                                : `transition-colors ${
                                    currentTheme === 'light' 
                                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                                }` // Styles pour les éléments non sélectionnés
                        }`}
                    >
                        <item.icon className={`h-6 w-6 sm:h-7 sm:w-7 mb-1 ${
                            currentView === item.view ? 'scale-110' : '' // Animation d'échelle pour l'icône sélectionnée
                        } transition-transform duration-200`} />
                        <span className={`text-xs sm:text-sm font-medium leading-tight text-center ${
                            currentView === item.view ? 'font-semibold' : '' // Texte en gras pour l'élément sélectionné
                        }`}>
                            {item.name}
                        </span>
                        {/* Indicateur visuel sous l'élément sélectionné */}
                        {currentView === item.view && (
                            <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 ${item.color.replace('text-', 'bg-')} rounded-full`}></div>
                        )}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default BottomNavigationBar;