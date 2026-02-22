class Player:
    def play_turn(self, samurai):
        samurai.walk(samurai.direction_of_stairs())
