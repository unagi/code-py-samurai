class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        fwd = samurai.feel()
        bwd = samurai.feel('backward')
        if not self.captive_rescued:
            if bwd is not None and bwd.is_captive():
                samurai.rescue('backward')
                self.captive_rescued = True
                self.last_health = health
                return
            elif bwd is not None and bwd.is_wall():
                self.captive_rescued = True
            else:
                samurai.walk('backward')
                self.last_health = health
                return
        if fwd is not None and fwd.is_enemy():
            samurai.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            samurai.rest()
        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd is None:
            samurai.walk('backward')
        else:
            samurai.walk()
        self.last_health = health
