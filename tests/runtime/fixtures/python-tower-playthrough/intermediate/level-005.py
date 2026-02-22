class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                samurai.attack(d)
                return
            if space.unit is not None and space.unit.kind == UnitKind.CAPTIVE:
                samurai.rescue(d)
                return
        for target in units:
            if target.unit is not None and (target.unit.kind == UnitKind.ENEMY or target.unit.kind == UnitKind.CAPTIVE):
                samurai.walk(samurai.direction_of(target))
                return
        if health < 15:
            samurai.rest()
            return
        samurai.walk(samurai.direction_of_stairs())
