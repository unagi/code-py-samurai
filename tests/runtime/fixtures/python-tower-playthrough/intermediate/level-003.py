class Player:
    def play_turn(self, warrior):
        enemies = []
        captive_dir = None
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is not None and space.is_enemy():
                enemies.append(d)
            elif space is not None and space.is_captive():
                captive_dir = d
        if len(enemies) >= 2:
            warrior.bind(enemies[0])
            return
        if len(enemies) == 1:
            warrior.attack(enemies[0])
            return
        if captive_dir is not None:
            warrior.rescue(captive_dir)
            return
        warrior.walk(warrior.direction_of_stairs())
