import type { LevelDefinition } from "../../engine/types";

const level005: LevelDefinition = {
  description:
    "You hear cries for help. Captives must need rescuing.",
  tip: "Use warrior.feel().captive? to see if there is a captive and warrior.rescue! to rescue him. Don't attack captives.",
  clue: "Don't forget to constantly check if you're taking damage. Rest until your health is full if you aren't taking damage.",
  timeBonus: 45,
  aceScore: 123,
  floor: { width: 7, height: 1 },
  stairs: [6, 0],
  warrior: {
    x: 0,
    y: 0,
    direction: "east",
    abilities: ["rescue!"],
  },
  units: [
    { type: "captive", x: 2, y: 0, direction: "west" },
    { type: "archer", x: 3, y: 0, direction: "west" },
    { type: "archer", x: 4, y: 0, direction: "west" },
    { type: "thick_sludge", x: 5, y: 0, direction: "west" },
    { type: "captive", x: 6, y: 0, direction: "west" },
  ],
};

export default level005;
