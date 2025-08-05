// client.js
let ws;
let hasChosenFirstMission = false; // Track if player has made their first mission choice

function conectar() {
    ws = new WebSocket('ws://localhost:3000'); // Conectar ao servidor WebSocket

    // Evento quando o WebSocket for aberto
    ws.onopen = () => {
        console.log('Conectado ao servidor WebSocket');
        updateGameStatus('Conectado ao servidor', 'status-match-found');
    };

    // Evento quando uma mensagem for recebida do servidor
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Quando o servidor envia informações de inicialização
        if (data.type === 'init') {
            // Atualiza as informações do jogador
            document.getElementById('playerName').innerText = data.data.name;
            document.getElementById('playerSkill').innerText = data.data.skillLevel;
            updateCreditsDisplay(data.data.credits);
        }

        // Quando o jogador está aguardando outros jogadores
        if (data.type === 'waitingForPlayers') {
            updateGameStatus('Procurando outros jogadores...', 'status-waiting');
            document.getElementById('roundOutcome').innerText = 'Aguardando...';
            document.getElementById('roundCredits').innerText = 'Procurando partida...';
            updateCreditChange('Aguardando partida...', 'neutral');
            disableButtons();
        }

        // Quando uma partida é encontrada
        if (data.type === 'matchFound') {
            updateGameStatus(`Partida encontrada! ${data.players.length}/3 jogadores`, 'status-in-game');
            document.getElementById('roundOutcome').innerText = `Partida iniciada`;
            document.getElementById('roundCredits').innerText = `Aguardando missões...`;
            updateCreditChange('Partida iniciada', 'neutral');
            enableButtons();
        }

        // Quando um jogador se desconecta
        if (data.type === 'playerDisconnected') {
            updateGameStatus(`Jogador desconectou (${data.remainingPlayers} restantes)`, 'status-error');
            document.getElementById('roundOutcome').innerText = `Jogador desconectou`;
            document.getElementById('roundCredits').innerText = `${data.remainingPlayers} jogadores restantes`;
        }

        // Quando o servidor envia as missões
        if (data.type === 'missions') {
            // Atualiza com as missões enviadas pelo servidor
            updateMissionInfo(data.data[0], 'individual'); // Atualiza missão individual
            updateMissionInfo(data.data[1], 'collective'); // Atualiza missão coletiva
            updateGameStatus('Escolha sua missão!', 'status-in-game');
            updateRoundInfo(data.currentRound, data.maxRounds);
            document.getElementById('roundOutcome').innerText = 'Missões disponíveis';
            
            // Only show choice instruction on first round
            if (!hasChosenFirstMission) {
                document.getElementById('roundCredits').innerText = 'Escolha individual ou coletiva';
            } else {
                document.getElementById('roundCredits').innerText = 'Nova rodada iniciada';
            }
            
            enableButtons();
        }

        // Quando o servidor envia o resultado da rodada
        if (data.type === 'roundEnd') {
            // Exibe o resultado da rodada
            const success = data.success === 'Venceu';
            document.getElementById('roundOutcome').innerText = success ? 'Missão bem-sucedida!' : 'Missão fracassou';
            document.getElementById('roundCredits').innerText = success ? 'Parabéns pela vitória!' : 'Tente novamente na próxima';
            
            // Calcular mudança nos créditos baseado no sucesso
            const previousCredits = parseFloat(document.getElementById('playerCredits').innerText.match(/[\d.]+/)[0]);
            const creditChange = data.credits - previousCredits;
            const changeText = creditChange >= 0 ? `+${creditChange.toFixed(2)}` : `${creditChange.toFixed(2)}`;
            const changeType = creditChange > 0 ? 'positive' : creditChange < 0 ? 'negative' : 'neutral';
            updateCreditChange(`${changeText} créditos`, changeType);
            
            updateCreditsDisplay(data.credits);
            
            // Atualiza as informações das missões para o jogador
            updateMissionInfo(data.missions[0], 'individual'); // Atualiza missão individual
            updateMissionInfo(data.missions[1], 'collective'); // Atualiza missão coletiva
            
            // Atualiza informação da rodada
            if (data.currentRound && data.maxRounds) {
                updateRoundInfo(data.currentRound, data.maxRounds);
            }
            
            updateGameStatus(success ? 'Missão bem-sucedida!' : 'Missão fracassou', 
                           success ? 'status-match-found' : 'status-error');
        }

        // Quando há um erro
        if (data.type === 'error') {
            updateGameStatus(`Erro: ${data.message}`, 'status-error');
            document.getElementById('roundOutcome').innerText = `Erro: ${data.message}`;
            document.getElementById('roundCredits').innerText = 'Tente novamente';
        }

        // Quando a partida é encerrada
        if (data.type === 'matchEnded') {
            updateGameStatus('Partida encerrada', 'status-error');
            document.getElementById('roundOutcome').innerText = `Partida encerrada`;
            document.getElementById('roundCredits').innerText = data.reason || 'Jogo finalizado';
            if (data.finalCredits) {
                updateCreditsDisplay(data.finalCredits);
            }
            disableButtons();
        }

        // Quando o jogador é removido da partida
        if (data.type === 'kicked') {
            updateGameStatus('Removido da partida', 'status-error');
            document.getElementById('roundOutcome').innerText = `Removido: ${data.reason}`;
            document.getElementById('roundCredits').innerText = 'Desconectado do jogo';
            disableButtons();
        }
    };

    // Evento quando a conexão for fechada
    ws.onclose = () => {
        console.log('Desconectado do servidor WebSocket');
        updateGameStatus('Desconectado do servidor', 'status-error');
        disableButtons();
    };

    // Evento de erro
    ws.onerror = (error) => {
        console.log('Erro no WebSocket:', error);
        updateGameStatus('Erro de conexão', 'status-error');
    };
}

