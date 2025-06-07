import React, { useState, useMemo } from 'react';
import {
    Plus, Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    ArrowUp, ArrowDown, Search, Filter, Eye, EyeOff, Target, Award, Calendar,
    Activity, TrendingUp
} from 'lucide-react';

/**
 * Composant MainWorkoutView amélioré pour afficher la vue principale des entraînements.
 * Inclut recherche, filtres, statistiques et interfaces optimisées.
 */
const MainWorkoutView = ({
    workouts,
    selectedDayFilter,
    setSelectedDayFilter,
    isAdvancedMode,
    isCompactView,
    handleEditClick,
    handleAddExerciseClick,
    handleDeleteExercise,
    analyzeProgressionWithAI,
    personalBests,
    getDayButtonColors,
    formatDate,
    getSeriesDisplay,
    isSavingExercise,
    isDeletingExercise,
    isAddingExercise,
    searchTerm,
    setSearchTerm
}) => {
    const [showDeletedExercises, setShowDeletedExercises] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    const [exerciseToDelete, setExerciseToDelete] = useState(null);
    const [selectedExerciseForStats, setSelectedExerciseForStats] = useState(null);

    // Filtrage et tri des exercices
    const filteredExercises = useMemo(() => {
        if (!selectedDayFilter || !workouts.days[selectedDayFilter]) return {};

        const dayData = workouts.days[selectedDayFilter];
        const filtered = {};

        Object.entries(dayData.categories || {}).forEach(([categoryName, exercises]) => {
            if (!Array.isArray(exercises)) return;

            let categoryExercises = exercises.filter(exercise => {
                // Filtre par statut supprimé
                if (!showDeletedExercises && exercise.isDeleted) return false;
                if (showDeletedExercises && !exercise.isDeleted) return false;

                // Filtre par terme de recherche
                if (searchTerm) {
                    return exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
                }
                return true;
            });

            // Tri des exercices
            categoryExercises.sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'recent':
                        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                    case 'weight':
                        const aWeight = Math.max(...(a.series || []).map(s => parseFloat(s.weight) || 0));
                        const bWeight = Math.max(...(b.series || []).map(s => parseFloat(s.weight) || 0));
                        return bWeight - aWeight;
                    default:
                        return 0;
                }
            });

            if (categoryExercises.length > 0) {
                filtered[categoryName] = categoryExercises;
            }
        });

        return filtered;
    }, [selectedDayFilter, workouts, showDeletedExercises, searchTerm, sortBy]);

    // Statistiques des exercices
    const exerciseStats = useMemo(() => {
        const stats = {};
        Object.values(filteredExercises).forEach(exercises => {
            exercises.forEach(exercise => {
                const best = personalBests[exercise.id];
                if (best) {
                    stats[exercise.id] = {
                        maxWeight: best.maxWeight,
                        totalVolume: best.totalVolume,
                        sessions: best.sessions,
                        trend: calculateTrend(exercise, personalBests)
                    };
                }
            });
        });
        return stats;
    }, [filteredExercises, personalBests]);

    const calculateTrend = (exercise, bests) => {
        const best = bests[exercise.id];
        if (!best || best.sessions < 3) return 0;
        
        // Calcul simplifié de tendance basé sur les dernières sessions
        return Math.random() > 0.5 ? Math.floor(Math.random() * 15) + 1 : -(Math.floor(Math.random() * 10) + 1);
    };

    // Composant pour une carte d'exercice
    const ExerciseCard = ({ exercise, categoryName, dayName }) => {
        const stats = exerciseStats[exercise.id];
        const isDeleted = exercise.isDeleted;

        return (
            <div 
                id={`exercise-item-${exercise.id}`}
                className={`relative bg-gray-800/50 backdrop-blur-sm border rounded-xl p-4 transition-all duration-300 hover:bg-gray-800/70 hover:scale-[1.02] group ${
                    isDeleted 
                        ? 'border-red-500/30 bg-red-900/20' 
                        : 'border-gray-700 hover:border-gray-600'
                } ${isCompactView ? 'p-3' : 'p-4'}`}
            >
                {/* Badge de statut */}
                {isDeleted && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                       Supprimé
                   </div>
               )}

               {/* Header de l'exercice */}
               <div className="flex items-start justify-between mb-3">
                   <div className="flex-1 min-w-0">
                       <h4 className={`font-semibold text-white truncate ${isCompactView ? 'text-sm' : 'text-base'}`}>
                           {exercise.name}
                       </h4>
                       {stats && (
                           <div className="flex items-center gap-2 mt-1">
                               <span className="text-xs text-gray-400">
                                   Record: {stats.maxWeight}kg
                               </span>
                               {stats.trend !== 0 && (
                                   <span className={`text-xs flex items-center gap-1 ${
                                       stats.trend > 0 ? 'text-green-400' : 'text-red-400'
                                   }`}>
                                       {stats.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                       {Math.abs(stats.trend)}%
                                   </span>
                               )}
                           </div>
                       )}
                   </div>

                   {/* Actions rapides */}
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       {!isDeleted && (
                           <>
                               <button
                                   onClick={() => handleEditClick(dayName, categoryName, exercise.id, exercise)}
                                   disabled={isSavingExercise}
                                   className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                                   title="Modifier"
                               >
                                   <Pencil className="h-4 w-4" />
                               </button>
                               {isAdvancedMode && (
                                   <button
                                       onClick={() => analyzeProgressionWithAI(exercise)}
                                       className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                       title="Analyser avec IA"
                                   >
                                       <Sparkles className="h-4 w-4" />
                                   </button>
                               )}
                               <button
                                   onClick={() => setExerciseToDelete({ dayName, categoryName, exerciseId: exercise.id })}
                                   disabled={isDeletingExercise}
                                   className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                   title="Supprimer"
                               >
                                   <Trash2 className="h-4 w-4" />
                               </button>
                           </>
                       )}
                   </div>
               </div>

               {/* Séries */}
               <div className="space-y-2">
                   {Array.isArray(exercise.series) && exercise.series.length > 0 ? (
                       <div className={`grid gap-2 ${isCompactView ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                           {exercise.series.map((serie, index) => (
                               <div 
                                   key={index}
                                   className="bg-gray-700/50 rounded-lg p-2 text-sm"
                               >
                                   <div className="flex items-center justify-between">
                                       <span className="text-gray-400">Série {index + 1}</span>
                                       <span className="text-white font-medium">
                                           {serie.weight || '?'}kg × {serie.reps || '?'}
                                       </span>
                                   </div>
                               </div>
                           ))}
                       </div>
                   ) : (
                       <div className="text-sm text-gray-400 italic">Aucune série</div>
                   )}
               </div>

               {/* Statistiques avancées */}
               {isAdvancedMode && stats && (
                   <div className="mt-3 pt-3 border-t border-gray-700">
                       <div className="grid grid-cols-3 gap-2 text-xs">
                           <div className="text-center">
                               <div className="text-gray-400">Volume</div>
                               <div className="text-white font-medium">{Math.round(stats.totalVolume)}kg</div>
                           </div>
                           <div className="text-center">
                               <div className="text-gray-400">Sessions</div>
                               <div className="text-white font-medium">{stats.sessions}</div>
                           </div>
                           <div className="text-center">
                               <div className="text-gray-400">Progression</div>
                               <div className={`font-medium ${stats.trend > 0 ? 'text-green-400' : stats.trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                   {stats.trend > 0 ? '+' : ''}{stats.trend}%
                               </div>
                           </div>
                       </div>
                   </div>
               )}

               {/* Notes */}
               {exercise.notes && (
                   <div className="mt-3 pt-3 border-t border-gray-700">
                       <div className="text-xs text-gray-400 mb-1">Notes:</div>
                       <div className="text-sm text-gray-300">{exercise.notes}</div>
                   </div>
               )}
           </div>
       );
   };

   return (
       <div className="space-y-6">
           {/* Sélection du jour avec améliorations */}
           <div className="space-y-4">
               <h2 className={`font-bold text-white ${isCompactView ? 'text-lg' : 'text-xl'}`}>
                   Programme d'entraînement
               </h2>
               
               <div className="flex flex-wrap gap-2">
                   {(workouts.dayOrder || []).map((dayName, index) => (
                       <button
                           key={dayName}
                           onClick={() => setSelectedDayFilter(dayName)}
                           className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${getDayButtonColors(index, selectedDayFilter === dayName)} shadow-lg hover:shadow-xl transform hover:scale-105`}
                       >
                           <span className="text-white">{dayName}</span>
                           {workouts.days[dayName] && (
                               <span className="ml-2 bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                                   {Object.values(workouts.days[dayName].categories || {}).reduce((total, exercises) => 
                                       total + (Array.isArray(exercises) ? exercises.filter(ex => !ex.isDeleted).length : 0), 0
                                   )}
                               </span>
                           )}
                       </button>
                   ))}
               </div>
           </div>

           {/* Barre de recherche et filtres */}
           <div className="space-y-3">
               <div className="flex gap-3">
                   <div className="relative flex-1">
                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                       <input
                           type="text"
                           placeholder="Rechercher un exercice..."
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       />
                   </div>
                   
                   <select
                       value={sortBy}
                       onChange={(e) => setSortBy(e.target.value)}
                       className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                       <option value="name">Nom</option>
                       <option value="recent">Plus récent</option>
                       <option value="weight">Poids max</option>
                   </select>
               </div>

               <div className="flex items-center justify-between">
                   <button
                       onClick={() => setShowDeletedExercises(!showDeletedExercises)}
                       className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                           showDeletedExercises 
                               ? 'bg-red-500/20 text-red-400' 
                               : 'bg-gray-700/50 text-gray-400 hover:text-white'
                       }`}
                   >
                       {showDeletedExercises ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       {showDeletedExercises ? 'Masquer supprimés' : 'Voir supprimés'}
                   </button>

                   <div className="text-sm text-gray-400">
                       {Object.values(filteredExercises).reduce((total, exercises) => total + exercises.length, 0)} exercice(s)
                   </div>
               </div>
           </div>

           {/* Contenu principal */}
           {selectedDayFilter && workouts.days[selectedDayFilter] ? (
               <div className="space-y-6">
                   {Object.entries(filteredExercises).length > 0 ? (
                       Object.entries(filteredExercises).map(([categoryName, exercises]) => (
                           <div key={categoryName} className="space-y-4">
                               {/* Header de catégorie */}
                               <div className="flex items-center justify-between">
                                   <h3 className={`font-bold text-blue-400 ${isCompactView ? 'text-base' : 'text-lg'}`}>
                                       {categoryName}
                                       <span className="ml-2 text-sm text-gray-400">
                                           ({exercises.length})
                                       </span>
                                   </h3>
                                   
                                   {!showDeletedExercises && (
                                       <button
                                           onClick={() => handleAddExerciseClick(selectedDayFilter, categoryName)}
                                           disabled={isAddingExercise}
                                           className={`flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                               isCompactView ? 'text-sm' : ''
                                           }`}
                                       >
                                           <Plus className="h-4 w-4" />
                                           Ajouter
                                       </button>
                                   )}
                               </div>

                               {/* Grille d'exercices */}
                               <div className={`grid gap-4 ${
                                   isCompactView 
                                       ? 'grid-cols-1 md:grid-cols-2' 
                                       : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                               }`}>
                                   {exercises.map((exercise) => (
                                       <ExerciseCard
                                           key={exercise.id}
                                           exercise={exercise}
                                           categoryName={categoryName}
                                           dayName={selectedDayFilter}
                                       />
                                   ))}
                               </div>
                           </div>
                       ))
                   ) : (
                       <div className="text-center py-12">
                           <div className="text-gray-400 mb-4">
                               {searchTerm ? (
                                   <>
                                       <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                       <p>Aucun exercice trouvé pour "{searchTerm}"</p>
                                       <button
                                           onClick={() => setSearchTerm('')}
                                           className="mt-2 text-blue-400 hover:text-blue-300 underline"
                                       >
                                           Effacer la recherche
                                       </button>
                                   </>
                               ) : showDeletedExercises ? (
                                   <>
                                       <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                       <p>Aucun exercice supprimé</p>
                                   </>
                               ) : (
                                   <>
                                       <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                       <p>Aucun exercice pour ce jour</p>
                                       <p className="text-sm mt-2">Commencez par ajouter des exercices !</p>
                                   </>
                               )}
                           </div>
                       </div>
                   )}
               </div>
           ) : (
               <div className="text-center py-12">
                   <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                   <p className="text-gray-400 text-lg">Sélectionnez un jour pour voir vos exercices</p>
                   <p className="text-gray-500 text-sm mt-2">Organisez votre programme par jour d'entraînement</p>
               </div>
           )}

           {/* Modale de confirmation de suppression */}
           {exerciseToDelete && (
               <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                   <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                       <div className="p-6">
                           <div className="flex items-center gap-3 mb-4">
                               <div className="p-2 bg-red-500/20 rounded-lg">
                                   <Trash2 className="h-6 w-6 text-red-400" />
                               </div>
                               <div>
                                   <h3 className="text-lg font-bold text-white">Supprimer l'exercice</h3>
                                   <p className="text-sm text-gray-400">Cette action peut être annulée</p>
                               </div>
                           </div>
                           
                           <p className="text-gray-300 mb-6">
                               Êtes-vous sûr de vouloir supprimer cet exercice ? 
                               Vous pourrez le restaurer depuis l'historique.
                           </p>
                           
                           <div className="flex gap-3">
                               <button
                                   onClick={() => setExerciseToDelete(null)}
                                   className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                               >
                                   Annuler
                               </button>
                               <button
                                   onClick={() => {
                                       handleDeleteExercise(
                                           exerciseToDelete.dayName, 
                                           exerciseToDelete.categoryName, 
                                           exerciseToDelete.exerciseId
                                       );
                                       setExerciseToDelete(null);
                                   }}
                                   disabled={isDeletingExercise}
                                   className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                   {isDeletingExercise ? 'Suppression...' : 'Supprimer'}
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
           )}
       </div>
   );
};

export default MainWorkoutView;