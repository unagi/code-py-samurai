class Player:
    def play_turn(self, samurai):
        space = samurai.feel()
        if space.unit is None and space.terrain != Terrain.WALL:
            if samurai.hp < 20:
                samurai.rest()
            else:
                samurai.walk()
        elif space.unit is not None and space.unit.kind == UnitKind.ENEMY:
            samurai.attack()
        elif samurai.hp < 20:
            samurai.rest()
        else:
            samurai.walk()
