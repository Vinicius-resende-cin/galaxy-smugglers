import pygame
import random
import json
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import matplotlib.pyplot as plt
import numpy as np

# Inicialização do Pygame
pygame.init()

# Configurações da tela
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 800
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Galaxy Smugglers - Contrabandistas da Galáxia")

# Cores
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
BLUE = (0, 100, 200)
GREEN = (0, 150, 0)
RED = (200, 0, 0)
YELLOW = (255, 200, 0)
PURPLE = (150, 0, 150)
GRAY = (128, 128, 128)
LIGHT_GRAY = (200, 200, 200)
DARK_BLUE = (0, 50, 100)

# Fontes
font_large = pygame.font.Font(None, 48)
font_medium = pygame.font.Font(None, 36)
font_small = pygame.font.Font(None, 24)

class Player:
    def __init__(self, name: str, skill_level: int, initial_credits: int):
        self.name = name
        self.skill_level = skill_level
        self.credits = initial_credits
        self.initial_credits = initial_credits
        self.credit_history = [initial_credits]
        self.decision_history = []
        self.missions_completed = 0
        self.missions_failed = 0
    
    def add_credits(self, amount: int):
        self.credits += amount
        self.credit_history.append(self.credits)
    
    def subtract_credits(self, amount: int):
        self.credits = max(0, self.credits - amount)
        self.credit_history.append(self.credits)

    def add_skill(self, amount: int):
        self.skill_level = max(1, self.skill_level + amount)

    def subtract_skill(self, amount: int):
        self.skill_level = max(1, self.skill_level - amount)
    
    def record_decision(self, decision: str, mission_round: int):
        self.decision_history.append({
            'round': mission_round,
            'decision': decision,
            'credits_before': self.credit_history[-2] if len(self.credit_history) > 1 else self.initial_credits
        })

class Mission:
    def __init__(self, name: str, risk_level: int, reward: int, fuel_cost: int):
        self.name = name
        self.risk_level = risk_level
        self.reward = reward
        self.fuel_cost = fuel_cost

