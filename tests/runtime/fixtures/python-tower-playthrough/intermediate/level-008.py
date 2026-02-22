class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        spaces = samurai.look()
        fwd = samurai.feel()
        units = samurai.listen()
        if len(spaces) >= 2:
            a = spaces[0]
            b = spaces[1]
            if a is not None and b is not None and a.is_enemy() and b.is_enemy():
                samurai.detonate()
                return
        if fwd is not None and fwd.is_enemy():
            samurai.attack()
            return
        if fwd is not None and fwd.is_captive():
            samurai.rescue()
            return
        has_ticking = False
        for unit in units:
            if unit.is_captive() and unit.is_ticking():
                has_ticking = True
                break
        if (not has_ticking) and health < 10:
            samurai.rest()
            return
        samurai.walk()
