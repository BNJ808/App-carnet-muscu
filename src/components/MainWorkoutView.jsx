import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Search,
    Filter,
    Plus,
    Pencil,
    Trash2,
    NotebookText,
    Sparkles,
    LineChart as LineChartIcon,
    Calendar,
    Target,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    Copy,
    History,
    TrendingUp,
    Dumbbell,
    Layers,
    Activity,
    Clock,
    Zap, // Added Zap for AI suggestions
    RotateCcw, // For AI generation spinner
    Undo2, Redo2,
    Settings,
    XCircle, // For clearing AI analysis
    CheckCircle,
    Download,
    Upload,
    Share,
    Eye, EyeOff, Maximize2, Minimize2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Recharts for progression graph

const stableSort = (array, compareFunction) => {
    return array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compareFunction(a.item, b.item) || a.index - b.index)
        .map(({ item }) => item);
};

function MainWorkoutView({
    workouts,
    setWorkouts,
    onToggleSerieCompleted = () => { },
    onUpdateSerie = () => { },
    onAddSerie = () => { },
    onRemoveSerie = () => { },
    onUpdateExerciseNotes = () => { },
    onEditClick = () => { },
    onDeleteExercise = () => { },
    addDay = () => { },
    renameDay = () => { },
    deleteDay = () => { },
    duplicateDay = () => { },
    moveDay = () => { },
    addExercise = () => { },
    toggleExerciseVisibility = () => { },
    formatDate,
    showToast,
    isAdvancedMode,
    toggleAdvancedMode,
    exportData,
    importData,
    undo, redo,
    canUndo, canRedo,
    analyzeWorkoutWithAI, // AI function for workout analysis
    aiAnalysisLoading = false, // Loading state for AI analysis
    aiWorkoutAnalysisContent = '', // Holds the AI analysis text
    clearAiWorkoutAnalysis, // Function to clear AI analysis
    generateExerciseSuggestionsAI, // New prop for generating AI exercise suggestions
    aiSuggestionsLoading = false, // Loading state for AI suggestions
    aiExerciseSuggestions = [], // Holds the AI generated exercise suggestions
    clearAiExerciseSuggestions, // Function to clear AI suggestions
}) {
    const [selectedDayIndex, setSelectedDayIndex] = useState(0); // Index of the currently selected day
    const [isAddingDay, setIsAddingDay] = useState(false);
    const [newDayName, setNewDayName] = useState('');
    const [isRenamingDay, setIsRenamingDay] = useState(null); // Stores the index of the day being renamed
    const [renamedDayName, setRenamedDayName] = useState('');
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseCategory, setNewExerciseCategory] = useState('');
    const [exerciseMenuOpen, setExerciseMenuOpen] = useState(null); // Stores ID of exercise with open menu
    const [exerciseProgressionModalOpen, setExerciseProgressionModalOpen] = useState(null); // Stores ID of exercise for progression modal
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDayFilter, setSelectedDayFilter] = useState('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);
    const [showHiddenExercises, setShowHiddenExercises] = useState(false);
    const [currentWorkoutNotes, setCurrentWorkoutNotes] = useState(''); // État local pour les notes de la séance en cours
    const [isEditingNotes, setIsEditingNotes] = useState(false); // État pour l'édition des notes
    const [showAllDays, setShowAllDays] = useState(false); // Pour le bouton "Voir tous les jours"

    const selectedDayId = useMemo(() => workouts.dayOrder[selectedDayIndex], [workouts.dayOrder, selectedDayIndex]);
    const selectedDay = useMemo(() => workouts.days[selectedDayId], [workouts.days, selectedDayId]);

    // Update current workout notes when selected day changes
    useEffect(() => {
        if (selectedDay) {
            setCurrentWorkoutNotes(selectedDay.notes || '');
        }
    }, [selectedDay]);

    // Déclencher l'analyse IA si un exercice est sélectionné pour le graphique et que l'analyse n'est pas déjà là
    // Ou si l'analyse IA est vide et que le modal est ouvert
    useEffect(() => {
        if (exerciseProgressionModalOpen && !aiWorkoutAnalysisContent && !aiAnalysisLoading) {
            // Optionnel: Déclencher l'analyse globale si le modal de progression est ouvert et qu'il n'y a pas d'analyse spécifique pour l'exercice.
            // Actuellement, analyzeWorkoutWithAI est appelée explicitement par un bouton.
        }
    }, [exerciseProgressionModalOpen, aiWorkoutAnalysisContent, aiAnalysisLoading]);


    // Récupérer toutes les catégories uniques pour le filtre
    const allCategories = useMemo(() => {
        const categories = new Set();
        workouts.dayOrder.forEach(dayId => {
            workouts.days[dayId].exercises.forEach(exercise => {
                if (exercise.category) {
                    categories.add(exercise.category);
                }
            });
        });
        return Array.from(categories).sort();
    }, [workouts]);

    // Filtrer les jours disponibles pour la sélection
    const getAvailableDays = useCallback(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return workouts.dayOrder.filter(dayId => {
            const day = workouts.days[dayId];
            const matchesDayName = day.name.toLowerCase().includes(lowerCaseSearchTerm);
            const matchesExercise = day.exercises.some(ex => ex.name.toLowerCase().includes(lowerCaseSearchTerm));
            const matchesCategory = selectedCategoryFilter === 'all' || day.exercises.some(ex => ex.category === selectedCategoryFilter);
            const matchesCompleted = !showOnlyCompleted || day.exercises.every(ex => ex.series.every(s => s.completed));
            const matchesVisibility = showHiddenExercises || day.exercises.every(ex => !ex.hidden); // Check for visibility in day exercises

            return (matchesDayName || matchesExercise) && matchesCategory && matchesCompleted && matchesVisibility;
        });
    }, [workouts, searchTerm, selectedCategoryFilter, showOnlyCompleted, showHiddenExercises]);

    // Filtrer les exercices du jour sélectionné
    const getFilteredExercises = useCallback(() => {
        if (!selectedDay) return [];

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return selectedDay.exercises.filter(exercise => {
            const matchesSearchTerm = exercise.name.toLowerCase().includes(lowerCaseSearchTerm);
            const matchesCategory = selectedCategoryFilter === 'all' || exercise.category === selectedCategoryFilter;
            const matchesCompleted = !showOnlyCompleted || exercise.series.every(s => s.completed);
            const matchesVisibility = showHiddenExercises || !exercise.hidden; // Only show if not hidden or if showing hidden

            return matchesSearchTerm && matchesCategory && matchesCompleted && matchesVisibility;
        });
    }, [selectedDay, searchTerm, selectedCategoryFilter, showOnlyCompleted, showHiddenExercises]);

    // Rendre les inputs des séries avec les flèches
    const renderSerieInput = (serie, exerciseId, serieIndex, field, value) => {
        const commonClasses = "bg-gray-700 text-white rounded-md text-center text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none p-1 w-12";
        const disabledClasses = "opacity-60 cursor-not-allowed";

        const handleIncrement = () => {
            const newValue = (parseInt(value) || 0) + 1;
            onUpdateSerie(selectedDayId, exerciseId, serieIndex, field, newValue);
        };
        const handleDecrement = () => {
            const newValue = Math.max(0, (parseInt(value) || 0) - 1);
            onUpdateSerie(selectedDayId, exerciseId, serieIndex, field, newValue);
        };

        return (
            <div className="flex flex-col items-center">
                <button onClick={handleIncrement} className="text-gray-400 hover:text-white transition-colors" aria-label={`Augmenter ${field}`}>
                    <ChevronUp className="h-4 w-4" />
                </button>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onUpdateSerie(selectedDayId, exerciseId, serieIndex, field, parseInt(e.target.value) || 0)}
                    className={`${commonClasses} ${isAdvancedMode ? '' : disabledClasses}`}
                    disabled={!isAdvancedMode}
                    min="0"
                    inputMode="numeric"
                />
                <button onClick={handleDecrement} className="text-gray-400 hover:text-white transition-colors" aria-label={`Diminuer ${field}`}>
                    <ChevronDown className="h-4 w-4" />
                </button>
            </div>
        );
    };

    // Gestion de l'ajout d'un nouveau jour
    const handleAddDay = () => {
        if (newDayName.trim()) {
            addDay(newDayName.trim());
            setNewDayName('');
            setIsAddingDay(false);
            showToast('Nouveau jour ajouté !', 'success');
        } else {
            showToast('Le nom du jour ne peut pas être vide.', 'error');
        }
    };

    // Gestion du renommage d'un jour
    const handleRenameDay = (dayId) => {
        if (renamedDayName.trim()) {
            renameDay(dayId, renamedDayName.trim());
            setIsRenamingDay(null);
            setRenamedDayName('');
            showToast('Jour renommé !', 'success');
        } else {
            showToast('Le nom ne peut pas être vide.', 'error');
        }
    };

    // Gestion de la suppression d'un jour
    const handleDeleteDay = (dayId) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce jour d'entraînement et tous ses exercices ? Cette action est irréversible.")) {
            deleteDay(dayId);
            // Si le jour supprimé était sélectionné, on sélectionne le premier jour restant
            if (dayId === selectedDayId && workouts.dayOrder.length > 1) {
                setSelectedDayIndex(0);
            } else if (workouts.dayOrder.length === 1) { // Si c'était le dernier jour
                setSelectedDayIndex(0); // Garde l'index à 0 même si aucun jour
            }
            showToast('Jour supprimé !', 'success');
        }
    };

    // Gestion de l'ajout d'un nouvel exercice
    const handleAddExercise = () => {
        if (!selectedDayId) {
            showToast("Veuillez sélectionner ou ajouter un jour d'entraînement d'abord.", "warning");
            return;
        }
        if (newExerciseName.trim()) {
            addExercise(selectedDayId, newExerciseName.trim(), newExerciseCategory.trim());
            setNewExerciseName('');
            setNewExerciseCategory('');
            setIsAddingExercise(false);
            showToast('Exercice ajouté !', 'success');
        } else {
            showToast('Le nom de l\'exercice ne peut pas être vide.', 'error');
        }
    };

    // Gérer l'état d'édition des notes de la séance
    const handleSaveNotes = () => {
        if (selectedDay) {
            setWorkouts(prevWorkouts => {
                const updatedDays = {
                    ...prevWorkouts.days,
                    [selectedDayId]: {
                        ...prevWorkouts.days[selectedDayId],
                        notes: currentWorkoutNotes
                    }
                };
                return { ...prevWorkouts, days: updatedDays };
            });
            setIsEditingNotes(false);
            showToast('Notes de la séance sauvegardées !', 'success');
        }
    };

    // Fonction pour les suggestions d'exercices AI
    const handleGenerateExerciseSuggestionsAI = useCallback(() => {
        if (selectedDay) {
            generateExerciseSuggestionsAI(selectedDay);
        } else {
            showToast("Veuillez sélectionner un jour d'entraînement pour générer des suggestions.", "info");
        }
    }, [selectedDay, generateExerciseSuggestionsAI, showToast]);

    // Fermer le menu d'exercice si on clique en dehors
    const exerciseMenuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exerciseMenuRef.current && !exerciseMenuRef.current.contains(event.target)) {
                setExerciseMenuOpen(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Afficher les 3 premiers jours par défaut, ou tous si showAllDays est vrai
    const displayedDayIds = showAllDays ? getAvailableDays() : getAvailableDays().slice(0, 3);

    return (
        <div className="p-4 bg-gray-900 min-h-screen text-gray-100 font-sans pb-20"> {/* Ajout de padding-bottom pour la nav bar */}
            <h1 className="text-3xl font-extrabold text-white mb-6 text-center">Plan d'Entraînement</h1>

            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher exercice ou jour..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-gray-700 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                        onClick={() => setSelectedCategoryFilter(prev => prev === 'all' ? allCategories[0] || 'all' : 'all')} // Simple toggle for category filter
                        className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300"
                        aria-label="Filtrer par catégorie"
                    >
                        <Filter className="h-5 w-5" />
                    </button>
                </div>
                {allCategories.length > 0 && (
                    <div className="mb-3">
                        <label htmlFor="category-filter" className="block text-sm font-medium text-gray-400 mb-1">Catégorie :</label>
                        <select
                            id="category-filter"
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            <option value="all">Toutes les catégories</option>
                            {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex justify-between items-center text-sm">
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600 rounded"
                            checked={showOnlyCompleted}
                            onChange={(e) => setShowOnlyCompleted(e.target.checked)}
                        />
                        <span className="ml-2 text-gray-300">Afficher uniquement complétés</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600 rounded"
                            checked={showHiddenExercises}
                            onChange={(e) => setShowHiddenExercises(e.target.checked)}
                        />
                        <span className="ml-2 text-gray-300">Afficher masqués</span>
                    </label>
                </div>
            </div>

            {/* Boutons d'action globaux (Undo/Redo, Mode Avancé, Import/Export) */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md border border-gray-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm"
                        aria-label="Annuler la dernière action"
                    >
                        <Undo2 className="h-4 w-4" /> Annuler
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm"
                        aria-label="Rétablir la dernière action"
                    >
                        <Redo2 className="h-4 w-4" /> Rétablir
                    </button>
                </div>
                <button
                    onClick={toggleAdvancedMode}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                >
                    <Settings className="h-4 w-4" /> Mode {isAdvancedMode ? 'Standard' : 'Avancé'}
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={exportData}
                        className="px-3 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-colors flex items-center gap-1 text-sm"
                        aria-label="Exporter les données"
                    >
                        <Download className="h-4 w-4" /> Export
                    </button>
                    <button
                        onClick={importData}
                        className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1 text-sm"
                        aria-label="Importer les données"
                    >
                        <Upload className="h-4 w-4" /> Import
                    </button>
                </div>
            </div>

            {/* Boutons d'ajout de jour et gestion des jours (carrousel ou liste) */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-orange-400" />
                    Mes Jours d'Entraînement
                </h2>
                <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                    {displayedDayIds.map((dayId, index) => (
                        <div key={dayId} className="flex-shrink-0">
                            <button
                                onClick={() => setSelectedDayIndex(workouts.dayOrder.indexOf(dayId))}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                                    ${selectedDayId === dayId
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-700 text-gray-300 hover:bg-blue-500/30 hover:text-white'
                                    }`
                                }
                            >
                                {workouts.days[dayId]?.name || 'Jour sans nom'}
                            </button>
                        </div>
                    ))}
                    {getAvailableDays().length > 3 && !showAllDays && (
                        <button
                            onClick={() => setShowAllDays(true)}
                            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
                        >
                            Voir tous les jours ({getAvailableDays().length - 3} de plus)
                        </button>
                    )}
                    {showAllDays && (
                        <button
                            onClick={() => setShowAllDays(false)}
                            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
                        >
                            Voir moins
                        </button>
                    )}
                </div>

                {/* Ajout d'un nouveau jour */}
                {!isAddingDay && (
                    <button
                        onClick={() => setIsAddingDay(true)}
                        className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        <Plus className="h-5 w-5" /> Ajouter un nouveau jour
                    </button>
                )}

                {isAddingDay && (
                    <div className="mt-4 flex items-center gap-2 bg-gray-700 rounded-lg p-3">
                        <input
                            type="text"
                            value={newDayName}
                            onChange={(e) => setNewDayName(e.target.value)}
                            placeholder="Nom du nouveau jour"
                            className="flex-1 bg-gray-800 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            onKeyPress={(e) => { if (e.key === 'Enter') handleAddDay(); }}
                        />
                        <button
                            onClick={handleAddDay}
                            className="p-2 rounded-md bg-green-500 hover:bg-green-600 text-white"
                            aria-label="Ajouter ce jour"
                        >
                            <Check className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setIsAddingDay(false)}
                            className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white"
                            aria-label="Annuler l'ajout de jour"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Affichage du jour sélectionné */}
            {selectedDayId && selectedDay ? (
                <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700 mb-8">
                    <div className="flex justify-between items-center mb-5">
                        {isRenamingDay === selectedDayId ? (
                            <input
                                type="text"
                                value={renamedDayName}
                                onChange={(e) => setRenamedDayName(e.target.value)}
                                onBlur={() => handleRenameDay(selectedDayId)}
                                onKeyPress={(e) => { if (e.key === 'Enter') handleRenameDay(selectedDayId); }}
                                className="text-2xl font-bold bg-gray-700 text-white rounded-md px-3 py-1 focus:ring-2 focus:ring-blue-500 outline-none w-full"
                                autoFocus
                            />
                        ) : (
                            <h2
                                className="text-2xl font-bold text-white cursor-pointer hover:text-gray-300 transition-colors flex items-center gap-2"
                                onClick={() => { setIsRenamingDay(selectedDayId); setRenamedDayName(selectedDay.name); }}
                            >
                                <Calendar className="h-7 w-7 text-green-400" /> {selectedDay.name}
                                <Pencil className="h-5 w-5 text-gray-400 ml-2" />
                            </h2>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => duplicateDay(selectedDayId)}
                                className="p-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
                                aria-label="Dupliquer ce jour"
                            >
                                <Copy className="h-5 w-5" />
                            </button>
                            {workouts.dayOrder.length > 1 && ( // Disable deletion if only one day remains
                                <button
                                    onClick={() => handleDeleteDay(selectedDayId)}
                                    className="p-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                                    aria-label="Supprimer ce jour"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notes de la séance */}
                    <div className="mb-6 bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                            <NotebookText className="h-5 w-5 text-orange-400" /> Notes de la séance
                        </h3>
                        {isEditingNotes ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    value={currentWorkoutNotes}
                                    onChange={(e) => setCurrentWorkoutNotes(e.target.value)}
                                    className="w-full h-24 bg-gray-600 text-gray-200 rounded-md p-2 focus:ring-2 focus:ring-orange-500 outline-none resize-y"
                                    placeholder="Ajouter des notes pour cette séance..."
                                />
                                <button
                                    onClick={handleSaveNotes}
                                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md self-end"
                                >
                                    Sauvegarder les notes
                                </button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <p
                                    className={`text-gray-300 text-sm whitespace-pre-wrap ${currentWorkoutNotes ? '' : 'italic text-gray-400'}`}
                                >
                                    {currentWorkoutNotes || "Cliquez pour ajouter des notes..."}
                                </p>
                                <button
                                    onClick={() => setIsEditingNotes(true)}
                                    className="absolute top-1 right-1 p-1 bg-gray-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:bg-gray-600"
                                    aria-label="Modifier les notes"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Boutons d'action IA pour le jour */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <button
                            onClick={() => analyzeWorkoutWithAI(selectedDay)}
                            disabled={aiAnalysisLoading}
                            className={`flex-1 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-lg
                                ${aiAnalysisLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white font-medium`}
                        >
                            {aiAnalysisLoading ? (
                                <>
                                    <RotateCcw className="h-5 w-5 animate-spin" />
                                    Analyse de la séance en cours...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    Analyser cette séance (IA)
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleGenerateExerciseSuggestionsAI}
                            disabled={aiSuggestionsLoading}
                            className={`flex-1 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-lg
                                ${aiSuggestionsLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white font-medium`}
                        >
                            {aiSuggestionsLoading ? (
                                <>
                                    <RotateCcw className="h-5 w-5 animate-spin" />
                                    Génération de suggestions...
                                </>
                            ) : (
                                <>
                                    <Zap className="h-5 w-5" />
                                    Suggérer des exercices (IA)
                                </>
                            )}
                        </button>
                    </div>

                    {/* Affichage de l'analyse IA de la séance */}
                    {aiWorkoutAnalysisContent && (
                        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4 mb-6 relative">
                            <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Sparkles className="h-6 w-6 text-yellow-400" /> Analyse IA de la séance
                                <button
                                    onClick={clearAiWorkoutAnalysis}
                                    className="ml-auto text-gray-400 hover:text-white transition-colors"
                                    aria-label="Effacer l'analyse IA"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </h3>
                            <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                {aiWorkoutAnalysisContent}
                            </div>
                            <div className="text-xs text-gray-400 mt-4">
                                💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                                Consultez un professionnel pour un programme personnalisé.
                            </div>
                        </div>
                    )}

                    {/* Affichage des suggestions d'exercices IA */}
                    {aiExerciseSuggestions && aiExerciseSuggestions.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 relative">
                            <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Zap className="h-6 w-6 text-green-400" /> Suggestions d'exercices IA
                                <button
                                    onClick={clearAiExerciseSuggestions}
                                    className="ml-auto text-gray-400 hover:text-white transition-colors"
                                    aria-label="Effacer les suggestions IA"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </h3>
                            <ul className="list-disc list-inside text-sm text-white space-y-1">
                                {aiExerciseSuggestions.map((suggestion, index) => (
                                    <li key={index}>{suggestion}</li>
                                ))}
                            </ul>
                            <div className="text-xs text-gray-400 mt-4">
                                💡 Ces suggestions sont générées par IA. Adaptez-les à vos besoins.
                            </div>
                        </div>
                    )}


                    {/* Liste des exercices du jour sélectionné */}
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Dumbbell className="h-6 w-6 text-blue-400" />
                        Exercices
                        <button
                            onClick={() => setIsAddingExercise(true)}
                            className="ml-auto px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-sm"
                        >
                            <Plus className="h-4 w-4" /> Ajouter exercice
                        </button>
                    </h3>

                    {/* Formulaire d'ajout d'exercice */}
                    {isAddingExercise && (
                        <div className="bg-gray-700 rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center">
                            <input
                                type="text"
                                placeholder="Nom de l'exercice"
                                value={newExerciseName}
                                onChange={(e) => setNewExerciseName(e.target.value)}
                                className="flex-1 bg-gray-600 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                                onKeyPress={(e) => { if (e.key === 'Enter') handleAddExercise(); }}
                            />
                            <input
                                type="text"
                                placeholder="Catégorie (ex: Jambes)"
                                value={newExerciseCategory}
                                onChange={(e) => setNewExerciseCategory(e.target.value)}
                                className="flex-1 bg-gray-600 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                                onKeyPress={(e) => { if (e.key === 'Enter') handleAddExercise(); }}
                            />
                            <button
                                onClick={handleAddExercise}
                                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1 text-sm w-full sm:w-auto justify-center"
                            >
                                <Check className="h-4 w-4" /> Ajouter
                            </button>
                            <button
                                onClick={() => setIsAddingExercise(false)}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1 text-sm w-full sm:w-auto justify-center"
                            >
                                <X className="h-4 w-4" /> Annuler
                            </button>
                        </div>
                    )}

                    {getFilteredExercises().length === 0 ? (
                        <div className="bg-gray-700 rounded-lg p-8 text-center border border-gray-600">
                            <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">Aucun exercice trouvé pour ce jour avec les filtres actuels.</p>
                            <p className="text-sm text-gray-500">Ajoutez un exercice ou modifiez les filtres.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {getFilteredExercises().map((exercise) => (
                                <div key={exercise.id} className="bg-gray-700 rounded-lg p-5 border border-gray-600 relative shadow-md">
                                    {/* Menu 3 points pour l'exercice */}
                                    <div className="absolute top-3 right-3" ref={exerciseMenuOpen === exercise.id ? exerciseMenuRef : null}>
                                        <button
                                            onClick={() => setExerciseMenuOpen(prev => prev === exercise.id ? null : exercise.id)}
                                            className="p-1 rounded-full text-gray-400 hover:bg-gray-600 transition-colors"
                                            aria-label="Options d'exercice"
                                        >
                                            <MoreVertical className="h-5 w-5" />
                                        </button>
                                        {exerciseMenuOpen === exercise.id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 rounded-md shadow-lg py-1 z-10 border border-gray-700">
                                                <button
                                                    onClick={() => { onEditClick(selectedDayId, exercise.id); setExerciseMenuOpen(null); showToast("Exercice édité.", "info"); }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                                >
                                                    <Pencil className="h-4 w-4" /> Modifier
                                                </button>
                                                <button
                                                    onClick={() => { onDeleteExercise(selectedDayId, exercise.id); setExerciseMenuOpen(null); showToast("Exercice supprimé.", "success"); }}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                                                >
                                                    <Trash2 className="h-4 w-4" /> Supprimer
                                                </button>
                                                <button
                                                    onClick={() => { toggleExerciseVisibility(selectedDayId, exercise.id); setExerciseMenuOpen(null); showToast(exercise.hidden ? "Exercice affiché." : "Exercice masqué.", "info"); }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                                >
                                                    {exercise.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {exercise.hidden ? 'Afficher' : 'Masquer'}
                                                </button>
                                                <button
                                                    onClick={() => { setExerciseProgressionModalOpen(exercise.id); setExerciseMenuOpen(null); }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                                >
                                                    <LineChartIcon className="h-4 w-4" /> Voir progression
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* En-tête de l'exercice */}
                                    <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                        {exercise.name}
                                        {exercise.category && <span className="text-blue-400 text-sm font-normal bg-blue-900/30 px-2 py-0.5 rounded-full">{exercise.category}</span>}
                                        {exercise.hidden && <span className="text-gray-400 text-sm font-normal bg-gray-600/30 px-2 py-0.5 rounded-full flex items-center gap-1"><EyeOff className="h-3 w-3" /> Masqué</span>}
                                    </h4>

                                    {/* Séries de l'exercice */}
                                    <div className="space-y-3 mb-4">
                                        <div className="flex justify-between items-center text-sm font-medium text-gray-400 px-2">
                                            <span>Série</span>
                                            <span className="w-12 text-center">Poids</span>
                                            <span className="w-12 text-center">Reps</span>
                                            <span className="w-12 text-center">RPE</span>
                                            <span className="w-10 text-center">Fait</span>
                                        </div>
                                        {exercise.series.map((serie, serieIndex) => (
                                            <div key={serieIndex} className="flex justify-between items-center bg-gray-600 rounded-md py-2 px-2 border border-gray-500">
                                                <span className="text-gray-300 w-10 text-center">{serie.set}</span>
                                                {renderSerieInput(serie, exercise.id, serieIndex, 'weight', serie.weight)}
                                                {renderSerieInput(serie, exercise.id, serieIndex, 'reps', serie.reps)}
                                                {renderSerieInput(serie, exercise.id, serieIndex, 'rpe', serie.rpe)}

                                                <button
                                                    onClick={() => onToggleSerieCompleted(selectedDayId, exercise.id, serieIndex)}
                                                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${serie.completed ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'}`}
                                                    aria-label={serie.completed ? 'Marquer comme non complété' : 'Marquer comme complété'}
                                                >
                                                    {serie.completed ? <Check className="h-5 w-5 text-white" /> : <X className="h-5 w-5 text-white" />}
                                                </button>
                                                <button
                                                    onClick={() => onRemoveSerie(selectedDayId, exercise.id, serieIndex)}
                                                    className="p-1 rounded-full text-red-400 hover:bg-red-900/50 transition-colors ml-2"
                                                    aria-label="Supprimer la série"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => onAddSerie(selectedDayId, exercise.id)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Plus className="h-4 w-4" /> Ajouter Série
                                    </button>

                                    {/* Notes de l'exercice */}
                                    <div className="mt-4 bg-gray-600/50 rounded-lg p-3 border border-gray-500">
                                        <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                                            <NotebookText className="h-4 w-4 text-orange-300" /> Notes de l'exercice
                                        </h5>
                                        <textarea
                                            value={exercise.notes || ''}
                                            onChange={(e) => onUpdateExerciseNotes(selectedDayId, exercise.id, e.target.value)}
                                            className="w-full h-20 bg-gray-700 text-gray-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-y"
                                            placeholder="Ajouter des notes spécifiques à cet exercice..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700 mt-8">
                    <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Commencez votre entraînement !</p>
                    <p className="text-sm text-gray-500">
                        Cliquez sur "Ajouter un nouveau jour" pour créer votre premier programme.
                    </p>
                </div>
            )}

            {/* Modale de progression de l'exercice (peut être intégrée ou séparée) */}
            {exerciseProgressionModalOpen && (
                <ExerciseProgressionModal
                    isOpen={!!exerciseProgressionModalOpen}
                    onClose={() => setExerciseProgressionModalOpen(null)}
                    exerciseName={getFilteredExercises().find(ex => ex.id === exerciseProgressionModalOpen)?.name || ''}
                    historicalData={workouts.dayOrder.flatMap(dayId => workouts.days[dayId].exercises)} // Passer toutes les données d'exercice
                    formatDate={formatDate}
                    showToast={showToast}
                />
            )}
        </div>
    );
}

export default MainWorkoutView;


// Composant Modale de Progression (à déplacer dans un fichier séparé si grand)
const ExerciseProgressionModal = ({ isOpen, onClose, exerciseName, historicalData, formatDate, showToast }) => {
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [isLoadingAI, setIsLoadingAI] = useState(false);

    // Filter historical data for the selected exercise
    const getProgressionDataForExercise = useCallback((name) => {
        const data = [];
        historicalData.forEach(exercise => { // historicalData ici est déjà une liste d'exercices aplatie
            if (exercise.name === name) {
                let max1RM = 0;
                exercise.series.forEach(serie => {
                    if (serie.weight && serie.reps) {
                        max1RM = Math.max(max1RM, serie.weight * (1 + (serie.reps / 30)));
                    }
                });
                if (max1RM > 0 && exercise.date) { // Ensure date exists for sorting
                    data.push({ date: exercise.date, '1RM Estimé (kg)': parseFloat(max1RM.toFixed(2)) });
                }
            }
        });
        return data.sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [historicalData]);

    const data = useMemo(() => getProgressionDataForExercise(exerciseName), [exerciseName, getProgressionDataForExercise]);

    // This function will be called directly in the modal for a specific exercise
    const analyzeProgressionWithAIInModal = async (exerciseNameForAnalysis, historicalDataForAnalysis) => {
        setIsLoadingAI(true);
        setProgressionAnalysisContent(''); // Clear previous analysis

        try {
            // Filter relevant data for the specific exercise
            const exerciseSpecificData = historicalDataForAnalysis.filter(ex => ex.name === exerciseNameForAnalysis);

            if (exerciseSpecificData.length === 0) {
                setProgressionAnalysisContent("Aucune donnée suffisante trouvée pour cet exercice afin d'effectuer une analyse.");
                return;
            }

            // Prepare a concise summary for the AI
            let prompt = `Analyse la progression pour l'exercice "${exerciseNameForAnalysis}" basé sur les données suivantes et donne des conseils en français sur la surcharge progressive, la périodisation, ou des ajustements si la progression stagne. Ne donne pas de répétition spécifique. Garde la réponse courte et axée sur l'amélioration.\n\n`;
            exerciseSpecificData.forEach(ex => {
                prompt += `Date: ${formatDate(ex.date)}, Séries: [`;
                ex.series.forEach(s => prompt += `${s.weight}kgx${s.reps}reps `);
                prompt += `]\n`;
            });

            const response = await fetch('/api/gemini-pro', { // Assumed API endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                throw new Error(`Erreur de l'API: ${response.statusText}`);
            }

            const data = await response.json();
            setProgressionAnalysisContent(data.response || "Aucune analyse disponible.");
        } catch (error) {
            console.error("Erreur lors de l'analyse de progression par l'IA:", error);
            showToast(`Erreur d'analyse IA: ${error.message}`, 'error');
            setProgressionAnalysisContent("Erreur lors de la récupération de l'analyse IA. Veuillez réessayer.");
        } finally {
            setIsLoadingAI(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-700 relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                    aria-label="Fermer la modale"
                >
                    <X className="h-6 w-6" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
                    <LineChartIcon className="h-7 w-7 text-blue-400" /> Progression de {exerciseName}
                </h2>

                {/* Graphique de progression */}
                {data.length > 0 ? (
                    <div className="mt-4 bg-gray-700/50 rounded-lg p-4 border border-gray-600 mb-4">
                        <h4 className="font-semibold text-white mb-3 text-center">
                            1RM Estimé (kg)
                        </h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    tickFormatter={(dateStr) => {
                                        const d = new Date(dateStr);
                                        return `${d.getDate()}/${d.getMonth() + 1}`;
                                    }}
                                    interval="preserveStartEnd"
                                    angle={-20}
                                    textAnchor="end"
                                    height={40}
                                    style={{ fontSize: '0.75rem' }}
                                />
                                <YAxis stroke="#9CA3AF" label={{ value: '1RM (kg)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px', color: '#E5E7EB' }}
                                    itemStyle={{ color: '#E5E7EB' }}
                                    formatter={(value) => [`${value} kg`, '1RM Estimé']}
                                    labelFormatter={(label) => `Date: ${formatDate(label)}`}
                                />
                                <Line type="monotone" dataKey="1RM Estimé (kg)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                        <div className="text-center mt-3 text-gray-400 text-xs">
                            *1RM Estimé = Poids x (1 + (Reps / 30))
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-700/50 rounded-lg p-4 text-center border border-gray-600 mb-4">
                        <LineChartIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-400">Pas assez de données pour le graphique de progression de cet exercice.</p>
                        <p className="text-sm text-gray-500 mt-1">Enregistrez plus de séances pour cet exercice.</p>
                    </div>
                )}

                {/* Bouton d'analyse IA pour l'exercice */}
                <button
                    onClick={() => analyzeProgressionWithAIInModal(exerciseName, historicalData)}
                    disabled={isLoadingAI}
                    className={`w-full px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-lg
                        ${isLoadingAI ? 'bg-gray-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'} text-white font-medium mb-4`}
                >
                    {isLoadingAI ? (
                        <>
                            <RotateCcw className="h-5 w-5 animate-spin" />
                            Analyse IA en cours...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-5 w-5" />
                            Analyser la progression (IA)
                        </>
                    )}
                </button>

                {/* Résultat de l'analyse IA */}
                {progressionAnalysisContent && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 relative mb-4">
                        <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-yellow-400" /> Analyse IA pour {exerciseName}
                            <button
                                onClick={() => setProgressionAnalysisContent('')}
                                className="ml-auto text-gray-400 hover:text-white transition-colors"
                                aria-label="Effacer l'analyse IA"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </h3>
                        <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                            {progressionAnalysisContent}
                        </div>
                        <div className="text-xs text-gray-400 mt-4">
                            💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};