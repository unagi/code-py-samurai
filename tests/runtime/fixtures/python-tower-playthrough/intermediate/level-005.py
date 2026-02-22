class Player:
    def play_turn(self, samurai):
        health = samurai.hp
        units = samurai.listen()
        for d in ['forward', 'left', 'right', 'backward']:
            space = samurai.feel(d)
            if space is not None and space.is_enemy():
                samurai.attack(d)
                return
            if space is not None and space.is_captive():
                samurai.rescue(d)
                return
        for unit in units:
            if unit.is_enemy() or unit.is_captive():
                samurai.walk(samurai.direction_of(unit))
                return
        if health < 15:
            samurai.rest()
            return
        samurai.walk(samurai.direction_of_stairs())
