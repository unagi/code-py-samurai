class Player:
    def play_turn(self, samurai):
        space = samurai.feel()
        if space is None:
            if samurai.hp < 20:
                samurai.rest()
            else:
                samurai.walk()
        elif space.is_enemy():
            samurai.attack()
        elif samurai.hp < 20:
            samurai.rest()
        else:
            samurai.walk()
