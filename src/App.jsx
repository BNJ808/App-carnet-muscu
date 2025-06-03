import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, where, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Undo2, Redo2, Settings, XCircle, CheckCircle } from 'lucide-react';

// Import des composants refactorisés
import Toast from './Toast';
import MainWorkoutView from './MainWorkoutView';
import HistoryView from './HistoryView';

// This ensures Tone is defined, either by the environment or as a stub.
// This is a workaround to prevent ReferenceError if Tone.js is not loaded by the environment.
// It will allow the app to run, but audio functionality will be disabled if Tone is truly missing.
if (typeof window.Tone === 'undefined') {
    console.warn("Tone.js library not found globally. Audio functionality will be disabled.");
    window.Tone = {
        // Basic stub for Tone.Synth and context to prevent ReferenceErrors
        Synth: function() {
            console.warn("Tone.js Synth stub used.");
            return {
                toDestination: () => ({}),
                triggerAttackRelease: () => { /* no-op */ },
                dispose: () => { /* no-op */ }
            };
        },
        Context: { // Stub for Tone.Context
            // Add any methods/properties that are accessed directly
            isSupported: true
        }
    };
}

// --- DÉBUT DES MODIFICATIONS : AJOUT DE LA CONFIGURATION FIREBASE ---
// Utilisez import.meta.env pour accéder aux variables d'environnement définies par Vite
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Vérification pour le débogage (peut être retirée après que tout fonctionne)
if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.error("ERREUR DE CONFIGURATION: Firebase 'projectId' ou 'apiKey' manquant. Vérifiez vos variables d'environnement VITE_FIREBASE_PROJECT_ID et VITE_FIREBASE_API_KEY sur Vercel et dans votre fichier .env local.");
}
// --- FIN DES MODIFICATIONS ---


// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Exportez les services Firebase pour qu'ils puissent être utilisés dans le reste de l'application
const auth = getAuth(app);
const db = getFirestore(app);

