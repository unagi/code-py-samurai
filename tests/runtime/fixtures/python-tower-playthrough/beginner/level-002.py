class Player:
    def play_turn(self, samurai):
        space = samurai.feel()
        if space.unit is None and space.terrain != Terrain.WALL:
            samurai.walk()
        else:
            samurai.attack()
