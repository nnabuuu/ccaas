import type { OutputSchema } from './interfaces.js';

export class OutputSchemaRegistry {
  private schemas = new Map<string, OutputSchema>();

  register(schema: OutputSchema): void {
    this.schemas.set(schema.id, schema);
  }

  get(id: string): OutputSchema | undefined {
    return this.schemas.get(id);
  }

  list(): OutputSchema[] {
    return Array.from(this.schemas.values());
  }

  remove(id: string): boolean {
    return this.schemas.delete(id);
  }
}
