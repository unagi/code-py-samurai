class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        for d in ['forward', 'left', 'right', 'backward']:
            space = samurai.feel(d)
            if space is not None and space.is_captive() and space.is_ticking():
                samurai.rescue(d)
                return
        ticking = None
        for unit in units:
            if unit.is_captive() and unit.is_ticking():
                ticking = unit
                break
        if ticking is not None:
            tick_dir = samurai.direction_of(ticking)
            blocker = samurai.feel(tick_dir)
            if blocker is not None and blocker.is_enemy():
                samurai.attack(tick_dir)
                return
            samurai.walk(tick_dir)
            return
        for d in ['forward', 'left', 'right', 'backward']:
            space = samurai.feel(d)
            if space is not None and space.is_enemy():
                samurai.attack(d)
                return
            if space is not None and space.is_captive():
                samurai.rescue(d)
                return
        if len(units) > 0:
            samurai.walk(samurai.direction_of(units[0]))
            return
        if health < 15:
            samurai.rest()
            return
        samurai.walk(samurai.direction_of_stairs())
