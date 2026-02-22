class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is not None and space.unit.kind == UnitKind.CAPTIVE and space.unit.ticking:
                samurai.rescue(d)
                return
        ticking = None
        for target in units:
            if target.unit is not None and target.unit.kind == UnitKind.CAPTIVE and target.unit.ticking:
                ticking = target
                break
        if ticking is not None:
            tick_dir = samurai.direction_of(ticking)
            blocker = samurai.feel(tick_dir)
            if blocker.unit is not None and blocker.unit.kind == UnitKind.ENEMY:
                samurai.attack(tick_dir)
                return
            samurai.walk(tick_dir)
            return
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                samurai.attack(d)
                return
            if space.unit is not None and space.unit.kind == UnitKind.CAPTIVE:
                samurai.rescue(d)
                return
        if len(units) > 0:
            samurai.walk(samurai.direction_of(units[0]))
            return
        if health < 15:
            samurai.rest()
            return
        samurai.walk(samurai.direction_of_stairs())
