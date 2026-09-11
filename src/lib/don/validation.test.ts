import { describe, expect, it } from "vitest";
import {
  isAdult,
  parseIdentity,
  validateBaasPayoutPayload,
  validateBaasWebhookPayload,
  validateDisputeLockPayload,
  validateDspWebhookPayload,
  validatePlaidExchangePayload,
  validatePlaidKycPayload,
  validateRecoupmentPayload,
  validateSplitCalculatePayload,
  validateSplitReversePayload,
  validateUnifiedWebhookPayload,
  validateVaultPayoutPayload,
  validateVaultReleasePayload,
  validateWithholdingPayload,
} from "@/lib/don/validation";

const NOW = new Date("2026-09-10T00:00:00.000Z");

const VALID_IDENTITY = {
  legal_name: "Yeshua Throne",
  date_of_birth: "1990-01-15",
  email: "yeshua@example.com",
  phone: "+15125551234",
  ssn_last_4: "6789",
  address: {
    street: "123 Congress Ave",
    city: "Austin",
    region: "TX",
    postal_code: "78701",
    country: "US",
  },
};

describe("isAdult", () => {
  it("accepts an 18th birthday on the evaluation date", () => {
    expect(isAdult("2008-09-10", NOW)).toBe(true);
  });

  it("rejects the day before the 18th birthday", () => {
    expect(isAdult("2008-09-11", NOW)).toBe(false);
  });
});

