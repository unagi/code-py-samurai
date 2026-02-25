export class PythonSyntaxError extends Error {
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.name = "PythonSyntaxError";
    this.line = line;
    this.column = column;
  }
}

export class PythonRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythonRuntimeError";
  }
}

export function formatPythonError(error: unknown): string {
  if (error instanceof PythonSyntaxError) {
    if (error.line !== undefined) {
      return `Python syntax error (line ${error.line}): ${error.message}`;
    }
    return `Python syntax error: ${error.message}`;
  }
  if (error instanceof PythonRuntimeError) {
    return `Python runtime error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Python error: ${error.message}`;
  }
  return `Python error: ${String(error)}`;
}
