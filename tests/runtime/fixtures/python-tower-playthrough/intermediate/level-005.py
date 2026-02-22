class Player:
    def play_turn(self, warrior):
        health = warrior.hp
        units = warrior.listen()
        for d in ['forward', 'left', 'right', 'backward']:
            space = warrior.feel(d)
            if space is not None and space.is_enemy():
                warrior.attack(d)
                return
            if space is not None and space.is_captive():
                warrior.rescue(d)
                return
        for unit in units:
            if unit.is_enemy() or unit.is_captive():
                warrior.walk(warrior.direction_of(unit))
                return
        if health < 15:
            warrior.rest()
            return
        warrior.walk(warrior.direction_of_stairs())
