// client/client.js
let ws;

function conectar() {
    ws = new WebSocket('ws://localhost:3000'); // Conectar ao servidor WebSocket

    // Evento quando o WebSocket for aberto
    ws.onopen = () => {
        console.log('Conectado ao servidor WebSocket');
    };

    // Evento quando uma mensagem for recebida do servidor
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Quando o servidor envia informações de inicialização
        if (data.type === 'init') {
            // Atualiza as informações do jogador
            document.getElementById('playerName').innerText = `Nome: ${data.data.name}`;
            document.getElementById('playerSkill').innerText = `Habilidade: ${data.data.skillLevel}`;
            document.getElementById('playerCredits').innerText = `Créditos: ${data.data.credits}`;
        }

        // Quando o servidor envia as missões
        if (data.type === 'missions') {
            // Atualiza com as missões enviadas pelo servidor
            updateMissionInfo(data.data[0], 'individual');
            updateMissionInfo(data.data[1], 'collective');
        }

        // Quando o servidor envia o resultado da rodada
        if (data.type === 'roundEnd') {
            // Exibe o resultado da rodada
            document.getElementById('roundOutcome').innerText = `${data.playerName} ${data.success} a missão!`;
            document.getElementById('roundCredits').innerText = `Créditos após a rodada: ${data.credits}`;

            // Atualiza as informações das missões para o jogador
            updateMissionInfo(data.missions[0], 'individual'); // Atualiza com a missão individual (primeira missão)
            updateMissionInfo(data.missions[1], 'collective'); // Atualiza com a missão coletiva (segunda missão)
        }
    };

    // Evento quando a conexão for fechada
    ws.onclose = () => {
        console.log('Desconectado do servidor WebSocket');
    };

    // Evento de erro
    ws.onerror = (error) => {
        console.log('Erro no WebSocket:', error);
    };
}

// Atualizar as informações da missão no front-end
function updateMissionInfo(mission, missionType) {
    if (missionType === 'individual') {
        document.getElementById('missionIndividualType').innerText = `Tipo: ${mission.type}`;
        document.getElementById('missionIndividualDifficulty').innerText = `Dificuldade: ${mission.difficulty}`;
        document.getElementById('missionIndividualReward').innerText = `Recompensa: ${mission.reward} créditos`;
        document.getElementById('missionIndividualFailureCost').innerText = `Custo de fracasso: ${mission.failureCost} créditos`;
    } else if (missionType === 'collective') {
        document.getElementById('missionCollectiveType').innerText = `Tipo: ${mission.type}`;
        document.getElementById('missionCollectiveDifficulty').innerText = `Dificuldade: ${mission.difficulty}`;
        document.getElementById('missionCollectiveReward').innerText = `Recompensa: ${mission.reward} créditos`;
        document.getElementById('missionCollectiveFailureCost').innerText = `Custo de fracasso: ${mission.failureCost} créditos`;
    }
}

// Enviar escolha de missão ao servidor
function chooseMission(missionType) {
    // Envia a escolha do jogador para o servidor
    ws.send(JSON.stringify({ type: 'chooseMission', missionType: missionType }));
}

// Iniciar a conexão WebSocket assim que o script carregar
conectar();