class GameState:
    def __init__(self):
        self.players: List[Player] = []
        self.current_round = 0
        self.max_rounds = 10
        self.current_mission: Optional[Mission] = None
        self.game_phase = "setup"  # setup, mission_selection, results, game_over
        self.selected_players: List[Player] = []
        self.victory_condition = "credits"  # "credits" or "quota"
        self.victory_target = 100
        self.mission_results = []
        
    def generate_mission(self) -> Mission:
        # Verifica se pelo menos um jogador tem créditos suficientes para o custo de combustível
        # e se a soma das habilidades pode alcançar o nível de risco da missão
        if self.players:
            possible = False
            skill_possible = False

            attempts = 0
            while (not possible or not skill_possible) and attempts < 10:
                missions = self.__generate_mission_pool()
                shuffled_missions = random.sample(missions, len(missions))

                for name, risk, reward, fuel in shuffled_missions:
                    possible_players = filter(lambda player: player.credits >= fuel, self.players)
                    possible = len(list(possible_players)) > 0
                    skill_possible = sum(player.skill_level for player in possible_players) + 6 >= risk
                
            if not possible or not skill_possible:
                # Se ninguém pode pagar ou não é possível vencer, retorna a missão mesmo assim (o jogo não pode travar)
                pass

        return Mission(name, risk, reward, fuel)
    
    def __generate_mission_pool(self) -> List[Mission]:
        return [
            ("Transporte de Especiarias", random.randint(8, 12), random.randint(30, 50), random.randint(6, 10)),
            ("Contrabando de Armas", random.randint(10, 15), random.randint(40, 70), random.randint(8, 14)),
            ("Medicamentos Ilegais", random.randint(12, 18), random.randint(50, 80), random.randint(10, 16)),
            ("Dados Corporativos", random.randint(6, 10), random.randint(20, 40), random.randint(4, 8)),
            ("Refugiados Políticos", random.randint(14, 20), random.randint(60, 100), random.randint(12, 20))
        ]
    
    def execute_mission(self) -> Dict:
        if not self.selected_players or not self.current_mission:
            return {"success": False, "error": "No players selected or no mission"}
        
        # Calcular custos de combustível
        for player in self.selected_players:
            player.subtract_credits(self.current_mission.fuel_cost)
        
        # Rolar dado e calcular resultado
        dice_roll = random.randint(1, 6)
        total_skill = sum(player.skill_level for player in self.selected_players)
        total_result = dice_roll + total_skill
        
        success = total_result >= self.current_mission.risk_level
        
        result = {
            "success": success,
            "dice_roll": dice_roll,
            "total_skill": total_skill,
            "total_result": total_result,
            "risk_level": self.current_mission.risk_level,
            "participants": [p.name for p in self.selected_players],
            "mission_name": self.current_mission.name
        }
        
        if success:
            # Dividir recompensa igualmente
            reward_per_player = self.current_mission.reward // len(self.selected_players)
            for player in self.selected_players:
                player.add_credits(reward_per_player)
                player.add_skill(1)
                player.missions_completed += 1
            result["reward_per_player"] = reward_per_player
        else:
            # Todos perdem créditos com reparos
            repair_cost = random.randint(10, 25)
            for player in self.selected_players:
                player.subtract_credits(repair_cost)
                player.missions_failed += 1
            result["repair_cost"] = repair_cost
        
        # Registrar decisões
        decision = "comboio" if len(self.selected_players) > 1 else "solo"
        for player in self.selected_players:
            player.record_decision(decision, self.current_round)
        
        self.mission_results.append(result)
        return result
    
    def check_victory(self) -> Optional[List[Player]]:
        if self.victory_condition == "credits":
            winners = [p for p in self.players if p.credits >= self.victory_target]
            return winners if winners else None
        elif self.victory_condition == "quota":
            if self.current_round >= self.max_rounds:
                winners = [p for p in self.players if p.credits >= self.victory_target]
                return winners if winners else []
        return None
    
    def generate_report(self) -> Dict:
        report = {
            "game_summary": {
                "total_rounds": self.current_round,
                "victory_condition": self.victory_condition,
                "victory_target": self.victory_target,
                "timestamp": datetime.now().isoformat()
            },
            "players": [],
            "mission_results": self.mission_results
        }
        
        for player in self.players:
            solo_missions = sum(1 for decision in player.decision_history if decision['decision'] == 'solo')
            coop_missions = sum(1 for decision in player.decision_history if decision['decision'] == 'comboio')
            
            player_data = {
                "name": player.name,
                "initial_credits": player.initial_credits,
                "final_credits": player.credits,
                "credit_change": player.credits - player.initial_credits,
                "skill_level": player.skill_level,
                "missions_completed": player.missions_completed,
                "missions_failed": player.missions_failed,
                "solo_missions": solo_missions,
                "cooperative_missions": coop_missions,
                "credit_history": player.credit_history,
                "decision_history": player.decision_history
            }
            report["players"].append(player_data)
        
        return report
    
    def save_report(self, filename: str = None):
        if filename is None:
            filename = f"galaxy_smugglers_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = self.generate_report()
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return filename

