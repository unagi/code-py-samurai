class Player:
    def play_turn(self, samurai):
        space = samurai.feel()
        if space is None:
            samurai.walk()
        else:
            samurai.attack()
