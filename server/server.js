// server/server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// Criação de um servidor WebSocket usando o pacote 'ws'
const wss = new WebSocket.Server({ server });

let players = []; // Armazenar jogadores conectados
let currentRound = 1; // Controla o número da rodada
let missions = []; // Armazenar missões
let playersChoices = []; // Armazenar as escolhas dos jogadores para as missões

// Função para criar uma missão
function createMission(type) {
  const difficulty = Math.floor(Math.random() * 10) + 1; // Dificuldade entre 1 e 10
  const reward = Math.floor(Math.random() * 100) + 50; // Recompensa entre 50 e 150 créditos
  const failureCost = Math.floor(Math.random() * 50) + 10; // Custo do fracasso entre 10 e 60 créditos
  
  return {
    type,
    difficulty,
    reward,
    failureCost,
    playersParticipating: [] // Jogadores que estão participando
  };
}

// Gerar missões ao início de cada rodada
function generateMissions() {
  missions = [
    createMission('individual'),
    createMission('collective')
  ];
}

// Função para rolar um dado de 6 lados
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
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

  return { success, credits: player.credits };
}

// Função para resolver missões coletivas
function resolveCollectiveMission(playersInvolved, mission) {
  const totalSkill = playersInvolved.reduce((total, player) => total + player.skillLevel, 0);
  const roll = rollDice();
  const success = (totalSkill + roll >= mission.difficulty);

  if (success) {
    playersInvolved.forEach(player => player.credits += mission.reward);
  } else {
    playersInvolved.forEach(player => player.credits -= mission.failureCost);
  }

  return { success, credits: playersInvolved.map(p => p.credits) };
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
  console.log('Novo jogador conectado');

  // Adiciona um jogador com informações iniciais
  const player = {
    ws,
    credits: 100, // Créditos iniciais
    skillLevel: Math.floor(Math.random() * 5) + 1, // Habilidade aleatória entre 1 e 5
    name: `Jogador ${players.length + 1}`,
    hasChosen: false // Inicializa com a marcação de não ter escolhido uma missão ainda
  };
  players.push(player);

  // Envia as informações iniciais ao jogador
  ws.send(JSON.stringify({ type: 'init', data: player }));

  // Envia as missões para o jogador assim que ele se conecta
  sendMissionsToAllPlayers(); // Envia missões para todos os jogadores

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

      console.log(`${player.name} escolheu a missão: ${missionType}`);

      // Verificar se todos os jogadores já escolheram suas missões
      if (playersChoices.length === players.length) {
        // Todos os jogadores tomaram sua decisão, resolver as missões
        console.log('Todos os jogadores escolheram suas missões, resolvendo as missões agora.');

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
        collectiveMission.playersParticipating = players.filter(p => {
          return playersChoices.find(c => c.player === p.name && c.choice === 'collective');
        });

        if (collectiveMission.playersParticipating.length > 0) {
          const result = resolveCollectiveMission(collectiveMission.playersParticipating, collectiveMission);
          collectiveMission.playersParticipating.forEach(player => {
            sendToPlayer(player, {
              type: 'roundEnd',
              playerName: player.name,
              success: result.success ? 'Venceu' : 'Perdeu',
              credits: player.credits,
              missions: missions // Envia as novas missões
            });
          });
        }

        // Exibe a quantidade de créditos no log do servidor ao final da rodada
        console.log('Créditos após a rodada:');
        players.forEach(player => {
          console.log(`${player.name}: ${player.credits} créditos`);
        });

        // Limpar as escolhas para a próxima rodada
        playersChoices = [];
        players.forEach(p => p.hasChosen = false); // Resetar a flag de escolhas
        generateMissions(); // Gerar novas missões para a próxima rodada
      }
    }
  });

  // Quando o jogador se desconectar
  ws.on('close', () => {
    console.log(`Jogador ${player.name} desconectado`);
    players = players.filter(p => p !== player);
  });
});

// Servir os arquivos da pasta 'client'
app.use(express.static('client'));

// Inicializar o servidor na porta 3000
server.listen(3000, () => {
  console.log('Servidor WebSocket rodando na porta 3000');
  generateMissions(); // Gerar missões no início do jogo
});
