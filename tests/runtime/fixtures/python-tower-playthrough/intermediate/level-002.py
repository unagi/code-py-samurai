class Player:
    def play_turn(self, warrior):
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is not None and space.is_enemy():
                warrior.attack(d)
                return
        if warrior.hp < 15:
            warrior.rest()
            return
        warrior.walk(warrior.direction_of_stairs())
