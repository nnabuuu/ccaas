export interface BlockData {
  type: string;
  content: Record<string, any>;
  attributes?: Record<string, any>;
}

export interface DocumentMeta {
  [key: string]: string | number | boolean;
}

export interface EntityDocument {
  meta: DocumentMeta;
  blocks: BlockData[];
}

export interface BlockTransform {
  type: string;
  serialize(content: Record<string, any>): string;
  deserialize(lines: string[]): Record<string, any> | null;
  detect(lines: string[]): boolean;
}

export type ContentToAttrConfig = Record<string, string[]>;

export interface StrReplaceResult {
  success: boolean;
  error?: string;
  document?: EntityDocument;
  documentText?: string;
}
