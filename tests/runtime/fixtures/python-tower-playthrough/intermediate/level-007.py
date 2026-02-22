class Player:
    def play_turn(self, samurai):
        dirs = ['forward', 'left', 'right', 'backward']
        units = samurai.listen()
        ticking_dir = None
        adjacent_enemies = []
        captive_dir = None
        for d in dirs:
            space = samurai.feel(d)
            if space is None:
                continue
            if space.is_captive() and space.is_ticking():
                ticking_dir = d
            elif space.is_enemy():
                adjacent_enemies.append(d)
            elif space.is_captive() and captive_dir is None:
                captive_dir = d
        if ticking_dir is not None:
            samurai.rescue(ticking_dir)
            return
        ticking = None
        for unit in units:
            if unit.is_captive() and unit.is_ticking():
                ticking = unit
                break
        if ticking is not None:
            tick_dir = samurai.direction_of(ticking)
            space_in_dir = samurai.feel(tick_dir)
            if space_in_dir is not None and space_in_dir.is_enemy():
                if len(adjacent_enemies) >= 2:
                    for d in adjacent_enemies:
                        if d != tick_dir:
                            samurai.bind(d)
                            return
                samurai.attack(tick_dir)
                return
            samurai.walk(tick_dir)
            return
        if captive_dir is not None:
            samurai.rescue(captive_dir)
            return
        if len(adjacent_enemies) > 0:
            samurai.attack(adjacent_enemies[0])
            return
        if len(units) > 0:
            samurai.walk(samurai.direction_of(units[0]))
            return
        samurai.walk(samurai.direction_of_stairs())