// Atualizar status do jogo
function updateGameStatus(message, statusClass) {
    const statusElement = document.getElementById('gameStatus');
    statusElement.innerHTML = message;
    statusElement.className = `status-indicator ${statusClass}`;
}

// Atualizar display de créditos
function updateCreditsDisplay(credits) {
    const formattedCredits = Number(credits).toFixed(2);
    document.getElementById('playerCredits').innerHTML = `💰 ${formattedCredits} Créditos`;
}

// Atualizar informações da rodada
function updateRoundInfo(currentRound, maxRounds) {
    document.getElementById('currentRound').innerText = currentRound;
    document.getElementById('maxRounds').innerText = maxRounds;
}

// Atualizar display de mudança de créditos
function updateCreditChange(message, type = 'neutral') {
    const creditChangeElement = document.getElementById('creditChange');
    creditChangeElement.innerText = message;
    creditChangeElement.className = `credit-change ${type}`;
}

// Habilitar botões de missão
function enableButtons() {
    document.getElementById('individualBtn').disabled = false;
    document.getElementById('collectiveBtn').disabled = false;
}

// Desabilitar botões de missão
function disableButtons() {
    document.getElementById('individualBtn').disabled = true;
    document.getElementById('collectiveBtn').disabled = true;
}

// Obter badge de dificuldade
function getDifficultyBadge(difficulty) {
    // Convert to number if it's not already
    const difficultyNum = Number(difficulty);
    let badgeClass = 'difficulty-medium';
    let difficultyText = 'Médio';
    
    // Define difficulty ranges based on numeric values
    if (difficultyNum <= 5) {
        badgeClass = 'difficulty-easy';
        difficultyText = 'Fácil';
    } else if (difficultyNum >= 8) {
        badgeClass = 'difficulty-hard';
        difficultyText = 'Difícil';
    } else {
        badgeClass = 'difficulty-medium';
        difficultyText = 'Médio';
    }
    
    return `<span class="difficulty-badge ${badgeClass}">${difficultyText} (${difficultyNum})</span>`;
}

// Atualizar as informações da missão no front-end
function updateMissionInfo(mission, missionType) {
    if (missionType === 'individual') {
        document.getElementById('missionIndividualName').innerText = mission.name;
        document.getElementById('missionIndividualDifficulty').innerHTML = getDifficultyBadge(mission.difficulty);
        document.getElementById('missionIndividualReward').innerText = `${Number(mission.reward).toFixed(2)} créditos`;
        document.getElementById('missionIndividualFailureCost').innerText = `${Number(mission.failureCost).toFixed(2)} créditos`;
    } else if (missionType === 'collective') {
        document.getElementById('missionCollectiveName').innerText = mission.name;
        document.getElementById('missionCollectiveDifficulty').innerHTML = getDifficultyBadge(mission.difficulty);
        document.getElementById('missionCollectiveReward').innerText = `${Number(mission.reward).toFixed(2)} créditos`;
        document.getElementById('missionCollectiveFailureCost').innerText = `${Number(mission.failureCost).toFixed(2)} créditos`;
    }
}

// Enviar escolha de missão ao servidor
function chooseMission(missionType) {
    // Mark that the player has made their first choice
    hasChosenFirstMission = true;
    
    // Desabilita os botões temporariamente
    disableButtons();
    updateGameStatus('Processando escolha...', 'status-waiting');
    
    // Atualiza informações para mostrar que a escolha foi feita
    const missionTypeText = missionType === 'individual' ? 'Individual' : 'Coletiva';
    document.getElementById('roundOutcome').innerText = `Missão ${missionTypeText} escolhida`;
    document.getElementById('roundCredits').innerText = 'Aguardando outros jogadores...';
    updateCreditChange('Escolha realizada', 'neutral');
    
    // Envia a escolha do jogador para o servidor
    ws.send(JSON.stringify({ type: 'chooseMission', missionType: missionType }));
}

// Iniciar a conexão WebSocket assim que o script carregar
conectar();
