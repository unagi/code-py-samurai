import type { LevelDefinition } from "../../engine/types";

const level007: LevelDefinition = {
  description:
    "You feel a wall right in front of you and an opening behind you.",
  tip: "You are not as effective at attacking backward. Use warrior.feel().is_wall() and warrior.pivot() to turn around.",
  timeBonus: 30,
  aceScore: 50,
  floor: { width: 6, height: 1 },
  stairs: [0, 0],
  warrior: {
    x: 5,
    y: 0,
    direction: "east",
    abilities: ["pivot!"],
  },
  units: [
    { type: "archer", x: 1, y: 0, direction: "east" },
    { type: "thick_sludge", x: 3, y: 0, direction: "east" },
  ],
};

export default level007;
