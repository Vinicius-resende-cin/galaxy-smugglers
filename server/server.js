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

let players = []; // Armazenar jogadores conectados
let currentRound = 1; // Controla o número da rodada
let missions = []; // Armazenar missões
let playersChoices = []; // Armazenar as escolhas dos jogadores para as missões
let gameId = uuidv4(); // ID único para esta partida
let gameReport = {
  gameId: gameId,
  totalRounds: 0,
  players: {}
}; // Armazenar dados para relatório

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

  // Inicializar dados do jogador no relatório
  gameReport.players[name] = {
    skillLevel: skillLevel,
    missionHistory: [],
    creditsHistory: [INITIAL_CREDITS]
  };

  return player;
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

// Gerar missões ao início de cada rodada
function generateMissions() {
  console.log(`\nRODADA ${currentRound}:`);  // Exibe o número da rodada no início
  missions = [
    createMission('individual'),
    createMission('collective')
  ];
}

// Função para rolar um dado de 6 lados
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// Função para gerar e salvar o relatório em JSON
function generateReport() {
  const reportData = {
    gameId: gameReport.gameId,
    totalRounds: gameReport.totalRounds,
    players: gameReport.players,
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  const filename = `${gameId}.json`;
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
function resolveIndividualMission(player, mission) {
  const roll = rollDice();
  const success = (player.skillLevel + roll >= mission.difficulty);

  if (success) {
    player.credits += mission.reward;
  } else {
    player.credits -= mission.failureCost;
  }

  // Adicionar ao histórico do relatório
  gameReport.players[player.name].missionHistory.push({
    round: currentRound,
    missionType: 'individual',
    missionName: mission.name,
    result: success ? 'success' : 'failure',
    roll: roll,
    creditsChange: success ? mission.reward : -mission.failureCost
  });

  return { success, credits: player.credits };
}

// Função para resolver missões coletivas
function resolveCollectiveMission(groups, mission) {
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
      gameReport.players[player.name].missionHistory.push({
        round: currentRound,
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

// Enviar as missões para todos os jogadores
function sendMissionsToAllPlayers() {
  players.forEach(player => {
    player.ws.send(JSON.stringify({
      type: 'missions',
      data: missions
    }));
  });
}

// Quando um cliente se conecta ao WebSocket
wss.on('connection', (ws) => {
  console.log(`Novo jogador conectado: Jogador ${players.length + 1}`);

  // Adiciona um jogador com informações iniciais
  const player = createPlayer(`Jogador ${players.length + 1}`);
  player.ws = ws; // Associa o WebSocket ao jogador
  players.push(player);

  // Envia as informações iniciais ao jogador
  ws.send(JSON.stringify({ type: 'init', data: player }));

  // Envia as missões para o jogador assim que ele se conecta
  sendMissionsToAllPlayers();

  // Quando o jogador escolhe participar de uma missão
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'chooseMission') {
      const { missionType } = data;

      // Verificar se o jogador já fez uma escolha
      if (player.hasChosen) {
        ws.send(JSON.stringify({ type: 'error', message: 'Você já escolheu uma missão, aguarde a rodada terminar.' }));
        return;
      }

      // Marcar a escolha do jogador
      playersChoices.push({ player: player.name, choice: missionType });
      player.hasChosen = true;

      // Log da escolha da missão
      console.log(`${player.name} escolheu a missão: ${missionType}`);

      // Verificar se todos os jogadores já escolheram suas missões
      if (playersChoices.length === players.length) {
        // Todos os jogadores tomaram sua decisão, resolver as missões
        console.log(`Todos os jogadores escolheram suas missões, resolvendo as missões agora.`);

        let playerResults = [];

        // Resolução das missões individuais
        playersChoices.forEach(choice => {
          const selectedMission = missions.find(m => m.type === choice.choice);
          if (choice.choice === 'individual') {
            const result = resolveIndividualMission(players.find(p => p.name === choice.player), selectedMission);
            sendToPlayer(players.find(p => p.name === choice.player), {
              type: 'roundEnd',
              playerName: choice.player,
              success: result.success ? 'Venceu' : 'Perdeu',
              credits: result.credits,
              missions: missions // Envia as novas missões
            });
          }
        });

        // Resolução das missões coletivas
        const collectiveMission = missions.find(m => m.type === 'collective');
        const playersForCollective = players.filter(p => {
          return playersChoices.find(c => c.player === p.name && c.choice === 'collective');
        });

        if (playersForCollective.length > 0) {
          // Divide os jogadores em grupos equilibrados e aleatórios
          const groups = divideIntoGroups(playersForCollective);
          const groupResults = resolveCollectiveMission(groups, collectiveMission);

          groupResults.forEach(groupResult => {
            groupResult.group.forEach(player => {
              sendToPlayer(player, {
                type: 'roundEnd',
                playerName: player.name,
                success: groupResult.success ? 'Venceu' : 'Perdeu',
                credits: player.credits,
                missions: missions // Envia as novas missões
              });
            });
          });
        }

        // Exibe a quantidade de créditos no log do servidor ao final da rodada
        console.log(`Créditos após a rodada:`);
        players.forEach(player => {
          console.log(`${player.name}: ${player.credits} créditos`);
          // Adicionar créditos atuais ao histórico
          gameReport.players[player.name].creditsHistory.push(player.credits);
        });

        // Atualizar total de rodadas e gerar relatório
        gameReport.totalRounds = currentRound;
        generateReport();

        // Limpar as escolhas para a próxima rodada
        playersChoices = [];
        players.forEach(p => p.hasChosen = false); // Resetar a flag de escolhas
        currentRound++; // Incrementar o número da rodada
        generateMissions(); // Gerar novas missões para a próxima rodada
      }
    }
  });

  // Quando o jogador se desconectar
  ws.on('close', () => {
    console.log(`Jogador ${player.name} desconectado`);
    players = players.filter(p => p !== player);
    // Nota: Mantemos os dados do jogador no gameReport para fins históricos
    // mesmo após a desconexão, para que o relatório contenha o histórico completo do jogo
  });
});

// Servir os arquivos da pasta 'client'
app.use(express.static('client'));

// Inicializar o servidor na porta 3000
server.listen(3000, () => {
  console.log('Servidor WebSocket rodando na porta 3000');
  console.log(`ID do jogo: ${gameId}`);
  generateMissions(); // Gerar missões no início do jogo
});
