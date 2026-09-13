/**
 * Universal Global Identifiers (UGIs) used by the Covenant collection SDK
 * to match works, parties, products, and NIL across DSP / UGC / PRO nodes.
 */

export const UNIVERSAL_GLOBAL_IDENTIFIERS = [
  "ISRC",
  "ISWC",
  "ISAN",
  "EIDR",
  "DOI",
  "EPC",
  "RFID",
  "NIL",
  "IPI",
  "ISNI",
  "IPN",
  "UPC",
  "EAN",
  "GRID",
  "ISBN",
  "ISSN",
  "ISMN",
  "ORCID",
  "LEI",
  "GTIN",
] as const;

export type UniversalGlobalIdentifier =
  (typeof UNIVERSAL_GLOBAL_IDENTIFIERS)[number];

export const UNIVERSAL_GLOBAL_IDENTIFIER_COUNT =
  UNIVERSAL_GLOBAL_IDENTIFIERS.length;

export function isUniversalGlobalIdentifier(
  value: string,
): value is UniversalGlobalIdentifier {
  return (UNIVERSAL_GLOBAL_IDENTIFIERS as readonly string[]).includes(value);
}
