import pygame
import random
import textwrap

# --- Constantes e Configurações Iniciais ---
pygame.init()

SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 700
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Galaxy Smugglers - Protótipo")

# Cores
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (40, 40, 40)
LIGHT_GRAY = (100, 100, 100)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
BLUE = (100, 100, 255)
YELLOW = (255, 255, 0)

# Fontes
FONT_TITLE = pygame.font.Font(None, 48)
FONT_MEDIUM = pygame.font.Font(None, 36)
FONT_SMALL = pygame.font.Font(None, 24)

# Configurações do Jogo
WIN_CONDITION_CREDITS = 200
DICE_SIDES = 6

# --- Classes do Jogo ---

class Player:
    """Representa um contrabandista no jogo."""
    def __init__(self, name, credits, skill_level):
        self.name = name
        self.initial_credits = credits
        self.credits = credits
        self.skill_level = skill_level
        self.decision_history = []

    def log_decision(self, round_num, decision, paid_cost, credit_change):
        self.decision_history.append({
            "round": round_num,
            "decision": decision,
            "paid_cost": paid_cost,
            "credit_change": credit_change
        })

class Mission:
    """Representa uma missão de contrabando."""
    def __init__(self, name, type, risk, reward, cost):
        self.name = name
        self.type = type
        self.base_risk = risk # base_risk is now just the initial risk for the mission type
        self.risk = risk
        self.reward = reward
        self.cost = cost

