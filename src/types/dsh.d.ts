// The DSH host is the only source of these two packages at runtime, and its
// type declarations are not a stable contract. We keep the host boundary
// deliberately narrow and typed locally; domain/ports/adapters never depend
// on DSH types.

declare module "@deepseek-ai/dsh-tools" {
  export function defineTool(options: Record<string, unknown>): unknown;
}

declare module "@deepseek-ai/schemastery" {
  interface Schema {
    default(value: unknown): Schema;
  }
  const z: {
    object(shape: Record<string, unknown>): unknown;
    boolean(): Schema;
    string(): Schema;
    number(): Schema;
    array(item: unknown): Schema;
  };
  export default z;
}
