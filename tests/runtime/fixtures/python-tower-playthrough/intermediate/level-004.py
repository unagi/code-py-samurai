class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        adjacent_enemies = []
        adjacent_captive = None
        for d in ['forward', 'left', 'right', 'backward']:
            space = samurai.feel(d)
            if space is not None and space.is_enemy():
                adjacent_enemies.append(d)
            elif space is not None and space.is_captive():
                adjacent_captive = d
        if len(adjacent_enemies) > 0:
            samurai.attack(adjacent_enemies[0])
            return
        if adjacent_captive is not None:
            samurai.rescue(adjacent_captive)
            return
        if health < 15:
            samurai.rest()
            return
        if len(units) > 0:
            samurai.walk(samurai.direction_of(units[0]))
            return
        samurai.walk(samurai.direction_of_stairs())
