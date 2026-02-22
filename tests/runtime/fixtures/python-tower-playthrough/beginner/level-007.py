class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        fwd = warrior.feel()
        if fwd is not None and fwd.is_wall() and not self.pivoted:
            warrior.pivot('backward')
            self.pivoted = True
        elif fwd is not None and fwd.is_enemy():
            warrior.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            warrior.rest()
        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd is None:
            warrior.walk('backward')
        else:
            warrior.walk()
        self.last_health = health
