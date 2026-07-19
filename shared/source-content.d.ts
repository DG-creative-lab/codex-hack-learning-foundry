export const SOURCE_CONTENT_LIMITS: Readonly<{
  maxBytes: number;
  maxUnits: number;
  maxUnitCharacters: number;
  minWebUnitCharacters: number;
}>;

export const SOURCE_HTML_RULES: Readonly<{
  contentSelector: string;
  removeSelector: string;
  rootSelector: string;
}>;

export interface SourceContentUnit<TLocation> {
  content: string;
  location: TLocation & { label: string };
}

export function normalizeSourceText(value: string): string;
export function normalizeSourceUnits<TLocation extends { label: string }>(
  units: SourceContentUnit<TLocation>[],
  minimumCharacters?: number
): SourceContentUnit<TLocation>[];
export function createWebSourceDocument<TLocation extends { label: string }>(input: {
  url: string;
  title: string;
  author: string;
  fingerprint: string;
  units: SourceContentUnit<TLocation>[];
}): {
  title: string;
  author: string;
  format: "Web page";
  fingerprint: string;
  units: SourceContentUnit<TLocation>[];
};
