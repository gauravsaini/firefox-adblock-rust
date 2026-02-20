/* tslint:disable */
/* eslint-disable */
export class WasmEngine {
  private constructor();
  free(): void;
  enableTag(tag: string): void;
  tagExists(tag: string): boolean;
  deserialize(data: Uint8Array): void;
  disableTag(tag: string): void;
  useResources(resources_json: string): void;
  static fromFilterSet(filter_set: WasmFilterSet, optimize: boolean): WasmEngine;
  urlCosmeticResources(url: string): any;
  hiddenClassIdSelectors(classes: any, ids: any, exceptions: any): any;
  check(url: string, source_url: string, request_type: string): any;
  serialize(): Uint8Array;
}
export class WasmFilterSet {
  free(): void;
  addFilter(rule: string): boolean;
  addFilters(rules: string, format: string): any;
  constructor(debug: boolean);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmengine_free: (a: number, b: number) => void;
  readonly __wbg_wasmfilterset_free: (a: number, b: number) => void;
  readonly wasmengine_check: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
  readonly wasmengine_deserialize: (a: number, b: number, c: number) => [number, number];
  readonly wasmengine_disableTag: (a: number, b: number, c: number) => void;
  readonly wasmengine_enableTag: (a: number, b: number, c: number) => void;
  readonly wasmengine_fromFilterSet: (a: number, b: number) => number;
  readonly wasmengine_hiddenClassIdSelectors: (a: number, b: any, c: any, d: any) => [number, number, number];
  readonly wasmengine_serialize: (a: number) => [number, number];
  readonly wasmengine_tagExists: (a: number, b: number, c: number) => number;
  readonly wasmengine_urlCosmeticResources: (a: number, b: number, c: number) => [number, number, number];
  readonly wasmengine_useResources: (a: number, b: number, c: number) => [number, number];
  readonly wasmfilterset_addFilter: (a: number, b: number, c: number) => number;
  readonly wasmfilterset_addFilters: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly wasmfilterset_new: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
