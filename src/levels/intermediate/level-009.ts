import type { LevelDefinition } from "../../engine/types";

const level009: LevelDefinition = {
  description:
    "Never before have you seen a room so full of sludge. Start the fireworks!",
  tip: "Be careful not to let the ticking captive get caught in the flames. Use warrior.distance_of to avoid the captives.",
  clue: "Be sure to bind the surrounding enemies before fighting. Check your health before detonating explosives.",
  timeBonus: 70,
  aceScore: 0,
  floor: { width: 4, height: 3 },
  stairs: [3, 0],
  warrior: {
    x: 0,
    y: 1,
    direction: "east",
    abilities: ["distance_of"],
  },
  units: [
    {
      type: "captive",
      x: 2,
      y: 0,
      direction: "south",
      abilities: ["explode!"],
      abilityConfig: { "explode!": { time: 20 } },
    },
    { type: "captive", x: 2, y: 2, direction: "north" },
    { type: "sludge", x: 0, y: 0, direction: "south" },
    { type: "sludge", x: 1, y: 0, direction: "south" },
    { type: "sludge", x: 1, y: 1, direction: "east" },
    { type: "sludge", x: 2, y: 1, direction: "east" },
    { type: "sludge", x: 3, y: 1, direction: "east" },
    { type: "sludge", x: 0, y: 2, direction: "north" },
    { type: "sludge", x: 1, y: 2, direction: "north" },
  ],
};

export default level009;
