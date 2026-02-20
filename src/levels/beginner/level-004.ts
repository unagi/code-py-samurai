import type { LevelDefinition } from "../../engine/types";

const level004: LevelDefinition = {
  description:
    "You can hear bow strings being stretched.",
  tip: "No new abilities this time, but you must be careful not to rest while taking damage. Save a @health instance variable and compare it on each turn to see if you're taking damage.",
  clue: "Set @health to your current health at the end of the turn. If this is greater than your current health next turn then you know you're taking damage and shouldn't rest.",
  timeBonus: 45,
  aceScore: 90,
  floor: { width: 7, height: 1 },
  stairs: [6, 0],
  warrior: {
    x: 0,
    y: 0,
    direction: "east",
    abilities: [],
  },
  units: [
    { type: "thick_sludge", x: 2, y: 0, direction: "west" },
    { type: "archer", x: 3, y: 0, direction: "west" },
    { type: "thick_sludge", x: 5, y: 0, direction: "west" },
  ],
};

export default level004;
