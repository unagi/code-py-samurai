import type { ITurn, IPlayer } from "@engine/types";
import { asRuntimeTurn, callSense, type RuntimeTurn } from "./bridge";

const ACTION_MAP: Record<string, string> = {
  walk: "walk!",
  attack: "attack!",
  rest: "rest!",
  rescue: "rescue!",
  shoot: "shoot!",
  pivot: "pivot!",
  bind: "bind!",
  detonate: "detonate!",
};

const SPACE_PREDICATES = new Set([
  "is_empty",
  "is_enemy",
  "is_captive",
  "is_stairs",
  "is_wall",
]);

type CompareOp = "<" | "<=" | ">" | ">=" | "==" | "!=";

type Expr =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "var"; name: string }
  | { kind: "sense"; sense: string; args: Expr[] }
  | { kind: "predicate"; target: Expr; name: string }
  | { kind: "compare"; left: Expr; op: CompareOp; right: Expr }
  | { kind: "not"; expr: Expr };

type Stmt =
  | { kind: "assign"; name: string; expr: Expr }
  | { kind: "action"; name: string; args: Expr[] }
  | { kind: "if"; branches: Array<{ cond: Expr; body: Stmt[] }>; elseBody: Stmt[] }
  | { kind: "pass" };

interface TokenLine {
  indent: number;
  text: string;
  lineNo: number;
}

class ParseError extends Error {}

function normalizeDirection(value: unknown): string {
  if (typeof value !== "string") return "forward";
  return value;
}

function tokenizePlayTurn(source: string): TokenLine[] {
  const normalized = source.replace(/\r\n?/g, "\n");
  if (normalized.trim().length === 0) {
    throw new ParseError("Python source is empty.");
  }

  const lines = normalized.split("\n");
  const defIndex = lines.findIndex((line) => /\bdef\s+play_turn\s*\(\s*self\s*,\s*warrior\s*\)\s*:/.test(line));
  if (defIndex < 0) {
    throw new ParseError("def play_turn(self, warrior): was not found.");
  }

  const defLine = lines[defIndex];
  const defIndent = defLine.match(/^\s*/)?.[0].length ?? 0;
  const tokens: TokenLine[] = [];

  for (let i = defIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim().length === 0 || raw.trimStart().startsWith("#")) {
      continue;
    }

    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= defIndent) {
      break;
    }

    tokens.push({
      indent,
      text: raw.trim(),
      lineNo: i + 1,
    });
  }

  if (tokens.length === 0) {
    throw new ParseError("play_turn body is empty.");
  }

  return tokens;
}

function parseStatements(tokens: TokenLine[], start: number, indent: number): { body: Stmt[]; next: number } {
  const body: Stmt[] = [];
  let index = start;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.indent < indent) break;
    if (token.indent > indent) {
      throw new ParseError(`Unsupported indentation at line ${token.lineNo}.`);
    }

    if (token.text === "pass") {
      body.push({ kind: "pass" });
      index += 1;
      continue;
    }

    if (token.text.startsWith("if ")) {
      const parsed = parseIfStmt(tokens, index, indent);
      body.push(parsed.stmt);
      index = parsed.next;
      continue;
    }

    if (token.text.startsWith("elif ") || token.text === "else:") {
      break;
    }

    const assign = token.text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assign) {
      body.push({
        kind: "assign",
        name: assign[1],
        expr: parseExpr(assign[2], token.lineNo),
      });
      index += 1;
      continue;
    }

    const action = parseWarriorAction(token.text, token.lineNo);
    if (action) {
      body.push(action);
      index += 1;
      continue;
    }

    throw new ParseError(`Unsupported syntax at line ${token.lineNo}: ${token.text}`);
  }

  return { body, next: index };
}

function parseIfStmt(tokens: TokenLine[], start: number, indent: number): { stmt: Stmt; next: number } {
  const branches: Array<{ cond: Expr; body: Stmt[] }> = [];
  let elseBody: Stmt[] = [];
  let index = start;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.indent !== indent) break;

    if (token.text.startsWith("if ") || token.text.startsWith("elif ")) {
      const condText = token.text.replace(/^(if|elif)\s+/, "").replace(/:\s*$/, "");
      const cond = parseExpr(condText, token.lineNo);
      const bodyIndent = tokens[index + 1]?.indent;
      if (!bodyIndent || bodyIndent <= indent) {
        throw new ParseError(`Missing block after condition at line ${token.lineNo}.`);
      }
      const parsed = parseStatements(tokens, index + 1, bodyIndent);
      branches.push({ cond, body: parsed.body });
      index = parsed.next;
      continue;
    }

    if (token.text === "else:") {
      const bodyIndent = tokens[index + 1]?.indent;
      if (!bodyIndent || bodyIndent <= indent) {
        throw new ParseError(`Missing block after else at line ${token.lineNo}.`);
      }
      const parsed = parseStatements(tokens, index + 1, bodyIndent);
      elseBody = parsed.body;
      index = parsed.next;
      break;
    }

    break;
  }

  if (branches.length === 0) {
    throw new ParseError(`Invalid if statement at line ${tokens[start].lineNo}.`);
  }

  return {
    stmt: { kind: "if", branches, elseBody },
    next: index,
  };
}

