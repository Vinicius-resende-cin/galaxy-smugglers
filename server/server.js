// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { INITIAL_CREDITS, FIXED_SKILL_LEVELS, MATCH_OBJECTIVES, DEFAULT_CREDITS_QUOTA, DEFAULT_MAX_ROUNDS, missionsData } = require('./gameConfig');

const app = express();
const server = http.createServer(app);

// Criação de um servidor WebSocket usando o pacote 'ws'
const wss = new WebSocket.Server({ server });

// Constantes do matchmaking
let MATCH_SIZE = 3; // Número de jogadores por partida (configurável)

// Configurações do jogo (modificáveis pelo moderador)
let gameConfig = {
  matchSize: 3,
  initialCredits: INITIAL_CREDITS,
  fixedSkillLevels: [...FIXED_SKILL_LEVELS],
  maxRounds: DEFAULT_MAX_ROUNDS, // Limite máximo de rodadas por partida (para modo fixedRounds)
  matchObjective: MATCH_OBJECTIVES.FIXED_ROUNDS, // Objetivo da partida
  creditsQuota: DEFAULT_CREDITS_QUOTA // Cota de créditos para vencer
};

// Estruturas globais para matchmaking
let waitingPlayers = []; // Jogadores aguardando partida
let activeMatches = new Map(); // Partidas ativas (matchId -> match data)
let playerToMatch = new Map(); // Mapeamento jogador -> matchId

// Função para criar jogadores com base nas variáveis fixas
function createPlayer(name) {
  // Atribui habilidade fixa de 3 ou 5 de maneira aleatória
  const skillLevel = gameConfig.fixedSkillLevels[Math.floor(Math.random() * gameConfig.fixedSkillLevels.length)];
  
  const player = {
    name,
    credits: gameConfig.initialCredits, // Créditos iniciais
    skillLevel, // Habilidade fixa configurável
    hasChosen: false // Marca se o jogador já fez uma escolha
  };

  return player;
}

// Função para criar uma nova partida
function createMatch() {
  const matchId = uuidv4();
  
  const match = {
    matchId: matchId,
    players: [],
    currentRound: 1,
    missions: [],
    playersChoices: [],
    gameReport: {
      matchId: matchId,
      totalRounds: 0,
      players: {}
    }
  };
  
  return match;
}

// Função para adicionar um jogador a uma partida
function addPlayerToMatch(player, match) {
  match.players.push(player);
  playerToMatch.set(player.name, match.matchId);
  
  // Inicializar dados do jogador no relatório da partida
  match.gameReport.players[player.name] = {
    skillLevel: player.skillLevel,
    missionHistory: [],
    creditsHistory: [gameConfig.initialCredits]
  };
}

// Função para iniciar uma partida quando estiver cheia
function startMatch(match) {
  console.log(`Iniciando partida ${match.matchId} com ${match.players.length} jogadores`);
  generateMissions(match);
  sendMissionsToAllPlayersInMatch(match);
}

// Função para criar uma missão com base nas variáveis fixas
function createMission(type) {
  const missionList = missionsData[type]; // Seleciona o tipo de missão (individual ou coletiva)
  const randomMission = missionList[Math.floor(Math.random() * missionList.length)]; // Escolhe uma missão aleatória
  
  return {
    type,
    name: randomMission.name,
    reward: randomMission.reward,
    failureCost: randomMission.failureCost,
    difficulty: randomMission.difficulty,
    playersParticipating: [] // Jogadores que estão participando dessa missão
  };
}

// Gerar missões ao início de cada rodada para uma partida específica
function generateMissions(match) {
  console.log(`\nRODADA ${match.currentRound} - Partida ${match.matchId}:`);
  match.missions = [
    createMission('individual'),
    createMission('collective')
  ];
}

