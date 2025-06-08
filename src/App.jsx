import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Undo2, Redo2, Settings, XCircle, CheckCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3, Moon, Sun,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity, Menu, Home, User
} from 'lucide-react';

// Configuration Firebase
const firebaseConfig = {
    apiKey: "demo-key",
    authDomain: "demo-domain",
    projectId: "demo-project",
    storageBucket: "demo-bucket",
    messagingSenderId: "demo-sender",
    appId: "demo-app",
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Constantes
const MAX_UNDO_STATES = 20;
const AUTO_SAVE_DELAY = 2000;

// Utilitaires
const generateUUID = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'Date invalide';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const getSeriesDisplay = (series) => {
    if (!Array.isArray(series) || series.length === 0) return 'Aucune série';
    return series.map(s => `${s.weight || '?'}kg × ${s.reps || '?'}`).join(' | ');
};

// Hook pour le localStorage
const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            setStoredValue(value);
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Erreur localStorage ${key}:`, error);
        }
    }, [key]);

    return [storedValue, setValue];
};

// Données de base
const baseInitialData = {
    days: {
        'Push (Lundi)': {
            categories: {
                PECS: [
                    { id: generateUUID(), name: 'Développé couché', series: [{ weight: '60', reps: '10', completed: false }, { weight: '65', reps: '8', completed: false }, { weight: '70', reps: '6', completed: false }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Développé incliné', series: [{ weight: '50', reps: '12', completed: false }, { weight: '55', reps: '10', completed: false }], isDeleted: false, notes: '' }
                ],
                EPAULES: [
                    { id: generateUUID(), name: 'Développé épaules', series: [{ weight: '40', reps: '12', completed: false }, { weight: '42.5', reps: '10', completed: false }], isDeleted: false, notes: '' }
                ],
                TRICEPS: [
                    { id: generateUUID(), name: 'Dips', series: [{ weight: '0', reps: '15', completed: false }, { weight: '0', reps: '12', completed: false }], isDeleted: false, notes: '' }
                ]
            }
        },
        'Pull (Mercredi)': {
            categories: {
                DOS: [
                    { id: generateUUID(), name: 'Tractions', series: [{ weight: '0', reps: '8', completed: false }, { weight: '0', reps: '6', completed: false }], isDeleted: false, notes: '' }
                ],
                BICEPS: [
                    { id: generateUUID(), name: 'Curl barre', series: [{ weight: '30', reps: '12', completed: false }, { weight: '32.5', reps: '10', completed: false }], isDeleted: false, notes: '' }
                ]
            }
        },
        'Legs (Vendredi)': {
            categories: {
                JAMBES: [
                    { id: generateUUID(), name: 'Squat', series: [{ weight: '80', reps: '10', completed: false }, { weight: '85', reps: '8', completed: false }], isDeleted: false, notes: '' }
                ]
            }
        }
    },
    dayOrder: ['Push (Lundi)', 'Pull (Mercredi)', 'Legs (Vendredi)']
};

// Composant Toast optimisé mobile
const Toast = ({ message, type = 'info', onClose, action, duration = 3000 }) => {
    const getToastColors = () => {
        switch (type) {
            case 'success': return 'bg-green-500 border-green-400';
            case 'error': return 'bg-red-500 border-red-400';
            case 'warning': return 'bg-yellow-500 border-yellow-400';
            default: return 'bg-blue-500 border-blue-400';
        }
    };

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => onClose(), duration);
            return () => clearTimeout(timer);
        }
    }, [onClose, duration]);

    return (
        <div className={`fixed bottom-20 left-2 right-2 mx-auto px-4 py-3 rounded-lg shadow-2xl ${getToastColors()} text-white font-medium z-50 max-w-sm border-l-4`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm leading-relaxed">{message}</p>
                    {action && (
                        <button
                            onClick={() => {
                                action.onClick();
                                onClose();
                            }}
                            className="mt-2 text-white underline text-xs"
                        >
                            {action.label}
                        </button>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="ml-3 text-white/80 text-lg leading-none"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

// Composant Navigation inférieure optimisé
const BottomNavigationBar = ({ currentView, setCurrentView }) => {
    const navItems = [
        { name: 'Workout', icon: Dumbbell, view: 'workout', color: 'text-blue-400' },
        { name: 'Timer', icon: Clock, view: 'timer', color: 'text-green-400' },
        { name: 'Stats', icon: BarChart3, view: 'stats', color: 'text-purple-400' },
        { name: 'History', icon: History, view: 'history', color: 'text-yellow-400' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-700/50 shadow-2xl z-50 safe-area-inset-bottom">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
                {navItems.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 min-w-0 flex-1 mx-1 ${
                            currentView === item.view 
                                ? `${item.color} bg-gray-800/50 scale-105` 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                        }`}
                    >
                        <item.icon className={`h-6 w-6 mb-1 ${
                            currentView === item.view ? 'scale-110' : ''
                        } transition-transform duration-200`} />
                        <span className={`text-xs font-medium ${
                            currentView === item.view ? 'font-semibold' : ''
                        }`}>
                            {item.name}
                        </span>
                        {currentView === item.view && (
                            <div className={`absolute bottom-0 w-6 h-0.5 ${item.color.replace('text-', 'bg-')} rounded-full`}></div>
                        )}
                    </button>
                ))}
            </div>
        </nav>
    );
};

