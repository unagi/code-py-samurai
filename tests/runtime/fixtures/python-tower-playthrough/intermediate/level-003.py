class Player:
    def play_turn(self, samurai):
        enemies = []
        captive_dir = None
        for d in ['forward', 'left', 'right', 'backward']:
            space = samurai.feel(d)
            if space is not None and space.is_enemy():
                enemies.append(d)
            elif space is not None and space.is_captive():
                captive_dir = d
        if len(enemies) >= 2:
            samurai.bind(enemies[0])
            return
        if len(enemies) == 1:
            samurai.attack(enemies[0])
            return
        if captive_dir is not None:
            samurai.rescue(captive_dir)
            return
        samurai.walk(samurai.direction_of_stairs())
