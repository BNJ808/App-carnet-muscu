// ExerciseDatabase.js - Base de données des exercices prédéfinis

export const EXERCISE_LEVELS = {
  BASE: 'base',
  ADVANCED: 'advanced', 
  FINITION: 'finition'
};

export const EXERCISE_LEVEL_LABELS = {
  [EXERCISE_LEVELS.BASE]: 'Exercices de base',
  [EXERCISE_LEVELS.ADVANCED]: 'Exercices avancés', 
  [EXERCISE_LEVELS.FINITION]: 'Exercices de finition'
};

export const MUSCLE_GROUPS = {
  PECTORAUX: 'pectoraux',
  EPAULES: 'epaules',
  DORSAUX: 'dorsaux',
  TRAPEZES: 'trapezes',
  TRICEPS: 'triceps',
  BICEPS: 'biceps',
  AVANTS_BRAS: 'avants-bras',
  ABDOMINAUX: 'abdominaux',
  FESSIERS: 'fessiers',
  QUADRICEPS: 'quadriceps',
  ISCHIO_JAMBIERS: 'ischio-jambiers',
  MOLLETS: 'mollets',
  LOMBAIRES: 'lombaires'
};

export const MUSCLE_GROUP_LABELS = {
  [MUSCLE_GROUPS.PECTORAUX]: 'Pectoraux',
  [MUSCLE_GROUPS.EPAULES]: 'Épaules',
  [MUSCLE_GROUPS.DORSAUX]: 'Dorsaux',
  [MUSCLE_GROUPS.TRAPEZES]: 'Trapèzes',
  [MUSCLE_GROUPS.TRICEPS]: 'Triceps',
  [MUSCLE_GROUPS.BICEPS]: 'Biceps',
  [MUSCLE_GROUPS.AVANTS_BRAS]: 'Avants-bras',
  [MUSCLE_GROUPS.ABDOMINAUX]: 'Abdominaux',
  [MUSCLE_GROUPS.FESSIERS]: 'Fessiers',
  [MUSCLE_GROUPS.QUADRICEPS]: 'Quadriceps',
  [MUSCLE_GROUPS.ISCHIO_JAMBIERS]: 'Ischio-jambiers',
  [MUSCLE_GROUPS.MOLLETS]: 'Mollets',
  [MUSCLE_GROUPS.LOMBAIRES]: 'Lombaires'
};

