// moderator.js

let refreshInterval;

// Carregar dados iniciais
document.addEventListener('DOMContentLoaded', function() {
    refreshData();
    // Auto-refresh a cada 5 segundos
    refreshInterval = setInterval(refreshData, 5000);
});

// Função para buscar dados do servidor
async function fetchStats() {
    try {
        const response = await fetch('/api/moderator/stats');
        if (!response.ok) {
            throw new Error('Erro ao buscar dados');
        }
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        showMessage('Erro ao buscar dados do servidor', 'error');
        return null;
    }
}

// Atualizar todos os dados na tela
async function refreshData() {
    const stats = await fetchStats();
    if (!stats) return;
    
    // Atualizar estatísticas
    document.getElementById('waitingPlayers').textContent = stats.totalWaitingPlayers;
    document.getElementById('activeMatches').textContent = stats.activeMatches;
    document.getElementById('totalPlayers').textContent = stats.totalPlayersInMatches;
    document.getElementById('currentMatchSize').textContent = stats.gameConfig.matchSize;
    
    // Atualizar formulário de configuração
    document.getElementById('matchSize').value = stats.gameConfig.matchSize;
    document.getElementById('initialCredits').value = stats.gameConfig.initialCredits;
    document.getElementById('skillLevels').value = stats.gameConfig.fixedSkillLevels.join(',');
    document.getElementById('maxRounds').value = stats.gameConfig.maxRounds;
    document.getElementById('matchObjective').value = stats.gameConfig.matchObjective || 'fixedRounds';
    document.getElementById('creditsQuota').value = stats.gameConfig.creditsQuota || 500;
    
    // Atualizar partidas ativas
    displayMatches(stats.matches);
}

// Exibir partidas ativas
function displayMatches(matches) {
    const container = document.getElementById('matchesContainer');
    
    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #ccc;">Nenhuma partida ativa no momento</p>';
        return;
    }
    
    // Get current stats for objective info
    fetchStats().then(stats => {
        container.innerHTML = matches.map(match => `
            <div class="match-card">
                <div class="match-header">
                    <span class="match-id">Partida: ${match.matchId.substring(0, 8)}...</span>
                    <span>Rodada: ${match.currentRound}</span>
                </div>
                
                <div class="players-list">
                    <strong>Jogadores (${match.playersCount}):</strong>
                    ${match.players.map(player => `
                        <div class="player-item">
                            <div class="player-info">
                                <strong>${player.name}</strong> 
                                (Skill: ${player.skillLevel}, Créditos: ${player.credits.toFixed(2)})
                                ${player.hasChosen ? ' ✅' : ' ⏳'}
                            </div>
                            <button class="btn btn-warning btn-sm" onclick="kickPlayer('${player.name}')">
                                Remover
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="missions-info">
                    <strong>Missões Atuais:</strong><br>
                    Individual: ${match.missions[0]?.name || 'N/A'}<br>
                    Coletiva: ${match.missions[1]?.name || 'N/A'}<br>
                    <strong>Objetivo:</strong> ${getObjectiveText(stats?.gameConfig?.matchObjective)}<br>
                    <strong>Cota:</strong> ${stats?.gameConfig?.creditsQuota || 500} créditos
                </div>
                
                <div style="text-align: center; margin-top: 15px;">
                    <button class="btn btn-danger" onclick="endMatch('${match.matchId}')">
                        Encerrar Partida
                    </button>
                </div>
            </div>
        `).join('');
    });
}

// Helper function to get objective text
function getObjectiveText(objective) {
    switch(objective) {
        case 'fixedRounds':
            return 'Rodadas Fixas';
        case 'infiniteRounds':
            return 'Primeiro a Atingir';
        default:
            return 'Desconhecido';
    }
}

// Atualizar configurações do jogo
async function updateConfig() {
    const matchSize = parseInt(document.getElementById('matchSize').value);
    const initialCredits = parseInt(document.getElementById('initialCredits').value);
    const skillLevelsStr = document.getElementById('skillLevels').value;
    const maxRounds = parseInt(document.getElementById('maxRounds').value);
    const matchObjective = document.getElementById('matchObjective').value;
    const creditsQuota = parseInt(document.getElementById('creditsQuota').value);
    
    // Validar níveis de habilidade
    let fixedSkillLevels;
    try {
        fixedSkillLevels = skillLevelsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (fixedSkillLevels.length === 0) {
            throw new Error('Níveis de habilidade inválidos');
        }
    } catch (error) {
        showMessage('Níveis de habilidade devem ser números separados por vírgula (ex: 3,5)', 'error');
        return;
    }
    
    const config = {
        matchSize,
        initialCredits,
        fixedSkillLevels,
        maxRounds,
        matchObjective,
        creditsQuota
    };
    
    try {
        const response = await fetch('/api/moderator/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            throw new Error('Erro ao atualizar configurações');
        }
        
        const result = await response.json();
        showMessage('Configurações atualizadas com sucesso!', 'success');
        refreshData();
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        showMessage('Erro ao atualizar configurações', 'error');
    }
}

// Encerrar uma partida
async function endMatch(matchId) {
    if (!confirm('Tem certeza que deseja encerrar esta partida?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/moderator/match/${matchId}/end`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao encerrar partida');
        }
        
        const result = await response.json();
        showMessage('Partida encerrada com sucesso!', 'success');
        refreshData();
    } catch (error) {
        console.error('Erro ao encerrar partida:', error);
        showMessage('Erro ao encerrar partida', 'error');
    }
}

// Remover um jogador
async function kickPlayer(playerName) {
    if (!confirm(`Tem certeza que deseja remover o jogador ${playerName}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/moderator/player/${playerName}/kick`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao remover jogador');
        }
        
        const result = await response.json();
        showMessage(`Jogador ${playerName} removido com sucesso!`, 'success');
        refreshData();
    } catch (error) {
        console.error('Erro ao remover jogador:', error);
        showMessage('Erro ao remover jogador', 'error');
    }
}

// Exibir mensagem
function showMessage(text, type) {
    const messageDiv = document.getElementById('configMessage');
    messageDiv.innerHTML = `<div class="message ${type}">${text}</div>`;
    
    // Remover mensagem após 5 segundos
    setTimeout(() => {
        messageDiv.innerHTML = '';
    }, 5000);
}

// Parar/iniciar auto-refresh
function toggleAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('Auto-refresh pausado');
    } else {
        refreshInterval = setInterval(refreshData, 5000);
        console.log('Auto-refresh iniciado');
    }
}

// Atalhos de teclado
document.addEventListener('keydown', function(event) {
    // Ctrl+R ou F5 para refresh manual
    if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
        event.preventDefault();
        refreshData();
    }
    
    // Espaço para pausar/iniciar auto-refresh
    if (event.key === ' ' && event.target.tagName !== 'INPUT') {
        event.preventDefault();
        toggleAutoRefresh();
    }
});
