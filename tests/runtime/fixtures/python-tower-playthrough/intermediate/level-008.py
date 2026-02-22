class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        spaces = samurai.look()
        fwd = samurai.feel()
        units = samurai.listen()
        if len(spaces) >= 2:
            a = spaces[0]
            b = spaces[1]
            if a.unit is not None and b.unit is not None and a.unit.kind == UnitKind.ENEMY and b.unit.kind == UnitKind.ENEMY:
                samurai.detonate()
                return
        if fwd.unit is not None and fwd.unit.kind == UnitKind.ENEMY:
            samurai.attack()
            return
        if fwd.unit is not None and fwd.unit.kind == UnitKind.CAPTIVE:
            samurai.rescue()
            return
        has_ticking = False
        for target in units:
            if target.unit is not None and target.unit.kind == UnitKind.CAPTIVE and target.unit.ticking:
                has_ticking = True
                break
        if (not has_ticking) and health < 10:
            samurai.rest()
            return
        samurai.walk()
