import { Level } from "./level";

export interface ProfileData {
  warriorName: string;
  towerName: string;
  score: number;
  epicScore: number;
  currentEpicScore: number;
  averageGrade: number | null;
  currentEpicGrades: Record<number, number>;
  abilities: string[];
  levelNumber: number;
  lastLevelNumber: number | null;
  epic: boolean;
}

/**
 * Profile - manages player progression state.
 * Ported from RubyWarrior::Profile
 */
export class Profile {
  warriorName: string;
  towerName: string;
  score: number = 0;
  epicScore: number = 0;
  currentEpicScore: number = 0;
  averageGrade: number | null = null;
  currentEpicGrades: Record<number, number> = {};
  abilities: string[] = [];
  levelNumber: number = 0;
  lastLevelNumber: number | null = null;
  private _epic: boolean = false;

  constructor(warriorName: string, towerName: string) {
    this.warriorName = warriorName;
    this.towerName = towerName;
  }

  isEpic(): boolean {
    return this._epic;
  }

  addAbilities(...newAbilities: string[]): void {
    for (const ability of newAbilities) {
      if (!this.abilities.includes(ability)) {
        this.abilities.push(ability);
      }
    }
  }

  enableEpicMode(): void {
    this._epic = true;
    this.lastLevelNumber = this.lastLevelNumber ?? this.levelNumber;
    this.currentEpicScore = 0;
    this.currentEpicGrades = {};
  }

  enableNormalMode(): void {
    this._epic = false;
    if (this.lastLevelNumber !== null) {
      this.levelNumber = this.lastLevelNumber;
    }
    this.lastLevelNumber = null;
  }

  updateEpicScore(): void {
    if (this.currentEpicScore > this.epicScore) {
      this.epicScore = this.currentEpicScore;
      this.averageGrade = this.calculateAverageGrade();
    }
  }

  calculateAverageGrade(): number | null {
    const grades = Object.values(this.currentEpicGrades);
    if (grades.length === 0) return null;
    return grades.reduce((sum, v) => sum + v, 0) / grades.length;
  }

  gradeLetterForAverage(): string | null {
    if (this.averageGrade === null) return null;
    return Level.gradeLetter(this.averageGrade);
  }

  toJSON(): ProfileData {
    return {
      warriorName: this.warriorName,
      towerName: this.towerName,
      score: this.score,
      epicScore: this.epicScore,
      currentEpicScore: this.currentEpicScore,
      averageGrade: this.averageGrade,
      currentEpicGrades: { ...this.currentEpicGrades },
      abilities: [...this.abilities],
      levelNumber: this.levelNumber,
      lastLevelNumber: this.lastLevelNumber,
      epic: this._epic,
    };
  }

  static fromJSON(data: ProfileData): Profile {
    const profile = new Profile(data.warriorName, data.towerName);
    profile.score = data.score;
    profile.epicScore = data.epicScore;
    profile.currentEpicScore = data.currentEpicScore;
    profile.averageGrade = data.averageGrade;
    profile.currentEpicGrades = { ...data.currentEpicGrades };
    profile.abilities = [...data.abilities];
    profile.levelNumber = data.levelNumber;
    profile.lastLevelNumber = data.lastLevelNumber;
    if (data.epic) {
      profile.enableEpicMode();
      // Restore epic state without resetting scores
      profile.currentEpicScore = data.currentEpicScore;
      profile.currentEpicGrades = { ...data.currentEpicGrades };
    }
    return profile;
  }

  get storageKey(): string {
    const safeName = this.warriorName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `pysamurai-${safeName}-${this.towerName}`;
  }

  save(storage?: Storage): void {
    const s = storage ?? globalThis.localStorage;
    s.setItem(this.storageKey, JSON.stringify(this.toJSON()));
  }

  static load(key: string, storage?: Storage): Profile | null {
    const s = storage ?? globalThis.localStorage;
    const data = s.getItem(key);
    if (!data) return null;
    return Profile.fromJSON(JSON.parse(data));
  }
}