describe("parseIdentity", () => {
  it("normalizes email case and optional blanks to null", () => {
    const result = parseIdentity(
      { ...VALID_IDENTITY, email: "Yeshua@Example.COM", phone: "", ssn_last_4: "" },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.email).toBe("yeshua@example.com");
    expect(result.value.phone).toBeNull();
    expect(result.value.ssn_last_4).toBeNull();
  });

  it("rejects a missing legal name", () => {
    const result = parseIdentity({ ...VALID_IDENTITY, legal_name: "  " }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("invalid_identity");
  });

  it("rejects a non-E.164 phone", () => {
    const result = parseIdentity(
      { ...VALID_IDENTITY, phone: "512-555-1234" },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("invalid_phone");
  });
});

describe("validatePlaidKycPayload", () => {
  it("defaults products to auth + identity for create_link_token", () => {
    const result = validatePlaidKycPayload(
      { action: "create_link_token", creator_id: "creator-1" },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        action: "create_link_token",
        creator_id: "creator-1",
        products: ["auth", "identity"],
      },
    });
  });

  it("rejects an unknown action", () => {
    const result = validatePlaidKycPayload({
      action: "delete",
      creator_id: "c1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("invalid_action");
  });

  it("parses verify_identity with optional tokens", () => {
    const result = validatePlaidKycPayload(
      {
        action: "verify_identity",
        creator_id: " creator-1 ",
        identity: VALID_IDENTITY,
      },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.action).toBe("verify_identity");
    if (result.value.action !== "verify_identity") {
      return;
    }
    expect(result.value.creator_id).toBe("creator-1");
    expect(result.value.identity.legal_name).toBe("Yeshua Throne");
    expect(result.value.public_token).toBeNull();
  });

  it("rejects underage identity on verify", () => {
    const result = validatePlaidKycPayload(
      {
        action: "verify_identity",
        creator_id: "c1",
        identity: { ...VALID_IDENTITY, date_of_birth: "2015-01-01" },
      },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("underage");
  });
});

describe("validateSplitCalculatePayload", () => {
  const LINE = {
    work_id: "trk_01",
    work_title: "Midnight On 6th",
    amount_cents: 10_000,
    splits: [
      {
        payee_id: "c1",
        payee_name: "Yeshua Throne",
        role: "creator",
        share_percent: 70,
      },
      {
        payee_id: "l1",
        payee_name: "Throne Records",
        role: "label",
        share_percent: 30,
      },
    ],
  };

  it("defaults currency to USD, rail to rtp, and settle to false", () => {
    const result = validateSplitCalculatePayload({
      source: "spotify",
      line_items: [LINE],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.currency).toBe("USD");
    expect(result.value.rail).toBe("rtp");
    expect(result.value.settle).toBe(false);
    expect(result.value.line_items[0].splits.map((s) => s.share_bps)).toEqual([
      7000, 3000,
    ]);
  });

  it("prefers share_bps when both share fields are present", () => {
    const result = validateSplitCalculatePayload({
      source: "apple_music",
      line_items: [
        {
          ...LINE,
          splits: [
            {
              payee_id: "c1",
              payee_name: "Yeshua Throne",
              role: "creator",
              share_percent: 50,
              share_bps: 7000,
            },
            {
              payee_id: "l1",
              payee_name: "Throne Records",
              role: "label",
              share_bps: 3000,
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.line_items[0].splits[0].share_bps).toBe(7000);
  });

  it("rejects shares that do not sum to 100%", () => {
    const result = validateSplitCalculatePayload({
      source: "spotify",
      line_items: [
        {
          ...LINE,
          splits: [
            { ...LINE.splits[0], share_percent: 60 },
            { ...LINE.splits[1], share_percent: 30 },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("splits_do_not_balance");
  });

  it("rejects a zero amount", () => {
    const result = validateSplitCalculatePayload({
      source: "spotify",
      line_items: [{ ...LINE, amount_cents: 0 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("invalid_amount");
  });
});

describe("validateBaasPayoutPayload", () => {
  it("accepts a sandbox ACH body", () => {
    const result = validateBaasPayoutPayload({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 7000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.currency).toBe("USD");
    expect(result.value.ledger_transaction_id).toBeNull();
  });

  it("rejects an unknown provider", () => {
    const result = validateBaasPayoutPayload({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 7000,
      provider: "stripe",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("invalid_provider");
  });
});

describe("validateWithholdingPayload", () => {
  it("accepts a payout with optional TIN flags", () => {
    const result = validateWithholdingPayload({
      creator_id: "c1",
      gross_cents: 7000,
      tin_verified: false,
      w9_on_file: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.tax_year).toBeNull();
  });

  it("rejects a bad tax year", () => {
    expect(
      validateWithholdingPayload({
        creator_id: "c1",
        gross_cents: 100,
        tax_year: 19,
      }).ok,
    ).toBe(false);
  });
});

describe("validatePlaidExchangePayload", () => {
  it("accepts a public_token exchange", () => {
    const result = validatePlaidExchangePayload({
      creator_id: "c1",
      public_token: "public-sandbox-abc",
      processor: "unit",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.processor).toBe("unit");
  });

  it("rejects a missing public_token", () => {
    expect(
      validatePlaidExchangePayload({ creator_id: "c1" }).ok,
    ).toBe(false);
  });
});

describe("validateVault payloads", () => {
  it("parses a release and a payout", () => {
    const release = validateVaultReleasePayload({
      action: "release",
      payee_id: "c1",
    });
    expect(release.ok).toBe(true);
    const payout = validateVaultPayoutPayload({ payee_id: "c1", rail: "ach" });
    expect(payout.ok).toBe(true);
    if (!payout.ok) {
      return;
    }
    expect(payout.value.rail).toBe("ach");
    expect(payout.value.amount_cents).toBeUndefined();
  });

  it("rejects an unknown vault action", () => {
    expect(validateVaultReleasePayload({ action: "delete", payee_id: "c1" }).ok).toBe(
      false,
    );
  });
});

describe("validateBaasWebhookPayload", () => {
  it("parses a settled callback", () => {
    const result = validateBaasWebhookPayload({
      event: "payout.settled",
      transfer_id: "xfer_1",
      event_id: "evt_1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.event_id).toBe("evt_1");
  });

  it("rejects a missing transfer or unknown event", () => {
    expect(validateBaasWebhookPayload({ event: "payout.settled" }).ok).toBe(false);
    expect(
      validateBaasWebhookPayload({ event: "payout.nope", transfer_id: "x" }).ok,
    ).toBe(false);
    expect(validateBaasWebhookPayload("nope").ok).toBe(false);
  });
});

describe("validateRecoupmentPayload", () => {
  it("defaults bps to 100% and name to creator_id", () => {
    const result = validateRecoupmentPayload({
      creator_id: "c1",
      recoupment_target_cents: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.recoupment_bps).toBe(10_000);
    expect(result.value.creator_name).toBe("c1");
  });

  it("rejects a bad target or bps", () => {
    expect(
      validateRecoupmentPayload({ creator_id: "c1", recoupment_target_cents: 0 }).ok,
    ).toBe(false);
    expect(
      validateRecoupmentPayload({
        creator_id: "c1",
        recoupment_target_cents: 1,
        recoupment_bps: 0,
      }).ok,
    ).toBe(false);
    expect(validateRecoupmentPayload({ recoupment_target_cents: 1 }).ok).toBe(false);
    expect(validateRecoupmentPayload("nope").ok).toBe(false);
  });
});

describe("validateDisputeLockPayload", () => {
  it("parses a lock with optional line item", () => {
    const result = validateDisputeLockPayload({
      payee_id: "c1",
      locked: true,
      line_item_id: "li_1",
      amount_cents: 50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.amount_cents).toBe(50);
  });

  it("rejects missing fields", () => {
    expect(validateDisputeLockPayload({ locked: true }).ok).toBe(false);
    expect(validateDisputeLockPayload({ payee_id: "c1" }).ok).toBe(false);
    expect(
      validateDisputeLockPayload({ payee_id: "c1", locked: true, amount_cents: 0 }).ok,
    ).toBe(false);
    expect(validateDisputeLockPayload("nope").ok).toBe(false);
  });

  it("accepts a catalog work lock without a payee", () => {
    const result = validateDisputeLockPayload({
      work_id: "trk_01",
      locked: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.work_id).toBe("trk_01");
    expect(result.value.payee_id).toBeUndefined();
  });
});

const DSP_LINE = {
  work_id: "trk_01",
  work_title: "Midnight On 6th",
  amount_cents: 10_000,
  splits: [
    {
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      role: "creator",
      share_percent: 70,
    },
    {
      payee_id: "l1",
      payee_name: "Throne Records",
      role: "label",
      share_percent: 30,
    },
  ],
};

describe("validateDspWebhookPayload", () => {
  it("parses a royalty.report ingest", () => {
    const result = validateDspWebhookPayload({
      event: "royalty.report",
      source: "spotify",
      line_items: [DSP_LINE],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.line_items).toHaveLength(1);
    expect(result.value.source).toBe("spotify");
  });

  it("parses royalty.reversed with a split_run_id", () => {
    const result = validateDspWebhookPayload({
      event: "royalty.reversed",
      source: "spotify",
      split_run_id: "run-1",
      event_id: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.source).toBe("spotify");
    expect(result.value.split_run_id).toBe("run-1");
  });

  it("rejects bad DSP events and missing reverse target", () => {
    expect(validateDspWebhookPayload("nope").ok).toBe(false);
    expect(validateDspWebhookPayload({ event: "payout.settled" }).ok).toBe(false);
    expect(
      validateDspWebhookPayload({ event: "royalty.reversed", source: "spotify" }).ok,
    ).toBe(false);
    expect(
      validateDspWebhookPayload({
        event: "royalty.report",
        event_id: 1,
        source: "spotify",
        line_items: [DSP_LINE],
      }).ok,
    ).toBe(false);
    expect(
      validateDspWebhookPayload({ event: "royalty.adjusted", line_items: [DSP_LINE] }).ok,
    ).toBe(false);
  });
});

describe("validateSplitReversePayload", () => {
  it("requires split_run_id", () => {
    expect(validateSplitReversePayload({ split_run_id: "run-1" }).ok).toBe(true);
    expect(validateSplitReversePayload({}).ok).toBe(false);
    expect(validateSplitReversePayload("nope").ok).toBe(false);
  });
});

describe("validateUnifiedWebhookPayload", () => {
  it("dispatches payout and royalty events", () => {
    const baas = validateUnifiedWebhookPayload({
      event: "payout.settled",
      transfer_id: "xfer_1",
    });
    expect(baas.ok).toBe(true);
    if (baas.ok) {
      expect(baas.value.kind).toBe("baas");
    }
    const dsp = validateUnifiedWebhookPayload({
      event: "royalty.report",
      source: "spotify",
      line_items: [DSP_LINE],
    });
    expect(dsp.ok).toBe(true);
    if (dsp.ok) {
      expect(dsp.value.kind).toBe("dsp");
    }
  });

  it("rejects unknown events and incomplete payloads", () => {
    expect(validateUnifiedWebhookPayload("nope").ok).toBe(false);
    expect(validateUnifiedWebhookPayload({ event: 1 }).ok).toBe(false);
    expect(validateUnifiedWebhookPayload({ event: "unknown.event" }).ok).toBe(false);
    expect(
      validateUnifiedWebhookPayload({ event: "payout.settled" }).ok,
    ).toBe(false);
    expect(
      validateUnifiedWebhookPayload({ event: "royalty.reversed" }).ok,
    ).toBe(false);
  });
});
