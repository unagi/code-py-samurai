import type { LevelDefinition } from "../../engine/types";

const level003: LevelDefinition = {
  description: "You feel slime on all sides, you're surrounded!",
  tip: "Call warrior.bind(direction) to bind an enemy to keep him from attacking. Bound enemies look like captives.",
  clue: "Count the number of enemies around you. Bind an enemy if there are two or more.",
  timeBonus: 50,
  aceScore: 101,
  floor: { width: 3, height: 3 },
  stairs: [0, 0],
  warrior: {
    x: 1,
    y: 1,
    direction: "east",
    abilities: ["rescue!", "bind!"],
  },
  units: [
    { type: "sludge", x: 1, y: 0, direction: "west" },
    { type: "captive", x: 1, y: 2, direction: "west" },
    { type: "sludge", x: 0, y: 1, direction: "west" },
    { type: "sludge", x: 2, y: 1, direction: "west" },
  ],
};

export default level003;
