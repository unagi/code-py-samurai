import { describe, it, expect } from "vitest";
import { Game } from "@engine/game";
import { Profile } from "@engine/profile";
import { Tower } from "@engine/tower";
import { Turn } from "@engine/turn";
import { beginnerTower } from "../../src/levels";
import type { IPlayer, ITurn, LevelDefinition } from "@engine/types";
import type { Space } from "@engine/space";

/**
 * A simple tower with trivially solvable levels for testing Game mechanics.
 */
function createTestTower(): Tower {
  const level1: LevelDefinition = {
    timeBonus: 10,
    aceScore: 10,
    floor: { width: 4, height: 1 },
    stairs: { x: 3, y: 0 },
    samurai: { x: 0, y: 0, direction: "east", abilities: { skills: ["walk()"], stats: [] } },
    units: [],
  };

  const level2: LevelDefinition = {
    timeBonus: 15,
    aceScore: 20,
    floor: { width: 5, height: 1 },
    stairs: { x: 4, y: 0 },
    samurai: { x: 0, y: 0, direction: "east", abilities: { skills: ["feel()", "attack()"], stats: [] } },
    units: [{ type: "sludge", x: 2, y: 0, direction: "west" }],
  };

  const level3: LevelDefinition = {
    timeBonus: 20,
    aceScore: 30,
    floor: { width: 6, height: 1 },
    stairs: { x: 5, y: 0 },
    samurai: { x: 0, y: 0, direction: "east", abilities: { skills: ["rest()"], stats: ["hp"] } },
    units: [{ type: "sludge", x: 3, y: 0, direction: "west" }],
  };

  return new Tower("test", [level1, level2, level3]);
}

/**
 * Simple player that walks forward, attacks adjacent enemies, and rests when low.
 */
function createTestPlayer(): IPlayer {
  return {
    playTurn(turn: ITurn): void {
      const t = turn as Turn;

      // Attack adjacent enemy
      if (t.hasSense("feel")) {
        const fwd = t.doSense("feel", "forward") as Space;
        if (fwd.isEnemy() && t.hasAction("attack!")) {
          t.doAction("attack!", "forward");
          return;
        }
      }

      // Rest if low health
      if (t.hasSense("health") && t.hasAction("rest!")) {
        const hp = t.doSense("health") as number;
        if (hp < 10) {
          t.doAction("rest!");
          return;
        }
      }

      // Walk forward
      if (t.hasAction("walk!")) {
        t.doAction("walk!", "forward");
      }
    },
  };
}

describe("Game", () => {
  describe("Normal Mode", () => {
    it("plays a level and returns result", () => {
      const profile = new Profile("Tama", "beginner");
      profile.levelNumber = 1;
      const game = new Game(beginnerTower, profile);

      const player: IPlayer = {
        playTurn(turn: ITurn): void {
          (turn as Turn).doAction("walk!", "forward");
        },
      };

      const result = game.playLevel(player);
      expect(result.passed).toBe(true);
    });

    it("accumulates score on pass", () => {
      const profile = new Profile("Tama", "beginner");
      profile.levelNumber = 1;
      const game = new Game(beginnerTower, profile);

      const player: IPlayer = {
        playTurn(turn: ITurn): void {
          (turn as Turn).doAction("walk!", "forward");
        },
      };

      game.playLevel(player);
      expect(profile.score).toBeGreaterThan(0);
    });

    it("accumulates abilities from level", () => {
      const profile = new Profile("Tama", "beginner");
      profile.levelNumber = 1;
      const game = new Game(beginnerTower, profile);

      const player: IPlayer = {
        playTurn(turn: ITurn): void {
          (turn as Turn).doAction("walk!", "forward");
        },
      };

      game.playLevel(player);
      expect(profile.abilities).toContain("walk!");
    });

    it("advances to next level", () => {
      const profile = new Profile("Tama", "beginner");
      profile.levelNumber = 1;
      const game = new Game(beginnerTower, profile);

      expect(game.advanceLevel()).toBe(true);
      expect(profile.levelNumber).toBe(2);
    });

    it("cannot advance past last level", () => {
      const profile = new Profile("Tama", "beginner");
      profile.levelNumber = 9;
      const game = new Game(beginnerTower, profile);

      expect(game.advanceLevel()).toBe(false);
      expect(profile.levelNumber).toBe(9);
    });

    it("throws for invalid level number", () => {
      const profile = new Profile("Tama", "beginner");
      profile.levelNumber = 0;
      const game = new Game(beginnerTower, profile);

      const player: IPlayer = {
        playTurn(): void {},
      };

      expect(() => game.playLevel(player)).toThrow("Level 0 not found");
    });
  });

  describe("Epic Mode", () => {
    it("plays all levels in sequence", () => {
      const profile = new Profile("Tama", "test");
      const game = new Game(createTestTower(), profile);

      const result = game.playEpic(createTestPlayer(), 200);
      expect(result.passed).toBe(true);
      expect(result.levelResults).toHaveLength(3);
    });

    it("calculates total score across all levels", () => {
      const profile = new Profile("Tama", "test");
      const game = new Game(createTestTower(), profile);

      const result = game.playEpic(createTestPlayer(), 200);
      expect(result.totalScore).toBeGreaterThan(0);
    });

    it("records grades per level", () => {
      const profile = new Profile("Tama", "test");
      const game = new Game(createTestTower(), profile);

      const result = game.playEpic(createTestPlayer(), 200);
      expect(Object.keys(result.epicGrades).length).toBeGreaterThan(0);
    });

    it("updates epic score on profile", () => {
      const profile = new Profile("Tama", "test");
      const game = new Game(createTestTower(), profile);

      game.playEpic(createTestPlayer(), 200);
      expect(profile.epicScore).toBeGreaterThan(0);
    });

    it("stops on failure", () => {
      const profile = new Profile("Tama", "test");
      const game = new Game(createTestTower(), profile);

      // A player that does nothing will eventually fail
      const badPlayer: IPlayer = {
        playTurn(): void {},
      };

      const result = game.playEpic(badPlayer, 200);
      expect(result.passed).toBe(false);
    });

    it("accumulates abilities across levels", () => {
      const profile = new Profile("Tama", "test");
      const game = new Game(createTestTower(), profile);

      const result = game.playEpic(createTestPlayer(), 200);
      expect(result.passed).toBe(true);
      // Level 3 gets abilities from levels 1+2+3
      expect(result.levelResults).toHaveLength(3);
    });
  });
});
