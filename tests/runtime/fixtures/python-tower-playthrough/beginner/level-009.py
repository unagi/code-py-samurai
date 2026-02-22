class Player:
    def play_turn(self, samurai):
        fwd = samurai.feel()
        if not self.pivoted:
            samurai.pivot('backward')
            self.pivoted = True
            return
        for space in samurai.look():
            if space is None:
                continue
            if space.is_enemy():
                samurai.shoot()
                return
            break
        if fwd is not None and fwd.is_captive():
            samurai.rescue()
        elif fwd is not None and fwd.is_enemy():
            samurai.attack()
        else:
            samurai.walk()
