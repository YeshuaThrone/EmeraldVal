import type {
  MatchingResult,
  RoyaltyChannelSource,
  UnclaimedRoyaltyRecord,
} from "./universal-blackbox-sweeper";

export type RawCWRRecordType =
  | "HDR"
  | "NWR"
  | "REV"
  | "ACK"
  | "SPU"
  | "SWR"
  | "REC";

export type RawCWRRecord = {
  recordType: RawCWRRecordType | string;
  rawLine: string;
};

export type RawDDEXDSRLine = {
  recordType: string;
  fields: string[];
};

export const UNMATCHED_CWR_ACK_STATUSES = ["NP", "RJ", "UN"] as const;
export type UnmatchedCwrAckStatus = (typeof UNMATCHED_CWR_ACK_STATUSES)[number];

export const DSR_UNMATCHED_STATUSES = [
  "UNMATCHED_HOLD",
  "MISSING_PUBLISHER",
] as const;

export const CLEARANCE_ACTIONS = [
  "CWR_RE_REGISTRATION_GENERATED",
  "DIRECT_DSP_CLAIM_SUBMITTED",
  "MICRO_SYNC_INVOICE_ISSUED",
] as const;
export type ClearanceAction = (typeof CLEARANCE_ACTIONS)[number];

export type MULClearanceNotice = {
  clearanceId: string;
  matchedWorkId: string;
  targetChannel: RoyaltyChannelSource;
  actionTaken: ClearanceAction;
  claimedAmountCents: number;
  currency: string;
  cwrRevisionPayload?: string;
  clearanceTimestamp: string;
};

/** CWR 2.1 NWR/REV: prefix 19, title 60, language 2, submitter work # 14, ISWC 11. */
const CWR_TITLE = { start: 19, end: 79 } as const;
const CWR_ISWC = { start: 95, end: 106 } as const;
/** CWR 2.1 REC: prefix + catalog 18 + duration 6 + album 60 + label 60 + date 8 + recording title 60. */
const CWR_REC_ISRC = { start: 231, end: 243 } as const;
/** CWR 2.1 ACK after prefix: orig tx seq 8 + orig type 3 + processing date 8, then 2-char status. */
const CWR_ACK_STATUS = { start: 38, end: 40 } as const;
const CWR_ACK_STATUS_FALLBACK = { start: 40, end: 42 } as const;
/** Fixed-width sandbox REV line (prefix + title + ISWC + space pad). */
export const CWR_REV_LINE_LENGTH = 197;

const UNMATCHED_ACK = new Set<string>(UNMATCHED_CWR_ACK_STATUSES);
const UNMATCHED_DSR = new Set<string>(DSR_UNMATCHED_STATUSES);

type CwrTransaction = {
  seq: string;
  ackStatus?: string;
  title?: string;
  iswc?: string;
  isrc?: string;
};

export type ConnectorClock = () => Date;

function defaultClock(): Date {
  return new Date();
}

function sliceField(line: string, start: number, end: number): string {
  if (line.length <= start) {
    return "";
  }
  return line.substring(start, end).trim();
}

