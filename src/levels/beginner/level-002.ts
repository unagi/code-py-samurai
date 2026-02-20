import type { LevelDefinition } from "../../engine/types";

const level002: LevelDefinition = {
  description:
    "It is too dark to see anything, but you smell sludge nearby.",
  tip: "Use warrior.feel().is_empty() to see if there is anything in front of you, and warrior.attack() to fight it. Remember, you can only do one action per turn.",
  clue: "Add an if/else condition using warrior.feel().is_empty() to decide whether to warrior.attack() or warrior.walk().",
  timeBonus: 20,
  aceScore: 26,
  floor: { width: 8, height: 1 },
  stairs: [7, 0],
  warrior: {
    x: 0,
    y: 0,
    direction: "east",
    abilities: ["feel", "attack!"],
  },
  units: [{ type: "sludge", x: 4, y: 0, direction: "west" }],
};

export default level002;