function parseArgs(raw: string, lineNo: number): Expr[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(",").map((part) => parseExpr(part.trim(), lineNo));
}

function parseWarriorAction(text: string, lineNo: number): Stmt | null {
  const m = text.match(/^warrior\.([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (!m) return null;

  const pythonName = m[1];
  const action = ACTION_MAP[pythonName];
  if (!action) {
    throw new ParseError(`Unsupported warrior action '${pythonName}' at line ${lineNo}.`);
  }

  return {
    kind: "action",
    name: action,
    args: parseArgs(m[2], lineNo),
  };
}

function parseExpr(raw: string, lineNo: number): Expr {
  const text = raw.trim();

  if (/^\d+$/.test(text)) {
    return { kind: "number", value: Number(text) };
  }

  const stringMatch = text.match(/^(["'])(.*)\1$/);
  if (stringMatch) {
    return { kind: "string", value: stringMatch[2] };
  }

  if (text.startsWith("not ")) {
    return {
      kind: "not",
      expr: parseExpr(text.slice(4), lineNo),
    };
  }

  const cmp = text.match(/(.+)\s*(<=|>=|==|!=|<|>)\s*(.+)/);
  if (cmp) {
    return {
      kind: "compare",
      left: parseExpr(cmp[1], lineNo),
      op: cmp[2] as CompareOp,
      right: parseExpr(cmp[3], lineNo),
    };
  }

  const predicate = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\.(is_[A-Za-z_][A-Za-z0-9_]*)\(\)$/);
  if (predicate) {
    if (!SPACE_PREDICATES.has(predicate[2])) {
      throw new ParseError(`Unsupported predicate '${predicate[2]}' at line ${lineNo}.`);
    }
    return {
      kind: "predicate",
      target: { kind: "var", name: predicate[1] },
      name: predicate[2],
    };
  }

  const sense = text.match(/^warrior\.([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (sense) {
    return {
      kind: "sense",
      sense: sense[1],
      args: parseArgs(sense[2], lineNo),
    };
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
    return { kind: "var", name: text };
  }

  throw new ParseError(`Unsupported expression at line ${lineNo}: ${text}`);
}

function evalExpr(expr: Expr, turn: RuntimeTurn, env: Map<string, unknown>): unknown {
  switch (expr.kind) {
    case "number":
      return expr.value;
    case "string":
      return expr.value;
    case "var":
      if (!env.has(expr.name)) {
        throw new Error(`Unknown variable: ${expr.name}`);
      }
      return env.get(expr.name);
    case "sense": {
      const args = expr.args.map((arg) => evalExpr(arg, turn, env));
      return callSense(turn, expr.sense, ...args);
    }
    case "predicate": {
      const target = evalExpr(expr.target, turn, env) as Record<string, unknown>;
      const fn = target[expr.name] as (() => boolean) | undefined;
      if (typeof fn !== "function") {
        throw new Error(`Predicate ${expr.name} is not available.`);
      }
      return fn.call(target);
    }
    case "not":
      return !Boolean(evalExpr(expr.expr, turn, env));
    case "compare": {
      const left = evalExpr(expr.left, turn, env) as number;
      const right = evalExpr(expr.right, turn, env) as number;
      switch (expr.op) {
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "==":
          return left === right;
        case "!=":
          return left !== right;
      }
    }
  }
}

function runStatements(stmts: Stmt[], turn: RuntimeTurn, env: Map<string, unknown>): void {
  for (const stmt of stmts) {
    if (stmt.kind === "pass") {
      continue;
    }

    if (stmt.kind === "assign") {
      env.set(stmt.name, evalExpr(stmt.expr, turn, env));
      continue;
    }

    if (stmt.kind === "action") {
      const args = stmt.args.map((arg) => evalExpr(arg, turn, env));
      if (stmt.name === "rest!") {
        if (turn.hasAction(stmt.name)) {
          turn.doAction(stmt.name);
        }
        continue;
      }
      const direction = normalizeDirection(args[0]);
      if (turn.hasAction(stmt.name)) {
        turn.doAction(stmt.name, direction);
      }
      continue;
    }

    if (stmt.kind === "if") {
      let matched = false;
      for (const branch of stmt.branches) {
        if (Boolean(evalExpr(branch.cond, turn, env))) {
          runStatements(branch.body, turn, env);
          matched = true;
          break;
        }
      }
      if (!matched && stmt.elseBody.length > 0) {
        runStatements(stmt.elseBody, turn, env);
      }
      continue;
    }
  }
}

export function compilePythonPlayer(source: string): IPlayer {
  const tokens = tokenizePlayTurn(source);
  const firstIndent = tokens[0].indent;
  const parsed = parseStatements(tokens, 0, firstIndent);

  if (parsed.next !== tokens.length) {
    const token = tokens[parsed.next];
    throw new ParseError(`Unsupported trailing syntax at line ${token.lineNo}: ${token.text}`);
  }

  const ast = parsed.body;

  return {
    playTurn(turnInput: ITurn): void {
      const turn = asRuntimeTurn(turnInput);
      const env = new Map<string, unknown>();
      runStatements(ast, turn, env);
    },
  };
}

export function isPythonPlayerCodeEmpty(source: string): boolean {
  return source.trim().length === 0;
}