// Composant Vue Entraînement optimisé mobile
const WorkoutView = ({ 
    workouts, 
    selectedDayFilter, 
    setSelectedDayFilter,
    handleEditClick,
    handleAddExerciseClick,
    handleDeleteExercise,
    handleToggleSeriesCompleted, // New prop
    handleUpdateSeries, // New prop
    personalBests,
    getDayButtonColors,
    getSeriesDisplay,
    searchTerm,
    setSearchTerm,
    handleAddDay,
    handleEditDay,
    handleDeleteDay
}) => {
    const [expandedDays, setExpandedDays] = useState(new Set());
    const [expandedCategories, setExpandedCategories] = useState(new Set()); // New state for categories
    const [showAddDayModal, setShowAddDayModal] = useState(false);
    const [newDayName, setNewDayName] = useState('');
    const [editingDay, setEditingDay] = useState(null); // State for editing day

    const toggleDayExpanded = (day) => {
        const newExpanded = new Set(expandedDays);
        if (newExpanded.has(day)) {
            newExpanded.delete(day);
        } else {
            newExpanded.add(day);
        }
        setExpandedDays(newExpanded);
    };

    const toggleCategoryExpanded = (dayCategory) => { // New function
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(dayCategory)) {
            newExpanded.delete(dayCategory);
        } else {
            newExpanded.add(dayCategory);
        }
        setExpandedCategories(newExpanded);
    };

    const getDaysToShow = () => {
        if (!workouts?.dayOrder) return [];
        return selectedDayFilter ? [selectedDayFilter] : workouts.dayOrder;
    };

    const getAvailableCategories = (dayName) => { // New function
        if (!workouts?.days?.[dayName]?.categories) {
            return [];
        }
        
        // Return categories that have exercises
        return Object.keys(workouts.days[dayName].categories).filter(categoryName => {
            const exercises = workouts.days[dayName].categories[categoryName];
            return Array.isArray(exercises) && exercises.length > 0;
        });
    };

    const handleAddDaySubmit = () => {
        if (!newDayName.trim()) return;
        
        if (handleAddDay) {
            handleAddDay(newDayName.trim());
        }
        
        setNewDayName('');
        setShowAddDayModal(false);
    };

    const handleEditDaySubmit = () => {
        if (!editingDay || !newDayName.trim()) return;
        
        if (handleEditDay) {
            handleEditDay(editingDay, newDayName.trim());
        }
        
        setEditingDay(null);
        setNewDayName('');
    };

    const renderExerciseSeries = (exercise, dayName, categoryName) => {
        if (!exercise.series || !Array.isArray(exercise.series) || exercise.series.length === 0) {
            return (
                <div className="text-gray-400 text-sm italic">
                    Aucune série configurée
                </div>
            );
        }

        return (
            <div className="space-y-2 mt-3">
                {exercise.series.map((serie, serieIndex) => (
                    <div key={serie.id || serieIndex} className={`flex items-center gap-2 bg-gray-600/50 rounded-md p-2 ${serie.completed ? 'opacity-60 grayscale' : ''}`}>
                        <span className="text-xs text-gray-400 w-6">#{serieIndex + 1}</span>
                        
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={serie.weight}
                                onChange={(e) => handleUpdateSeries(dayName, categoryName, exercise.id, serieIndex, 'weight', e.target.value)}
                                className="bg-transparent text-white text-xs w-12 text-center border-b border-gray-500 focus:outline-none focus:border-blue-400"
                                placeholder="Poids"
                                step="0.5"
                            />
                            <span className="text-xs text-gray-300">kg</span>
                            <span className="text-gray-400">×</span>
                            <input
                                type="number"
                                value={serie.reps}
                                onChange={(e) => handleUpdateSeries(dayName, categoryName, exercise.id, serieIndex, 'reps', e.target.value)}
                                className="bg-transparent text-white text-xs w-12 text-center border-b border-gray-500 focus:outline-none focus:border-blue-400"
                                placeholder="Reps"
                            />
                        </div>
                        
                        <div className="flex-1"></div>
                        
                        <button
                            onClick={() => handleToggleSeriesCompleted(dayName, categoryName, exercise.id, serieIndex)}
                            className={`p-1 rounded transition-colors ${
                                serie.completed 
                                    ? 'text-green-400 hover:text-green-300' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title={serie.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                        >
                            {serie.completed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </button>
                        
                        {/* <button
                            onClick={() => console.log('Démarrer minuteur de repos')}
                            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                            title="Démarrer minuteur de repos"
                        >
                            <Clock className="h-4 w-4" />
                        </button> */}
                    </div>
                ))}
            </div>
        );
    };

    const renderExercise = (exercise, dayName, categoryName) => {
        if (!exercise || exercise.isDeleted) {
            return null;
        }

        const personalBest = personalBests?.[exercise.id];
        
        // Filtrage par terme de recherche
        if (searchTerm && !exercise.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return null;
        }
        
        return (
            <div key={exercise.id} className={`bg-gray-700/50 rounded-lg border border-gray-600/50 transition-all p-4`}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h4 className="font-medium text-white mb-1">{exercise.name}</h4>
                        
                        {personalBest && (
                            <div className="text-xs text-yellow-400 mb-1">
                                🏆 Record: {personalBest.maxWeight}kg × {personalBest.maxReps} reps
                            </div>
                        )}
                        
                        {exercise.notes && (
                            <div className="text-xs text-gray-400 mb-2">
                                📝 {exercise.notes}
                            </div>
                        )}

                        <div className="text-sm text-gray-300 mb-2">
                            {getSeriesDisplay(exercise.series)}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-3">
                        {/* Fonctionnalités par défaut (plus en mode avancé uniquement) */}
                        {/* <button
                            onClick={() => analyzeProgressionWithAI && analyzeProgressionWithAI(exercise)}
                            className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                            title="Analyser avec IA"
                        >
                            <Sparkles className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => console.log('Voir graphique de progression')}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                            title="Voir graphique de progression"
                        >
                            <LineChartIcon className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => console.log('Modifier les notes')}
                            className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded transition-colors"
                            title="Modifier les notes"
                        >
                            <NotebookText className="h-4 w-4" />
                        </button> */}
                        
                        <button
                            onClick={() => handleEditClick && handleEditClick(dayName, categoryName, exercise.id, exercise)}
                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                            title="Modifier l'exercice"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => handleDeleteExercise && handleDeleteExercise(dayName, categoryName, exercise.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                            title="Supprimer l'exercice"
                            // disabled={isDeletingExercise}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                
                {renderExerciseSeries(exercise, dayName, categoryName)}
            </div>
        );
    };

    const renderCategory = (categoryName, exercises, dayName) => {
        if (!Array.isArray(exercises)) {
            return null;
        }

        const activeExercises = exercises.filter(ex => ex && !ex.isDeleted);
        if (activeExercises.length === 0) return null;
        
        const categoryKey = `${dayName}-${categoryName}`;
        const isExpanded = expandedCategories.has(categoryKey);
        
        return (
            <div key={categoryName} className="mb-6">
                <button
                    onClick={() => toggleCategoryExpanded(categoryKey)}
                    className="w-full flex items-center justify-between p-3 bg-gray-600/30 hover:bg-gray-600/50 rounded-lg transition-colors mb-3"
                >
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-300">{categoryName}</span>
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                            {activeExercises.length}
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                
                {isExpanded && (
                    <div className="space-y-3">
                        {activeExercises.map(exercise => renderExercise(exercise, dayName, categoryName))}
                        
                        {/* Bouton toujours visible par défaut */}
                        <button
                            onClick={() => handleAddExerciseClick && handleAddExerciseClick(dayName, categoryName)}
                            className="w-full bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-gray-600"
                            // disabled={isAddingExercise}
                        >
                            <Plus className="h-4 w-4" />
                            Ajouter un exercice à {categoryName}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderDay = (dayName, dayIndex) => {
        const dayData = workouts?.days?.[dayName];
        if (!dayData || !dayData.categories) return null;
        
        const isExpanded = expandedDays.has(dayName);
        const availableCategories = getAvailableCategories(dayName);
        
        const totalExercises = availableCategories.reduce((total, categoryName) => {
            const exercises = dayData.categories[categoryName];
            return total + (Array.isArray(exercises) ? exercises.filter(ex => ex && !ex.isDeleted).length : 0);
        }, 0);
        
        const dayColors = [
            'bg-blue-600/20 text-blue-400 border-blue-600/50',
            'bg-green-600/20 text-green-400 border-green-600/50',
            'bg-purple-600/20 text-purple-400 border-purple-600/50',
            'bg-yellow-600/20 text-yellow-400 border-yellow-600/50',
            'bg-red-600/20 text-red-400 border-red-600/50',
            'bg-indigo-600/20 text-indigo-400 border-indigo-600/50',
            'bg-pink-600/20 text-pink-400 border-pink-600/50',
        ];
        const currentDayColorClass = dayColors[dayIndex % dayColors.length];

        return (
            <div key={dayName} className="mb-8">
                <button
                    onClick={() => toggleDayExpanded(dayName)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${currentDayColorClass}`}
                >
                    <div className="flex items-center gap-3">
                        <h2 className={`text-xl font-bold ${currentDayColorClass.includes('text-') ? currentDayColorClass.split(' ').find(cls => cls.startsWith('text-')) : 'text-white'}`}>{dayName}</h2>
                        <span className="text-sm bg-gray-600/50 text-gray-300 px-3 py-1 rounded-full">
                            {totalExercises} exercice{totalExercises !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Boutons de gestion du jour */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingDay(dayName);
                                setNewDayName(dayName);
                            }}
                            className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                            title="Modifier le jour"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Êtes-vous sûr de vouloir supprimer le jour "${dayName}" et tous ses exercices ?`)) { // Using confirm for now, will replace with custom modal if needed
                                    handleDeleteDay(dayName);
                                }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                            title="Supprimer le jour"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                </button>
                
                {isExpanded && (
                    <div className="mt-4 pl-4">
                        {availableCategories.map(categoryName => {
                            const exercises = dayData.categories[categoryName];
                            return renderCategory(categoryName, exercises, dayName);
                        })}
                        
                        {totalExercises === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <p className="mb-4">Aucun exercice programmé pour {dayName}</p>
                                <button
                                    onClick={() => handleAddExerciseClick && handleAddExerciseClick(dayName)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                                    // disabled={isAddingExercise}
                                >
                                    <Plus className="h-4 w-4" />
                                    Ajouter le premier exercice
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const filteredDays = getDaysToShow();

    return (
        <div className="space-y-6">
            {/* Sélecteur de jour modifié */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Jours d'entraînement</h3>
                    {searchTerm && (
                        <div className="text-sm text-gray-400">
                            Recherche: "{searchTerm}"
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {Array.isArray(workouts?.dayOrder) && workouts.dayOrder.map((day, index) => (
                        <button
                            key={day}
                            onClick={() => setSelectedDayFilter(selectedDayFilter === day ? '' : day)}
                            className={`p-3 rounded-lg transition-all ${
                                selectedDayFilter === day
                                    ? getDayButtonColors ? getDayButtonColors(index, true) : 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {day}
                        </button>
                    ))}
                    
                    {/* Bouton d'ajout de jour */}
                    <button
                        onClick={() => setShowAddDayModal(true)}
                        className="p-3 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 border-2 border-dashed border-green-600/50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Ajouter un jour
                    </button>
                </div>

                {/* Barre de recherche */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm && setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Supprimer le bouton d'ajout rapide car il fait doublon */}
            {/* <div className="flex justify-center">
                <button
                    onClick={() => handleAddExerciseClick && handleAddExerciseClick()}
                    disabled={isAddingExercise}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg"
                >
                    <Plus className="h-5 w-5" />
                    {isAddingExercise ? 'Ajout en cours...' : 'Ajouter un exercice'}
                </button>
            </div> */}
            
            {/* Liste des jours */}
            <div className="space-y-6">
                {filteredDays.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="mb-4">
                            <Dumbbell className="h-16 w-16 mx-auto text-gray-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Aucun jour d'entraînement configuré</h3>
                        <p className="mb-6">Commencez par ajouter votre premier jour d'entraînement</p>
                        <button
                            onClick={() => setShowAddDayModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                        >
                            <Plus className="h-4 w-4" />
                            Créer mon premier jour
                        </button>
                    </div>
                ) : (
                    filteredDays.map((dayName, dayIndex) => renderDay(dayName, dayIndex))
                )}
            </div>

            {/* Modal d'ajout de jour - mobile optimized */}
            {showAddDayModal && (
                <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-t-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-slide-up">
                        <div className="p-6">
                            {/* Handle pour glisser */}
                            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6"></div>
                            
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Nouveau jour</h3>
                                <button
                                    onClick={() => setShowAddDayModal(false)}
                                    className="p-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors active:scale-95"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={newDayName}
                                onChange={(e) => setNewDayName(e.target.value)}
                                placeholder="Ex: Push (Lundi)"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-base"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowAddDayModal(false);
                                        setNewDayName('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddDaySubmit}
                                    disabled={!newDayName.trim()}
                                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    Ajouter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal d'édition de jour */}
            {editingDay && (
                <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-t-2xl shadow-2xl w-full max-w-md border border-gray-700 animate-slide-up">
                        <div className="p-6">
                             {/* Handle pour glisser */}
                             <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6"></div>

                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Modifier le jour</h3>
                                <button
                                    onClick={() => setEditingDay(null)}
                                    className="p-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors active:scale-95"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={newDayName}
                                onChange={(e) => setNewDayName(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-base"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setEditingDay(null);
                                        setNewDayName('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleEditDaySubmit}
                                    disabled={!newDayName.trim()}
                                    className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Composant Timer optimisé mobile
const TimerView = ({
    timerSeconds,
    timerIsRunning,
    timerIsFinished,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    formatTime
}) => {
    const [selectedPreset, setSelectedPreset] = useState(90);
    const [customMinutes, setCustomMinutes] = useState(1); // New state for custom minutes
    const [customSeconds, setCustomSeconds] = useState(30); // New state for custom seconds
    
    const timePresets = [
        { label: '30s', value: 30 },
        { label: '1min', value: 60 },
        { label: '1m30', value: 90 },
        { label: '2min', value: 120 },
        { label: '3min', value: 180 },
        { label: '5min', value: 300 }
    ];

    const getTimerDisplay = () => {
        if (timerSeconds === 0 && !timerIsRunning) return '00:00';
        return formatTime(timerSeconds);
    };

    const getTimerStatusColor = () => {
        if (timerIsFinished) return 'text-red-400';
        if (timerIsRunning) return 'text-blue-400';
        if (timerSeconds > 0) return 'text-yellow-400';
        return 'text-gray-400';
    };

    const getProgressPercentage = () => {
        if (selectedPreset === 0) return 0;
        return ((selectedPreset - timerSeconds) / selectedPreset) * 100;
    };

    const handlePresetSelection = (value) => { // Modified function to only set preset, not start timer
        setSelectedPreset(value);
        setTimerSeconds(value);
        setTimerIsRunning(false); // Ensure timer is paused when a new preset is selected
        setTimerIsFinished(false);
    };

    const handleCustomTimerStart = () => {
        const totalSeconds = (customMinutes * 60) + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds);
            setSelectedPreset(totalSeconds);
            startTimer();
        }
    };

    return (
        <div className="max-w-lg mx-auto space-y-6 pb-4">
            {/* Affichage principal du minuteur */}
            <div className="bg-gray-800 rounded-2xl p-8 text-center border border-gray-700">
                <div className="mb-6">
                    <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Minuteur de repos</h2>
                </div>

                {/* Affichage du temps */}
                <div className="relative mb-8">
                    <div className={`text-6xl sm:text-7xl font-mono font-bold ${getTimerStatusColor()} mb-4`}>
                        {getTimerDisplay()}
                    </div>
                    
                    {/* Barre de progression */}
                    {selectedPreset > 0 && timerSeconds > 0 && (
                        <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
                            <div 
                                className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                    )}
                    
                    {timerIsFinished && (
                        <div className="text-green-400 font-semibold text-xl animate-pulse">
                            ⏰ Repos terminé !
                        </div>
                    )}
                </div>

                {/* Contrôles du minuteur */}
                <div className="flex justify-center gap-4 mb-6">
                    {timerSeconds > 0 && !timerIsFinished ? (
                        <>
                            <button
                                onClick={timerIsRunning ? pauseTimer : startTimer}
                                className={`px-8 py-4 rounded-2xl font-medium transition-all flex items-center gap-2 text-lg active:scale-95 ${
                                    timerIsRunning 
                                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                            >
                                {timerIsRunning ? (
                                    <>
                                        <Pause className="h-6 w-6" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-6 w-6" />
                                        Start
                                    </>
                                )}
                            </button>
                            <button
                                onClick={resetTimer}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-4 rounded-2xl font-medium transition-all flex items-center gap-2 active:scale-95"
                            >
                                <RotateCcw className="h-5 w-5" />
                                Reset
                            </button>
                        </>
                    ) : (
                        <div className="text-gray-400 text-lg">
                            Choisissez un temps de repos ci-dessous
                        </div>
                    )}
                </div>
            </div>

            {/* Presets de temps */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Temps prédéfinis
                </h3>
                
                <div className="grid grid-cols-3 gap-3">
                    {timePresets.map(preset => (
                        <button
                            key={preset.value}
                            onClick={() => handlePresetSelection(preset.value)} // Changed to handlePresetSelection
                            disabled={timerIsRunning}
                            className={`p-4 rounded-xl font-medium transition-all active:scale-95 ${
                                selectedPreset === preset.value && timerSeconds > 0
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            } disabled:opacity-50`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Minuteur personnalisé */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Temps personnalisé</h3>
                
                <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-16"
                            disabled={timerIsRunning}
                        />
                        <span className="text-gray-400">min</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={customSeconds}
                            onChange={(e) => setCustomSeconds(parseInt(e.target.value) || 0)}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-16"
                            disabled={timerIsRunning}
                        />
                        <span className="text-gray-400">sec</span>
                    </div>
                    
                    <button
                        onClick={handleCustomTimerStart}
                        disabled={timerIsRunning || (customMinutes === 0 && customSeconds === 0)}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Démarrer
                    </button>
                </div>
                
                <div className="text-center text-gray-400 text-sm">
                    Temps total: {formatTime((customMinutes * 60) + customSeconds)}
                </div>
            </div>

            {/* Conseils */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">💡 Conseils de repos</h3>
                <div className="space-y-3 text-sm">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <h4 className="font-medium text-green-400 mb-1">Force (1-5 reps)</h4>
                        <p className="text-gray-300">3-5 minutes pour récupération complète</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <h4 className="font-medium text-blue-400 mb-1">Hypertrophie (6-12 reps)</h4>
                        <p className="text-gray-300">1-3 minutes pour maintenir l'intensité</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <h4 className="font-medium text-yellow-400 mb-1">Endurance (12+ reps)</h4>
                        <p className="text-gray-300">30s-1min pour le rythme cardiaque</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Composant Stats optimisé mobile
const StatsView = ({ workouts = {}, historicalData = [], personalBests = {} }) => {
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

    const mainStats = useMemo(() => {
        let totalExercises = 0;
        let totalSeries = 0;
        let totalVolume = 0;

        Object.values(workouts.days || {}).forEach(day => {
            Object.values(day.categories || {}).forEach(exercises => {
                if (Array.isArray(exercises)) {
                    const activeExercises = exercises.filter(ex => !ex.isDeleted);
                    totalExercises += activeExercises.length;
                    
                    activeExercises.forEach(exercise => {
                        if (Array.isArray(exercise.series)) {
                            totalSeries += exercise.series.length;
                        }
                    });
                }
            });
        });

        Object.values(personalBests).forEach(best => {
            totalVolume += (best.totalVolume || 0);
        });

        const totalSessions = historicalData.length;
        const thisWeekSessions = historicalData.filter(session => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return session.timestamp && session.timestamp > weekAgo;
        }).length;

        return {
            totalExercises,
            totalSeries,
            totalSessions,
            thisWeekSessions,
            totalVolume: Math.round(totalVolume),
            averageSessionsPerWeek: totalSessions > 0 ? Math.round((totalSessions / 12) * 10) / 10 : 0
        };
    }, [workouts, historicalData, personalBests]);

    const topExercises = useMemo(() => {
        return Object.entries(personalBests)
            .map(([name, best]) => ({
                name: name.substring(0, 15) + (name.length > 15 ? '...' : ''),
                volume: Math.round(best.totalVolume || 0),
                maxWeight: best.maxWeight || 0
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [personalBests]);

    return (
        <div className="space-y-6 pb-4">
            {/* Titre */}
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Statistiques</h1>
                <p className="text-gray-400">Votre progression en un coup d'œil</p>
            </div>

            {/* Statistiques principales */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <Activity className="h-8 w-8 text-blue-400 p-1.5 bg-blue-500/20 rounded-lg" />
                    </div>
                    <div className="text-2xl font-bold text-white">{mainStats.totalExercises}</div>
                    <div className="text-sm text-gray-300">Exercices actifs</div>
                </div>
                
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <Calendar className="h-8 w-8 text-green-400 p-1.5 bg-green-500/20 rounded-lg" />
                    </div>
                    <div className="text-2xl font-bold text-white">{mainStats.totalSessions}</div>
                    <div className="text-sm text-gray-300">Sessions totales</div>
                </div>
                
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <Target className="h-8 w-8 text-purple-400 p-1.5 bg-purple-500/20 rounded-lg" />
                    </div>
                    <div className="text-2xl font-bold text-white">{mainStats.totalVolume}kg</div>
                    <div className="text-sm text-gray-300">Volume total</div>
                </div>
                
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <Award className="h-8 w-8 text-yellow-400 p-1.5 bg-yellow-500/20 rounded-lg" />
                    </div>
                    <div className="text-2xl font-bold text-white">{mainStats.recordsCount}</div>
                    <div className="text-sm text-gray-300">Records</div>
                </div>
            </div>

            {/* Top exercices */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Top Exercices
                </h3>
                {topExercises.length > 0 ? (
                    <div className="space-y-3">
                        {topExercises.map((exercise, index) => (
                            <div key={exercise.name} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                        {index + 1}
                                    </div>
                                    <span className="text-white font-medium">{exercise.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-green-400 font-bold">{exercise.volume}kg</div>
                                    <div className="text-xs text-gray-400">Max: {exercise.maxWeight}kg</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        <p>Commencez à vous entraîner pour voir vos statistiques</p>
                    </div>
                )}
            </div>

            {/* Conseils personnalisés */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">💡 Conseils</h3>
                <div className="space-y-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <h4 className="font-medium text-blue-400 mb-1">Fréquence</h4>
                        <p className="text-gray-300 text-sm">
                            {mainStats.totalSessions === 0 ? 
                                "Commencez par 3 séances par semaine" :
                                "Excellente régularité ! Continuez ainsi"
                            }
                        </p>
                    </div>
                    
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <h4 className="font-medium text-green-400 mb-1">Progression</h4>
                        <p className="text-gray-300 text-sm">
                            {Object.keys(personalBests).length < 5 ?
                                "Diversifiez vos exercices pour progresser" :
                                "Excellent suivi de vos performances !"
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Composant History optimisé mobile
const HistoryView = ({ 
    historicalData = [], 
    personalBests = {}, 
    formatDate, 
    getSeriesDisplay,
    searchTerm = '',
    setSearchTerm 
}) => {
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [expandedSessions, setExpandedSessions] = useState(new Set());

    const timeRangeOptions = [
        { value: 'all', label: 'Tout' },
        { value: 'week', label: '7 jours' },
        { value: 'month', label: '30 jours' }
    ];

    const getFilteredData = useMemo(() => {
        let filtered = historicalData;
        
        if (selectedTimeRange !== 'all') {
            const now = new Date();
            const cutoff = new Date();
            
            if (selectedTimeRange === 'week') {
                cutoff.setDate(now.getDate() - 7);
            } else if (selectedTimeRange === 'month') {
                cutoff.setDate(now.getDate() - 30);
            }
            
            filtered = historicalData.filter(session => 
                session.timestamp && session.timestamp >= cutoff
            );
        }
        
        return filtered;
    }, [historicalData, selectedTimeRange]);

    const toggleSessionExpanded = (sessionId) => {
        const newExpanded = new Set(expandedSessions);
        if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId);
        } else {
            newExpanded.add(sessionId);
        }
        setExpandedSessions(newExpanded);
    };

    const groupedSessions = useMemo(() => {
        const sessions = new Map();
        
        getFilteredData.forEach(session => {
            if (!sessions.has(session.id)) {
                sessions.set(session.id, {
                    id: session.id,
                    timestamp: session.timestamp,
                    exercises: []
                });
            }
            
            // Extraire les exercices de la session
            const workoutData = session.workoutData;
            if (workoutData?.days) {
                Object.values(workoutData.days).forEach(day => {
                    Object.values(day.categories || {}).forEach(exercises => {
                        if (Array.isArray(exercises)) {
                            exercises.forEach(exercise => {
                                if (!exercise.isDeleted) {
                                    sessions.get(session.id).exercises.push({
                                        ...exercise,
                                        sessionTimestamp: session.timestamp
                                    });
                                }
                            });
                        }
                    });
                });
            }
        });
        
        return Array.from(sessions.values())
            .filter(session => session.exercises.length > 0)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [getFilteredData]);

    return (
        <div className="space-y-6 pb-4">
            {/* Filtres */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">Historique</h2>
                
                <div className="space-y-3">
                    {/* Recherche */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-xl pl-10 pr-4 py-3 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    {/* Période */}
                    <select
                        value={selectedTimeRange}
                        onChange={(e) => setSelectedTimeRange(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {timeRangeOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Records */}
            {Object.keys(personalBests).length > 0 && (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-400" />
                        Records personnels
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(personalBests).slice(0, 3).map(([name, best]) => (
                            <div key={name} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                                <span className="font-medium text-white text-sm truncate flex-1 mr-2">
                                    {name.length > 20 ? name.substring(0, 20) + '...' : name}
                                </span>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-yellow-400 font-bold text-sm">
                                        {best.maxWeight}kg × {best.maxReps}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sessions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Sessions ({groupedSessions.length})</h3>
                
                {groupedSessions.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
                        <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400">Aucune session trouvée</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groupedSessions.map(session => {
                            const isExpanded = expandedSessions.has(session.id);
                            const exerciseCount = session.exercises.length;
                            
                            return (
                                <div key={session.id} className="bg-gray-800 rounded-xl border border-gray-700">
                                    <button
                                        onClick={() => toggleSessionExpanded(session.id)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors active:scale-95"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-blue-400" />
                                            <div className="text-left">
                                                <h4 className="font-medium text-white">{formatDate(session.timestamp)}</h4>
                                                <p className="text-sm text-gray-400">
                                                    {exerciseCount} exercice{exerciseCount !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="p-4 pt-0 space-y-3">
                                            {session.exercises.map((exercise, index) => (
                                                <div key={`${exercise.id}-${index}`} className="bg-gray-700/50 rounded-lg p-3">
                                                    <h5 className="font-medium text-white mb-1">{exercise.name}</h5>
                                                    <div className="text-sm text-gray-300">
                                                        {getSeriesDisplay(exercise.series)}
                                                    </div>
                                                    {personalBests[exercise.name] && (
                                                        <div className="text-xs text-yellow-400 mt-1">
                                                            🏆 Record: {personalBests[exercise.name].maxWeight}kg × {personalBests[exercise.name].maxReps}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// Composant principal de l'application
const WorkoutApp = () => {
    // États principaux
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useLocalStorage('current-view', 'workout');
    const [workouts, setWorkouts] = useState(baseInitialData);
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    
    // États de l'interface
    const [toast, setToast] = useState(null);
    const [selectedDayFilter, setSelectedDayFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // États des modales
    const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // États d'édition
    const [editingExercise, setEditingExercise] = useState(null);
    const [editingExerciseName, setEditingExerciseName] = useState('');
    const [newWeight, setNewWeight] = useState('');
    const [newSets, setNewSets] = useState('3');
    const [newReps, setNewReps] = useState('');
    const [selectedDayForAdd, setSelectedDayForAdd] = useState('');
    const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('');
    const [newExerciseName, setNewExerciseName] = useState('');
    
    // États du minuteur
    const [timerSeconds, setTimerSeconds] = useState(90);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    
    // Refs
    const timerRef = useRef(null);

    // Simulation du chargement initial
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    // Effet pour le minuteur
    useEffect(() => {
        if (timerIsRunning && timerSeconds > 0) {
            timerRef.current = setTimeout(() => {
                setTimerSeconds(prev => prev - 1);
            }, 1000);
        } else if (timerSeconds === 0 && timerIsRunning) {
            setTimerIsRunning(false);
            setTimerIsFinished(true);
            
            // Vibration mobile
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
            
            setToast({ message: 'Temps de repos terminé !', type: 'success' });
        }
        return () => clearTimeout(timerRef.current);
    }, [timerSeconds, timerIsRunning]);

    // Fonctions utilitaires
    const getDayButtonColors = useCallback((index, isSelected) => {
        const colors = [
            'bg-blue-600 hover:bg-blue-700',
            'bg-green-600 hover:bg-green-700',
            'bg-purple-600 hover:bg-purple-700',
            'bg-red-600 hover:bg-red-700',
            'bg-yellow-600 hover:bg-yellow-700',
            'bg-indigo-600 hover:bg-indigo-700',
            'bg-pink-600 hover:bg-pink-700',
        ];
        return isSelected ? colors[index % colors.length] : 'bg-gray-700 hover:bg-gray-600';
    }, []);

    // Fonctions d'exercices
    const handleAddExercise = useCallback(() => {
        if (!newExerciseName.trim()) {
            setToast({ message: "Le nom de l'exercice est requis", type: 'error' });
            return;
        }
        
        if (!selectedDayForAdd || !selectedCategoryForAdd) {
            setToast({ message: "Sélectionnez un jour et une catégorie", type: 'error' });
            return;
        }
        
        const setsNum = parseInt(newSets) || 1;
        const updatedWorkouts = { ...workouts };
        
        if (!updatedWorkouts.days[selectedDayForAdd]) {
            updatedWorkouts.days[selectedDayForAdd] = { categories: {} };
        }
        if (!updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd]) {
            updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd] = [];
        }
        
        const newExercise = {
            id: generateUUID(),
            name: newExerciseName.trim(),
            series: Array(setsNum).fill(null).map(() => ({
                weight: newWeight.toString(),
                reps: newReps.toString(),
                completed: false, // Initialize as not completed
            })),
            isDeleted: false,
            notes: ''
        };
        
        updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd].push(newExercise);
        setWorkouts(updatedWorkouts);
        
        // Réinitialiser le formulaire
        setNewExerciseName('');
        setNewWeight('');
        setNewSets('3');
        setNewReps('');
        setShowAddExerciseModal(false);
        setToast({ message: `Exercice "${newExerciseName}" ajouté !`, type: 'success' });
    }, [newExerciseName, selectedDayForAdd, selectedCategoryForAdd, newSets, newWeight, newReps, workouts]);

    const handleEditClick = useCallback((day, category, exerciseId, exercise) => {
        setEditingExercise({ day, category, exerciseId });
        setEditingExerciseName(exercise.name);
        
        // For editing, populate with the first series' data, or empty if no series
        if (exercise.series && exercise.series.length > 0) {
            setNewWeight(exercise.series[0].weight);
            setNewSets(exercise.series.length.toString());
            setNewReps(exercise.series[0].reps);
        } else {
            setNewWeight('');
            setNewSets('3');
            setNewReps('');
        }
        setShowAddExerciseModal(true); // Open the modal for editing
    }, []);

    const handleSaveEdit = useCallback(() => {
        if (!editingExercise) return;
        
        const { day, category, exerciseId } = editingExercise;
        const updatedWorkouts = { ...workouts };
        const exercises = updatedWorkouts.days?.[day]?.categories?.[category];
        
        if (!exercises) return;
        
        const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
        if (exerciseIndex === -1) return;
        
        const setsNum = parseInt(newSets) || 1;
        // Keep existing completed status for series that remain, create new ones if sets change
        const existingSeries = exercises[exerciseIndex].series || [];
        const newSeriesArray = Array(setsNum).fill(null).map((_, index) => ({
            weight: newWeight,
            reps: newReps,
            completed: existingSeries[index] ? existingSeries[index].completed : false // Preserve completion status
        }));
        
        exercises[exerciseIndex] = {
            ...exercises[exerciseIndex],
            name: editingExerciseName.trim(),
            series: newSeriesArray
        };
        
        setWorkouts(updatedWorkouts);
        setEditingExercise(null);
        setShowAddExerciseModal(false); // Close the modal after saving
        setToast({ message: "Exercice modifié !", type: 'success' });
    }, [editingExercise, workouts, editingExerciseName, newWeight, newSets, newReps]);

    const handleDeleteExercise = useCallback((day, category, exerciseId) => {
        const updatedWorkouts = { ...workouts };
        const exercises = updatedWorkouts.days?.[day]?.categories?.[category];
        
        if (!exercises) return;
        
        const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
        if (exerciseIndex === -1) return;
        
        exercises[exerciseIndex].isDeleted = true;
        setWorkouts(updatedWorkouts);
        setToast({ message: "Exercice supprimé", type: 'success' });
    }, [workouts]);

    const handleToggleSeriesCompleted = useCallback((dayName, categoryName, exerciseId, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const newWorkouts = { ...prevWorkouts };
            const day = newWorkouts.days[dayName];
            if (!day) return prevWorkouts;

            const category = day.categories[categoryName];
            if (!category) return prevWorkouts;

            const exercise = category.find(ex => ex.id === exerciseId);
            if (!exercise || !exercise.series) return prevWorkouts;

            if (exercise.series[serieIndex]) {
                exercise.series[serieIndex].completed = !exercise.series[serieIndex].completed;
            }
            return newWorkouts;
        });
    }, []);

    const handleUpdateSeries = useCallback((dayName, categoryName, exerciseId, serieIndex, field, value) => {
        setWorkouts(prevWorkouts => {
            const newWorkouts = { ...prevWorkouts };
            const day = newWorkouts.days[dayName];
            if (!day) return prevWorkouts;

            const category = day.categories[categoryName];
            if (!category) return prevWorkouts;

            const exercise = category.find(ex => ex.id === exerciseId);
            if (!exercise || !exercise.series) return prevWorkouts;

            if (exercise.series[serieIndex]) {
                exercise.series[serieIndex][field] = value;
            }
            return newWorkouts;
        });
    }, []);

    const handleAddDay = useCallback((dayName) => {
        const updatedWorkouts = { ...workouts };
        updatedWorkouts.days[dayName] = { categories: {} };
        updatedWorkouts.dayOrder = [...(updatedWorkouts.dayOrder || []), dayName];
        setWorkouts(updatedWorkouts);
        setToast({ message: `Jour "${dayName}" ajouté !`, type: 'success' });
    }, [workouts]);

    const handleEditDay = useCallback((oldDayName, newDayName) => {
        const updatedWorkouts = { ...workouts };
        updatedWorkouts.days[newDayName] = updatedWorkouts.days[oldDayName];
        delete updatedWorkouts.days[oldDayName];
        
        const dayIndex = updatedWorkouts.dayOrder.indexOf(oldDayName);
        if (dayIndex !== -1) {
            updatedWorkouts.dayOrder[dayIndex] = newDayName;
        }
        
        setWorkouts(updatedWorkouts);
        setToast({ message: `Jour renommé !`, type: 'success' });
    }, [workouts]);

    const handleDeleteDay = useCallback((dayName) => {
        const updatedWorkouts = { ...workouts };
        delete updatedWorkouts.days[dayName];
        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.filter(day => day !== dayName);
        setWorkouts(updatedWorkouts);
        setToast({ message: `Jour "${dayName}" supprimé !`, type: 'success' });
    }, [workouts]);

    // Fonctions du minuteur
    const startTimer = useCallback(() => {
        setTimerIsRunning(true);
        setTimerIsFinished(false);
    }, []);

    const pauseTimer = useCallback(() => {
        setTimerIsRunning(false);
    }, []);

    const resetTimer = useCallback(() => {
        setTimerSeconds(90); // Reset to default preset
        setTimerIsRunning(false);
        setTimerIsFinished(false);
    }, []);

    // Styles CSS pour mobile
    const mobileStyles = `
        .safe-area-inset-bottom {
            padding-bottom: env(safe-area-inset-bottom);
        }
        
        .animate-slide-up {
            animation: slideUp 0.3s ease-out forwards;
        }
        
        @keyframes slideUp {
            from {
                transform: translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        /* Optimisations touch */
        button, [role="button"] {
            min-height: 44px;
            min-width: 44px;
        }
        
        input, select, textarea {
            font-size: 16px; /* Évite le zoom sur iOS */
        }
        
        /* Scrollbar mobile */
        .scrollbar-hidden::-webkit-scrollbar {
            display: none;
        }
        
        /* Focus amélioré */
        *:focus {
            outline: 2px solid #3B82F6;
            outline-offset: 2px;
        }
        
        /* Améliore les performances */
        .gpu-accelerated {
            transform: translateZ(0);
            will-change: transform;
        }
    `;

    // Rendu de chargement
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                <div className="text-center">
                    <div className="relative mb-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                        <Dumbbell className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Carnet Muscu</h2>
                    <p className="text-gray-400">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            <style>{mobileStyles}</style>
            
            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    action={toast.action}
                />
            )}

            {/* Header mobile optimisé */}
            <header className="sticky top-0 z-40 bg-gray-800/95 backdrop-blur-md border-b border-gray-700/50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Dumbbell className="h-7 w-7 text-blue-400" />
                        <div>
                            <h1 className="text-lg font-bold text-white">Carnet Muscu</h1>
                            <p className="text-xs text-gray-400">Mobile v2.0</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors active:scale-95"
                    >
                        <Settings className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Contenu principal avec padding pour navigation */}
            <main className="p-4 pb-20">
                {currentView === 'workout' && (
                    <WorkoutView
                        workouts={workouts}
                        selectedDayFilter={selectedDayFilter}
                        setSelectedDayFilter={setSelectedDayFilter}
                        handleEditClick={handleEditClick}
                        handleAddExerciseClick={(day, category) => {
                            setSelectedDayForAdd(day || (workouts?.dayOrder?.[0] || ''));
                            setSelectedCategoryForAdd(category || 'PECS');
                            setEditingExercise(null); // Ensure no exercise is being edited
                            setNewExerciseName('');
                            setNewWeight('');
                            setNewSets('3');
                            setNewReps('');
                            setShowAddExerciseModal(true);
                        }}
                        handleDeleteExercise={handleDeleteExercise}
                        handleToggleSeriesCompleted={handleToggleSeriesCompleted}
                        handleUpdateSeries={handleUpdateSeries}
                        personalBests={personalBests}
                        getDayButtonColors={getDayButtonColors}
                        getSeriesDisplay={getSeriesDisplay}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        handleAddDay={handleAddDay}
                        handleEditDay={handleEditDay}
                        handleDeleteDay={handleDeleteDay}
                    />
                )}

                {currentView === 'timer' && (
                    <TimerView
                        timerSeconds={timerSeconds}
                        timerIsRunning={timerIsRunning}
                        timerIsFinished={timerIsFinished}
                        startTimer={startTimer}
                        pauseTimer={pauseTimer}
                        resetTimer={resetTimer}
                        setTimerSeconds={setTimerSeconds}
                        formatTime={formatTime}
                    />
                )}

                {currentView === 'stats' && (
                    <StatsView
                        workouts={workouts}
                        historicalData={historicalData}
                        personalBests={personalBests}
                    />
                )}

                {currentView === 'history' && (
                    <HistoryView
                        historicalData={historicalData}
                        personalBests={personalBests}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                    />
                )}
            </main>

            {/* Navigation mobile */}
            <BottomNavigationBar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
            />

            {/* Modal d'ajout/édition d'exercice - Design mobile-first */}
            {(showAddExerciseModal || editingExercise) && (
                <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
                    <div className="bg-gray-800 rounded-t-3xl shadow-2xl w-full max-w-md border-t border-gray-700 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            {/* Handle pour glisser */}
                            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6"></div>
                            
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">{editingExercise ? 'Modifier l\'Exercice' : 'Nouvel Exercice'}</h3>
                                <button
                                    onClick={() => {
                                        setShowAddExerciseModal(false);
                                        setEditingExercise(null);
                                    }}
                                    className="p-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors active:scale-95"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Nom de l'exercice */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nom de l'exercice *
                                    </label>
                                    <input
                                        type="text"
                                        value={editingExercise ? editingExerciseName : newExerciseName}
                                        onChange={(e) => editingExercise ? setEditingExerciseName(e.target.value) : setNewExerciseName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        placeholder="Ex: Développé couché"
                                        autoFocus
                                    />
                                </div>

                                {/* Jour - Masqué en mode édition si le jour est déjà sélectionné */}
                                {!editingExercise && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Jour d'entraînement *
                                        </label>
                                        <select
                                            value={selectedDayForAdd}
                                            onChange={(e) => setSelectedDayForAdd(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        >
                                            <option value="">Sélectionner un jour</option>
                                            {(workouts?.dayOrder || []).map(day => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Catégorie - Masqué en mode édition si la catégorie est déjà sélectionnée */}
                                {!editingExercise && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Catégorie *
                                        </label>
                                        <select
                                            value={selectedCategoryForAdd}
                                            onChange={(e) => setSelectedCategoryForAdd(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        >
                                            <option value="">Sélectionner une catégorie</option>
                                            {['PECS', 'DOS', 'EPAULES', 'BICEPS', 'TRICEPS', 'JAMBES', 'ABDOS'].map(category => (
                                                <option key={category} value={category}>{category}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Poids et Reps */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Poids (kg)
                                        </label>
                                        <input
                                            type="number"
                                            value={newWeight}
                                            onChange={(e) => setNewWeight(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                            placeholder="60"
                                            step="0.5"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Répétitions
                                        </label>
                                        <input
                                            type="number"
                                            value={newReps}
                                            onChange={(e) => setNewReps(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                            placeholder="10"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                {/* Séries */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nombre de séries
                                    </label>
                                    <input
                                        type="number"
                                        value={newSets}
                                        onChange={(e) => setNewSets(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        placeholder="3"
                                        min="1"
                                        max="10"
                                    />
                                </div>

                                {/* Aperçu */}
                                <div className="text-sm text-gray-400 bg-gray-700/50 p-4 rounded-xl">
                                    <p className="font-medium mb-1">Aperçu:</p>
                                    <p>{newSets || '3'} série(s) de {newWeight || '?'}kg × {newReps || '?'} reps</p>
                                </div>
                            </div>

                            {/* Boutons */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowAddExerciseModal(false);
                                        setEditingExercise(null);
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95 font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={editingExercise ? handleSaveEdit : handleAddExercise}
                                    disabled={!(editingExercise ? editingExerciseName.trim() : (newExerciseName.trim() && selectedDayForAdd && selectedCategoryForAdd))}
                                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 font-medium"
                                >
                                    {editingExercise ? 'Sauvegarder' : 'Ajouter'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal des paramètres */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
                    <div className="bg-gray-800 rounded-t-3xl shadow-2xl w-full max-w-md border-t border-gray-700 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6"></div>
                            
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Paramètres</h3>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors active:scale-95"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Info App */}
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-3">ℹ️ Application</h4>
                                    <div className="text-sm text-gray-400 space-y-2 bg-gray-700/50 rounded-xl p-4">
                                        <p><strong>Version:</strong> 2.0 Mobile</p>
                                        <p><strong>Statut:</strong> Démo locale</p>
                                        <p><strong>Exercices:</strong> {Object.values(workouts.days || {}).reduce((total, day) => {
                                            return total + Object.values(day.categories || {}).reduce((dayTotal, exercises) => {
                                                return dayTotal + (Array.isArray(exercises) ? exercises.filter(ex => !ex.isDeleted).length : 0);
                                            }, 0);
                                        }, 0)}</p>
                                    </div>
                                </div>

                                {/* Fonctionnalités */}
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-3">🚀 Fonctionnalités</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-xl">
                                            <span className="text-gray-300">Interface tactile</span>
                                            <span className="text-green-400">✓</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-xl">
                                            <span className="text-gray-300">Minuteur de repos</span>
                                            <span className="text-green-400">✓</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-xl">
                                            <span className="text-gray-300">Statistiques</span>
                                            <span className="text-green-400">✓</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-xl">
                                            <span className="text-gray-300">Optimisé mobile</span>
                                            <span className="text-green-400">✓</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-3">⚡ Actions</h4>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => {
                                                setWorkouts(baseInitialData);
                                                setToast({ message: "Données réinitialisées", type: 'success' });
                                                setShowSettingsModal(false);
                                            }}
                                            className="w-full p-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-colors active:scale-95 font-medium"
                                        >
                                            Réinitialiser les données
                                        </button>
                                        
                                        <button
                                            onClick={() => {
                                                const data = JSON.stringify(workouts, null, 2);
                                                const blob = new Blob([data], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'carnet-muscu-mobile.json';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                setToast({ message: "Données exportées", type: 'success' });
                                            }}
                                            className="w-full p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors active:scale-95 font-medium"
                                        >
                                            Exporter les données
                                        </button>
                                    </div>
                                </div>

                                {/* Conseils mobile */}
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-3">📱 Conseils mobile</h4>
                                    <div className="text-sm text-gray-400 space-y-2 bg-gray-700/50 rounded-xl p-4">
                                        <p>• Ajoutez l'app à votre écran d'accueil</p>
                                        <p>• Utilisez les gestes tactiles intuitifs</p>
                                        <p>• Le minuteur vibre à la fin du repos</p>
                                        <p>• Données sauvées localement</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="w-full px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95 font-medium"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkoutApp;