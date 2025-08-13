// client.js
let ws;
let hasChosenFirstMission = false; // Track if player has made their first mission choice
let playerData = null; // Store player registration data

// Handle registration form
document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('registrationForm');
    const registrationOverlay = document.getElementById('registrationOverlay');
    
    registrationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('playerNameInput').value.trim();
        const age = parseInt(document.getElementById('playerAge').value);
        const gender = document.getElementById('playerGender').value;
        
        if (!name || !age || !gender) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }
        
        if (name.length < 2) {
            alert('O nome deve ter pelo menos 2 caracteres.');
            return;
        }
        
        if (age < 13 || age > 99) {
            alert('A idade deve estar entre 13 e 99 anos.');
            return;
        }
        
        // Store player data
        playerData = {
            name: name,
            age: age,
            gender: gender,
            registrationTime: new Date().toISOString()
        };
        
        // Hide registration form and connect to game
        registrationOverlay.classList.add('hidden');
        conectar();
    });
});

function conectar() {
    // Get WebSocket host and port from environment or fallback to current location
    const wsHost = process.env.GALAXY_WS_HOST || "";
    const wsPort = process.env.GALAXY_WS_PORT || "";
    const wsUrl = `${wsHost}${wsPort ? ':' + wsPort : ''}`;
    ws = new WebSocket(wsUrl); // Conectar ao servidor WebSocket

    // Evento quando o WebSocket for aberto
    ws.onopen = () => {
        console.log('Conectado ao servidor WebSocket');
        updateGameStatus('Conectado ao servidor', 'status-match-found');
        
        // Send registration data to server
        if (playerData) {
            ws.send(JSON.stringify({
                type: 'playerRegistration',
                data: playerData
            }));
        }
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

        // Quando o jogador está aguardando na fila
        if (data.type === 'waitingForMatch') {
            updateGameStatus(data.message, 'status-waiting');
            document.getElementById('roundOutcome').innerText = 'Na fila de espera';
            document.getElementById('roundCredits').innerText = `Posição na fila: ${data.queuePosition}`;
            updateCreditChange('Aguardando partida...', 'neutral');
            disableButtons();
        }

        // Quando o jogador entra em uma partida
        if (data.type === 'matchJoined') {
            updateGameStatus(`Entrou na partida automaticamente! (${data.currentPlayers}/${data.maxPlayers} jogadores)`, 'status-match-found');
            document.getElementById('roundOutcome').innerText = `Aguardando outros jogadores`;
            document.getElementById('roundCredits').innerText = `${data.currentPlayers}/${data.maxPlayers} jogadores na partida`;
            updateCreditChange('Partida encontrada', 'neutral');
        }

        // Quando outro jogador entra na partida
        if (data.type === 'playerJoined') {
            updateGameStatus(`${data.playerName} entrou na partida! (${data.currentPlayers}/${data.maxPlayers} jogadores)`, 'status-match-found');
            document.getElementById('roundCredits').innerText = `${data.currentPlayers}/${data.maxPlayers} jogadores na partida`;
        }

        // Quando a partida inicia
        if (data.type === 'matchStarted') {
            updateGameStatus('Partida iniciada!', 'status-in-game');
            document.getElementById('roundOutcome').innerText = `Partida iniciada`;
            document.getElementById('roundCredits').innerText = `Aguardando missões...`;
            updateCreditChange('Partida iniciada', 'neutral');
            enableButtons();
        }

        // Quando uma partida é cancelada
        if (data.type === 'matchCancelled') {
            updateGameStatus('Partida cancelada pelo moderador', 'status-error');
            document.getElementById('roundOutcome').innerText = 'Partida cancelada';
            document.getElementById('roundCredits').innerText = 'Buscando nova partida...';
            updateCreditChange('Partida cancelada', 'neutral');
        }

        // Quando um jogador se desconecta
        if (data.type === 'playerDisconnected') {
            updateGameStatus(`Jogador desconectou - Partida encerrada`, 'status-error');
            document.getElementById('roundOutcome').innerText = `Partida encerrada`;
            document.getElementById('roundCredits').innerText = `Desconexão durante partida`;
            updateCreditChange('Partida encerrada', 'neutral');
            disableButtons();
        }

        // Quando o servidor envia as missões
        if (data.type === 'missions') {
            // Atualiza com as missões enviadas pelo servidor
            updateMissionInfo(data.data[0], 'individual'); // Atualiza missão individual
            updateMissionInfo(data.data[1], 'collective'); // Atualiza missão coletiva
            updateGameStatus('Escolha sua missão!', 'status-in-game');
            updateRoundInfo(data.currentRound, data.maxRounds);
            updateObjectiveInfo(data.matchObjective, data.creditsQuota, data.maxRounds);
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
            const isWinner = data.isWinner || false;
            const statusClass = isWinner ? 'status-match-found' : 'status-error';
            const statusMessage = isWinner ? '🏆 VITÓRIA!' : 'Partida encerrada';
            
            updateGameStatus(statusMessage, statusClass);
            document.getElementById('roundOutcome').innerText = isWinner ? '🎉 Você venceu!' : `Partida encerrada`;
            document.getElementById('roundCredits').innerText = data.reason || 'Jogo finalizado';
            
            if (data.finalCredits) {
                updateCreditsDisplay(data.finalCredits);
            }
            
            if (data.winners && data.winners.length > 0) {
                const winnerText = data.winners.length === 1 ? 
                    `Vencedor: ${data.winners[0]}` : 
                    `Vencedores: ${data.winners.join(', ')}`;
                updateCreditChange(winnerText, isWinner ? 'positive' : 'neutral');
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

// Atualizar informações do objetivo da partida
function updateObjectiveInfo(matchObjective, creditsQuota, maxRounds) {
    let objectiveTypeText = '';
    let maxRoundsDisplay = '';
    
    if (matchObjective === 'fixedRounds') {
        objectiveTypeText = 'Rodadas Fixas';
        maxRoundsDisplay = maxRounds;
    } else if (matchObjective === 'infiniteRounds') {
        objectiveTypeText = 'Primeiro a Atingir';
        maxRoundsDisplay = '∞';
    } else {
        objectiveTypeText = 'Desconhecido';
        maxRoundsDisplay = '-';
    }
    
    document.getElementById('matchObjectiveType').innerText = objectiveTypeText;
    document.getElementById('creditsQuota').innerText = `${Number(creditsQuota).toFixed(2)} créditos`;
    
    // Update the max rounds display to show infinity symbol for infinite mode
    document.getElementById('maxRounds').innerText = maxRoundsDisplay;
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

// Note: Connection is now initiated after registration form is completed
