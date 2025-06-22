# Galaxy Smugglers - Contrabandistas da Galáxia

Um protótipo de jogo de estratégia e cooperação desenvolvido em Pygame, onde jogadores são contrabandistas espaciais buscando acumular créditos através de missões perigosas.

## Características do Jogo

### Mecânicas Principais

- **Jogadores**: 2 a 6 jogadores
- **Atributos**: Cada jogador possui nível de habilidade e créditos iniciais configuráveis
- **Missões**: Cada rodada apresenta uma nova missão com:
  - Nome temático (Transporte de Especiarias, Contrabando de Armas, etc.)
  - Nível de risco (8-20)
  - Recompensa em créditos (20-100)
  - Custo de combustível (3-20)

### Tomada de Decisão

- **Participação**: Jogadores escolhem participar ou não da missão
- **Cooperação**: Podem formar comboios (múltiplos jogadores) ou ir sozinhos
- **Estratégia**: Balanceamento entre risco, recompensa e cooperação

### Resolução de Missões

- **Fórmula**: Dado (1-6) + Soma das Habilidades dos Participantes
- **Sucesso**: Se resultado ≥ nível de risco da missão
  - Recompensa dividida igualmente entre participantes
- **Fracasso**: Se resultado < nível de risco
  - Todos perdem créditos com reparos (10-25)

### Condições de Vitória

- **Por Créditos**: Primeiro jogador a atingir a meta
- **Por Cota**: Jogadores que atingem a cota mínima após X rodadas

## Instalação e Execução

### Requisitos

```bash
pip install -r requirements.txt
```

### Executar o Jogo

```bash
python galaxy_smugglers.py
```

## Como Jogar

### 1. Configuração Inicial

- **Número de Jogadores**: Use os botões +/- para ajustar (2-6)
- **Configuração Individual**: Para cada jogador, defina:
  - Nível de habilidade (1-10)
  - Créditos iniciais (ajustáveis em incrementos de 10)
- **Condição de Vitória**: Escolha entre "créditos" ou "cota"
- **Meta**: Defina a quantidade de créditos necessária para vencer

### 2. Fase de Missão

- **Informações da Missão**: Visualize nome, risco, recompensa e custo
- **Seleção de Participantes**: Clique nos jogadores para selecioná-los
- **Previsão**: Veja a chance estimada de sucesso baseada na habilidade total
- **Execução**: Clique em "Executar Missão" para rolar o dado

### 3. Resultados

- **Detalhes**: Veja o resultado do dado, habilidades e cálculo final
- **Consequências**: Ganhos ou perdas de créditos são aplicados automaticamente
- **Status**: Visualize os créditos atuais de todos os jogadores

### 4. Fim de Jogo

- **Vencedores**: Jogadores que atingiram a condição de vitória
- **Classificação**: Ranking final por créditos
- **Relatório**: Gere análise comportamental detalhada

## Análise Comportamental

O jogo gera relatórios em JSON contendo:

### Dados do Jogo
- Condições de vitória utilizadas
- Número total de rodadas
- Resultados de todas as missões

### Análise por Jogador
- Evolução de créditos ao longo do jogo
- Histórico de decisões (solo vs. cooperativo)
- Taxa de sucesso/fracasso
- Comparativo de comportamento baseado em:
  - Créditos iniciais diferentes
  - Níveis de habilidade variados
  - Condições de vitória distintas

### Métricas de Cooperação
- Frequência de missões solo vs. em comboio
- Impacto da cooperação no sucesso
- Análise de risco vs. recompensa

## Extensões Futuras

- Diferentes tipos de nave com habilidades especiais
- Sistema de reputação e mercado negro
- Elementos de blefe e negociação
- Missões com requisitos específicos
- Sistema de progressão entre partidas

## Estrutura do Código

- `Player`: Classe para gerenciar estado dos jogadores
- `Mission`: Definição de missões com parâmetros variáveis  
- `GameState`: Lógica principal do jogo e controle de fluxo
- `GameUI`: Interface gráfica e interação do usuário
- Sistema de relatórios em JSON para análise posterior

O código foi estruturado para facilitar modificações e extensões futuras, mantendo separação clara entre lógica de negócio e apresentação. 