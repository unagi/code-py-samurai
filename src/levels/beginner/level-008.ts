import type { LevelDefinition } from "../../engine/types";

const level008: LevelDefinition = {
  description:
    "You hear the mumbling of wizards. Beware of their deadly wands! Good thing you found a bow.",
  tip: "Use warrior.look() to determine your surroundings, and warrior.shoot() to fire an arrow.",
  clue: "Wizards are deadly but low in health. Kill them before they have time to attack.",
  timeBonus: 20,
  aceScore: 46,
  floor: { width: 6, height: 1 },
  stairs: [5, 0],
  warrior: {
    x: 0,
    y: 0,
    direction: "east",
    abilities: ["look", "shoot!"],
  },
  units: [
    { type: "captive", x: 2, y: 0, direction: "west" },
    { type: "wizard", x: 3, y: 0, direction: "west" },
    { type: "wizard", x: 4, y: 0, direction: "west" },
  ],
};

export default level008;