// Função para rolar um dado de 6 lados
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// Função para verificar condições de vitória
function checkWinConditions(match) {
  const playersAboveQuota = match.players.filter(player => player.credits >= gameConfig.creditsQuota);
  
  if (gameConfig.matchObjective === MATCH_OBJECTIVES.FIXED_ROUNDS) {
    // Modo rodadas fixas: verifica se atingiu o limite de rodadas
    if (match.currentRound >= gameConfig.maxRounds) {
      // Todos os jogadores que atingiram a cota vencem
      if (playersAboveQuota.length > 0) {
        return {
          matchEnded: true,
          winners: playersAboveQuota,
          reason: `Partida finalizada após ${gameConfig.maxRounds} rodadas. Vencedores: ${playersAboveQuota.map(p => p.name).join(', ')}`
        };
      } else {
        // Ninguém atingiu a cota, o jogo termina sem vencedores
        return {
          matchEnded: true,
          winners: [],
          reason: `Partida finalizada após ${gameConfig.maxRounds} rodadas. Nenhum jogador atingiu a cota de ${gameConfig.creditsQuota} créditos.`
        };
      }
    }
  } else if (gameConfig.matchObjective === MATCH_OBJECTIVES.INFINITE_ROUNDS) {
    // Modo rodadas infinitas: verifica se alguém atingiu a cota
    if (playersAboveQuota.length > 0) {
      if (playersAboveQuota.length === 1) {
        // Um único vencedor
        return {
          matchEnded: true,
          winners: playersAboveQuota,
          reason: `${playersAboveQuota[0].name} atingiu a cota de ${gameConfig.creditsQuota} créditos primeiro!`
        };
      } else {
        // Múltiplos jogadores atingiram a cota simultaneamente
        // Primeiro critério: maior quantidade de créditos
        const maxCredits = Math.max(...playersAboveQuota.map(p => p.credits));
        const topPlayers = playersAboveQuota.filter(p => p.credits === maxCredits);
        
        if (topPlayers.length === 1) {
          return {
            matchEnded: true,
            winners: topPlayers,
            reason: `${topPlayers[0].name} venceu com ${topPlayers[0].credits} créditos (maior quantidade entre os que atingiram a cota)!`
          };
        } else {
          // Empate em créditos, decidir no dado
          console.log(`Empate entre ${topPlayers.map(p => p.name).join(', ')} com ${maxCredits} créditos. Decidindo no dado...`);
          
          let remainingPlayers = [...topPlayers];
          let rollRound = 1;
          let rollHistory = [];
          
          // Continue rolling until there's only one winner
          while (remainingPlayers.length > 1) {
            console.log(`Rodada de dados ${rollRound}:`);
            
            let currentRoll = remainingPlayers.map(player => ({
              player: player,
              roll: rollDice()
            }));
            
            // Log current round results
            currentRoll.forEach(result => {
              console.log(`${result.player.name} rolou ${result.roll}`);
            });
            
            rollHistory.push(currentRoll);
            
            // Find the highest roll in this round
            const highestRoll = Math.max(...currentRoll.map(r => r.roll));
            remainingPlayers = currentRoll.filter(r => r.roll === highestRoll).map(r => r.player);
            
            console.log(`Maior resultado: ${highestRoll}. Jogadores restantes: ${remainingPlayers.map(p => p.name).join(', ')}`);
            rollRound++;
          }
          
          const winner = remainingPlayers[0];
          const finalRollResult = rollHistory[rollHistory.length - 1].find(r => r.player.name === winner.name);
          
          // Create a detailed roll history string
          const rollHistoryText = rollHistory.map((round, index) => {
            const roundText = round.map(r => `${r.player.name}(${r.roll})`).join(', ');
            return `Rodada ${index + 1}: ${roundText}`;
          }).join(' | ');
          
          return {
            matchEnded: true,
            winners: [winner],
            reason: `${winner.name} venceu no desempate do dado após ${rollRound - 1} rodada(s) (último resultado: ${finalRollResult.roll})! Histórico completo: ${rollHistoryText}`
          };
        }
      }
    }
  }
  
  return { matchEnded: false };
}

// Função para gerar e salvar o relatório em JSON para uma partida específica
function generateReport(match) {
  const reportData = {
    matchId: match.matchId,
    totalRounds: match.gameReport.totalRounds,
    players: match.gameReport.players,
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  const filename = `${match.matchId}.json`;
  const filepath = path.join(reportsDir, filename);

  // Garante que o diretório reports existe
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  try {
    // Se o arquivo já existe, mantém a data de criação original
    if (fs.existsSync(filepath)) {
      const existingData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      reportData.generatedAt = existingData.generatedAt || reportData.generatedAt;
    }
    
    fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2));
    console.log(`Relatório atualizado: ${filepath}`);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
  }
}

