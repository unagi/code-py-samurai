import type { LevelDefinition } from "../../engine/types";

const level004: LevelDefinition = {
  description:
    "Your ears become more in tune with the surroundings. Listen to find enemies and captives!",
  tip: "Use warrior.listen to find spaces with other units, and warrior.direction_of to determine what direction they're in.",
  clue: "Walk towards an enemy or captive with warrior.walk(warrior.direction_of(warrior.listen()[0])). Once warrior.listen() is empty then head for the stairs.",
  timeBonus: 55,
  aceScore: 144,
  floor: { width: 4, height: 3 },
  stairs: [3, 2],
  warrior: {
    x: 1,
    y: 1,
    direction: "east",
    abilities: ["listen", "direction_of"],
  },
  units: [
    { type: "captive", x: 0, y: 0, direction: "east" },
    { type: "captive", x: 0, y: 2, direction: "east" },
    { type: "sludge", x: 2, y: 0, direction: "south" },
    { type: "thick_sludge", x: 3, y: 1, direction: "west" },
    { type: "sludge", x: 2, y: 2, direction: "north" },
  ],
};

export default level004;
