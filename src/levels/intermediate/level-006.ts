import type { LevelDefinition } from "../../engine/types";

const level006: LevelDefinition = {
  description:
    "What's that ticking? Some captives have a timed bomb at their feet!",
  tip: "Hurry and rescue captives first that have space.is_ticking(), they'll soon go!",
  clue: "Avoid fighting enemies at first. Use warrior.listen() and space.is_ticking() and quickly rescue those captives.",
  timeBonus: 50,
  aceScore: 108,
  floor: { width: 6, height: 2 },
  stairs: [5, 0],
  warrior: {
    x: 0,
    y: 1,
    direction: "east",
    abilities: [],
  },
  units: [
    { type: "sludge", x: 1, y: 0, direction: "west" },
    { type: "sludge", x: 3, y: 1, direction: "west" },
    { type: "captive", x: 0, y: 0, direction: "west" },
    {
      type: "captive",
      x: 4,
      y: 1,
      direction: "west",
      abilities: ["explode!"],
      abilityConfig: { "explode!": { time: 7 } },
    },
  ],
};

export default level006;
