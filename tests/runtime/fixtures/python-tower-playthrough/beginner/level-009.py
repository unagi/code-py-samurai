class Player:
    def play_turn(self, warrior):
        fwd = warrior.feel()
        if not self.pivoted:
            warrior.pivot('backward')
            self.pivoted = True
            return
        for space in warrior.look():
            if space is None:
                continue
            if space.is_enemy():
                warrior.shoot()
                return
            break
        if fwd is not None and fwd.is_captive():
            warrior.rescue()
        elif fwd is not None and fwd.is_enemy():
            warrior.attack()
        else:
            warrior.walk()