export const EXERCISES_DATABASE = {
  [MUSCLE_GROUPS.PECTORAUX]: {
    [EXERCISE_LEVELS.BASE]: [
      'Développé couché avec haltères',
      'Développé incliné avec haltères',
      'Développé décliné avec haltères',
      'Développé couché à la barre',
      'Développé décliné à la barre',
      'Développé incliné à la barre',
      'Développé assis à la machine convergente',
      'Développé couché à la machine convergente',
      'Développé incliné à la machine convergente',
      'Dips prise large buste penché',
      'Pull over avec barre ou haltère',
      'Pull over en travers d\'un banc avec barre ou haltère'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Écarté couché avec haltères',
      'Écarté décliné avec haltères',
      'Écarté incliné avec haltères',
      'Écarté pectoraux à la machine',
      'Pompes prise large au sol',
      'Pull over à la poulie basse'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Écarté à la poulie vis à vis basse',
      'Écarté à la poulie vis à vis haute',
      'Développé couché à la machine'
    ]
  },

  [MUSCLE_GROUPS.EPAULES]: {
    [EXERCISE_LEVELS.BASE]: [
      'Développé épaules avec haltères',
      'Développé épaules à la machine convergente',
      'Développé militaire avec barre',
      'Développé nuque avec barre',
      'Oiseau à la poulie basse',
      'Oiseau/Rowing avec haltères',
      'Rowing assis à la machine coudes ouverts',
      'Rowing assis à la poulie basse coudes ouverts',
      'Rowing à la poulie basse sur banc incliné coudes ouverts',
      'Rowing à la poulie haute sur banc incliné coudes ouverts',
      'Rowing à la T-bar coudes ouverts',
      'Rowing barre coudes ouverts',
      'Rowing debout à la poulie basse',
      'Rowing debout prise large avec barre'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Élévation latérale à la poulie',
      'Élévation latérale avec haltères',
      'Élévation latérale à un bras penché sur le côté',
      'Élévation latérale à un bras sur banc incliné',
      'Développé épaules Arnold avec haltères',
      'Développé épaules à la machine',
      'Développé inversé au poids de corps',
      'Oiseau avec haltères',
      'Oiseau à la machine',
      'Oiseau à la poulie haute',
      'Oiseau à un bras allongé',
      'Oiseau sur banc incliné avec haltères'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Élévation frontale avec haltères',
      'Élévation frontale avec une barre',
      'Élévation frontale à la poulie',
      'Élévation frontale sur banc incliné avec barre ou haltères',
      'Élévation latérale à la machine',
      'L-Fly allongé à la poulie basse',
      'L-Fly assis à la poulie basse',
      'L-Fly avec haltère',
      'L-Fly debout à la poulie',
      'Rotation externe debout avec barre',
      'Rotation interne allongé à la poulie basse',
      'Rotation interne assis à la poulie basse',
      'Rotation interne avec haltère',
      'Rotation interne debout à la poulie'
    ]
  },

  [MUSCLE_GROUPS.DORSAUX]: {
    [EXERCISE_LEVELS.BASE]: [
      'Traction prise large devant à la barre fixe',
      'Traction prise large nuque à la barre fixe',
      'Traction prise neutre à la barre fixe',
      'Traction prise serrée en pronation à la barre fixe',
      'Traction prise supination cambré à la barre fixe'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Pull over assis à la machine',
      'Traction à la machine convergente',
      'Traction à la poulie haute à un bras',
      'Traction à la poulie haute devant',
      'Traction à la poulie haute nuque',
      'Traction à la poulie haute prise neutre',
      'Traction à la poulie haute prise serrée en pronation',
      'Traction à la poulie haute prise supination'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Pull over debout à la poulie haute',
      'Traction à la machine'
    ]
  },

  [MUSCLE_GROUPS.TRAPEZES]: {
    [EXERCISE_LEVELS.BASE]: [
      'Rowing à la T-bar',
      'Rowing à un bras avec haltère',
      'Rowing à un bras à la machine',
      'Rowing barre à la Yates en pronation',
      'Rowing barre à la Yates en supination',
      'Rowing barre buste penché en pronation',
      'Rowing barre en supination',
      'Soulevé de terre partiel avec barre'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Rowing assis à la machine',
      'Rowing assis à la poulie basse à un bras',
      'Rowing assis à la poulie basse en pronation',
      'Rowing assis à la poulie basse en supination',
      'Rowing assis à la poulie basse prise neutre',
      'Rowing à la poulie basse sur banc incliné',
      'Rowing à la poulie haute à un bras',
      'Rowing à la poulie haute en prise neutre',
      'Rowing à la poulie haute en pronation',
      'Rowing à la poulie haute en supination',
      'Rowing à la T-bar à la machine',
      'Rowing à un bras à la poulie basse',
      'Rowing barre allongé sur banc',
      'Rowing debout prise serrée avec barre'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Rowing inversé au poids de corps',
      'Shrug avec barre',
      'Shrug avec haltères',
      'Shrug à la machine',
      'Shrug à la machine à mollets',
      'Shrug à la machine convergente',
      'Shrug à la poulie'
    ]
  },

  [MUSCLE_GROUPS.TRICEPS]: {
    [EXERCISE_LEVELS.BASE]: [
      'Barre au front allongé à la poulie basse',
      'Barre au front triceps avec barre ou haltères',
      'Développé couché prise serrée à la barre',
      'Dips à la machine',
      'Dips entre deux bancs',
      'Dips prise serrée',
      'Extension des triceps à la poulie haute à genoux',
      'Extension des triceps contre un mur au poids de corps',
      'Extension nuque avec barre ou haltère',
      'Extension nuque à la poulie',
      'Extension nuque à un bras avec haltère',
      'Magic tRYCeps avec barre ou haltère',
      'Pull over Press avec barre ou haltère'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Extension des triceps à la machine',
      'Extension des triceps bras à 180 degrés avec barre ou haltères',
      'Extension des triceps buste penché à la poulie haute',
      'Pompes prise serrée au sol',
      'Tate Press avec haltères',
      'Tate Press à un bras avec haltère'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Extension des triceps à la poulie avec la corde',
      'Extension des triceps à la poulie à un bras',
      'Extension des triceps à la poulie coudes écartés',
      'Extension des triceps à la poulie en pronation',
      'Extension des triceps à la poulie en supination',
      'Kickback avec haltère',
      'Kickback à la poulie'
    ]
  },

  [MUSCLE_GROUPS.BICEPS]: {
    [EXERCISE_LEVELS.BASE]: [
      'Curl au pupitre avec barre',
      'Curl incliné avec haltères',
      'Curl marteau en travers avec haltères',
      'Traction prise supination non cambré à la barre fixe'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Curl allongé à la poulie basse',
      'Curl allongé à la poulie haute',
      'Curl araignée avec barre',
      'Curl au pupitre à la poulie',
      'Curl avec haltères',
      'Curl à la barre',
      'Curl à la poulie basse',
      'Curl marteau avec haltères',
      'Curl marteau à la poulie basse'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Curl au pupitre à la machine',
      'Curl à la poulie vis à vis',
      'Curl concentré avec haltère'
    ]
  },

  [MUSCLE_GROUPS.AVANTS_BRAS]: {
    [EXERCISE_LEVELS.ADVANCED]: [
      'Curl inversé allongé à la poulie basse',
      'Curl inversé allongé à la poulie haute',
      'Curl inversé au pupitre avec barre',
      'Curl inversé au pupitre à la poulie',
      'Curl inversé avec barre',
      'Curl inversé à la poulie'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Bobine Andrieux - Extension',
      'Bobine Andrieux - Flexion',
      'Extension des poignets avec barre',
      'Flexion des poignets avec barre'
    ]
  },

  [MUSCLE_GROUPS.ABDOMINAUX]: {
    [EXERCISE_LEVELS.BASE]: [
      'Crunch abdominaux avec l\'Abmat',
      'Crunch à la poulie haute',
      'Enroulement de bassin au sol avec l\'Abmat',
      'Enroulement de bassin suspendu à la barre fixe',
      'Obliques sur banc à lombaires'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Crunch abdominaux au sol',
      'Crunch abdominaux à la machine',
      'Crunch abdominaux sur la Swiss Ball',
      'Crunch oblique au sol',
      'Enroulement de bassin au sol',
      'Obliques avec l\'Abmat',
      'Obliques sur la Swiss Ball',
      'Obliques suspendu à la barre fixe',
      'Rotation à la machine',
      'Vacuum'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Crunch abdominaux avec rotation au sol',
      'Drapeau du dragon',
      'Flexion latérale avec haltère',
      'Gainage abdominal frontal',
      'Gainage abdominal oblique',
      'Rotation debout avec balais'
    ]
  },

  [MUSCLE_GROUPS.FESSIERS]: {
    [EXERCISE_LEVELS.BASE]: [
      'Hip thrust à la barre',
      'Soulevé de terre avec barre',
      'Soulevé de terre sumo avec barre'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Extension inversé à la machine',
      'Fente arrière glissée avec Valslide',
      'Fente à la Smith machine'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Abducteurs allongé avec lest cheville',
      'Abducteurs assis à la machine',
      'Abducteurs à la machine',
      'Abducteurs à la poulie',
      'Extension de la hanche à la machine',
      'Fente avec barre',
      'Fente en marchant avec barre ou haltères',
      'Fente en reculant avec barre ou haltères'
    ]
  },

  [MUSCLE_GROUPS.QUADRICEPS]: {
    [EXERCISE_LEVELS.BASE]: [
      'Hack squat à la machine',
      'Presse à cuisses allongé',
      'Presse à cuisses assis',
      'Presse à cuisses incliné',
      'Squat avant avec barre',
      'Squat avec barre derrière la nuque',
      'Squat sumo avec barre'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Fente latérale avec barre',
      'Gobelet Squat avec haltère',
      'Hack squat avec une barre',
      'Montée sur banc avec barre ou haltères',
      'Squat avec ceinture de lest',
      'Squat à la machine',
      'Squat à la machine à mollets',
      'Squat à la Smith machine',
      'Squat à une jambe au poids de corps',
      'Squat bulgare avec barre ou haltères'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Adducteurs assis à la machine',
      'Adducteurs à la machine',
      'Adducteurs à la poulie',
      'Flexion de la hanche à une jambe à la machine',
      'Leg extension allongé à la machine',
      'Leg extension assis à la machine',
      'Relevé de buste au sol ou sur banc incliné',
      'Relevé de genoux allongé au sol ou sur banc incliné',
      'Relevé de genoux sur banc',
      'Relevé de genoux suspendu à la barre fixe',
      'Sissy squat',
      'Sissy squat à la presse allongé',
      'Squat avec haltères',
      'Squat indien'
    ]
  },

  [MUSCLE_GROUPS.ISCHIO_JAMBIERS]: {
    [EXERCISE_LEVELS.BASE]: [
      'Glute Ham Raise au banc',
      'Leg curl assis à la machine',
      'Soulevé de terre jambes tendues avec barre ou haltères'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Extension au banc à lombaires à 45 degrés',
      'Good Morning avec barre',
      'Leg curl allongé à la machine',
      'Leg curl debout à une jambe à la machine',
      'Leg curl debout à une jambe à la poulie',
      'Soulevé de terre jambes tendues à la poulie'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Extension au banc à lombaires à 90 degrés'
    ]
  },

  [MUSCLE_GROUPS.MOLLETS]: {
    [EXERCISE_LEVELS.BASE]: [
      'Chameau à la machine',
      'Mollets assis jambes tendues à la machine',
      'Mollets à la presse à cuisses'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Mollets debout à la machine',
      'Mollets debout à une jambe avec haltère'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Mollets assis à la machine'
    ]
  },

  [MUSCLE_GROUPS.LOMBAIRES]: {
    [EXERCISE_LEVELS.BASE]: [
      'Soulevé de terre avec barre',
      'Soulevé de terre jambes tendues avec barre ou haltères',
      'Soulevé de terre sumo avec barre'
    ],
    [EXERCISE_LEVELS.ADVANCED]: [
      'Enroulement/Déroulement au banc à lombaires',
      'Good Morning avec barre',
      'Soulevé de terre jambes tendues à la poulie'
    ],
    [EXERCISE_LEVELS.FINITION]: [
      'Superman au sol'
    ]
  }
};

