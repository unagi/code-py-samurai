class Player:
    def play_turn(self, samurai):
        for d in ['forward', 'left', 'right', 'backward']:
            space = samurai.feel(d)
            if space is not None and space.is_enemy():
                samurai.attack(d)
                return
        if samurai.hp < 15:
            samurai.rest()
            return
        samurai.walk(samurai.direction_of_stairs())
