import { describe, expect, it } from "vitest";
import { validateCovnantSignupPayload } from "@/lib/covnant/signupValidation";

const VALID = {
  stage_name: "Night Owl",
  legal_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+15125550123",
  core_industry: "music",
  title: "Performer",
  password: "correct-horse",
  udr_terms_accepted: true,
};

describe("validateCovnantSignupPayload", () => {
  it("accepts a complete payload and trims/lowercases identity fields", () => {
    const result = validateCovnantSignupPayload({
      ...VALID,
      stage_name: "  Night Owl  ",
      legal_name: "  Ada Lovelace  ",
      email: "  Ada@Example.COM  ",
      core_industry: "  music  ",
      title: "  Performer  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        ...VALID,
        email: "ada@example.com",
      });
    }
  });

  it("treats omitted, null, and blank phone as null", () => {
    for (const phone of [undefined, null, "", "   "]) {
      const result = validateCovnantSignupPayload({ ...VALID, phone });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.phone).toBeNull();
      }
    }
  });

  it("rejects a non-object body", () => {
    const result = validateCovnantSignupPayload(["not", "an", "object"]);
    expect(result).toEqual({
      ok: false,
      code: "malformed_body",
      message: "Request body must be a JSON object.",
    });
  });

  it("rejects missing required strings", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...VALID, stage_name: " " }, "missing_stage_name"],
      [{ ...VALID, legal_name: "" }, "missing_legal_name"],
      [{ ...VALID, core_industry: 1 }, "missing_core_industry"],
      [{ ...VALID, title: null }, "missing_title"],
    ];
    for (const [input, code] of cases) {
      const result = validateCovnantSignupPayload(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(code);
      }
    }
  });

  it("rejects an invalid email", () => {
    const result = validateCovnantSignupPayload({ ...VALID, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_email");
    }
  });

  it("rejects a phone that is not E.164", () => {
    for (const phone of ["512-555-0123", "15125550123"]) {
      const result = validateCovnantSignupPayload({ ...VALID, phone });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("invalid_phone");
      }
    }
  });

  it("rejects a password shorter than 8 characters without trimming it", () => {
    const result = validateCovnantSignupPayload({ ...VALID, password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_password");
    }
  });

  it("requires udr_terms_accepted to be boolean true", () => {
    for (const udr_terms_accepted of [false, "true", 1, null, undefined]) {
      const result = validateCovnantSignupPayload({
        ...VALID,
        udr_terms_accepted,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("udr_terms_required");
      }
    }
  });
});
