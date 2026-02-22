class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        fwd = samurai.feel()
        if fwd is not None and fwd.is_wall() and not self.pivoted:
            samurai.pivot('backward')
            self.pivoted = True
        elif fwd is not None and fwd.is_enemy():
            samurai.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            samurai.rest()
        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd is None:
            samurai.walk('backward')
        else:
            samurai.walk()
        self.last_health = health
