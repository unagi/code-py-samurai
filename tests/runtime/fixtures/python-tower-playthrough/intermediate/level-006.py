class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        units = warrior.listen()
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is not None and space.is_captive() and space.is_ticking():
                warrior.rescue(d)
                return
        ticking = None
        for unit in units:
            if unit.is_captive() and unit.is_ticking():
                ticking = unit
                break
        if ticking is not None:
            tick_dir = warrior.direction_of(ticking)
            blocker = warrior.feel(tick_dir)
            if blocker is not None and blocker.is_enemy():
                warrior.attack(tick_dir)
                return
            warrior.walk(tick_dir)
            return
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is not None and space.is_enemy():
                warrior.attack(d)
                return
            if space is not None and space.is_captive():
                warrior.rescue(d)
                return
        if len(units) > 0:
            warrior.walk(warrior.direction_of(units[0]))
            return
        if health < 15:
            warrior.rest()
            return
        warrior.walk(warrior.direction_of_stairs())
