import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, where } from 'firebase/firestore'; // Ajout de orderBy et where
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Composant principal de la vue d'entraînement
const MainWorkoutView = ({
    workouts,
    userId,
    appId,
    db,
    setToast,
    applyChanges,
    isEditMode,
    personalBests,
    progressionInsights,
    handleAnalyzeProgressionClick,
    isAdvancedMode, // Passé depuis App.jsx
    useTimer, // Le hook est passé en prop
    generateUUID,
    calculate1RM,
    normalizeDateToStartOfDay,
    generateDateRange,
}) => {
    // States locaux à MainWorkoutView
    const [editingExercise, setEditingExercise] = useState(null); 
    const [newWeight, setNewWeight] = useState('');
    const [newSets, setNewSets] = useState('');
    const [newReps, setNewReps] = useState('');

    const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');

    const [selectedDayForAdd, setSelectedDayForAdd] = useState('');
    const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState(null); 
    const [selectedDayFilter, setSelectedDayFilter] = useState(''); 
    
    const [showExerciseGraphModal, setShowExerciseGraphModal] = useState(false); 
    const [exerciseForGraph, setExerciseForGraph] = useState(null); 
    const [individualExerciseGraphData, setIndividualExerciseGraphData] = useState([]); 
    const [graphStartDate, setGraphStartDate] = useState('');
    const [graphEndDate, setGraphEndDate] = useState('');

    const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [showAddDayModal, setShowAddDayModal] = useState(false);
    const [newDayNameInput, setNewDayNameInput] = useState('');
    const [showEditDayModal, setShowEditDayModal] = useState(false);
    const [editingDayName, setEditingDayName] = useState(null);
    const [editedDayNewNameInput, setEditedDayNewNameInput] = useState('');
    const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
    const [dayToDeleteName, setDayToDeleteName] = useState(null);

    const [showDayActionsDropdown, setShowDayActionsDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const [showSelectDayForEditModal, setShowSelectDayForEditModal] = useState(false);
    const [showSelectDayForDeleteModal, setShowSelectDayForDeleteModal] = useState(false);

    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
    const [selectedDayForCategoryAdd, setSelectedDayForCategoryAdd] = useState(''); 

    const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null); 

    const [showReorderDaysModal, setShowReorderDaysModal] = useState(false);
    const [reorderingDayOrder, setReorderingDayOrder] = useState([]); 

    const [showNotesModal, setShowNotesModal] = useState(false);
    const [exerciseForNotes, setExerciseForNotes] = useState(null); 
    const [currentNoteContent, setCurrentNoteContent] = useState('');

    const DEFAULT_REST_TIME = 90; 
    // Déclarer restTimeInput avant d'appeler useTimer
    const [restTimeInput, setRestTimeInput] = useState(DEFAULT_REST_TIME); 
    const {
        seconds: timerSeconds, 
        isRunning: timerIsRunning, 
        isFinished: timerIsFinished, 
        startTimer,
        pauseTimer,
        resetTimer,
        formatTime,
        setSeconds: setTimerSeconds, 
    } = useTimer(restTimeInput || DEFAULT_REST_TIME); // Utilise le hook passé en prop


    const dayButtonColors = [
        'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
        'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
        'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
        'from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
        'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
        'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
        'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
    ];

    const dayBorderAndTextColors = [
        'border-blue-500 text-blue-700',
        'border-green-500 text-green-700',
        'border-red-500 text-red-700',
        'border-yellow-500 text-yellow-700',
        'border-purple-500 text-purple-700',
        'border-pink-500 text-pink-700',
        'border-indigo-500 text-indigo-700',
    ];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDayActionsDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const handleEditClick = useCallback((day, category, exerciseId, exercise) => {
        setEditingExercise({ day, category, exerciseId });
        if (exercise.series && exercise.series.length > 0) {
            setNewWeight(exercise.series[0].weight);
            setNewSets(exercise.series.length.toString());
            setNewReps(exercise.series[0].reps);
        } else {
            setNewWeight('');
            setNewSets('1'); // Default to 1 set if none exist
            setNewReps('');
        }
    }, []);

    const handleSaveEdit = useCallback(() => {
        if (!editingExercise) return;

        const { day, category, exerciseId } = editingExercise;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            const weightNum = parseFloat(newWeight);
            const setsNum = parseInt(newSets);
            const repsNum = parseInt(newReps);

            if (newWeight !== '' && isNaN(weightNum)) {
                setToast({ message: "Le poids doit être un nombre.", type: 'error' });
                return;
            }
            if (newSets !== '' && (isNaN(setsNum) || setsNum <=0)) { 
                setToast({ message: "Les séries doivent être un nombre entier positif.", type: 'error' });
                return;
            }
            if (newReps !== '' && (isNaN(repsNum) || repsNum < 0)) { 
                setToast({ message: "Les répétitions doivent être un nombre entier positif ou nul.", type: 'error' });
                return;
            }

            const newSeriesArray = [];
            for (let i = 0; i < (setsNum || 1) ; i++) { // Default to 1 set if setsNum is invalid
                newSeriesArray.push({ weight: newWeight, reps: newReps });
            }
            updatedWorkouts.days[day].categories[category][exerciseIndex] = {
                ...updatedWorkouts.days[day].categories[category][exerciseIndex],
                series: newSeriesArray,
            };

            applyChanges(updatedWorkouts, "Exercice modifié avec succès !");
            setEditingExercise(null);
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la modification.", type: 'error' });
        }
    }, [editingExercise, newWeight, newSets, newReps, workouts, applyChanges, setToast]);

    const handleAddExerciseClick = useCallback((day, category) => {
        setSelectedDayForAdd(day);
        setSelectedCategoryForAdd(category);
        setNewExerciseName('');
        setNewWeight('');
        setNewSets('3'); // Default to 3 sets
        setNewReps('');
        setShowAddExerciseModal(true);
    }, []);

    const handleAddNewExercise = useCallback((name = newExerciseName, weight = newWeight, sets = newSets, reps = newReps) => {
        if (!selectedDayForAdd || selectedDayForAdd.trim() === '' || !selectedCategoryForAdd || selectedCategoryForAdd.trim() === '') {
            setToast({ message: "Veuillez sélectionner un jour et une catégorie valides.", type: 'error' });
            return;
        }
        if (!name.trim()) {
            setToast({ message: "Le nom de l'exercice est obligatoire.", type: 'error' });
            return;
        }

        const weightNum = parseFloat(weight);
        const setsNum = parseInt(sets);
        const repsNum = parseInt(reps);

        if (weight !== '' && isNaN(weightNum)) {
            setToast({ message: "Le poids doit être un nombre.", type: 'error' });
            return;
        }
        if (sets !== '' && (isNaN(setsNum) || setsNum <=0)) {
            setToast({ message: "Les séries doivent être un nombre entier positif.", type: 'error' });
            return;
        }
        if (reps !== '' && (isNaN(repsNum) || repsNum < 0)) {
            setToast({ message: "Les répétitions doivent être un nombre entier positif ou nul.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        if (!updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd]) {
            updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd] = [];
        }

        const seriesToStore = [];
        for (let i = 0; i < (setsNum || 1); i++) { // Default to 1 set
            seriesToStore.push({ weight: String(weight), reps: String(reps) });
        }

        updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd].push({
            id: generateUUID(),
            name: name.trim(),
            series: seriesToStore,
            isDeleted: false,
            notes: '',
        });
        applyChanges(updatedWorkouts, "Exercice ajouté avec succès !");
        setShowAddExerciseModal(false);
    }, [selectedDayForAdd, selectedCategoryForAdd, newExerciseName, newWeight, newSets, newReps, workouts, applyChanges, setToast, generateUUID]);


    const handleDeleteExercise = useCallback((day, category, exerciseId) => {
        setExerciseToDelete({ day, category, exerciseId });
        setShowDeleteConfirm(true);
    }, []);

    const confirmDeleteExercise = useCallback(() => {
        if (!exerciseToDelete) return;

        const { day, category, exerciseId } = exerciseToDelete;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));

        if (updatedWorkouts.days[day] && updatedWorkouts.days[day].categories && updatedWorkouts.days[day].categories[category]) {
            const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(
                (ex) => ex.id === exerciseId
            );

            if (exerciseIndex !== -1) {
                updatedWorkouts.days[day].categories[category][exerciseIndex].isDeleted = true;
                applyChanges(updatedWorkouts, "Exercice supprimé avec succès !");
            } else {
                setToast({ message: "Erreur: Exercice non trouvé pour la suppression.", type: 'error' });
            }
        } else {
            setToast({ message: "Erreur: Catégorie ou jour non trouvé pour la suppression.", type: 'error' });
        }

        setShowDeleteConfirm(false);
        setExerciseToDelete(null);
    }, [exerciseToDelete, workouts, applyChanges, setToast]);

    const handleReactivateExercise = useCallback((day, category, exerciseId) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        if (updatedWorkouts.days[day] && updatedWorkouts.days[day].categories && updatedWorkouts.days[day].categories[category]) {
            const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(
                (ex) => ex.id === exerciseId
            );

            if (exerciseIndex !== -1) {
                updatedWorkouts.days[day].categories[category][exerciseIndex].isDeleted = false;
                applyChanges(updatedWorkouts, "Exercice réactivé avec succès !");
            } else {
                setToast({ message: "Erreur: Exercice non trouvé pour la réactivation.", type: 'error' });
            }
        } else {
            setToast({ message: "Erreur: Catégorie ou jour non trouvé pour la réactivation.", type: 'error' });
        }
    }, [workouts, applyChanges, setToast]);

    const handleAddDay = useCallback(() => {
        if (!newDayNameInput.trim()) {
            setToast({ message: "Le nom du jour ne peut pas être vide.", type: 'error' });
            return;
        }
        if (workouts.days[newDayNameInput.trim()]) {
            setToast({ message: "Ce jour existe déjà.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        updatedWorkouts.days[newDayNameInput.trim()] = {
            categories: {},
            categoryOrder: []
        };
        updatedWorkouts.dayOrder.push(newDayNameInput.trim());
        applyChanges(updatedWorkouts, `Jour "${newDayNameInput.trim()}" ajouté avec succès !`);
        setShowAddDayModal(false);
        setNewDayNameInput('');
    }, [newDayNameInput, workouts, applyChanges, setToast]);

    const handleEditDay = useCallback((oldDayName) => {
        setEditingDayName(oldDayName);
        setEditedDayNewNameInput(oldDayName);
        setShowSelectDayForEditModal(false);
        setShowEditDayModal(true);
    }, []);

    const confirmEditDay = useCallback(() => {
        if (!editedDayNewNameInput.trim()) {
            setToast({ message: "Le nouveau nom du jour ne peut pas être vide.", type: 'error' });
            return;
        }
        if (editedDayNewNameInput.trim() === editingDayName) {
            setShowEditDayModal(false);
            setEditingDayName(null);
            return;
        }
        if (workouts.days[editedDayNewNameInput.trim()]) {
            setToast({ message: "Un jour avec ce nom existe déjà.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const oldDayData = updatedWorkouts.days[editingDayName];
        delete updatedWorkouts.days[editingDayName];
        updatedWorkouts.days[editedDayNewNameInput.trim()] = oldDayData;

        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.map(dayName =>
            dayName === editingDayName ? editedDayNewNameInput.trim() : dayName
        );

        if (selectedDayFilter === editingDayName) {
            setSelectedDayFilter(updatedWorkouts.dayOrder.length > 0 ? editedDayNewNameInput.trim() : null);
        }

        applyChanges(updatedWorkouts, `Jour "${editingDayName}" renommé en "${editedDayNewNameInput.trim()}" avec succès !`);
        setShowEditDayModal(false);
        setEditingDayName(null);
        setEditedDayNewNameInput('');
    }, [editedDayNewNameInput, editingDayName, workouts, selectedDayFilter, applyChanges, setToast]);

    const handleDeleteDay = useCallback((dayName) => {
        setDayToDeleteName(dayName);
        setShowSelectDayForDeleteModal(false);
        setShowDeleteDayConfirm(true);
    }, []);

    const confirmDeleteDay = useCallback(() => {
        if (!dayToDeleteName) return;

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        delete updatedWorkouts.days[dayToDeleteName];
        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.filter(day => day !== dayToDeleteName);

        if (selectedDayFilter === dayToDeleteName) {
            setSelectedDayFilter(updatedWorkouts.dayOrder.length > 0 ? updatedWorkouts.dayOrder[0] : null);
        }

        applyChanges(updatedWorkouts, `Jour "${dayToDeleteName}" supprimé avec succès !`);
        setShowDeleteDayConfirm(false);
        setDayToDeleteName(null);
    }, [dayToDeleteName, workouts, selectedDayFilter, applyChanges, setToast]);

    const handleAddCategory = useCallback(() => {
        if (!selectedDayForCategoryAdd || selectedDayForCategoryAdd.trim() === '') {
            setToast({ message: "Veuillez sélectionner un jour valide pour ajouter un groupe musculaire.", type: 'error' });
            return;
        }
        if (!newCategoryNameInput.trim()) {
            setToast({ message: "Le nom du groupe musculaire est obligatoire.", type: 'error' });
            return;
        }
        const existingCategories = Object.keys(workouts.days[selectedDayForCategoryAdd]?.categories || {});
        if (existingCategories.some(cat => cat.toUpperCase() === newCategoryNameInput.trim().toUpperCase())) {
            setToast({ message: "Ce groupe musculaire existe déjà pour ce jour.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        if (!updatedWorkouts.days[selectedDayForCategoryAdd]) {
            updatedWorkouts.days[selectedDayForCategoryAdd] = { categories: {}, categoryOrder: [] };
        }
        const newCategoryKey = newCategoryNameInput.trim().toUpperCase(); 
        updatedWorkouts.days[selectedDayForCategoryAdd].categories[newCategoryKey] = [];
        updatedWorkouts.days[selectedDayForCategoryAdd].categoryOrder.push(newCategoryKey);
        
        applyChanges(updatedWorkouts, `Groupe musculaire "${newCategoryNameInput.trim()}" ajouté avec succès !`);
        setShowAddCategoryModal(false);
        setNewCategoryNameInput('');
    }, [selectedDayForCategoryAdd, newCategoryNameInput, workouts, applyChanges, setToast]);

    const openAddCategoryModalForDay = useCallback((day) => {
        if (!day) {
            setToast({ message: "Veuillez créer un jour d'entraînement avant d'ajouter des groupes musculaires.", type: 'error' });
            return;
        }
        setSelectedDayForCategoryAdd(day);
        setNewCategoryNameInput('');
        setShowAddCategoryModal(true);
    }, [setToast]);


    const handleEditCategory = useCallback((day, oldCategoryName) => {
        setEditingCategory({ day, oldCategoryName });
        setNewCategoryName(oldCategoryName); 
        setShowEditCategoryModal(true);
    }, []);

    const confirmEditCategory = useCallback(() => {
        if (!editingCategory || !newCategoryName.trim()) {
            setToast({ message: "Le nouveau nom du groupe musculaire ne peut pas être vide.", type: 'error' });
            return;
        }
        const newCatUpper = newCategoryName.trim().toUpperCase();
        const oldCatUpper = editingCategory.oldCategoryName.toUpperCase();

        if (newCatUpper === oldCatUpper) {
            setShowEditCategoryModal(false);
            setEditingCategory(null);
            return;
        }
        if (workouts.days[editingCategory.day]?.categories[newCatUpper]) {
            setToast({ message: "Un groupe musculaire avec ce nom existe déjà pour ce jour.", type: 'error' });
            return;
        }

        const { day, oldCategoryName } = editingCategory;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const categories = updatedWorkouts.days[day].categories;
        const categoryOrder = updatedWorkouts.days[day].categoryOrder;

        categories[newCatUpper] = categories[oldCategoryName]; 
        delete categories[oldCategoryName];

        const oldIndex = categoryOrder.indexOf(oldCategoryName); 
        if (oldIndex !== -1) {
            categoryOrder[oldIndex] = newCatUpper;
        }

        applyChanges(updatedWorkouts, `Groupe musculaire "${oldCategoryName}" renommé en "${newCategoryName.trim()}" avec succès !`);
        setShowEditCategoryModal(false);
        setEditingCategory(null);
        setNewCategoryName('');
    }, [editingCategory, newCategoryName, workouts, applyChanges, setToast]);

    const handleDeleteCategory = useCallback((day, categoryName) => {
        setCategoryToDelete({ day, categoryName });
        setShowDeleteCategoryConfirm(true);
    }, []);

    const confirmDeleteCategory = useCallback(() => {
        if (!categoryToDelete) return;

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));

        if (updatedWorkouts.days[categoryToDelete.day] && updatedWorkouts.days[categoryToDelete.day].categories) {
            const exercisesInCat = updatedWorkouts.days[categoryToDelete.day].categories[categoryToDelete.categoryName];
            if (Array.isArray(exercisesInCat)) {
                exercisesInCat.forEach(ex => ex.isDeleted = true); // Mark all exercises in category as deleted
            }
            // Remove the category from the display order, but keep its data for history
            updatedWorkouts.days[categoryToDelete.day].categoryOrder = updatedWorkouts.days[categoryToDelete.day].categoryOrder.filter(cat => cat !== categoryToDelete.categoryName);
            
            applyChanges(updatedWorkouts, `Groupe musculaire "${categoryToDelete.categoryName}" et ses exercices marqués comme supprimés avec succès !`);
        } else {
            setToast({ message: "Erreur: Groupe musculaire ou jour non trouvé pour la suppression.", type: 'error' });
        }

        setShowDeleteCategoryConfirm(false);
        setCategoryToDelete(null);
    }, [categoryToDelete, workouts, applyChanges, setToast]);

    const openExerciseGraphModal = useCallback(async (exercise) => {
        setExerciseForGraph(exercise);
        setShowExerciseGraphModal(true);
        setGraphStartDate('');
        setGraphEndDate('');

        // Fetch individual exercise data for the graph
        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        let queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - 3); // Default to 3 months for graph
        queryStartDate.setHours(0, 0, 0, 0);
        let queryEndDate = new Date();
        queryEndDate.setHours(23, 59, 59, 999);

        const allDatesForDisplay = generateDateRange(queryStartDate, queryEndDate);

        const q = query(
            sessionsRef,
            where('timestamp', '>=', queryStartDate),
            where('timestamp', '<=', queryEndDate),
            orderBy('timestamp', 'asc')
        );

        try {
            const snapshot = await getDocs(q);
            const fetchedData = snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                workoutData: doc.data().workoutData
            }));

            const latestDailyWeightsIndividual = {};
            fetchedData.forEach(session => {
                const localDate = session.timestamp;
                const dateKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                const sessionDays = session.workoutData?.days || {};
                Object.keys(sessionDays).forEach(dayKey => {
                    const dayData = sessionDays[dayKey];
                    if (dayData && dayData.categories) {
                        Object.keys(dayData.categories).forEach(categoryKey => {
                            (dayData.categories[categoryKey] || []).forEach(exItem => {
                                if (exItem.id === exercise.id) {
                                    const exerciseSeries = Array.isArray(exItem.series) ? exItem.series : [];
                                    const maxWeightForDay = Math.max(0, ...exerciseSeries.map(s => parseFloat(s.weight)).filter(w => !isNaN(w)));
                                    if (maxWeightForDay > 0) {
                                        if (!latestDailyWeightsIndividual[dateKey] || session.timestamp > latestDailyWeightsIndividual[dateKey].timestamp) {
                                            latestDailyWeightsIndividual[dateKey] = {
                                                timestamp: session.timestamp,
                                                weight: maxWeightForDay,
                                            };
                                        }
                                    }
                                }
                            });
                        });
                    }
                });
            });

            const finalIndividualData = [];
            let lastKnownWeight = null;
            allDatesForDisplay.forEach(date => {
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dataPoint = { date: dateKey, weight: null, hasNewData: false };
                if (latestDailyWeightsIndividual[dateKey]) {
                    dataPoint.weight = latestDailyWeightsIndividual[dateKey].weight;
                    dataPoint.hasNewData = true;
                    lastKnownWeight = dataPoint.weight;
                } else if (lastKnownWeight !== null) {
                    dataPoint.weight = lastKnownWeight;
                }
                finalIndividualData.push(dataPoint);
            });
            setIndividualExerciseGraphData(finalIndividualData);

        } catch (error) {
            console.error("Erreur lors de la récupération des données de graphique:", error);
            setToast({ message: `Erreur graphique: ${error.message}`, type: 'error' });
        }
    }, [userId, appId, db, setToast, generateDateRange]);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        if (dateString instanceof Date) {
            return dateString.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts;
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        return dateString; 
    }, []);

    const handleReorderDays = useCallback((dayName, direction) => {
        const currentOrder = [...reorderingDayOrder];
        const index = currentOrder.indexOf(dayName);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < currentOrder.length) {
            const [removed] = currentOrder.splice(index, 1);
            currentOrder.splice(newIndex, 0, removed);
            setReorderingDayOrder(currentOrder);
        }
    }, [reorderingDayOrder]);

    const saveReorderedDays = useCallback(() => {
        const updatedWorkouts = { ...workouts, dayOrder: reorderingDayOrder };
        applyChanges(updatedWorkouts, "Ordre des jours sauvegardé avec succès !");
        setShowReorderDaysModal(false);
    }, [workouts, reorderingDayOrder, applyChanges]);

    const getSeriesDisplay = useCallback((exercise) => {
        const firstSeries = exercise.series && exercise.series.length > 0 ? exercise.series[0] : { weight: '', reps: '' };
        const setsCount = exercise.series ? exercise.series.length : 0;

        const weight = parseFloat(firstSeries.weight);
        const reps = parseInt(firstSeries.reps);
        const rmResult = calculate1RM(weight, reps);

        return (
            <span>
                Poids: <strong className="font-extrabold text-xl">{firstSeries.weight || '-'}</strong> kg | Séries: <strong className="font-extrabold text-xl">{setsCount || '-'}</strong> | Reps: <strong className="font-extrabold text-xl">{firstSeries.reps || '-'}</strong>
                {isAdvancedMode && (!isNaN(weight) && !isNaN(reps) && rmResult.average !== 'N/A') && (
                    <span className="text-sm text-blue-300 ml-1">(1RM: {rmResult.average} kg)</span>
                )}
            </span>
        );
    }, [isAdvancedMode, calculate1RM]);

    const handleReorderCategories = useCallback((dayName, categoryName, direction) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const categoryOrder = updatedWorkouts.days[dayName].categoryOrder;
        const index = categoryOrder.indexOf(categoryName);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < categoryOrder.length) {
            const [removed] = categoryOrder.splice(index, 1);
            categoryOrder.splice(newIndex, 0, removed);
            updatedWorkouts.days[dayName].categoryOrder = categoryOrder; 
            applyChanges(updatedWorkouts, "Ordre des groupes musculaires mis à jour !");
        }
    }, [workouts, applyChanges]);

    const handleReorderExercises = useCallback((dayName, categoryName, exerciseId, direction) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exercises = updatedWorkouts.days[dayName].categories[categoryName];
        const index = exercises.findIndex(ex => ex.id === exerciseId);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < exercises.length) {
            const [removed] = exercises.splice(index, 1);
            exercises.splice(newIndex, 0, removed);
            updatedWorkouts.days[dayName].categories[categoryName] = exercises;
            applyChanges(updatedWorkouts, "Ordre des exercices mis à jour !");
        }
    }, [workouts, applyChanges]);

    const handleOpenNotesModal = useCallback((day, category, exerciseId, currentNotes) => {
        setExerciseForNotes({ day, category, exerciseId });
        setCurrentNoteContent(currentNotes || '');
        setShowNotesModal(true);
    }, []);

    const handleSaveNote = useCallback(() => {
        if (!exerciseForNotes) return;

        const { day, category, exerciseId } = exerciseForNotes;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            updatedWorkouts.days[day].categories[category][exerciseIndex].notes = currentNoteContent;
            applyChanges(updatedWorkouts, "Note sauvegardée avec succès !");
            setShowNotesModal(false);
            setExerciseForNotes(null);
            setCurrentNoteContent('');
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la sauvegarde de la note.", type: 'error' });
        }
    }, [exerciseForNotes, currentNoteContent, workouts, applyChanges, setToast]);

    const handleDeleteNote = useCallback(() => {
        if (!exerciseForNotes) return;

        const { day, category, exerciseId } = exerciseForNotes;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            updatedWorkouts.days[day].categories[category][exerciseIndex].notes = ''; 
            applyChanges(updatedWorkouts, "Note supprimée avec succès !");
            setShowNotesModal(false);
            setExerciseForNotes(null);
            setCurrentNoteContent('');
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la suppression de la note.", type: 'error' });
        }
    }, [exerciseForNotes, workouts, applyChanges, setToast]);

    const orderedDays = workouts.dayOrder || []; 
    const daysToDisplay = selectedDayFilter && orderedDays.includes(selectedDayFilter) ? [selectedDayFilter] : [];

    useEffect(() => {
        if ((workouts.dayOrder || []).length > 0) {
            if (!selectedDayFilter || !(workouts.dayOrder || []).includes(selectedDayFilter)) {
                setSelectedDayFilter((workouts.dayOrder || [])[0]);
            }
        } else {
            setSelectedDayFilter(null);
        }
    }, [workouts.dayOrder, selectedDayFilter]);


    return (
        <>
            {isEditMode && (
                <div className="flex flex-col sm:flex-row gap-6 mb-6">
                    <div className="relative inline-block text-left" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDayActionsDropdown(!showDayActionsDropdown)}
                            className="inline-flex justify-center w-full rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                            id="menu-button"
                            aria-expanded="true"
                            aria-haspopup="true"
                        >
                            Actions sur les jours
                            <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {showDayActionsDropdown && (
                            <div
                                className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                                role="menu"
                                aria-orientation="vertical"
                                aria-labelledby="menu-button"
                                tabIndex="-1"
                            >
                                <div className="py-1" role="none">
                                    <button onClick={() => { setShowAddDayModal(true); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1" > Ajouter un jour </button>
                                    <button onClick={() => { setShowSelectDayForEditModal(true); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1"> Renommer un jour</button>
                                    <button onClick={() => { setShowSelectDayForDeleteModal(true); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1">Supprimer un jour</button>
                                    <button onClick={() => { setShowReorderDaysModal(true); setReorderingDayOrder([...(workouts.dayOrder || [])]); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1">Réorganiser les jours</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 mb-8 justify-start">
                {orderedDays.map((day, index) => (
                    <button
                        key={day}
                        onClick={() => setSelectedDayFilter(day)}
                        className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold shadow-md transition transform hover:scale-105 text-sm sm:text-base
                        ${selectedDayFilter === day
                                ? `bg-gradient-to-r ${dayButtonColors[index % dayButtonColors.length]} text-white`
                                : `bg-gray-700 border-2 ${dayBorderAndTextColors[index % dayBorderAndTextColors.length]}`
                            }`}
                    >
                        {day}
                    </button>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-8 mb-8 max-w-6xl mx-auto">
                <div className={`bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700 w-full`}>
                    <h2 className={`text-2xl sm:text-3xl font-bold text-red-400 mb-4 text-center`}>Minuteur de repos</h2>
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <input type="number" value={restTimeInput}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value >= 0) {setRestTimeInput(value); setTimerSeconds(value);}
                                else if (e.target.value === '') {setRestTimeInput('');}
                            }}
                            onBlur={() => { if (restTimeInput === '') {setRestTimeInput(DEFAULT_REST_TIME); setTimerSeconds(DEFAULT_REST_TIME);}}}
                            className={`w-20 sm:w-24 p-2 rounded-md bg-gray-700 text-white border border-gray-600 text-center text-base sm:text-lg focus:ring-2 focus:ring-blue-500`}
                            min="0" max="3600" aria-label="Temps de repos en secondes" />
                        <span className={`text-lg sm:text-xl text-gray-300`}>secondes</span>
                    </div>
                    <p className={`text-5xl sm:text-6xl font-extrabold text-blue-400 mb-6 text-center transition-colors duration-500`}> {formatTime(timerSeconds)} </p>
                    <div className="flex justify-center space-x-4">
                        <button onClick={timerIsRunning ? pauseTimer : () => startTimer()}
                            className={`px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold shadow-lg transition transform hover:scale-105 text-lg sm:text-xl ${timerIsRunning ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} text-white`} >
                            {timerIsRunning ? 'Pause' : 'Démarrer'}
                        </button>
                        <button onClick={() => resetTimer(restTimeInput || DEFAULT_REST_TIME)} className="px-6 py-3 sm:px-8 sm:py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg transition transform hover:scale-105 text-lg sm:text-xl" >
                            Réinitialiser
                        </button>
                    </div>
                    {timerIsFinished && ( <p className="text-yellow-400 text-xl sm:text-2xl font-bold mt-4 animate-bounce text-center"> Temps de repos terminé ! </p> )}
                </div>
            </div>


            <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
                {daysToDisplay.map((day) => {
                    const currentDayData = workouts.days?.[day];
                    if (!currentDayData) {
                        return <div key={day} className="text-center text-gray-500">Journée "{day}" non trouvée ou vide.</div>;
                    }

                    const categoriesToIterate = currentDayData.categoryOrder || [];

                    return (
                        <div key={day} className={`bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-700`}>
                            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                                <h2 className={`text-2xl sm:text-3xl font-bold text-blue-400`}>{day}</h2>
                                {isEditMode && (
                                    <button onClick={() => openAddCategoryModalForDay(day)} className="px-3 py-1 sm:px-4 sm:py-2 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs sm:text-sm" title="Ajouter un groupe musculaire" >
                                        Ajouter groupe musculaire
                                    </button>
                                )}
                            </div>

                            {categoriesToIterate.map((category) => {
                                const exercises = currentDayData.categories?.[category] || [];

                                const exercisesToRender = exercises.filter(ex => !ex.isDeleted);
                                
                                if (!isEditMode && exercises.every(ex => ex.isDeleted)) {
                                    return null;
                                }

                                const categoryIndexInOrder = currentDayData.categoryOrder.indexOf(category);

                                return (
                                    <div key={category} className={`mb-8 bg-gray-700 rounded-lg p-3 sm:p-5 shadow-inner border border-gray-700`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className={`text-xl sm:text-2xl font-semibold text-green-300`}>{category}</h3>
                                            {isEditMode && (
                                                <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1"> 
                                                    <button onClick={() => handleAddExerciseClick(day, category)} className="px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs" title="Ajouter un exercice">Ajouter exo</button>
                                                    <button onClick={() => handleEditCategory(day, category)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Renommer groupe musculaire"> <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-7.793 7.793A1 1 0 017.07 14H5a1 1 0 01-1-1v-2.07l7.793-7.793zM11.379 5.793L13.586 8l-1.5 1.5-2.207-2.207 1.5-1.5z" /></svg></button>
                                                    <button onClick={() => handleDeleteCategory(day, category)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer groupe musculaire"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={() => handleReorderCategories(day, category, -1)} disabled={categoryIndexInOrder === 0 || categoryIndexInOrder === -1} className="p-1 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer le groupe musculaire vers le haut"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={() => handleReorderCategories(day, category, 1)} disabled={categoryIndexInOrder === currentDayData.categoryOrder.length - 1 || categoryIndexInOrder === -1} className="p-1 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer le groupe musculaire vers le bas"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                </div>
                                            )}
                                        </div>
                                        <ul className="space-y-4">
                                            {exercisesToRender.map((exercise, exerciseIndex) => (
                                                <li key={exercise.id} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-200 ${exercise.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                                    <div className="flex-grow mb-2 sm:mb-0">
                                                        <p className={`text-base sm:text-lg font-medium text-white`}>{exercise.name}</p>
                                                        <p className={`text-sm sm:text-base text-gray-300`}>{getSeriesDisplay(exercise)}</p>
                                                        {isAdvancedMode && personalBests[exercise.id] && ( <p className="text-xs sm:text-sm text-yellow-300 mt-1"> Meilleure Perf: {personalBests[exercise.id].maxWeight}kg ({personalBests[exercise.id].reps} reps) le {formatDate(personalBests[exercise.id].date)}</p>)}
                                                        {isAdvancedMode && progressionInsights[exercise.id] && ( <p className="text-xs sm:text-sm text-cyan-300 mt-1"> Insight: {progressionInsights[exercise.id]} </p>)}
                                                        {exercise.notes && ( <p className={`text-xs sm:text-sm text-gray-300 mt-2 italic`}> Notes: "{exercise.notes}"</p>)}
                                                    </div>
                                                    <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1 mt-2 sm:mt-0"> 
                                                        <button onClick={() => handleEditClick(day, category, exercise.id, exercise)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110 shadow-lg" title="Editer l'exercice"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-7.793 7.793A1 1 0 017.07 14H5a1 1 0 01-1-1v-2.07l7.793-7.793zM11.379 5.793L13.586 8l-1.5 1.5-2.207-2.207 1.5-1.5z" /></svg></button>
                                                        {isEditMode && (
                                                            <>
                                                                <button onClick={() => handleDeleteExercise(day, category, exercise.id)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110 shadow-lg" title="Supprimer l'exercice"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, -1)} disabled={exerciseIndex === 0} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer l'exercice vers le haut"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, 1)} disabled={exerciseIndex === exercisesToRender.length - 1} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer l'exercice vers le bas"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                            </>
                                                        )}
                                                        {isAdvancedMode && !exercise.isDeleted && (
                                                             <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec IA"> ✨ Analyser </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg></button>
                                                        <button onClick={() => handleOpenNotesModal(day, category, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0117 8.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h9V8.414L12.586 5A2 2 0 0012 4.586V4H6zm-1 6a1 1 0 011-1h5a1 1 0 110 2H6a1 1 0 01-1-1zM6 13a1 1 0 011-1h5a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>


            {/* Modals */}
            {editingExercise && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Modifier l'exercice</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="editWeight" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Poids (kg):</label> <input type="number" id="editWeight" step="0.1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} /> </div> <div> <label htmlFor="editSets" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Séries:</label> <input type="number" id="editSets" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newSets} onChange={(e) => setNewSets(e.target.value)} /> </div> <div> <label htmlFor="editReps" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Reps:</label> <input type="number" id="editReps" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newReps} onChange={(e) => setNewReps(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setEditingExercise(null)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler </button> <button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder </button> </div> </div> </div>)}
            {showAddExerciseModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter un nouvel exercice</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newExerciseName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom de l'exercice:</label> <input type="text" id="newExerciseName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} /> </div> <div> <label htmlFor="newExerciseWeight" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Poids (kg):</label> <input type="number" id="newExerciseWeight" step="0.1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} /> </div> <div> <label htmlFor="newExerciseSets" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Séries:</label> <input type="number" id="newExerciseSets" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newSets} onChange={(e) => setNewSets(e.target.value)} /> </div> <div> <label htmlFor="newExerciseReps" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Reps:</label> <input type="number" id="newExerciseReps" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newReps} onChange={(e) => setNewReps(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowAddExerciseModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={() => handleAddNewExercise()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button> </div> </div> </div>)}
            {showDeleteConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression</h2> <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer l'exercice "{workouts.days[exerciseToDelete?.day]?.categories[exerciseToDelete?.category]?.find(ex => ex.id === exerciseToDelete?.exerciseId)?.name}" ? Il sera marqué comme supprimé. </p> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowDeleteConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler </button> <button onClick={confirmDeleteExercise} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer </button> </div> </div> </div>)}
            {showAddDayModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter un nouveau jour</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newDayName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom du jour:</label> <input type="text" id="newDayName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newDayNameInput} onChange={(e) => setNewDayNameInput(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowAddDayModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={handleAddDay} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button> </div> </div> </div>)}
            {showSelectDayForEditModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Sélectionner le jour à renommer</h2> <div className="space-y-3 sm:space-y-4"> {(orderedDays || []).map((day) => ( <button key={day} onClick={() => handleEditDay(day)} className={`w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base`} > {day} </button> ))} </div> <div className="flex justify-end mt-6 sm:mt-8"> <button onClick={() => setShowSelectDayForEditModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> </div> </div> </div>)}
            {showEditDayModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Renommer le jour "{editingDayName}"</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="editedDayNewName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nouveau nom du jour:</label> <input type="text" id="editedDayNewName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={editedDayNewNameInput} onChange={(e) => setEditedDayNewNameInput(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowEditDayModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmEditDay} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Renommer</button> </div> </div> </div>)}
            {showSelectDayForDeleteModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Sélectionner le jour à supprimer</h2> <div className="space-y-3 sm:space-y-4"> {(orderedDays || []).map((day) => ( <button key={day} onClick={() => handleDeleteDay(day)} className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base" > {day} </button> ))} </div> <div className="flex justify-end mt-6 sm:mt-8"> <button onClick={() => setShowSelectDayForDeleteModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> </div> </div> </div>)}
            {showDeleteDayConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression du jour</h2> <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer le jour "{dayToDeleteName}" et toutes ses catégories et exercices ? Cette action est irréversible. </p> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowDeleteDayConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmDeleteDay} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer</button> </div> </div> </div>)}
            {showAddCategoryModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter groupe musculaire à "{selectedDayForCategoryAdd}"</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newCategoryNameInput" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom du groupe musculaire:</label> <input type="text" id="newCategoryNameInput" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowAddCategoryModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={handleAddCategory} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button> </div> </div> </div>)}
            {showEditCategoryModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Renommer le groupe musculaire "{editingCategory?.oldCategoryName}"</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newCategoryName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nouveau nom:</label> <input type="text" id="newCategoryName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowEditCategoryModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmEditCategory} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Renommer</button> </div> </div> </div>)}
            {showDeleteCategoryConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression</h2> <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer "{categoryToDelete?.categoryName}" du jour "{categoryToDelete?.day}" et tous ses exercices ? Irréversible. </p> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowDeleteCategoryConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmDeleteCategory} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer</button> </div> </div> </div>)}
            {showExerciseGraphModal && exerciseForGraph && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-lg sm:max-w-4xl border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Progression: {exerciseForGraph.name}</h2> <div className={`bg-gray-700 p-4 rounded-lg mb-6`}> <h3 className={`text-lg sm:text-xl font-semibold mb-4 text-center text-white`}>Plage de dates</h3> <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4"> <div> <label htmlFor="graphStartDate" className={`block text-gray-300 text-xs sm:text-sm font-bold mb-1 sm:mb-2`}>Début:</label> <input type="date" id="graphStartDate" value={graphStartDate} onChange={(e) => setGraphStartDate(e.target.value)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 w-full text-sm sm:text-base`} /> </div> <div> <label htmlFor="graphEndDate" className={`block text-gray-300 text-xs sm:text-sm font-bold mb-1 sm:mb-2`}>Fin:</label> <input type="date" id="graphEndDate" value={graphEndDate} onChange={(e) => setGraphEndDate(e.target.value)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 w-full text-sm sm:text-base`} /> </div> </div> </div> <ResponsiveContainer width="100%" height={250} sm:height={300}> <LineChart data={individualExerciseGraphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" /> <XAxis dataKey="date" stroke="#cbd5e0" tickFormatter={formatDate} style={{fontSize: '10px'}} sm:style={{fontSize: '12px'}} /> <YAxis stroke="#cbd5e0" domain={['auto', 'auto']} style={{fontSize: '10px'}} sm:style={{fontSize: '12px'}} /> <Tooltip contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#a0aec0' }} formatter={(value) => value !== null ? `${value} kg` : 'N/A'} /> <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: '12px' }} /> <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={2} dot={({ cx, cy, stroke, payload }) => { if (payload.hasNewData) { return ( <circle key={`${payload.date}-${payload.weight}`} cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill="#8884d8" /> );} return null; }} activeDot={{ r: 6 }} name="Poids" connectNulls={true} /> </LineChart> </ResponsiveContainer> <div className="flex justify-end mt-6 sm:mt-8"> <button onClick={() => setShowExerciseGraphModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Fermer</button> </div> </div> </div>)}
            {showReorderDaysModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Réorganiser les jours</h2> <ul className="space-y-3"> {reorderingDayOrder.map((dayName, index) => ( <li key={dayName} className={`flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm`}> <span className={`text-base sm:text-lg text-white`}>{dayName}</span> <div className="flex space-x-2"> <button onClick={() => handleReorderDays(dayName, -1)} disabled={index === 0} className="p-1 sm:p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le haut"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button> <button onClick={() => handleReorderDays(dayName, 1)} disabled={index === reorderingDayOrder.length - 1} className="p-1 sm:p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le bas"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button> </div> </li> ))} </ul> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowReorderDaysModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={saveReorderedDays} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder</button> </div> </div> </div>)}
            {showNotesModal && exerciseForNotes && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Notes pour {workouts.days[exerciseForNotes.day]?.categories[exerciseForNotes.category]?.find(ex => ex.id === exerciseForNotes.exerciseId)?.name}</h2> <textarea className={`w-full h-24 sm:h-32 p-2 sm:p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 resize-none text-sm sm:text-base`} placeholder="Écrivez vos notes ici..." value={currentNoteContent} onChange={(e) => setCurrentNoteContent(e.target.value)} ></textarea> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => {setShowNotesModal(false); setExerciseForNotes(null); setCurrentNoteContent('');}} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={handleDeleteNote} disabled={!currentNoteContent} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"> Supprimer Note</button> <button onClick={handleSaveNote} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder</button> </div> </div> </div>)}
            
        </>
    );
};

export default MainWorkoutView;