class Button:
    """Classe auxiliar para criar botões clicáveis."""
    def __init__(self, x, y, width, height, text, color=LIGHT_GRAY, hover_color=WHITE):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.hover_color = hover_color
        self.is_hovered = False

    def draw(self, screen):
        color = self.hover_color if self.is_hovered else self.color
        pygame.draw.rect(screen, color, self.rect, border_radius=5)
        text_surf = FONT_MEDIUM.render(self.text, True, BLACK)
        text_rect = text_surf.get_rect(center=self.rect.center)
        screen.blit(text_surf, text_rect)

    def is_clicked(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                return True
        return False
    
    def check_hover(self, mouse_pos):
        self.is_hovered = self.rect.collidepoint(mouse_pos)

class GameManager:
    """Gerencia todo o estado e fluxo do jogo."""
    def __init__(self):
        self.players = [
            Player("Capitã Eva", 50, 3),
            Player("Kael, o Piloto", 30, 5),
            Player("Zorg, o Mercador", 70, 1),
        ]
        self.game_state = "DECISION"  # DECISION, COST, RESOLUTION, END_GAME
        self.current_round = 0
        self.missions = {}
        self.game_log = []
        
        # Controle de turnos e decisões
        self.active_player_index = 0
        self.player_decisions = {} # Guarda a decisão principal ('SOLO', 'COLETIVA', 'SKIP')
        self.cost_decision_pending = None # Guarda o jogador que precisa decidir o custo
        
        self.winner = None
        self._setup_buttons()
        self.new_round()

    def _setup_buttons(self):
        self.buttons = {
            "solo": Button(200, 550, 200, 60, "Missão Solo"),
            "coletiva": Button(500, 550, 200, 60, "Missão Coletiva"),
            "skip": Button(800, 550, 200, 60, "Ficar no Hangar"),
            "pay_cost": Button(350, 550, 200, 60, "Pagar Custo"),
            "freeride": Button(650, 550, 200, 60, "Pegar Carona")
        }

    def new_round(self):
        self.current_round += 1
        self.log_event(f"--- Iniciando Rodada {self.current_round} ---")
        
        # Gerar missões com risco e custo aleatórios, sem aumento progressivo
        self.missions['SOLO'] = Mission(
            "Entrega Rápida", 'SOLO', 
            risk=random.randint(5, 10),  # Random risk between 5 and 10
            reward=random.randint(15, 30), # Random reward between 15 and 30
            cost=random.randint(3, 7)    # Random cost between 3 and 7
        )
        self.missions['COLETIVA'] = Mission(
            "Bloqueio Imperial", 'COLETIVA',
            risk=random.randint(10, 20), # Random risk between 10 and 20
            reward=random.randint(40, 80),# Random reward between 40 and 80
            cost=random.randint(8, 15)   # Random cost between 8 and 15
        )
        
        self.game_state = "DECISION"
        self.active_player_index = 0
        self.player_decisions = {}
        self.cost_decision_pending = None

    def handle_input(self, event, mouse_pos):
        for button in self.buttons.values():
            button.check_hover(mouse_pos)

        if self.game_state not in ["DECISION", "COST"]:
            return

        active_player = self.players[self.active_player_index]

        if self.game_state == "DECISION":
            if self.buttons['solo'].is_clicked(event):
                self.player_decisions[active_player] = {'type': 'SOLO', 'paid': True}
                self.log_event(f"{active_player.name} escolheu a missão solo.")
                self.next_player_turn()
            elif self.buttons['coletiva'].is_clicked(event):
                self.cost_decision_pending = active_player
                self.game_state = "COST"
                self.log_event(f"{active_player.name} pondera sobre a missão coletiva...")
            elif self.buttons['skip'].is_clicked(event):
                self.player_decisions[active_player] = {'type': 'SKIP', 'paid': False}
                self.log_event(f"{active_player.name} vai ficar no hangar nesta rodada.")
                self.next_player_turn()
        
        elif self.game_state == "COST" and self.cost_decision_pending:
            if self.buttons['pay_cost'].is_clicked(event):
                self.player_decisions[self.cost_decision_pending] = {'type': 'COLETIVA', 'paid': True}
                self.log_event(f"{self.cost_decision_pending.name} se junta ao comboio e paga o combustível.")
                self.next_player_turn()
            elif self.buttons['freeride'].is_clicked(event):
                self.player_decisions[self.cost_decision_pending] = {'type': 'COLETIVA', 'paid': False}
                self.log_event(f"{self.cost_decision_pending.name} pega carona, aumentando o risco!")
                self.next_player_turn()
                
    def next_player_turn(self):
        self.cost_decision_pending = None
        self.game_state = "DECISION"
        self.active_player_index += 1
        if self.active_player_index >= len(self.players):
            self.game_state = "RESOLUTION"
            self.resolve_missions()

    def resolve_missions(self):
        self.log_event("--- Resolução da Rodada ---")
        
        round_credit_changes = {p: 0 for p in self.players}
        
        # --- Missão Coletiva ---
        coop_mission = self.missions['COLETIVA']
        participants = [p for p, d in self.player_decisions.items() if d['type'] == 'COLETIVA']
        
        if participants:
            total_skill = sum(p.skill_level for p in participants)
            freeriders = sum(1 for p in participants if not self.player_decisions[p]['paid'])
            
            # Penalidade de risco por caroneiro
            # The risk calculation here still adds to the base_risk, but base_risk itself is now randomized per round.
            coop_mission.risk = coop_mission.base_risk + (freeriders * 3) 
            
            # Deduzir custos
            for p in participants:
                if self.player_decisions[p]['paid']:
                    p.credits -= coop_mission.cost
                    round_credit_changes[p] -= coop_mission.cost

            dice_roll = random.randint(1, DICE_SIDES)
            total_score = dice_roll + total_skill
            
            log_msg = f"Comboio: Habilidade({total_skill}) + Dado({dice_roll}) = {total_score}. Risco: {coop_mission.risk}"
            
            if total_score >= coop_mission.risk:
                self.log_event(f"SUCESSO! {log_msg}")
                reward_per_player = coop_mission.reward // len(participants)
                for p in participants:
                    p.credits += reward_per_player
                    round_credit_changes[p] += reward_per_player
                self.log_event(f"Cada um no comboio recebe {reward_per_player} créditos.")
            else:
                self.log_event(f"FRACASSO! {log_msg}")
                self.log_event("O comboio volta de mãos vazias.")
        
        # --- Missões Solo ---
        solo_mission = self.missions['SOLO']
        solo_participants = [p for p, d in self.player_decisions.items() if d['type'] == 'SOLO']

        for p in solo_participants:
            p.credits -= solo_mission.cost
            round_credit_changes[p] -= solo_mission.cost
            
            dice_roll = random.randint(1, DICE_SIDES)
            total_score = dice_roll + p.skill_level

            log_msg = f"{p.name}: Habilidade({p.skill_level}) + Dado({dice_roll}) = {total_score}. Risco: {solo_mission.risk}"

            if total_score >= solo_mission.risk:
                p.credits += solo_mission.reward
                round_credit_changes[p] += solo_mission.reward
                self.log_event(f"SUCESSO! {p.name} ganha {solo_mission.reward} créditos. ({log_msg})")
            else:
                self.log_event(f"FRACASSO! {p.name} não ganha nada. ({log_msg})")

        # Logar dados da rodada para o relatório final
        for p in self.players:
            decision = self.player_decisions.get(p, {'type': 'SKIP', 'paid': False})
            p.log_decision(self.current_round, decision['type'], decision['paid'], round_credit_changes.get(p, 0))

        if self.check_win_condition():
            self.game_state = "END_GAME"
        else:
            pygame.time.set_timer(pygame.USEREVENT + 1, 3000) # Pausa antes da próxima rodada

    def check_win_condition(self):
        for p in self.players:
            if p.credits >= WIN_CONDITION_CREDITS:
                self.winner = p
                self.log_event(f"--- FIM DE JOGO! {p.name} alcançou {WIN_CONDITION_CREDITS} créditos! ---")
                return True
        return False
    
    def log_event(self, message):
        # Simply print the message to the console
        print(message)
    
    def generate_report(self):
        report = [f"Relatório Final da Partida - {self.winner.name} Venceu!"]
        report.append("="*40)
        report.append("\nEvolução de Créditos por Rodada:")
        
        header = f"{'Rodada':<10}" + "".join([f"{p.name:<20}" for p in self.players])
        report.append(header)
        
        credit_track = {p.name: p.initial_credits for p in self.players}
        
        for r in range(1, self.current_round + 1):
            line = f"{r:<10}"
            for p in self.players:
                found = False
                for log in p.decision_history:
                    if log['round'] == r:
                        credit_track[p.name] += log['credit_change']
                        line += f"{credit_track[p.name]:<20}"
                        found = True
                        break
                if not found: # Caso o jogador não tenha participado e não tenha log
                    line += f"{credit_track[p.name]:<20}"
            report.append(line)

        report.append("\nAnálise de Decisões:")
        for p in self.players:
            solo = sum(1 for d in p.decision_history if d['decision'] == 'SOLO')
            coletiva = sum(1 for d in p.decision_history if d['decision'] == 'COLETIVA')
            skip = sum(1 for d in p.decision_history if d['decision'] == 'SKIP')
            freerides = sum(1 for d in p.decision_history if d['decision'] == 'COLETIVA' and not d['paid_cost'])
            report.append(f"- {p.name}: Solo({solo}), Coletiva({coletiva}), Hangar({skip}), Caronas({freerides})")
        
        return report

    def draw(self):
        screen.fill(BLACK)
        
        if self.game_state != "END_GAME":
            # Desenhar Status dos Jogadores
            for i, player in enumerate(self.players):
                status_text = f"{player.name} | Créditos: {player.credits} | Habilidade: {player.skill_level}"
                draw_text(screen, status_text, FONT_MEDIUM, WHITE, 20, 20 + i * 40)
            
            # Desenhar Missões
            draw_mission(self.missions['SOLO'], 150, 150)
            draw_mission(self.missions['COLETIVA'], 650, 150)
            
            # Desenhar turno e botões
            if self.game_state in ["DECISION", "COST"]:
                active_player = self.players[self.active_player_index]
                turn_text = f"Turno de: {active_player.name}"
                draw_text(screen, turn_text, FONT_TITLE, YELLOW, SCREEN_WIDTH // 2, 480, align="center")

                if self.game_state == "DECISION":
                    self.buttons['solo'].draw(screen)
                    self.buttons['coletiva'].draw(screen)
                    self.buttons['skip'].draw(screen)
                elif self.game_state == "COST":
                    self.buttons['pay_cost'].draw(screen)
                    self.buttons['freeride'].draw(screen)
        
        else: # Tela de Fim de Jogo
            report_lines = self.generate_report()
            for i, line in enumerate(report_lines):
                # Usar fonte monoespaçada para melhor alinhamento
                font = pygame.font.SysFont('consolas', 22)
                draw_text(screen, line, font, WHITE, 50, 50 + i * 30)


# --- Funções Auxiliares de Desenho ---

def draw_text(screen, text, font, color, x, y, align="left"):
    text_surface = font.render(text, True, color)
    text_rect = text_surface.get_rect()
    if align == "center":
        text_rect.center = (x, y)
    elif align == "right":
        text_rect.right = x
        text_rect.top = y
    else:
        text_rect.left = x
        text_rect.top = y
    screen.blit(text_surface, text_rect)

def draw_mission(mission, x, y):
    box = pygame.Rect(x, y, 400, 200)
    pygame.draw.rect(screen, GRAY, box, border_radius=10)
    pygame.draw.rect(screen, LIGHT_GRAY, box, width=2, border_radius=10)
    
    title = f"Missão {mission.type.capitalize()}"
    draw_text(screen, title, FONT_TITLE, BLUE, box.centerx, y + 30, align="center")
    
    draw_text(screen, f"Risco: {mission.risk}", FONT_MEDIUM, WHITE, x + 20, y + 80)
    draw_text(screen, f"Recompensa: {mission.reward} créditos", FONT_MEDIUM, GREEN, x + 20, y + 120)
    draw_text(screen, f"Custo: {mission.cost} créditos", FONT_MEDIUM, RED, x + 20, y + 160)


# --- Loop Principal do Jogo ---

def main():
    clock = pygame.time.Clock()
    game_manager = GameManager()
    running = True

    while running:
        mouse_pos = pygame.mouse.get_pos()
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            
            # Timer para avançar para a próxima rodada após a resolução
            if event.type == pygame.USEREVENT + 1:
                game_manager.new_round()
                pygame.time.set_timer(pygame.USEREVENT + 1, 0) # Desativa o timer

            game_manager.handle_input(event, mouse_pos)

        game_manager.draw()
        pygame.display.flip()
        clock.tick(60)

    pygame.quit()

if __name__ == '__main__':
    main()