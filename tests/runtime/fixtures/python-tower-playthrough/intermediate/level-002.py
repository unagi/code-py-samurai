class Player:
    def play_turn(self, samurai):
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is not None and space.unit.kind == UnitKind.ENEMY:
                samurai.attack(d)
                return
        if samurai.hp < 15:
            samurai.rest()
            return
        samurai.walk(samurai.direction_of_stairs())
