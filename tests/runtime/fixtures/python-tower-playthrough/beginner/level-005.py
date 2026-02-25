class Player:
    last_health = None

    def play_turn(self, samurai):
        health = samurai.hp
        space = samurai.feel()
        if space.unit is not None and space.unit.kind == UnitKind.CAPTIVE:
            samurai.rescue()
        elif space.unit is not None and space.unit.kind == UnitKind.ENEMY:
            samurai.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            samurai.rest()
        else:
            samurai.walk()
        self.last_health = health
