// ExerciseSelector.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, X, ChevronDown, ChevronUp, Dumbbell, Star, Clock, 
  Target, Zap, Award, Plus, Check, Filter
} from 'lucide-react';
import {
  EXERCISES_DATABASE,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  EXERCISE_LEVELS,
  EXERCISE_LEVEL_LABELS,
  searchExercises,
  getExercisesByMuscleGroup,
  getPopularExercises
} from './ExerciseDatabase.jsx';

/**
 * Composant ExerciseSelector pour choisir un exercice prédéfini ou personnalisé
 */
const ExerciseSelector = ({
  isOpen,
  onClose,
  onSelectExercise,
  recentExercises = [],
  favoriteExercises = [],
  onToggleFavorite
}) => {
  const [activeTab, setActiveTab] = useState('popular'); // 'popular', 'muscle', 'search', 'custom'
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState(MUSCLE_GROUPS.PECTORAUX);
  const [searchTerm, setSearchTerm] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [expandedLevels, setExpandedLevels] = useState({
    [EXERCISE_LEVELS.BASE]: true,
    [EXERCISE_LEVELS.ADVANCED]: false,
    [EXERCISE_LEVELS.FINITION]: false
  });
  const [selectedLevel, setSelectedLevel] = useState('all'); // 'all', 'base', 'advanced', 'finition'

  // Réinitialiser le formulaire personnalisé quand on change d'onglet
  useEffect(() => {
    if (activeTab !== 'custom') {
      setCustomExerciseName('');
    }
  }, [activeTab]);

  // Recherche d'exercices
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return searchExercises(searchTerm);
  }, [searchTerm]);

  // Exercices populaires
  const popularExercises = useMemo(() => {
    return getPopularExercises();
  }, []);

  // Exercices par groupe musculaire sélectionné
  const muscleGroupExercises = useMemo(() => {
    return getExercisesByMuscleGroup(selectedMuscleGroup);
  }, [selectedMuscleGroup]);

  // Exercices favoris avec leurs informations
  const favoriteExercisesWithInfo = useMemo(() => {
    const favorites = [];
    favoriteExercises.forEach(exerciseName => {
      // Chercher l'exercice dans la base
      for (const group of Object.keys(EXERCISES_DATABASE)) {
        for (const level of Object.keys(EXERCISES_DATABASE[group])) {
          const exercises = EXERCISES_DATABASE[group][level];
          if (exercises.includes(exerciseName)) {
            favorites.push({
              name: exerciseName,
              muscleGroup: group,
              level: level,
              muscleGroupLabel: MUSCLE_GROUP_LABELS[group],
              levelLabel: EXERCISE_LEVEL_LABELS[level]
            });
            return; // Sortir des boucles une fois trouvé
          }
        }
      }
      // Si pas trouvé dans la base, c'est un exercice personnalisé
      favorites.push({
        name: exerciseName,
        muscleGroup: null,
        level: null,
        muscleGroupLabel: 'Personnalisé',
        levelLabel: 'Exercice personnalisé'
      });
    });
    return favorites;
  }, [favoriteExercises]);

  // Exercices récents avec leurs informations
  const recentExercisesWithInfo = useMemo(() => {
    const recent = [];
    recentExercises.forEach(exerciseName => {
      // Chercher l'exercice dans la base
      for (const group of Object.keys(EXERCISES_DATABASE)) {
        for (const level of Object.keys(EXERCISES_DATABASE[group])) {
          const exercises = EXERCISES_DATABASE[group][level];
          if (exercises.includes(exerciseName)) {
            recent.push({
              name: exerciseName,
              muscleGroup: group,
              level: level,
              muscleGroupLabel: MUSCLE_GROUP_LABELS[group],
              levelLabel: EXERCISE_LEVEL_LABELS[level]
            });
            return;
          }
        }
      }
      // Si pas trouvé, exercice personnalisé
      recent.push({
        name: exerciseName,
        muscleGroup: null,
        level: null,
        muscleGroupLabel: 'Personnalisé',
        levelLabel: 'Exercice personnalisé'
      });
    });
    return recent;
  }, [recentExercises]);

  const toggleLevel = useCallback((level) => {
    setExpandedLevels(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  }, []);

  const handleSelectExercise = useCallback((exerciseName) => {
    onSelectExercise(exerciseName);
    onClose();
  }, [onSelectExercise, onClose]);

  const handleCustomExerciseSubmit = useCallback(() => {
    if (customExerciseName.trim()) {
      handleSelectExercise(customExerciseName.trim());
    }
  }, [customExerciseName, handleSelectExercise]);

  const handleToggleFavorite = useCallback((exerciseName, e) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(exerciseName);
    }
  }, [onToggleFavorite]);

  const getLevelIcon = (level) => {
    switch (level) {
      case EXERCISE_LEVELS.BASE:
        return <Target className="h-4 w-4 text-green-400" />;
      case EXERCISE_LEVELS.ADVANCED:
        return <Zap className="h-4 w-4 text-yellow-400" />;
      case EXERCISE_LEVELS.FINITION:
        return <Award className="h-4 w-4 text-purple-400" />;
      default:
        return <Dumbbell className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderExerciseItem = useCallback((exercise) => {
    const isFavorite = favoriteExercises.includes(exercise.name);
    const isRecent = recentExercises.includes(exercise.name);

    return (
      <div
        key={exercise.name}
        onClick={() => handleSelectExercise(exercise.name)}
        className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 border bg-gray-700/50 hover:bg-gray-700 border-gray-600/50 hover:border-gray-500"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {getLevelIcon(exercise.level)}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-white">{exercise.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">{exercise.muscleGroupLabel}</span>
              {exercise.levelLabel && (
                <>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-400">{exercise.levelLabel}</span>
                </>
              )}
              {isRecent && (
                <>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs flex items-center gap-1 text-blue-400">
                    <Clock className="h-3 w-3" /> Récent
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => handleToggleFavorite(exercise.name, e)}
          className={`p-1 rounded-full transition-colors ${
            isFavorite 
              ? 'text-yellow-400 hover:text-yellow-500'
              : 'text-gray-500 hover:text-yellow-400'
          }`}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  }, [favoriteExercises, recentExercises, handleSelectExercise, handleToggleFavorite, getLevelIcon]);

  const renderExercisesByLevel = useCallback((exercises, level) => {
    const exercisesToShow = exercises || [];
    if (exercisesToShow.length === 0) return null;

    const isExpanded = expandedLevels[level];
    const levelExercises = exercisesToShow.map(name => ({
      name,
      muscleGroup: selectedMuscleGroup,
      level,
      muscleGroupLabel: MUSCLE_GROUP_LABELS[selectedMuscleGroup],
      levelLabel: EXERCISE_LEVEL_LABELS[level]
    }));

    return (
      <div key={level} className="mb-4">
        <button
          onClick={() => toggleLevel(level)}
          className="w-full flex items-center justify-between p-3 rounded-lg transition-colors border bg-gray-700/30 hover:bg-gray-700/50 border-gray-600/30"
        >
          <div className="flex items-center gap-2">
            {getLevelIcon(level)}
            <span className="font-medium text-white">{EXERCISE_LEVEL_LABELS[level]}</span>
            <span className="text-sm text-gray-400">({exercisesToShow.length})</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        
        {isExpanded && (
          <div className="mt-2 space-y-2">
            {levelExercises.map(exercise => renderExerciseItem(exercise))}
          </div>
        )}
      </div>
    );
  }, [expandedLevels, selectedMuscleGroup, toggleLevel, getLevelIcon, renderExerciseItem]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
            <Dumbbell className="h-7 w-7 text-blue-400" />
            Choisir un exercice
          </h2>
          <button
            onClick={onClose}
            className="transition-colors p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 border-gray-700">
          <button
            onClick={() => setActiveTab('popular')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'popular'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Populaires
          </button>
          <button
            onClick={() => setActiveTab('muscle')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'muscle'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Par muscle
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'search'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Recherche
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'custom'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Personnalisé
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar pour la sélection de muscle (visible seulement dans l'onglet muscle) */}
          {activeTab === 'muscle' && (
            <div className="w-64 border-r overflow-y-auto scrollbar-thin border-gray-700">
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-300">
                  Groupes musculaires
                </h3>
                <div className="space-y-1">
                  {Object.entries(MUSCLE_GROUP_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedMuscleGroup(key)}
                      className={`w-full text-left p-2 rounded-lg transition-colors text-sm ${
                        selectedMuscleGroup === key
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main content area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-6">
              {/* Tab: Populaires */}
              {activeTab === 'popular' && (
                <div className="space-y-6">
                  {/* Favoris */}
                  {favoriteExercisesWithInfo.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                        <Star className="h-5 w-5 fill-current text-yellow-400" />
                        Mes favoris ({favoriteExercisesWithInfo.length})
                      </h3>
                      <div className="space-y-2">
                        {favoriteExercisesWithInfo.map(exercise => renderExerciseItem(exercise))}
                      </div>
                    </div>
                  )}

                  {/* Récents */}
                  {recentExercisesWithInfo.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                        <Clock className="h-5 w-5 text-blue-400" />
                        Récemment utilisés ({recentExercisesWithInfo.length})
                      </h3>
                      <div className="space-y-2">
                        {recentExercisesWithInfo.slice(0, 10).map(exercise => renderExerciseItem(exercise))}
                      </div>
                    </div>
                  )}

                  {/* Exercices populaires */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                      <Dumbbell className="h-5 w-5 text-green-400" />
                      Exercices populaires
                    </h3>
                    <div className="space-y-2">
                      {popularExercises.slice(0, 20).map(exercise => renderExerciseItem(exercise))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Par muscle */}
              {activeTab === 'muscle' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-white">
                    {MUSCLE_GROUP_LABELS[selectedMuscleGroup]}
                  </h3>
                  
                  {/* Filtre par niveau */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Filtrer par niveau :
                    </label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white border border-gray-600"
                    >
                      <option value="all">Tous les niveaux</option>
                      <option value={EXERCISE_LEVELS.BASE}>Exercices de base</option>
                      <option value={EXERCISE_LEVELS.ADVANCED}>Exercices avancés</option>
                      <option value={EXERCISE_LEVELS.FINITION}>Exercices de finition</option>
                    </select>
                  </div>

                  <div className="space-y-4">
                    {selectedLevel === 'all' ? (
                      // Afficher tous les niveaux
                      Object.entries(muscleGroupExercises).map(([level, exercises]) => 
                        renderExercisesByLevel(exercises, level)
                      )
                    ) : (
                      // Afficher seulement le niveau sélectionné
                      muscleGroupExercises[selectedLevel] && renderExercisesByLevel(muscleGroupExercises[selectedLevel], selectedLevel)
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Recherche */}
              {activeTab === 'search' && (
                <div>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un exercice..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-gray-700 text-white border border-gray-600"
                      autoFocus
                    />
                  </div>

                  {searchTerm.trim() === '' ? (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                      <p className="text-gray-400">
                        Tapez pour rechercher un exercice
                      </p>
                      <p className="text-sm mt-2 text-gray-500">
                        Exemple : "développé", "curl", "squat"...
                      </p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">
                        Aucun exercice trouvé pour "{searchTerm}"
                      </p>
                      <p className="text-sm mt-2 text-gray-500">
                        Essayez avec un autre terme ou créez un exercice personnalisé
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-4 text-gray-300">
                        {searchResults.length} exercice(s) trouvé(s) pour "{searchTerm}"
                      </p>
                      <div className="space-y-2">
                        {searchResults.map(exercise => renderExerciseItem(exercise))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Personnalisé */}
              {activeTab === 'custom' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-white">
                    Créer un exercice personnalisé
                  </h3>
                  <div className="bg-gray-700/30 border-gray-600/50 rounded-lg p-6 border">
                    <label htmlFor="custom-exercise" className="block text-sm font-medium mb-2 text-gray-300">
                      Nom de l'exercice :
                    </label>
                    <div className="flex gap-3">
                      <input
                        id="custom-exercise"
                        type="text"
                        value={customExerciseName}
                        onChange={(e) => setCustomExerciseName(e.target.value)}
                        placeholder="Ex: Mon exercice spécial"
                        className="flex-1 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-gray-700 text-white border border-gray-600"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCustomExerciseSubmit();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleCustomExerciseSubmit}
                        disabled={!customExerciseName.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium"
                      >
                        <Plus className="h-5 w-5" />
                        Ajouter
                      </button>
                    </div>
                    <p className="text-sm mt-3 text-gray-400">
                      Les exercices personnalisés seront sauvegardés pour une utilisation future.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSelector;