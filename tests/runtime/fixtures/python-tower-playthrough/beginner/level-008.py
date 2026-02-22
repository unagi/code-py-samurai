class Player:
    def play_turn(self, warrior):
        fwd = warrior.feel()
        if fwd is not None and fwd.is_captive():
            warrior.rescue()
            return
        for space in warrior.look():
            if space is None:
                continue
            if space.is_enemy():
                warrior.shoot()
                return
            break
        warrior.walk()
