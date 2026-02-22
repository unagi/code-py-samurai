class Player:
    def play_turn(self, samurai):
        enemies = []
        captive_dir = None
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                enemies.append(d)
            elif space.unit is not None and space.unit.kind == UnitKind.CAPTIVE:
                captive_dir = d
        if len(enemies) >= 2:
            samurai.bind(enemies[0])
            return
        if len(enemies) == 1:
            samurai.attack(enemies[0])
            return
        if captive_dir is not None:
            samurai.rescue(captive_dir)
            return
        samurai.walk(samurai.direction_of_stairs())
