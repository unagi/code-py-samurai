class Player:
    def play_turn(self, warrior):
        space = warrior.feel()
        if space is None:
            if warrior.hp < 20:
                warrior.rest()
            else:
                warrior.walk()
        elif space.is_enemy():
            warrior.attack()
        elif warrior.hp < 20:
            warrior.rest()
        else:
            warrior.walk()
