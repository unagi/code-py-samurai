class Player:
    def _scan_adjacent(self, samurai):
        enemies = []
        bound_dirs = []
        ticking_captive_dir = None
        non_ticking_captive_dir = None
        for d in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            space = samurai.feel(d)
            if space.unit is None:
                continue
            if space.unit.kind == UnitKind.ENEMY:
                enemies.append(d)
            elif space.unit.kind == UnitKind.CAPTIVE and space.unit.ticking:
                ticking_captive_dir = d
            elif space.unit.kind == UnitKind.CAPTIVE:
                if non_ticking_captive_dir is None:
                    non_ticking_captive_dir = d
                bound_dirs.append(d)
        return enemies, bound_dirs, ticking_captive_dir, non_ticking_captive_dir

    def _walk_toward(self, samurai, target):
        samurai.walk(samurai.direction_of(target))

    def _rush_toward_ticking(self, samurai, target, health):
        dist = samurai.distance_of(target)
        if health < 5 and dist > 2:
            samurai.rest()
            return
        d = samurai.direction_of(target)
        space = samurai.feel(d)
        if (space.unit is None and space.terrain == Terrain.FLOOR) or space.terrain == Terrain.STAIRS:
            samurai.walk(d)
            return
        for alt in [Direction.FORWARD, Direction.LEFT, Direction.RIGHT, Direction.BACKWARD]:
            s = samurai.feel(alt)
            if s.unit is None and s.terrain != Terrain.WALL:
                samurai.walk(alt)
                return
        samurai.rest()

    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        enemies, bound_dirs, ticking_dir, non_ticking_dir = self._scan_adjacent(samurai)
        if ticking_dir is not None:
            samurai.rescue(ticking_dir)
            return
        if len(enemies) >= 2:
            samurai.bind(enemies[0])
            return
        if len(enemies) == 1:
            if len(bound_dirs) > 0:
                samurai.bind(enemies[0])
            else:
                samurai.attack(enemies[0])
            return
        if len(bound_dirs) > 0:
            samurai.rescue(bound_dirs[0])
            return
        ticking = None
        for target in units:
            if target.unit is not None and target.unit.kind == UnitKind.CAPTIVE and target.unit.ticking:
                ticking = target
                break
        if ticking is not None:
            self._rush_toward_ticking(samurai, ticking, health)
            return
        if health < 10:
            samurai.rest()
            return
        if non_ticking_dir is not None:
            samurai.rescue(non_ticking_dir)
            return
        captive = None
        for target in units:
            if target.unit is not None and target.unit.kind == UnitKind.CAPTIVE:
                captive = target
                break
        if captive is not None:
            self._walk_toward(samurai, captive)
            return
        enemy = None
        for target in units:
            if target.unit is not None and target.unit.kind == UnitKind.ENEMY:
                enemy = target
                break
        if enemy is not None:
            self._walk_toward(samurai, enemy)
            return
        samurai.walk(samurai.direction_of_stairs())
