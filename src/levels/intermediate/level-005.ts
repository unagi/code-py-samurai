import type { LevelDefinition } from "../../engine/types";

const level005: LevelDefinition = {
  description:
    "You can feel the stairs right next to you, but are you sure you want to go up them right away?",
  tip: "You'll get more points for clearing the level first. Use warrior.feel().is_stairs() and warrior.feel().is_empty() to determine where to go.",
  clue: "If going towards a unit is the same direction as the stairs, try moving another empty direction until you can safely move toward the enemies.",
  timeBonus: 45,
  aceScore: 107,
  floor: { width: 5, height: 2 },
  stairs: [1, 1],
  warrior: {
    x: 0,
    y: 1,
    direction: "east",
    abilities: [],
  },
  units: [
    { type: "thick_sludge", x: 4, y: 0, direction: "west" },
    { type: "thick_sludge", x: 3, y: 1, direction: "north" },
    { type: "captive", x: 4, y: 1, direction: "west" },
  ],
};

export default level005;