const App = () => {
    const [user, setUser] = useState(null);
    const [workouts, setWorkouts] = useState([]);
    const [currentWorkout, setCurrentWorkout] = useState({});
    const [editWorkoutId, setEditWorkoutId] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showProgressionAnalysisModal, setShowProgressionAnalysisModal] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [progressionAnalysisLoading, setProgressionAnalysisLoading] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' });
    const toastTimeoutRef = useRef(null);
    const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [workoutToDeleteId, setWorkoutToDeleteId] = useState(null);

    const showToast = (message, type) => {
        setToast({ message, type });
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = setTimeout(() => {
            setToast({ message: '', type: '' });
        }, 3000);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                // Sign in anonymously if no user is logged in
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Error signing in anonymously:", error);
                    showToast("Erreur de connexion anonyme.", "error");
                }
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            const q = query(
                collection(db, `users/${user.uid}/workouts`),
                orderBy("date", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedWorkouts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date(doc.data().date)
                }));
                setWorkouts(fetchedWorkouts);
            }, (error) => {
                console.error("Error fetching workouts:", error);
                showToast("Erreur de récupération des entraînements.", "error");
            });

            return () => unsubscribe();
        }
    }, [user]);

    const saveWorkout = async (workoutData) => {
        if (!user) {
            showToast("Utilisateur non authentifié.", "error");
            return;
        }

        try {
            const workoutToSave = {
                ...workoutData,
                date: workoutData.date instanceof Date ? Timestamp.fromDate(workoutData.date) : Timestamp.now(),
                exercises: workoutData.exercises.map(ex => ({
                    ...ex,
                    sets: ex.sets.map(s => ({
                        ...s,
                        reps: parseInt(s.reps, 10),
                        weight: parseFloat(s.weight)
                    }))
                }))
            };

            if (editWorkoutId) {
                await setDoc(doc(db, `users/${user.uid}/workouts`, editWorkoutId), workoutToSave);
                setEditWorkoutId(null);
                showToast("Entraînement mis à jour avec succès !", "success");
            } else {
                await addDoc(collection(db, `users/${user.uid}/workouts`), workoutToSave);
                showToast("Entraînement enregistré avec succès !", "success");
            }
            setCurrentWorkout({});
        } catch (e) {
            console.error("Error saving workout: ", e);
            showToast("Erreur lors de l'enregistrement.", "error");
        }
    };

    const editWorkout = (workout) => {
        setCurrentWorkout(workout);
        setEditWorkoutId(workout.id);
        setShowHistory(false); // Switch to main view
    };

    const confirmDeleteWorkout = (id) => {
        setWorkoutToDeleteId(id);
        setShowConfirmDeleteModal(true);
    };

    const deleteWorkout = async () => {
        if (!user || !workoutToDeleteId) return;

        try {
            await setDoc(doc(db, `users/${user.uid}/workouts`, workoutToDeleteId), { deleted: true }, { merge: true });
            showToast("Entraînement marqué comme supprimé.", "success");
            setShowConfirmDeleteModal(false);
            setWorkoutToDeleteId(null);
        } catch (e) {
            console.error("Error deleting workout: ", e);
            showToast("Erreur lors de la suppression.", "error");
        }
    };

    const restoreWorkout = async (id) => {
        if (!user) return;
        try {
            await setDoc(doc(db, `users/${user.uid}/workouts`, id), { deleted: false }, { merge: true });
            showToast("Entraînement restauré.", "success");
        } catch (e) {
            console.error("Error restoring workout:", e);
            showToast("Erreur lors de la restauration.", "error");
        }
    };

    const confirmClearAllWorkouts = () => {
        setShowConfirmClearModal(true);
    };

    const clearAllWorkouts = async () => {
        if (!user) {
            showToast("Utilisateur non authentifié.", "error");
            return;
        }

        try {
            const q = query(collection(db, `users/${user.uid}/workouts`));
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db); // Assurez-vous d'importer writeBatch de firebase/firestore

            querySnapshot.forEach((docRef) => {
                batch.update(docRef.ref, { deleted: true });
            });

            await batch.commit();
            showToast("Tous les entraînements marqués comme supprimés.", "success");
            setShowConfirmClearModal(false);
        } catch (e) {
            console.error("Error clearing all workouts:", e);
            showToast("Erreur lors de la suppression de tous les entraînements.", "error");
        }
    };


    const getProgressionAnalysis = async () => {
        if (!user) {
            showToast("Utilisateur non authentifié.", "error");
            return;
        }
        setProgressionAnalysisLoading(true);
        setProgressionAnalysisContent('');
        setShowProgressionAnalysisModal(true);

        try {
            const response = await fetch('/api/analyze-progression', { // Endpoint API à créer sur Vercel
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.uid }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setProgressionAnalysisContent(data.analysis);
            showToast("Analyse générée !", "success");
        } catch (error) {
            console.error("Error fetching progression analysis:", error);
            setProgressionAnalysisContent("Désolé, une erreur est survenue lors de l'analyse de votre progression. Veuillez réessayer plus tard.");
            showToast("Erreur lors de l'analyse de la progression.", "error");
        } finally {
            setProgressionAnalysisLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 font-sans">
            {toast.message && <Toast message={toast.message} type={toast.type} />}

            <header className="w-full max-w-4xl flex justify-between items-center mb-6 sm:mb-8">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-400">
                    Carnet Muscu
                </h1>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-2.5 sm:px-5 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                    >
                        {showHistory ? 'Nouvel Entraînement' : 'Historique'}
                    </button>
                    <button
                        onClick={() => setShowProgressionAnalysisModal(true)} // Affiche la modale d'analyse
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-2.5 sm:px-5 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                    >
                        Analyser Progression
                    </button>
                </div>
            </header>

            {showHistory ? (
                <HistoryView
                    workouts={workouts}
                    editWorkout={editWorkout}
                    confirmDeleteWorkout={confirmDeleteWorkout}
                    restoreWorkout={restoreWorkout}
                    confirmClearAllWorkouts={confirmClearAllWorkouts}
                />
            ) : (
                <MainWorkoutView
                    currentWorkout={currentWorkout}
                    setCurrentWorkout={setCurrentWorkout}
                    saveWorkout={saveWorkout}
                    editWorkoutId={editWorkoutId}
                    setEditWorkoutId={setEditWorkoutId}
                />
            )}

            {/* Confirmation Clear All Workouts Modal */}
            {showConfirmClearModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-2xl max-w-sm w-full text-center border border-gray-700">
                        <XCircle className="text-red-500 w-16 h-16 mx-auto mb-4" />
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Vider tous les entraînements ?</h2>
                        <p className="text-gray-300 mb-6 text-sm sm:text-base">
                            Ceci marquera tous vos entraînements comme supprimés. Vous pourrez les restaurer depuis l'historique si nécessaire.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => setShowConfirmClearModal(false)}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={clearAllWorkouts}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Delete Single Workout Modal */}
            {showConfirmDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-2xl max-w-sm w-full text-center border border-gray-700">
                        <XCircle className="text-red-500 w-16 h-16 mx-auto mb-4" />
                        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Supprimer cet entraînement ?</h2>
                        <p className="text-gray-300 mb-6 text-sm sm:text-base">
                            Ceci marquera cet entraînement comme supprimé. Vous pourrez le restaurer depuis l'historique si nécessaire.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => setShowConfirmDeleteModal(false)}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={deleteWorkout}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progression Analysis Modal */}
            {showProgressionAnalysisModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-2xl max-w-2xl w-full text-center border border-gray-700">
                        <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-400">Analyse de Progression</h2>
                        <button
                            onClick={getProgressionAnalysis}
                            disabled={progressionAnalysisLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {progressionAnalysisLoading ? 'Analyse en cours...' : 'Générer l\'Analyse'}
                        </button>
                        {progressionAnalysisLoading && (
                            <div className="mt-4">
                                <p className="text-sky-300 mt-3 text-sm sm:text-base">Analyse en cours...</p>
                            </div>
                        )}
                        {!progressionAnalysisLoading && progressionAnalysisContent && (
                            <div className="mt-4 p-3 sm:p-4 bg-gray-700 rounded-lg max-h-80 sm:max-h-96 overflow-y-auto">
                                <p className="text-white whitespace-pre-wrap text-sm sm:text-base">{progressionAnalysisContent}</p>
                            </div>
                        )}
                         {!progressionAnalysisLoading && !progressionAnalysisContent && (
                            <p className="text-gray-400 text-center text-sm sm:text-base">Aucune analyse disponible ou erreur lors de la récupération.</p>
                        )}
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6">
                            <button
                                onClick={() => setShowProgressionAnalysisModal(false)}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;