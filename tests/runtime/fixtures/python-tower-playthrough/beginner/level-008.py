class Player:
    def play_turn(self, samurai):
        fwd = samurai.feel()
        if fwd.unit is not None and fwd.unit.kind == UnitKind.CAPTIVE:
            samurai.rescue()
            return
        for space in samurai.look():
            if space.unit is None and space.terrain != Terrain.WALL:
                continue
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                samurai.shoot()
                return
            break
        samurai.walk()
