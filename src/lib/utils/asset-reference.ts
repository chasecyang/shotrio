/**
 * Asset reference utilities for parsing and managing asset references in messages
 * Format: [[asset_name|asset_id]]
 */

export interface AssetReference {
  name: string;
  id: string;
  fullMatch: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Regular expression to match asset references in the format [[name|id]]
 */
const ASSET_REFERENCE_REGEX = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

/**
 * Parse asset references from a message string
 */
export function parseAssetReferences(message: string): AssetReference[] {
  const references: AssetReference[] = [];
  let match;

  // Reset regex state
  ASSET_REFERENCE_REGEX.lastIndex = 0;

  while ((match = ASSET_REFERENCE_REGEX.exec(message)) !== null) {
    references.push({
      name: match[1].trim(),
      id: match[2].trim(),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return references;
}

/**
 * Create an asset reference token
 */
export function createAssetReference(name: string, id: string): string {
  return `[[${name}|${id}]]`;
}

/**
 * Check if a string contains asset references
 */
export function hasAssetReferences(message: string): boolean {
  ASSET_REFERENCE_REGEX.lastIndex = 0;
  return ASSET_REFERENCE_REGEX.test(message);
}

/**
 * Extract asset IDs from a message
 */
export function extractAssetIds(message: string): string[] {
  const references = parseAssetReferences(message);
  return references.map((ref) => ref.id);
}

/**
 * Replace asset references with a custom formatter
 */
export function replaceAssetReferences(
  message: string,
  replacer: (reference: AssetReference) => string
): string {
  const references = parseAssetReferences(message);
  let result = message;
  let offset = 0;

  for (const ref of references) {
    const replacement = replacer(ref);
    const start = ref.startIndex + offset;
    const end = ref.endIndex + offset;

    result = result.slice(0, start) + replacement + result.slice(end);
    offset += replacement.length - ref.fullMatch.length;
  }

  return result;
}

/**
 * Split message into text and reference segments
 */
export interface MessageSegment {
  type: "text" | "reference";
  content: string;
  reference?: AssetReference;
}

export function splitMessageSegments(message: string): MessageSegment[] {
  const references = parseAssetReferences(message);
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const ref of references) {
    // Add text before reference
    if (ref.startIndex > lastIndex) {
      segments.push({
        type: "text",
        content: message.slice(lastIndex, ref.startIndex),
      });
    }

    // Add reference segment
    segments.push({
      type: "reference",
      content: ref.fullMatch,
      reference: ref,
    });

    lastIndex = ref.endIndex;
  }

  // Add remaining text
  if (lastIndex < message.length) {
    segments.push({
      type: "text",
      content: message.slice(lastIndex),
    });
  }

  return segments;
}
