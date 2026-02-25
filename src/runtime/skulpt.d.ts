/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Minimal type declarations for Skulpt (Python-to-JS transpiler).
 * Skulpt is loaded as a global script; `Sk` lives on `globalThis`.
 */

interface SkBuiltinStr {
  v: string;
  readonly $mangled: string;
}

interface SkBuiltinInt {
  v: number;
}

interface SkBuiltinFloat {
  v: number;
}

interface SkBuiltinBool {
  v: number; // 0 or 1
}

interface SkModule {
  tp$getattr(name: SkBuiltinStr): any;
  $d: Record<string, any>;
}

export interface SkInstance {
  tp$getattr(name: SkBuiltinStr): any;
  tp$setattr(name: SkBuiltinStr, value: any): void;
}

interface SkConfigureOptions {
  output?: (text: string) => void;
  read?: (path: string) => string;
  __future__?: any;
  python3?: boolean;
}

export interface SkNamespace {
  configure(options: SkConfigureOptions): void;

  /** Parse Python source without executing. Throws on syntax errors. */
  parse(filename: string, source: string): { cst: unknown; flags: unknown };

  /** Convert a concrete syntax tree to an AST. */
  astFromParse(cst: unknown, filename: string, flags: unknown): unknown;

  importMainWithBody(
    name: string,
    dumpJS: boolean,
    body: string,
    canSuspend?: boolean,
  ): SkModule;

  readonly python3: any;

  readonly builtin: {
    str: new (s: string) => SkBuiltinStr;
    int_: new (n: number) => SkBuiltinInt;
    float_: new (n: number) => SkBuiltinFloat;
    func: new (f: (...args: any[]) => any) => any;
    list: new (items: any[]) => any;
    readonly none: { readonly none$: any };
    readonly bool: { readonly true$: any; readonly false$: any };
    readonly BaseException: any;
    readonly TypeError: any;
    readonly AttributeError: any;
    readonly SyntaxError: any;
  };

  readonly builtins: {
    readonly property: any;
  };

  builtinFiles: { files: Record<string, string> } | undefined;

  readonly misceval: {
    callsimArray(func: any, args?: any[]): any;
    callsimOrSuspendArray(func: any, args?: any[]): any;
    callsim(func: any, ...args: any[]): any;
    callsimOrSuspend(func: any, ...args: any[]): any;
    buildClass(
      globals: any,
      func: ($gbl: any, $loc: Record<string, any>) => void,
      name: string,
      bases: any[],
    ): any;
    asyncToPromise(
      func: () => any,
      handlers?: Record<string, (susp: any) => Promise<any>>,
    ): Promise<any>;
    chain(initialValue: any, ...fns: Array<(v: any) => any>): any;
  };

  readonly ffi: {
    remapToPy(obj: any): any;
    remapToJs(obj: any): any;
  };

  readonly abstr: {
    gattr(obj: any, name: SkBuiltinStr | string, canSuspend?: boolean): any;
    sattr(
      obj: any,
      name: SkBuiltinStr | string,
      value: any,
      canSuspend?: boolean,
    ): void;
  };
}

declare global {
  var Sk: SkNamespace;
}
