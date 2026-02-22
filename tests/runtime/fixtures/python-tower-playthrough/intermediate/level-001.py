class Player:
    def play_turn(self, warrior):
        warrior.walk(warrior.direction_of_stairs())
