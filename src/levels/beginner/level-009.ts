import type { LevelDefinition } from "../../engine/types";

const level009: LevelDefinition = {
  description:
    "Time to hone your skills and apply all of the abilities that you have learned.",
  tip: "Watch your back.",
  clue: "Don't just keep shooting the bow while you are being attacked from behind.",
  timeBonus: 40,
  aceScore: 100,
  floor: { width: 11, height: 1 },
  stairs: [0, 0],
  warrior: {
    x: 5,
    y: 0,
    direction: "east",
    abilities: [],
  },
  units: [
    { type: "captive", x: 1, y: 0, direction: "east" },
    { type: "archer", x: 2, y: 0, direction: "east" },
    { type: "thick_sludge", x: 7, y: 0, direction: "west" },
    { type: "wizard", x: 9, y: 0, direction: "west" },
    { type: "captive", x: 10, y: 0, direction: "west" },
  ],
};

export default level009;
