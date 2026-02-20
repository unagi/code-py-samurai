import type { LevelDefinition } from "../../engine/types";

const level007: LevelDefinition = {
  description:
    "Another ticking sound, but some sludge is blocking the way.",
  tip: "Quickly kill the sludge and rescue the captive before the bomb goes off. You can't simply go around them.",
  clue: "Determine the direction of the ticking captive and kill any enemies blocking that path. You may need to bind surrounding enemies first.",
  timeBonus: 70,
  aceScore: 134,
  floor: { width: 5, height: 3 },
  stairs: [4, 0],
  warrior: {
    x: 0,
    y: 1,
    direction: "east",
    abilities: [],
  },
  units: [
    { type: "sludge", x: 1, y: 0, direction: "south" },
    { type: "sludge", x: 1, y: 2, direction: "north" },
    { type: "sludge", x: 2, y: 1, direction: "west" },
    {
      type: "captive",
      x: 4,
      y: 1,
      direction: "west",
      abilities: ["explode!"],
      abilityConfig: { "explode!": { time: 10 } },
    },
    { type: "captive", x: 2, y: 0, direction: "west" },
  ],
};

export default level007;