// Função para embaralhar o array de jogadores (Fisher-Yates Shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Troca os elementos
  }
}

// Função para resolver missões individuais
function resolveIndividualMission(player, mission, match) {
  const roll = rollDice();
  const success = (player.skillLevel + roll >= mission.difficulty);

  if (success) {
    player.credits += mission.reward;
  } else {
    player.credits -= mission.failureCost;
  }

  // Adicionar ao histórico do relatório
  match.gameReport.players[player.name].missionHistory.push({
    round: match.currentRound,
    missionType: 'individual',
    missionName: mission.name,
    result: success ? 'success' : 'failure',
    roll: roll,
    creditsChange: success ? mission.reward : -mission.failureCost
  });

  return { success, credits: player.credits };
}

// Função para resolver missões coletivas
function resolveCollectiveMission(players, mission, match) {
  if (players.length === 0) return [];
  
  // Todos os jogadores trabalham juntos como um único grupo
  const totalSkill = players.reduce((total, player) => total + player.skillLevel, 0);
  const roll = rollDice();
  const success = (totalSkill + roll >= mission.difficulty);

  console.log(`Missão coletiva: ${players.length} jogadores trabalhando juntos`);
  console.log(`Jogadores: ${players.map(p => p.name).join(', ')}`);
  console.log(`Habilidade total: ${totalSkill}, Dado: ${roll}, Dificuldade: ${mission.difficulty}`);
  console.log(`Resultado: ${success ? 'Sucesso' : 'Fracasso'}`);

  // Aplicar resultado a todos os jogadores
  if (success) {
    players.forEach(player => player.credits += (mission.reward / players.length));
  } else {
    players.forEach(player => player.credits -= mission.failureCost);
  }

  // Adicionar ao histórico do relatório para cada jogador
  players.forEach(player => {
    match.gameReport.players[player.name].missionHistory.push({
      round: match.currentRound,
      missionType: 'collective',
      missionName: mission.name,
      result: success ? 'success' : 'failure',
      roll: roll,
      creditsChange: success ? mission.reward : -mission.failureCost
    });
  });

  return [{
    group: players,
    success,
    credits: players.map(player => player.credits)
  }];
}

// Enviar uma mensagem para um único jogador
function sendToPlayer(player, message) {
  player.ws.send(JSON.stringify(message));
}

// Enviar as missões para todos os jogadores de uma partida específica
function sendMissionsToAllPlayersInMatch(match) {
  match.players.forEach(player => {
    player.ws.send(JSON.stringify({
      type: 'missions',
      data: match.missions,
      currentRound: match.currentRound,
      maxRounds: gameConfig.maxRounds,
      matchObjective: gameConfig.matchObjective,
      creditsQuota: gameConfig.creditsQuota
    }));
  });
}

