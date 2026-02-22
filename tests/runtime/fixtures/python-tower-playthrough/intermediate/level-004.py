class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        adjacent_enemies = []
        adjacent_captive = None
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                adjacent_enemies.append(d)
            elif space.unit is not None and space.unit.kind == UnitKind.CAPTIVE:
                adjacent_captive = d
        if len(adjacent_enemies) > 0:
            samurai.attack(adjacent_enemies[0])
            return
        if adjacent_captive is not None:
            samurai.rescue(adjacent_captive)
            return
        if health < 15:
            samurai.rest()
            return
        if len(units) > 0:
            samurai.walk(samurai.direction_of(units[0]))
            return
        samurai.walk(samurai.direction_of_stairs())
