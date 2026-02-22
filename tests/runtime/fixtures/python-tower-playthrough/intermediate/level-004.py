class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        units = warrior.listen()
        adjacent_enemies = []
        adjacent_captive = None
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is not None and space.is_enemy():
                adjacent_enemies.append(d)
            elif space is not None and space.is_captive():
                adjacent_captive = d
        if len(adjacent_enemies) > 0:
            warrior.attack(adjacent_enemies[0])
            return
        if adjacent_captive is not None:
            warrior.rescue(adjacent_captive)
            return
        if health < 15:
            warrior.rest()
            return
        if len(units) > 0:
            warrior.walk(warrior.direction_of(units[0]))
            return
        warrior.walk(warrior.direction_of_stairs())