function optionalField(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function cwrRecordType(line: string): string {
  return line.substring(0, 3);
}

function cwrTransactionSeq(line: string): string {
  return line.substring(3, 11);
}

function isUnmatchedAckStatus(status: string): status is UnmatchedCwrAckStatus {
  return UNMATCHED_ACK.has(status);
}

function ackStatusOf(line: string): string {
  const primary = sliceField(line, CWR_ACK_STATUS.start, CWR_ACK_STATUS.end);
  if (isUnmatchedAckStatus(primary)) {
    return primary;
  }
  const fallback = sliceField(
    line,
    CWR_ACK_STATUS_FALLBACK.start,
    CWR_ACK_STATUS_FALLBACK.end,
  );
  if (isUnmatchedAckStatus(fallback)) {
    return fallback;
  }
  return primary;
}

function addUtcYears(from: Date, years: number): Date {
  const next = new Date(from.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function slugIdPart(value: string): string {
  const slug = value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug === "" ? "NA" : slug.slice(0, 40);
}

function recIsrc(line: string): string | undefined {
  const sliced = optionalField(
    sliceField(line, CWR_REC_ISRC.start, CWR_REC_ISRC.end),
  );
  if (sliced) {
    return sliced;
  }
  const match = line.match(/\b([A-Z]{2}[A-Z0-9]{3}\d{7})\b/);
  return match?.[1];
}

/**
 * Parse a decimal dollar string ("12.34") into integer cents without float remainder.
 * Rejects negatives and malformed values.
 */
export function parseDecimalDollarsToCents(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return undefined;
  }
  const whole = Number(match[1]);
  const frac = (match[2] ?? "").padEnd(2, "0");
  const cents = whole * 100 + Number(frac);
  if (!Number.isSafeInteger(cents)) {
    return undefined;
  }
  return cents;
}

/**
 * Sandbox CWR / DDEX DSR parsers. Do not submit files to societies or DSPs.
 */
export class CovenantIngestionEngine {
  private readonly clock: ConnectorClock;

  constructor(options: { clock?: ConnectorClock } = {}) {
    this.clock = options.clock ?? defaultClock;
  }

  public parseCWRUnmatchedFeed(
    cwrFileContent: string,
    sourceSociety: string,
  ): UnclaimedRoyaltyRecord[] {
    const transactions = new Map<string, CwrTransaction>();
    const lines = cwrFileContent.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.replace(/\n$/, "");
      if (line.trim() === "") {
        continue;
      }
      const recordType = cwrRecordType(line);
      const seq = cwrTransactionSeq(line) || "00000000";
      const current = transactions.get(seq) ?? { seq };

      if (recordType === "NWR" || recordType === "REV") {
        current.title = optionalField(
          sliceField(line, CWR_TITLE.start, CWR_TITLE.end),
        );
        current.iswc = optionalField(sliceField(line, CWR_ISWC.start, CWR_ISWC.end));
      } else if (recordType === "REC") {
        current.isrc = recIsrc(line) ?? current.isrc;
      } else if (recordType === "ACK") {
        current.ackStatus = ackStatusOf(line);
      }

      transactions.set(seq, current);
    }

    const holdingPeriodEnd = addUtcYears(this.clock(), 3).toISOString();
    const records: UnclaimedRoyaltyRecord[] = [];

    for (const tx of transactions.values()) {
      if (!tx.ackStatus || !isUnmatchedAckStatus(tx.ackStatus)) {
        continue;
      }
      const identifiers = {
        ...(tx.iswc ? { iswc: tx.iswc } : {}),
        ...(tx.isrc ? { isrc: tx.isrc } : {}),
      };
      if (!tx.title && Object.keys(identifiers).length === 0) {
        continue;
      }
      records.push({
        recordId: `CWR_ACK_${slugIdPart(sourceSociety)}_${tx.seq}`,
        sourceChannel: "PRO_CMO_UNMATCHED",
        sourceEntityName: sourceSociety,
        unallocatedAmountCents: 0,
        currency: "USD",
        territory: "US",
        rawMetadata: {
          title: tx.title,
          identifiers,
          confidenceScore: 0.85,
        },
        holdingPeriodEnd,
      });
    }

    return records;
  }

  /**
   * Sandbox DDEX DSR TSV dialect:
   * 0=record type, 3=title, 4=ISRC, 5=ISWC, 8=territory, 9=currency,
   * 10=net dollars, 12=status (UNMATCHED_HOLD | MISSING_PUBLISHER).
   */
  public parseDDEXDSRFeed(
    dsrFileContent: string,
    dspName: string,
  ): UnclaimedRoyaltyRecord[] {
    const holdingPeriodEnd = addUtcYears(this.clock(), 2).toISOString();
    const records: UnclaimedRoyaltyRecord[] = [];
    const lines = dsrFileContent.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!.trim();
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      const fields = line.split("\t");
      const recordType = fields[0] ?? "";
      if (recordType !== "SU02" && recordType !== "MW01") {
        continue;
      }
      const status = (fields[12] ?? "").trim();
      if (!UNMATCHED_DSR.has(status)) {
        continue;
      }
      const netAmountCents = parseDecimalDollarsToCents(fields[10] ?? "");
      if (netAmountCents === undefined) {
        continue;
      }
      const title = optionalField((fields[3] ?? "").trim());
      const isrc = optionalField((fields[4] ?? "").trim());
      const iswc = optionalField((fields[5] ?? "").trim());
      records.push({
        recordId: `DSR_${slugIdPart(dspName)}_${index}_${slugIdPart(isrc ?? title ?? "line")}`,
        sourceChannel: "DSP_DIRECT_DISTRIBUTION",
        sourceEntityName: dspName,
        unallocatedAmountCents: netAmountCents,
        currency: optionalField((fields[9] ?? "").trim()) ?? "USD",
        territory: optionalField((fields[8] ?? "").trim()) ?? "WW",
        rawMetadata: {
          title,
          identifiers: {
            ...(isrc ? { isrc } : {}),
            ...(iswc ? { iswc } : {}),
          },
          confidenceScore: 0.9,
        },
        holdingPeriodEnd,
      });
    }

    return records;
  }
}

