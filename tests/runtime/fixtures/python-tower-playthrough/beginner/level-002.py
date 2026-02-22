class Player:
    def play_turn(self, warrior):
        space = warrior.feel()
        if space is None:
            warrior.walk()
        else:
            warrior.attack()
