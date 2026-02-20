import type { LevelDefinition } from "../../engine/types";

const level006: LevelDefinition = {
  description:
    "The wall behind you feels a bit further away in this room. And you hear more cries for help.",
  tip: "You can walk backward by passing 'backward' as an argument to walk(). Same goes for feel(), rescue() and attack(). Archers have a limited attack distance.",
  clue: "Walk backward if you are taking damage from afar and do not have enough health to attack. You may also want to consider walking backward until warrior.feel('backward').is_wall().",
  timeBonus: 55,
  aceScore: 105,
  floor: { width: 8, height: 1 },
  stairs: [7, 0],
  warrior: {
    x: 2,
    y: 0,
    direction: "east",
    abilities: [],
  },
  units: [
    { type: "captive", x: 0, y: 0, direction: "east" },
    { type: "thick_sludge", x: 4, y: 0, direction: "west" },
    { type: "archer", x: 6, y: 0, direction: "west" },
    { type: "archer", x: 7, y: 0, direction: "west" },
  ],
};

export default level006;
