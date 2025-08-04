# Galaxy Smugglers - Contrabandistas da Galáxia

Um jogo de **estratégia e cooperação** onde jogadores assumem o papel de contrabandistas espaciais, tentando acumular créditos através de missões coletivas e individuais. Os jogadores devem enfrentar missões com diferentes níveis de risco e recompensas, enquanto tomam decisões sobre sua participação em missões cooperativas ou individuais.

## Características do Jogo

### Mecânicas Principais

- **Jogadores**: 2 a 10 jogadores (com até 3 jogadores por missão coletiva)
- **Atributos**: Cada jogador possui um **nível de habilidade** e uma **quantidade inicial de créditos**.
- **Missões**: Cada rodada apresenta novas missões, que podem ser **individuais** ou **coletivas**:
  - **Nome da missão**: Ex.: "Contrabando de Especiarias", "Transporte de Armas", etc.
  - **Dificuldade**: Valor que define o quão desafiadora é a missão (1-10).
  - **Recompensa**: Créditos ganhos ao concluir a missão com sucesso (50-150 créditos).
  - **Custo de fracasso**: Créditos perdidos caso a missão falhe (10-60 créditos).

### Tomada de Decisão

- **Participação**: Jogadores escolhem se querem **participar** de uma missão **individual** ou **coletiva**.
- **Missões Individuais**: Cada jogador resolve a missão sozinho, baseado em sua habilidade.
- **Missões Coletivas**: Jogadores podem formar grupos para cooperar e completar missões mais desafiadoras. No máximo, 3 jogadores por grupo de missão coletiva.
- **Divisão em Grupos**: Quando múltiplos jogadores escolhem a missão coletiva, eles são divididos aleatoriamente em grupos de **2 ou 3 jogadores** para maximizar a cooperação e o equilíbrio do jogo.

### Resolução de Missões

- **Fórmula de Sucesso**: Resultado do dado (1-6) + **Soma das Habilidades** dos jogadores participantes.
- **Sucesso**: Se a soma for maior ou igual ao nível de **dificuldade** da missão, a missão é completada com sucesso.
  - A recompensa é dividida igualmente entre os participantes da missão coletiva.
- **Fracasso**: Se a soma for menor que o nível de dificuldade da missão, a missão falha.
  - Todos os participantes perdem créditos para **reparos** ou **despesas**.

### Condições de Vitória

- **Por Créditos**: O vencedor é o jogador que acumular o maior número de créditos ao final de um número predeterminado de rodadas.
- **Por Meta de Missões**: Os jogadores podem atingir objetivos específicos relacionados à quantidade de missões realizadas com sucesso ou fracasso.

## Instalação e Execução

### Requisitos

Certifique-se de ter o **Node.js** instalado. Se necessário, instale as dependências do jogo:

```bash
npm install
````

### Executar o Jogo

Inicie o servidor web para jogar o **Galaxy Smugglers**:

```bash
node .\server\server.js
````

### Acessando o Jogo

Abra o navegador e vá até [http://localhost:3000](http://localhost:3000) para começar a jogar.

## Como Jogar

### 1. Configuração Inicial

Ao iniciar, o jogo automaticamente conecta os jogadores ao servidor WebSocket. Cada jogador verá suas informações iniciais, como nome, nível de habilidade e créditos.

### 2. Fase de Missão

- **Informações da Missão**: Ao começar uma nova rodada, os jogadores podem visualizar as missões atuais com informações como:
  - Tipo de missão (individual ou coletiva).
  - Dificuldade da missão.
  - Recompensa ou custo de fracasso.

- **Seleção de Participantes**: Os jogadores escolhem se desejam participar da missão individual ou se juntam a um grupo coletivo. As missões coletivas são divididas em grupos aleatórios de 2 ou 3 jogadores.

- **Previsão de Sucesso**: Para as missões coletivas, os jogadores podem ver uma previsão de sucesso com base nas habilidades totais do grupo e o nível de risco.

### 3. Execução da Missão

Clique em "Executar Missão" para lançar o dado (1-6) e calcular o resultado da missão. A missão pode ser bem-sucedida ou fracassada dependendo do valor final obtido (dado + habilidade dos jogadores).

### 4. Resultados

- **Detalhes da Missão**: Após a execução, os jogadores podem ver o resultado do dado, o sucesso ou fracasso da missão e os créditos aplicados (se receberam uma recompensa ou perderam créditos).
  
- **Status**: Os créditos atualizados dos jogadores são exibidos para que todos possam ver a situação financeira de cada jogador ao longo do jogo.

### 5. Fim de Jogo

- **Vencedores**: O jogo termina quando um jogador atinge a condição de vitória (acumular o maior número de créditos ou atingir uma meta de missões completadas).

- **Classificação**: Exibe o ranking final dos jogadores, com base nos créditos acumulados ao longo do jogo.
