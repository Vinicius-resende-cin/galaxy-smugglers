// gameConfig.js

// Créditos iniciais por jogador
const INITIAL_CREDITS = 100;

// Possíveis valores de habilidades fixas (3 ou 5)
const FIXED_SKILL_LEVELS = [3, 5];

// Objetivos da partida
const MATCH_OBJECTIVES = {
  FIXED_ROUNDS: 'fixedRounds', // Número fixo de rodadas, todos que atingem a cota vencem
  INFINITE_ROUNDS: 'infiniteRounds' // Rodadas infinitas, primeiro a atingir a cota vence
};

// Configurações padrão dos objetivos
const DEFAULT_CREDITS_QUOTA = 500; // Cota de créditos para vencer
const DEFAULT_MAX_ROUNDS = 10; // Rodadas máximas (para modo fixedRounds)

// Possibilidades de missões individuais e coletivas com suas recompensas, prejuízos e dificuldade
const missionsData = {
  individual: [
    { name: "Contrabando de Especiarias", reward: 100, failureCost: 30, difficulty: 5 },
    { name: "Transporte de Armas", reward: 150, failureCost: 50, difficulty: 7 },
    { name: "Roubo de Dados", reward: 120, failureCost: 40, difficulty: 6 }
  ],
  collective: [
    { name: "Resgate de Reféns", reward: 200, failureCost: 60, difficulty: 8 },
    { name: "Sabotagem Corporativa", reward: 180, failureCost: 55, difficulty: 7 },
    { name: "Destruição de Base Militar", reward: 220, failureCost: 70, difficulty: 9 }
  ]
};

module.exports = {
  INITIAL_CREDITS,
  FIXED_SKILL_LEVELS,
  MATCH_OBJECTIVES,
  DEFAULT_CREDITS_QUOTA,
  DEFAULT_MAX_ROUNDS,
  missionsData
};
