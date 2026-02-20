import type { LevelDefinition } from "../../engine/types";

const level001: LevelDefinition = {
  description:
    "You see before yourself a long hallway with stairs at the end. There is nothing in the way.",
  tip: "Call warrior.walk() to walk forward in the Player 'play_turn' method.",
  timeBonus: 15,
  aceScore: 10,
  floor: { width: 8, height: 1 },
  stairs: [7, 0],
  warrior: { x: 0, y: 0, direction: "east", abilities: ["walk!"] },
  units: [],
};

export default level001;