/**
 * Sandbox MUL claim notices. Generates CWR REV strings locally.
 * Does not POST to societies, DSPs, or Covenant HTTP.
 */
export class CovenantClearanceDispatchNode {
  private readonly clock: ConnectorClock;

  constructor(options: { clock?: ConnectorClock } = {}) {
    this.clock = options.clock ?? defaultClock;
  }

  public async dispatchClearance(
    matches: MatchingResult[],
  ): Promise<MULClearanceNotice[]> {
    const clearanceTimestamp = this.clock().toISOString();
    const notices: MULClearanceNotice[] = [];

    for (const match of matches) {
      let actionTaken: ClearanceAction = "DIRECT_DSP_CLAIM_SUBMITTED";
      let cwrRevisionPayload: string | undefined;

      if (match.sourceChannel === "PRO_CMO_UNMATCHED") {
        actionTaken = "CWR_RE_REGISTRATION_GENERATED";
        cwrRevisionPayload = this.generateCWRRevisionRecord(
          match.matchedWorkId,
          match.recordId,
        );
      } else if (
        match.sourceChannel === "SYNC_CUE_SHEETS" ||
        match.sourceChannel === "GAMING_INTERACTIVE"
      ) {
        actionTaken = "MICRO_SYNC_INVOICE_ISSUED";
      }

      notices.push({
        clearanceId: `CLR_${match.recordId}_${match.matchedWorkId}`,
        matchedWorkId: match.matchedWorkId,
        targetChannel: match.sourceChannel,
        actionTaken,
        claimedAmountCents: match.recoveredAmountCents,
        currency: match.currency,
        cwrRevisionPayload,
        clearanceTimestamp,
      });
    }

    return notices;
  }

  private generateCWRRevisionRecord(workId: string, _recordId: string): string {
    const transactionNum = "00000001";
    const recordSeq = "00000000";
    // REV Record Type (3) + Transaction Sequence (8) + Record Sequence (8) = 19 char prefix
    const revHeader = `REV${transactionNum}${recordSeq}`;
    const titlePadded = `RECLAIM_${workId}`.slice(0, 60).padEnd(60, " ");
    const iswcPadded = "".padEnd(11, " ");

    // Construct valid 197-char line padded with spaces
    return `${revHeader}${titlePadded}${iswcPadded}`.padEnd(
      CWR_REV_LINE_LENGTH,
      " ",
    );
  }
}
