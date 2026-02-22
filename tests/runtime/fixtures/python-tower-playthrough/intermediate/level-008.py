class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        spaces = warrior.look()
        fwd = warrior.feel()
        units = warrior.listen()
        if len(spaces) >= 2:
            a = spaces[0]
            b = spaces[1]
            if a is not None and b is not None and a.is_enemy() and b.is_enemy():
                warrior.detonate()
                return
        if fwd is not None and fwd.is_enemy():
            warrior.attack()
            return
        if fwd is not None and fwd.is_captive():
            warrior.rescue()
            return
        has_ticking = False
        for unit in units:
            if unit.is_captive() and unit.is_ticking():
                has_ticking = True
                break
        if (not has_ticking) and health < 10:
            warrior.rest()
            return
        warrior.walk()
