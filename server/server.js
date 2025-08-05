// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { INITIAL_CREDITS, FIXED_SKILL_LEVELS, missionsData } = require('./gameConfig');

const app = express();
const server = http.createServer(app);

// Criação de um servidor WebSocket usando o pacote 'ws'
const wss = new WebSocket.Server({ server });

// Constantes do matchmaking
const MATCH_SIZE = 3; // Número de jogadores por partida

// Estruturas globais para matchmaking
let waitingPlayers = []; // Jogadores aguardando partida
let activeMatches = new Map(); // Partidas ativas (matchId -> match data)
let playerToMatch = new Map(); // Mapeamento jogador -> matchId

// Função para criar jogadores com base nas variáveis fixas
function createPlayer(name) {
  // Atribui habilidade fixa de 3 ou 5 de maneira aleatória
  const skillLevel = FIXED_SKILL_LEVELS[Math.floor(Math.random() * FIXED_SKILL_LEVELS.length)];
  
  const player = {
    name,
    credits: INITIAL_CREDITS, // Créditos iniciais
    skillLevel, // Habilidade fixa em 3 ou 5
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
    creditsHistory: [INITIAL_CREDITS]
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

// Função para dividir jogadores em grupos equilibrados de 2 ou 3
function divideIntoGroups(players) {
  const groups = [];
  
  // Embaralha a lista de jogadores antes de formar os grupos
  shuffleArray(players);

  while (players.length > 0) {
    if (players.length % 3 === 0) {
      groups.push(players.splice(0, 3)); // Adiciona grupo de 3
    } else {
      groups.push(players.splice(0, 2)); // Adiciona grupo de 2
    }
  }

  // Log dos grupos formados com o número da rodada
  console.log('Grupos formados para a missão coletiva:');
  groups.forEach((group, index) => {
    console.log(`Grupo ${index + 1}: ${group.map(player => player.name).join(', ')}`);
  });

  return groups;
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
function resolveCollectiveMission(groups, mission, match) {
  const groupResults = [];
  
  groups.forEach(group => {
    const totalSkill = group.reduce((total, player) => total + player.skillLevel, 0);
    const roll = rollDice();
    const success = (totalSkill + roll >= mission.difficulty);

    if (success) {
      group.forEach(player => player.credits += mission.reward);
    } else {
      group.forEach(player => player.credits -= mission.failureCost);
    }

    // Adicionar ao histórico do relatório para cada jogador do grupo
    group.forEach(player => {
      match.gameReport.players[player.name].missionHistory.push({
        round: match.currentRound,
        missionType: 'collective',
        missionName: mission.name,
        result: success ? 'success' : 'failure',
        roll: roll,
        groupMembers: group.map(p => p.name),
        creditsChange: success ? mission.reward : -mission.failureCost
      });
    });

    groupResults.push({
      group,
      success,
      credits: group.map(player => player.credits)
    });
  });

  return groupResults;
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
      data: match.missions
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
              missions: match.missions
            });
          }
        });

        // Resolução das missões coletivas
        const collectiveMission = match.missions.find(m => m.type === 'collective');
        const playersForCollective = match.players.filter(p => {
          return match.playersChoices.find(c => c.player === p.name && c.choice === 'collective');
        });

        if (playersForCollective.length > 0) {
          // Divide os jogadores em grupos equilibrados e aleatórios
          const groups = divideIntoGroups(playersForCollective);
          const groupResults = resolveCollectiveMission(groups, collectiveMission, match);

          groupResults.forEach(groupResult => {
            groupResult.group.forEach(player => {
              sendToPlayer(player, {
                type: 'roundEnd',
                playerName: player.name,
                success: groupResult.success ? 'Venceu' : 'Perdeu',
                credits: player.credits,
                missions: match.missions
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

// Inicializar o servidor na porta 3000
server.listen(3000, () => {
  console.log('Servidor WebSocket rodando na porta 3000');
  console.log(`Sistema de matchmaking ativo - ${MATCH_SIZE} jogadores por partida`);
});