// Quando um cliente se conecta ao WebSocket
wss.on('connection', (ws) => {
  console.log(`Novo jogador conectado`);

  // Criar jogador
  const playerCount = waitingPlayers.length + Array.from(activeMatches.values()).reduce((total, match) => total + match.players.length, 0) + 1;
  const player = createPlayer(`Jogador ${playerCount}`);
  player.ws = ws; // Associa o WebSocket ao jogador

  // Envia as informações iniciais ao jogador
  ws.send(JSON.stringify({ type: 'init', data: player }));

  // Adicionar jogador à fila de espera
  waitingPlayers.push(player);
  console.log(`${player.name} adicionado à fila de espera. Jogadores na fila: ${waitingPlayers.length}`);

  // Verificar se temos jogadores suficientes para uma partida
  if (waitingPlayers.length >= MATCH_SIZE) {
    // Criar nova partida com os primeiros jogadores da fila
    const newMatch = createMatch();
    
    // Mover jogadores da fila para a partida
    for (let i = 0; i < MATCH_SIZE; i++) {
      const playerFromQueue = waitingPlayers.shift();
      addPlayerToMatch(playerFromQueue, newMatch);
    }
    
    // Adicionar partida às partidas ativas
    activeMatches.set(newMatch.matchId, newMatch);
    
    console.log(`Partida ${newMatch.matchId} criada com ${newMatch.players.length} jogadores`);
    
    // Notificar jogadores que a partida começou
    newMatch.players.forEach(p => {
      p.ws.send(JSON.stringify({ 
        type: 'matchFound', 
        matchId: newMatch.matchId,
        players: newMatch.players.map(player => ({ name: player.name, skillLevel: player.skillLevel, credits: player.credits }))
      }));
    });
    
    // Iniciar a partida
    startMatch(newMatch);
  } else {
    // Informar ao jogador que está aguardando outros jogadores
    ws.send(JSON.stringify({ 
      type: 'waitingForPlayers', 
      message: `Aguardando outros jogadores... (${waitingPlayers.length}/${MATCH_SIZE})` 
    }));
  }

  // Quando o jogador escolhe participar de uma missão
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'chooseMission') {
      const { missionType } = data;

      // Encontrar a partida do jogador
      const matchId = playerToMatch.get(player.name);
      if (!matchId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Você não está em uma partida ativa.' }));
        return;
      }

      const match = activeMatches.get(matchId);
      if (!match) {
        ws.send(JSON.stringify({ type: 'error', message: 'Partida não encontrada.' }));
        return;
      }

      // Verificar se o jogador já fez uma escolha
      if (player.hasChosen) {
        ws.send(JSON.stringify({ type: 'error', message: 'Você já escolheu uma missão, aguarde a rodada terminar.' }));
        return;
      }

      // Marcar a escolha do jogador
      match.playersChoices.push({ player: player.name, choice: missionType });
      player.hasChosen = true;

      // Log da escolha da missão
      console.log(`${player.name} escolheu a missão: ${missionType} na partida ${matchId}`);

      // Verificar se todos os jogadores da partida já escolheram suas missões
      if (match.playersChoices.length === match.players.length) {
        // Todos os jogadores tomaram sua decisão, resolver as missões
        console.log(`Todos os jogadores da partida ${matchId} escolheram suas missões, resolvendo as missões agora.`);

        // Resolução das missões individuais
        match.playersChoices.forEach(choice => {
          const selectedMission = match.missions.find(m => m.type === choice.choice);
          if (choice.choice === 'individual') {
            const matchPlayer = match.players.find(p => p.name === choice.player);
            const result = resolveIndividualMission(matchPlayer, selectedMission, match);
            sendToPlayer(matchPlayer, {
              type: 'roundEnd',
              playerName: choice.player,
              success: result.success ? 'Venceu' : 'Perdeu',
              credits: result.credits,
              missions: match.missions,
              currentRound: match.currentRound,
              maxRounds: gameConfig.maxRounds
            });
          }
        });

        // Resolução das missões coletivas
        const collectiveMission = match.missions.find(m => m.type === 'collective');
        const playersForCollective = match.players.filter(p => {
          return match.playersChoices.find(c => c.player === p.name && c.choice === 'collective');
        });

        if (playersForCollective.length > 0) {
          // Todos os jogadores trabalham juntos na mesma missão coletiva
          const groupResults = resolveCollectiveMission(playersForCollective, collectiveMission, match);

          groupResults.forEach(groupResult => {
            groupResult.group.forEach(player => {
              sendToPlayer(player, {
                type: 'roundEnd',
                playerName: player.name,
                success: groupResult.success ? 'Venceu' : 'Perdeu',
                credits: player.credits,
                missions: match.missions,
                currentRound: match.currentRound,
                maxRounds: gameConfig.maxRounds
              });
            });
          });
        }

        // Exibe a quantidade de créditos no log do servidor ao final da rodada
        console.log(`Créditos após a rodada na partida ${matchId}:`);
        match.players.forEach(player => {
          console.log(`${player.name}: ${player.credits} créditos`);
          // Adicionar créditos atuais ao histórico
          match.gameReport.players[player.name].creditsHistory.push(player.credits);
        });

        // Atualizar total de rodadas e gerar relatório
        match.gameReport.totalRounds = match.currentRound;
        generateReport(match);

        // Verificar condições de vitória
        const winCondition = checkWinConditions(match);
        
        if (winCondition.matchEnded) {
          console.log(`Partida ${matchId} finalizada: ${winCondition.reason}`);
          
          // Notificar jogadores sobre o resultado final
          match.players.forEach(player => {
            const isWinner = winCondition.winners.some(winner => winner.name === player.name);
            player.ws.send(JSON.stringify({
              type: 'matchEnded',
              reason: winCondition.reason,
              finalCredits: player.credits,
              isWinner: isWinner,
              winners: winCondition.winners.map(w => w.name)
            }));
          });
          
          // Remover partida
          activeMatches.delete(matchId);
          match.players.forEach(player => {
            playerToMatch.delete(player.name);
          });
          
          return; // Não continuar para a próxima rodada
        }

        // Verificar se a partida atingiu o limite máximo de rodadas (modo fixedRounds apenas)
        if (gameConfig.matchObjective === MATCH_OBJECTIVES.FIXED_ROUNDS && match.currentRound >= gameConfig.maxRounds) {
          // Esta condição já foi tratada na função checkWinConditions
          // Mas mantemos como fallback de segurança
          console.log(`Partida ${matchId} atingiu o limite máximo de rodadas (${gameConfig.maxRounds}). Encerrando...`);
          
          // Notificar jogadores que a partida terminou
          match.players.forEach(player => {
            player.ws.send(JSON.stringify({
              type: 'matchEnded',
              reason: `Partida finalizada após ${gameConfig.maxRounds} rodadas`,
              finalCredits: player.credits,
              isWinner: false,
              winners: []
            }));
          });
          
          // Remover partida
          activeMatches.delete(matchId);
          match.players.forEach(player => {
            playerToMatch.delete(player.name);
          });
          
          return; // Não continuar para a próxima rodada
        }

        // Limpar as escolhas para a próxima rodada
        match.playersChoices = [];
        match.players.forEach(p => p.hasChosen = false); // Resetar a flag de escolhas
        match.currentRound++; // Incrementar o número da rodada
        generateMissions(match); // Gerar novas missões para a próxima rodada
        sendMissionsToAllPlayersInMatch(match); // Enviar novas missões para todos os jogadores da partida
      }
    }
  });

  // Quando o jogador se desconectar
  ws.on('close', () => {
    console.log(`Jogador ${player.name} desconectado`);
    
    // Remover da fila de espera se estiver lá
    const waitingIndex = waitingPlayers.findIndex(p => p.name === player.name);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
      console.log(`${player.name} removido da fila de espera`);
      return;
    }
    
    // Remover da partida ativa se estiver em uma
    const matchId = playerToMatch.get(player.name);
    if (matchId) {
      const match = activeMatches.get(matchId);
      if (match) {
        const playerIndex = match.players.findIndex(p => p.name === player.name);
        if (playerIndex !== -1) {
          match.players.splice(playerIndex, 1);
          console.log(`${player.name} removido da partida ${matchId}`);
          
          // Se a partida ficar vazia, removê-la
          if (match.players.length === 0) {
            activeMatches.delete(matchId);
            console.log(`Partida ${matchId} removida (sem jogadores)`);
          } else {
            // Notificar outros jogadores da partida sobre a desconexão
            match.players.forEach(p => {
              p.ws.send(JSON.stringify({
                type: 'playerDisconnected',
                playerName: player.name,
                remainingPlayers: match.players.length
              }));
            });
          }
        }
      }
      playerToMatch.delete(player.name);
    }
    
    // Nota: Mantemos os dados do jogador no gameReport para fins históricos
    // mesmo após a desconexão, para que o relatório contenha o histórico completo do jogo
  });
});

