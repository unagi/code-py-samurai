class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        space = warrior.feel()
        if space is not None and space.is_captive():
            warrior.rescue()
        elif space is not None and space.is_enemy():
            warrior.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            warrior.rest()
        else:
            warrior.walk()
        self.last_health = health