class GameUI:
    def __init__(self, game_state: GameState):
        self.game_state = game_state
        self.selected_player_indices = []
        self.setup_players_count = 2
        self.setup_player_names = ["Jogador 1", "Jogador 2"]
        self.setup_player_skills = [3, 3]
        self.setup_player_credits = [50, 50]
        self.setup_victory_condition = "credits"
        self.setup_victory_target = 100
        self.setup_max_rounds = 10
        
    def draw_setup_screen(self):
        screen.fill(DARK_BLUE)
        
        # Título
        title = font_large.render("Galaxy Smugglers - Configuração", True, WHITE)
        screen.blit(title, (SCREEN_WIDTH//2 - title.get_width()//2, 50))
        
        y_pos = 150
        
        # Número de jogadores
        players_text = font_medium.render(f"Número de Jogadores: {self.setup_players_count}", True, WHITE)
        screen.blit(players_text, (50, y_pos))
        
        # Botões para ajustar número de jogadores
        plus_btn = pygame.Rect(400, y_pos, 30, 30)
        minus_btn = pygame.Rect(350, y_pos, 30, 30)
        pygame.draw.rect(screen, GREEN, plus_btn)
        pygame.draw.rect(screen, RED, minus_btn)
        screen.blit(font_small.render("+", True, WHITE), (plus_btn.x + 10, plus_btn.y + 5))
        screen.blit(font_small.render("-", True, WHITE), (minus_btn.x + 10, minus_btn.y + 5))
        
        y_pos += 80
        
        # Configurações dos jogadores
        for i in range(self.setup_players_count):
            player_text = font_small.render(f"Jogador {i+1}:", True, WHITE)
            screen.blit(player_text, (50, y_pos))
            
            # Nome (simplificado para este protótipo)
            name_text = font_small.render(f"Nome: {self.setup_player_names[i]}", True, WHITE)
            screen.blit(name_text, (200, y_pos))
            
            # Habilidade
            skill_text = font_small.render(f"Habilidade: {self.setup_player_skills[i]}", True, WHITE)
            screen.blit(skill_text, (400, y_pos))
            
            skill_plus = pygame.Rect(550, y_pos, 25, 25)
            skill_minus = pygame.Rect(520, y_pos, 25, 25)
            pygame.draw.rect(screen, GREEN, skill_plus)
            pygame.draw.rect(screen, RED, skill_minus)
            screen.blit(font_small.render("+", True, WHITE), (skill_plus.x + 8, skill_plus.y + 3))
            screen.blit(font_small.render("-", True, WHITE), (skill_minus.x + 8, skill_minus.y + 3))
            
            # Créditos iniciais
            credits_text = font_small.render(f"Créditos: {self.setup_player_credits[i]}", True, WHITE)
            screen.blit(credits_text, (600, y_pos))
            
            credits_plus = pygame.Rect(750, y_pos, 25, 25)
            credits_minus = pygame.Rect(720, y_pos, 25, 25)
            pygame.draw.rect(screen, GREEN, credits_plus)
            pygame.draw.rect(screen, RED, credits_minus)
            screen.blit(font_small.render("+", True, WHITE), (credits_plus.x + 8, credits_plus.y + 3))
            screen.blit(font_small.render("-", True, WHITE), (credits_minus.x + 8, credits_minus.y + 3))
            
            y_pos += 40
        
        y_pos += 40
        
        # Condição de vitória
        victory_text = font_medium.render(f"Condição de Vitória: {self.setup_victory_condition}", True, WHITE)
        screen.blit(victory_text, (50, y_pos))
        
        victory_btn = pygame.Rect(400, y_pos, 150, 35)
        pygame.draw.rect(screen, PURPLE, victory_btn)
        btn_text = "Alternar" if self.setup_victory_condition == "credits" else "Alternar"
        screen.blit(font_small.render("Alternar", True, WHITE), (victory_btn.x + 45, victory_btn.y + 8))
        
        y_pos += 50
        
        # Meta de vitória
        target_text = font_medium.render(f"Meta: {self.setup_victory_target} créditos", True, WHITE)
        screen.blit(target_text, (50, y_pos))
        
        target_plus = pygame.Rect(350, y_pos, 30, 30)
        target_minus = pygame.Rect(310, y_pos, 30, 30)
        pygame.draw.rect(screen, GREEN, target_plus)
        pygame.draw.rect(screen, RED, target_minus)
        screen.blit(font_small.render("+", True, WHITE), (target_plus.x + 10, target_plus.y + 5))
        screen.blit(font_small.render("-", True, WHITE), (target_minus.x + 10, target_minus.y + 5))
        
        y_pos += 80
        
        # Botão iniciar jogo
        start_btn = pygame.Rect(SCREEN_WIDTH//2 - 100, y_pos, 200, 50)
        pygame.draw.rect(screen, GREEN, start_btn)
        start_text = font_medium.render("Iniciar Jogo", True, WHITE)
        screen.blit(start_text, (start_btn.x + 40, start_btn.y + 10))
        
        return {
            'plus_players': plus_btn,
            'minus_players': minus_btn,
            'victory_toggle': victory_btn,
            'target_plus': target_plus,
            'target_minus': target_minus,
            'start_game': start_btn,
            'skill_buttons': [(pygame.Rect(520, 230 + i*40, 25, 25), pygame.Rect(550, 230 + i*40, 25, 25), i) for i in range(self.setup_players_count)],
            'credit_buttons': [(pygame.Rect(720, 230 + i*40, 25, 25), pygame.Rect(750, 230 + i*40, 25, 25), i) for i in range(self.setup_players_count)]
        }
    
    def draw_mission_screen(self):
        screen.fill(BLACK)
        
        # Título
        title = font_large.render(f"Rodada {self.game_state.current_round + 1}", True, WHITE)
        screen.blit(title, (SCREEN_WIDTH//2 - title.get_width()//2, 30))
        
        # Informações da missão
        if self.game_state.current_mission:
            mission = self.game_state.current_mission
            
            mission_title = font_medium.render(f"Missão: {mission.name}", True, YELLOW)
            screen.blit(mission_title, (50, 100))
            
            risk_text = font_small.render(f"Nível de Risco: {mission.risk_level}", True, RED)
            screen.blit(risk_text, (50, 140))
            
            reward_text = font_small.render(f"Recompensa: {mission.reward} créditos", True, GREEN)
            screen.blit(reward_text, (50, 170))
            
            fuel_text = font_small.render(f"Custo de Combustível: {mission.fuel_cost} créditos", True, YELLOW)
            screen.blit(fuel_text, (50, 200))
        
        # Status dos jogadores
        y_pos = 260
        player_buttons = []
        
        for i, player in enumerate(self.game_state.players):
            color = GREEN if i in self.selected_player_indices else GRAY
            player_rect = pygame.Rect(50, y_pos, 400, 60)
            pygame.draw.rect(screen, color, player_rect)
            pygame.draw.rect(screen, WHITE, player_rect, 2)
            
            player_text = font_small.render(f"{player.name} - Habilidade: {player.skill_level}", True, WHITE)
            screen.blit(player_text, (player_rect.x + 10, player_rect.y + 10))
            
            credits_text = font_small.render(f"Créditos: {player.credits}", True, WHITE)
            screen.blit(credits_text, (player_rect.x + 10, player_rect.y + 30))
            
            player_buttons.append((player_rect, i))
            y_pos += 70
        
        # Jogadores selecionados
        if self.selected_player_indices:
            selected_text = font_small.render("Jogadores Selecionados:", True, WHITE)
            screen.blit(selected_text, (500, 260))
            
            y_pos = 290
            for idx in self.selected_player_indices:
                player = self.game_state.players[idx]
                name_text = font_small.render(f"• {player.name}", True, GREEN)
                screen.blit(name_text, (500, y_pos))
                y_pos += 25
            
            # Previsão de resultado
            total_skill = sum(self.game_state.players[i].skill_level for i in self.selected_player_indices)
            preview_text = font_small.render(f"Habilidade Total: {total_skill}", True, WHITE)
            screen.blit(preview_text, (500, y_pos + 20))
            
            chance_text = font_small.render(f"Chance de Sucesso: ~{min(100, max(0, (total_skill + 3.5 - self.game_state.current_mission.risk_level) * 16.67)):.0f}%", True, WHITE)
            screen.blit(chance_text, (500, y_pos + 45))
        
        # Botões de ação
        execute_btn = pygame.Rect(SCREEN_WIDTH//2 - 100, SCREEN_HEIGHT - 100, 200, 50)
        color = GREEN if self.selected_player_indices else GRAY
        pygame.draw.rect(screen, color, execute_btn)
        
        execute_text = font_medium.render("Executar Missão", True, WHITE)
        screen.blit(execute_text, (execute_btn.x + 25, execute_btn.y + 10))
        
        return {
            'player_buttons': player_buttons,
            'execute_mission': execute_btn if self.selected_player_indices else None
        }
    
    def draw_results_screen(self, mission_result):
        screen.fill(BLACK)
        
        # Título
        result_color = GREEN if mission_result["success"] else RED
        title = font_large.render("Resultado da Missão", True, result_color)
        screen.blit(title, (SCREEN_WIDTH//2 - title.get_width()//2, 50))
        
        y_pos = 150
        
        # Detalhes da missão
        mission_text = font_medium.render(f"Missão: {mission_result['mission_name']}", True, WHITE)
        screen.blit(mission_text, (50, y_pos))
        y_pos += 40
        
        participants_text = font_small.render(f"Participantes: {', '.join(mission_result['participants'])}", True, WHITE)
        screen.blit(participants_text, (50, y_pos))
        y_pos += 30
        
        dice_text = font_small.render(f"Resultado do Dado: {mission_result['dice_roll']}", True, WHITE)
        screen.blit(dice_text, (50, y_pos))
        y_pos += 30
        
        skill_text = font_small.render(f"Habilidade Total: {mission_result['total_skill']}", True, WHITE)
        screen.blit(skill_text, (50, y_pos))
        y_pos += 30
        
        total_text = font_small.render(f"Resultado Total: {mission_result['total_result']}", True, WHITE)
        screen.blit(total_text, (50, y_pos))
        y_pos += 30
        
        risk_text = font_small.render(f"Risco da Missão: {mission_result['risk_level']}", True, WHITE)
        screen.blit(risk_text, (50, y_pos))
        y_pos += 50
        
        # Resultado
        if mission_result["success"]:
            success_text = font_medium.render("SUCESSO!", True, GREEN)
            screen.blit(success_text, (50, y_pos))
            y_pos += 40
            
            reward_text = font_small.render(f"Recompensa por jogador: {mission_result['reward_per_player']} créditos", True, GREEN)
            screen.blit(reward_text, (50, y_pos))
        else:
            failure_text = font_medium.render("FRACASSO!", True, RED)
            screen.blit(failure_text, (50, y_pos))
            y_pos += 40
            
            repair_text = font_small.render(f"Custo de reparo por jogador: {mission_result['repair_cost']} créditos", True, RED)
            screen.blit(repair_text, (50, y_pos))
        
        y_pos += 80
        
        # Status atual dos jogadores
        status_text = font_medium.render("Status dos Jogadores:", True, WHITE)
        screen.blit(status_text, (50, y_pos))
        y_pos += 40
        
        for player in self.game_state.players:
            player_status = font_small.render(f"{player.name}: {player.credits} créditos", True, WHITE)
            screen.blit(player_status, (50, y_pos))
            y_pos += 25
        
        # Botão continuar
        continue_btn = pygame.Rect(SCREEN_WIDTH//2 - 100, SCREEN_HEIGHT - 100, 200, 50)
        pygame.draw.rect(screen, BLUE, continue_btn)
        
        continue_text = font_medium.render("Continuar", True, WHITE)
        screen.blit(continue_text, (continue_btn.x + 60, continue_btn.y + 10))
        
        return {'continue': continue_btn}
    
    def draw_game_over_screen(self, winners):
        screen.fill(BLACK)
        
        # Título
        title = font_large.render("Fim de Jogo!", True, YELLOW)
        screen.blit(title, (SCREEN_WIDTH//2 - title.get_width()//2, 50))
        
        y_pos = 150
        
        # Vencedores
        if winners:
            winners_text = font_medium.render("Vencedores:", True, GREEN)
            screen.blit(winners_text, (50, y_pos))
            y_pos += 40
            
            for winner in winners:
                winner_text = font_small.render(f"🏆 {winner.name} - {winner.credits} créditos", True, GREEN)
                screen.blit(winner_text, (50, y_pos))
                y_pos += 30
        else:
            no_winner_text = font_medium.render("Nenhum jogador atingiu a meta!", True, RED)
            screen.blit(no_winner_text, (50, y_pos))
            y_pos += 40
        
        y_pos += 30
        
        # Classificação final
        ranking_text = font_medium.render("Classificação Final:", True, WHITE)
        screen.blit(ranking_text, (50, y_pos))
        y_pos += 40
        
        sorted_players = sorted(self.game_state.players, key=lambda p: p.credits, reverse=True)
        for i, player in enumerate(sorted_players):
            rank_text = font_small.render(f"{i+1}º {player.name}: {player.credits} créditos", True, WHITE)
            screen.blit(rank_text, (50, y_pos))
            y_pos += 25
        
        # Botões
        y_pos += 50
        
        report_btn = pygame.Rect(SCREEN_WIDTH//2 - 250, y_pos, 200, 50)
        pygame.draw.rect(screen, PURPLE, report_btn)
        report_text = font_medium.render("Gerar Relatório", True, WHITE)
        screen.blit(report_text, (report_btn.x + 30, report_btn.y + 10))
        
        new_game_btn = pygame.Rect(SCREEN_WIDTH//2 + 50, y_pos, 200, 50)
        pygame.draw.rect(screen, GREEN, new_game_btn)
        new_game_text = font_medium.render("Novo Jogo", True, WHITE)
        screen.blit(new_game_text, (new_game_btn.x + 50, new_game_btn.y + 10))
        
        return {
            'generate_report': report_btn,
            'new_game': new_game_btn
        }

def main():
    clock = pygame.time.Clock()
    game_state = GameState()
    ui = GameUI(game_state)
    running = True
    current_result = None
    
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            
            elif event.type == pygame.MOUSEBUTTONDOWN:
                mouse_pos = event.pos
                
                if game_state.game_phase == "setup":
                    buttons = ui.draw_setup_screen()
                    
                    if buttons['plus_players'].collidepoint(mouse_pos) and ui.setup_players_count < 6:
                        ui.setup_players_count += 1
                        ui.setup_player_names.append(f"Jogador {ui.setup_players_count}")
                        ui.setup_player_skills.append(3)
                        ui.setup_player_credits.append(50)
                    
                    elif buttons['minus_players'].collidepoint(mouse_pos) and ui.setup_players_count > 2:
                        ui.setup_players_count -= 1
                        ui.setup_player_names.pop()
                        ui.setup_player_skills.pop()
                        ui.setup_player_credits.pop()
                    
                    elif buttons['victory_toggle'].collidepoint(mouse_pos):
                        ui.setup_victory_condition = "quota" if ui.setup_victory_condition == "credits" else "credits"
                    
                    elif buttons['target_plus'].collidepoint(mouse_pos):
                        ui.setup_victory_target += 10
                    
                    elif buttons['target_minus'].collidepoint(mouse_pos) and ui.setup_victory_target > 20:
                        ui.setup_victory_target -= 10
                    
                    elif buttons['start_game'].collidepoint(mouse_pos):
                        # Inicializar jogadores
                        game_state.players = []
                        for i in range(ui.setup_players_count):
                            player = Player(ui.setup_player_names[i], ui.setup_player_skills[i], ui.setup_player_credits[i])
                            game_state.players.append(player)
                        
                        game_state.victory_condition = ui.setup_victory_condition
                        game_state.victory_target = ui.setup_victory_target
                        game_state.max_rounds = ui.setup_max_rounds
                        game_state.current_mission = game_state.generate_mission()
                        game_state.game_phase = "mission_selection"
                    
                    # Botões de habilidade
                    for minus_btn, plus_btn, idx in buttons['skill_buttons']:
                        if minus_btn.collidepoint(mouse_pos) and ui.setup_player_skills[idx] > 1:
                            ui.setup_player_skills[idx] -= 1
                        elif plus_btn.collidepoint(mouse_pos) and ui.setup_player_skills[idx] < 10:
                            ui.setup_player_skills[idx] += 1
                    
                    # Botões de créditos
                    for minus_btn, plus_btn, idx in buttons['credit_buttons']:
                        if minus_btn.collidepoint(mouse_pos) and ui.setup_player_credits[idx] > 10:
                            ui.setup_player_credits[idx] -= 10
                        elif plus_btn.collidepoint(mouse_pos):
                            ui.setup_player_credits[idx] += 10
                
                elif game_state.game_phase == "mission_selection":
                    buttons = ui.draw_mission_screen()
                    
                    # Seleção de jogadores
                    for player_rect, player_idx in buttons['player_buttons']:
                        if player_rect.collidepoint(mouse_pos):
                            if player_idx in ui.selected_player_indices:
                                ui.selected_player_indices.remove(player_idx)
                            else:
                                # Verificar se o jogador tem créditos suficientes
                                player = game_state.players[player_idx]
                                if player.credits >= game_state.current_mission.fuel_cost:
                                    ui.selected_player_indices.append(player_idx)
                    
                    # Executar missão
                    if buttons['execute_mission'] and buttons['execute_mission'].collidepoint(mouse_pos):
                        game_state.selected_players = [game_state.players[i] for i in ui.selected_player_indices]
                        current_result = game_state.execute_mission()
                        game_state.game_phase = "results"
                
                elif game_state.game_phase == "results":
                    buttons = ui.draw_results_screen(current_result)
                    
                    if buttons['continue'].collidepoint(mouse_pos):
                        # Verificar condição de vitória
                        winners = game_state.check_victory()
                        if winners is not None:
                            game_state.game_phase = "game_over"
                        else:
                            # Próxima rodada
                            game_state.current_round += 1
                            if game_state.current_round >= game_state.max_rounds:
                                game_state.game_phase = "game_over"
                            else:
                                game_state.current_mission = game_state.generate_mission()
                                ui.selected_player_indices = []
                                game_state.game_phase = "mission_selection"
                
                elif game_state.game_phase == "game_over":
                    winners = game_state.check_victory()
                    buttons = ui.draw_game_over_screen(winners)
                    
                    if buttons['generate_report'].collidepoint(mouse_pos):
                        filename = game_state.save_report()
                        print(f"Relatório salvo em: {filename}")
                    
                    elif buttons['new_game'].collidepoint(mouse_pos):
                        game_state = GameState()
                        ui = GameUI(game_state)
                        current_result = None
        
        # Desenhar tela atual
        if game_state.game_phase == "setup":
            ui.draw_setup_screen()
        elif game_state.game_phase == "mission_selection":
            ui.draw_mission_screen()
        elif game_state.game_phase == "results":
            ui.draw_results_screen(current_result)
        elif game_state.game_phase == "game_over":
            winners = game_state.check_victory()
            ui.draw_game_over_screen(winners)
        
        pygame.display.flip()
        clock.tick(60)
    
    pygame.quit()

if __name__ == "__main__":
    main() 