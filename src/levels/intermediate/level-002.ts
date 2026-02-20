import type { LevelDefinition } from "../../engine/types";

const level002: LevelDefinition = {
  description:
    "Another large room, but with several enemies blocking your way to the stairs.",
  tip: "Just like walking, you can attack and feel in multiple directions (forward, left, right, backward).",
  clue: "Call warrior.feel(direction).is_enemy() in each direction to make sure there isn't an enemy beside you (attack if there is). Call warrior.rest() if you're low on health when there are no enemies around.",
  timeBonus: 40,
  aceScore: 84,
  floor: { width: 4, height: 2 },
  stairs: [3, 1],
  warrior: {
    x: 0,
    y: 0,
    direction: "east",
    abilities: ["attack!", "health", "rest!"],
  },
  units: [
    { type: "sludge", x: 1, y: 0, direction: "west" },
    { type: "thick_sludge", x: 2, y: 1, direction: "west" },
    { type: "sludge", x: 1, y: 1, direction: "north" },
  ],
};

export default level002;
