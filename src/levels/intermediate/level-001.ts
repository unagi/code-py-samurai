import type { LevelDefinition } from "../../engine/types";

const level001: LevelDefinition = {
  description:
    "Silence. The room feels large, but empty. Luckily you have a map of this tower to help find the stairs.",
  tip: "Use warrior.direction_of_stairs to determine which direction stairs are located. Pass this to warrior.walk to walk in that direction.",
  timeBonus: 20,
  aceScore: 19,
  floor: { width: 6, height: 4 },
  stairs: [2, 3],
  warrior: {
    x: 0,
    y: 1,
    direction: "east",
    abilities: ["walk!", "feel", "direction_of_stairs"],
  },
  units: [],
};

export default level001;
