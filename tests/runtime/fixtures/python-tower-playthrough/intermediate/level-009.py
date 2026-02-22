class Player:
    def _scan_adjacent(self, warrior):
        enemies = []
        bound_dirs = []
        ticking_captive_dir = None
        non_ticking_captive_dir = None
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is None:
                continue
            if space.is_enemy():
                enemies.append(d)
            elif space.is_captive() and space.is_ticking():
                ticking_captive_dir = d
            elif space.is_captive():
                if non_ticking_captive_dir is None:
                    non_ticking_captive_dir = d
                bound_dirs.append(d)
        return enemies, bound_dirs, ticking_captive_dir, non_ticking_captive_dir

    def _walk_toward(self, warrior, target):
        warrior.walk(warrior.direction_of(target))

    def _rush_toward_ticking(self, warrior, target, health):
        dist = warrior.distance_of(target)
        if health < 5 and dist > 2:
            warrior.rest()
            return
        d = warrior.direction_of(target)
        space = warrior.feel(d)
        if space is None or space.is_stairs():
            warrior.walk(d)
            return
        for alt in ['forward', 'left', 'right', 'backward']:
            s = warrior.feel(alt)
            if s is None:
                warrior.walk(alt)
                return
        warrior.rest()

    def play_turn(self, warrior):
        health = warrior.hp
        units = warrior.listen()
        enemies, bound_dirs, ticking_dir, non_ticking_dir = self._scan_adjacent(warrior)
        if ticking_dir is not None:
            warrior.rescue(ticking_dir)
            return
        if len(enemies) >= 2:
            warrior.bind(enemies[0])
            return
        if len(enemies) == 1:
            if len(bound_dirs) > 0:
                warrior.bind(enemies[0])
            else:
                warrior.attack(enemies[0])
            return
        if len(bound_dirs) > 0:
            warrior.rescue(bound_dirs[0])
            return
        ticking = None
        for unit in units:
            if unit.is_captive() and unit.is_ticking():
                ticking = unit
                break
        if ticking is not None:
            self._rush_toward_ticking(warrior, ticking, health)
            return
        if health < 10:
            warrior.rest()
            return
        if non_ticking_dir is not None:
            warrior.rescue(non_ticking_dir)
            return
        captive = None
        for unit in units:
            if unit.is_captive():
                captive = unit
                break
        if captive is not None:
            self._walk_toward(warrior, captive)
            return
        enemy = None
        for unit in units:
            if unit.is_enemy():
                enemy = unit
                break
        if enemy is not None:
            self._walk_toward(warrior, enemy)
            return
        warrior.walk(warrior.direction_of_stairs())
