import type { LevelDefinition } from "../../engine/types";

const level008: LevelDefinition = {
  description:
    "You discover a satchel of bombs which will help when facing a mob of enemies.",
  tip: "Detonate a bomb when you see a couple enemies ahead of you (warrior.look()). Watch out for your health too.",
  clue: "Calling warrior.look() will return an array of Spaces. If the first two contain enemies, detonate a bomb with warrior.detonate().",
  timeBonus: 30,
  aceScore: 0,
  floor: { width: 7, height: 1 },
  stairs: [6, 0],
  warrior: {
    x: 0,
    y: 0,
    direction: "east",
    abilities: ["look", "detonate!"],
  },
  units: [
    { type: "thick_sludge", x: 2, y: 0, direction: "west" },
    { type: "sludge", x: 3, y: 0, direction: "west" },
    {
      type: "captive",
      x: 5,
      y: 0,
      direction: "west",
      abilities: ["explode!"],
      abilityConfig: { "explode!": { time: 9 } },
    },
  ],
};

export default level008;
