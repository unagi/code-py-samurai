class Player:
    pivoted = False

    def play_turn(self, samurai):
        fwd = samurai.feel()
        if not self.pivoted:
            samurai.pivot()
            self.pivoted = True
            return
        for space in samurai.look():
            if space.unit is None and space.terrain != Terrain.WALL:
                continue
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                samurai.shoot()
                return
            break
        if fwd.unit is not None and fwd.unit.kind == UnitKind.CAPTIVE:
            samurai.rescue()
        elif fwd.unit is not None and fwd.unit.kind == UnitKind.ENEMY:
            samurai.attack()
        else:
            samurai.walk()
