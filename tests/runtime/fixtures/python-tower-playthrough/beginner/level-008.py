class Player:
    def play_turn(self, samurai):
        fwd = samurai.feel()
        if fwd is not None and fwd.is_captive():
            samurai.rescue()
            return
        for space in samurai.look():
            if space is None:
                continue
            if space.is_enemy():
                samurai.shoot()
                return
            break
        samurai.walk()