// Servir os arquivos da pasta 'client'
app.use(express.static('client'));

// Middleware para parsing JSON
app.use(express.json());

// API para o painel do moderador

// Obter estatísticas do jogo
app.get('/api/moderator/stats', (req, res) => {
  const stats = {
    totalWaitingPlayers: waitingPlayers.length,
    activeMatches: activeMatches.size,
    totalPlayersInMatches: Array.from(activeMatches.values()).reduce((total, match) => total + match.players.length, 0),
    gameConfig: gameConfig,
    matches: Array.from(activeMatches.values()).map(match => ({
      matchId: match.matchId,
      currentRound: match.currentRound,
      playersCount: match.players.length,
      players: match.players.map(p => ({
        name: p.name,
        credits: p.credits,
        skillLevel: p.skillLevel,
        hasChosen: p.hasChosen
      })),
      missions: match.missions
    }))
  };
  
  res.json(stats);
});

// Atualizar configurações do jogo
app.post('/api/moderator/config', (req, res) => {
  const { matchSize, initialCredits, fixedSkillLevels, maxRounds, matchObjective, creditsQuota } = req.body;
  
  if (matchSize && matchSize > 0 && matchSize <= 10) {
    gameConfig.matchSize = matchSize;
    MATCH_SIZE = matchSize;
  }
  
  if (initialCredits && initialCredits > 0) {
    gameConfig.initialCredits = initialCredits;
  }
  
  if (fixedSkillLevels && Array.isArray(fixedSkillLevels) && fixedSkillLevels.length > 0) {
    gameConfig.fixedSkillLevels = fixedSkillLevels;
  }
  
  if (maxRounds && maxRounds > 0) {
    gameConfig.maxRounds = maxRounds;
  }
  
  if (matchObjective && Object.values(MATCH_OBJECTIVES).includes(matchObjective)) {
    gameConfig.matchObjective = matchObjective;
  }
  
  if (creditsQuota && creditsQuota > 0) {
    gameConfig.creditsQuota = creditsQuota;
  }
  
  console.log('Configurações atualizadas pelo moderador:', gameConfig);
  res.json({ success: true, config: gameConfig });
});