/**
 * Recherche d'exercices par terme
 * @param {string} searchTerm - Terme de recherche
 * @param {string} muscleGroup - Groupe musculaire (optionnel)
 * @param {string} level - Niveau d'exercice (optionnel)
 * @returns {Array} Liste des exercices correspondants avec leur contexte
 */
export const searchExercises = (searchTerm, muscleGroup = null, level = null) => {
  const results = [];
  const term = searchTerm.toLowerCase().trim();
  
  if (!term) return results;

  const groupsToSearch = muscleGroup ? [muscleGroup] : Object.keys(EXERCISES_DATABASE);
  
  groupsToSearch.forEach(group => {
    const groupData = EXERCISES_DATABASE[group];
    const levelsToSearch = level ? [level] : Object.keys(groupData);
    
    levelsToSearch.forEach(exerciseLevel => {
      const exercises = groupData[exerciseLevel] || [];
      exercises.forEach(exercise => {
        if (exercise.toLowerCase().includes(term)) {
          results.push({
            name: exercise,
            muscleGroup: group,
            level: exerciseLevel,
            muscleGroupLabel: MUSCLE_GROUP_LABELS[group],
            levelLabel: EXERCISE_LEVEL_LABELS[exerciseLevel]
          });
        }
      });
    });
  });

  return results.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Obtient tous les exercices pour un groupe musculaire donné
 * @param {string} muscleGroup - Groupe musculaire
 * @returns {Object} Exercices organisés par niveau
 */
export const getExercisesByMuscleGroup = (muscleGroup) => {
  return EXERCISES_DATABASE[muscleGroup] || {};
};

/**
 * Obtient tous les exercices populaires (base + quelques avancés)
 * @returns {Array} Liste des exercices populaires
 */
export const getPopularExercises = () => {
  const popular = [];
  
  // Prendre quelques exercices de base de chaque groupe musculaire
  Object.keys(EXERCISES_DATABASE).forEach(group => {
    const baseExercises = EXERCISES_DATABASE[group][EXERCISE_LEVELS.BASE] || [];
    // Prendre les 2-3 premiers exercices de base de chaque groupe
    baseExercises.slice(0, 3).forEach(exercise => {
      popular.push({
        name: exercise,
        muscleGroup: group,
        level: EXERCISE_LEVELS.BASE,
        muscleGroupLabel: MUSCLE_GROUP_LABELS[group],
        levelLabel: EXERCISE_LEVEL_LABELS[EXERCISE_LEVELS.BASE]
      });
    });
  });
  
  return popular;
};

/**
 * Valide si un exercice existe dans la base de données
 * @param {string} exerciseName - Nom de l'exercice
 * @returns {Object|null} Informations sur l'exercice ou null
 */
export const validateExercise = (exerciseName) => {
  for (const group of Object.keys(EXERCISES_DATABASE)) {
    for (const level of Object.keys(EXERCISES_DATABASE[group])) {
      const exercises = EXERCISES_DATABASE[group][level];
      if (exercises.includes(exerciseName)) {
        return {
          name: exerciseName,
          muscleGroup: group,
          level: level,
          muscleGroupLabel: MUSCLE_GROUP_LABELS[group],
          levelLabel: EXERCISE_LEVEL_LABELS[level]
        };
      }
    }
  }
  return null;
};