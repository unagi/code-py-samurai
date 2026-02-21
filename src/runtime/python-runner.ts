import type { IPlayer } from "@engine/types";

import { compilePythonPlayer } from "./python-player";

export interface PythonRunnerResult {
  player: IPlayer;
}

export function runPythonPlayerSource(source: string): PythonRunnerResult {
  return {
    player: compilePythonPlayer(source),
  };
}