// Encerrar uma partida específica
app.post('/api/moderator/match/:matchId/end', (req, res) => {
  const { matchId } = req.params;
  const match = activeMatches.get(matchId);
  
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }
  
  // Notificar jogadores que a partida foi encerrada
  match.players.forEach(player => {
    player.ws.send(JSON.stringify({
      type: 'matchEnded',
      reason: 'Partida encerrada pelo moderador'
    }));
  });
  
  // Gerar relatório final
  match.gameReport.totalRounds = match.currentRound;
  generateReport(match);
  
  // Remover partida
  activeMatches.delete(matchId);
  match.players.forEach(player => {
    playerToMatch.delete(player.name);
  });
  
  console.log(`Partida ${matchId} encerrada pelo moderador`);
  res.json({ success: true, message: 'Partida encerrada com sucesso' });
});

// Kickar um jogador de uma partida
app.post('/api/moderator/player/:playerName/kick', (req, res) => {
  const { playerName } = req.params;
  const matchId = playerToMatch.get(playerName);
  
  if (!matchId) {
    return res.status(404).json({ error: 'Jogador não encontrado em nenhuma partida' });
  }
  
  const match = activeMatches.get(matchId);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }
  
  const playerIndex = match.players.findIndex(p => p.name === playerName);
  if (playerIndex === -1) {
    return res.status(404).json({ error: 'Jogador não encontrado na partida' });
  }
  
  const player = match.players[playerIndex];
  
  // Notificar o jogador que foi removido
  player.ws.send(JSON.stringify({
    type: 'kicked',
    reason: 'Você foi removido da partida pelo moderador'
  }));
  
  // Remover jogador
  match.players.splice(playerIndex, 1);
  playerToMatch.delete(playerName);
  
  // Notificar outros jogadores da partida
  match.players.forEach(p => {
    p.ws.send(JSON.stringify({
      type: 'playerDisconnected',
      playerName: playerName,
      remainingPlayers: match.players.length
    }));
  });
  
  // Se a partida ficar vazia, removê-la
  if (match.players.length === 0) {
    activeMatches.delete(matchId);
    console.log(`Partida ${matchId} removida (sem jogadores após kick)`);
  }
  
  console.log(`Jogador ${playerName} removido da partida ${matchId} pelo moderador`);
  res.json({ success: true, message: 'Jogador removido com sucesso' });
});

// Inicializar o servidor na porta 3000
server.listen(3000, () => {
  console.log('Servidor WebSocket rodando na porta 3000');
  console.log(`Sistema de matchmaking ativo - ${MATCH_SIZE} jogadores por partida`);
  console.log('Painel do moderador disponível em: http://localhost:3000/moderator.html');
});
