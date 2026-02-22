class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        fwd = warrior.feel()
        bwd = warrior.feel('backward')
        if not self.captive_rescued:
            if bwd is not None and bwd.is_captive():
                warrior.rescue('backward')
                self.captive_rescued = True
                self.last_health = health
                return
            elif bwd is not None and bwd.is_wall():
                self.captive_rescued = True
            else:
                warrior.walk('backward')
                self.last_health = health
                return
        if fwd is not None and fwd.is_enemy():
            warrior.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            warrior.rest()
        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd is None:
            warrior.walk('backward')
        else:
            warrior.walk()
        self.last_health = health
