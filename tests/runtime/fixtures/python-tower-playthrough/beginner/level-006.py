class Player:
    captive_rescued = False
    last_health = None

    def play_turn(self, samurai):
        health = samurai.hp
        fwd = samurai.feel()
        bwd = samurai.feel(Direction.BACKWARD)
        if not self.captive_rescued:
            if bwd.unit is not None and bwd.unit.kind == UnitKind.CAPTIVE:
                samurai.rescue(Direction.BACKWARD)
                self.captive_rescued = True
                self.last_health = health
                return
            elif bwd.terrain == Terrain.WALL:
                self.captive_rescued = True
            else:
                samurai.walk(Direction.BACKWARD)
                self.last_health = health
                return
        if fwd.unit is not None and fwd.unit.kind == UnitKind.ENEMY:
            samurai.attack()
        elif health < 20 and self.last_health is not None and health >= self.last_health:
            samurai.rest()
        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd.unit is None and fwd.terrain != Terrain.WALL:
            samurai.walk(Direction.BACKWARD)
        else:
            samurai.walk()
        self.last_health = health
