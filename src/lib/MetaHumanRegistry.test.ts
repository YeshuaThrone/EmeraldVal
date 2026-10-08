import { afterEach, describe, expect, it } from "vitest";
import {
  acquireMetaHuman,
  getMetaHumanConfig,
  listMetaHumans,
  METAHUMAN_REGISTRY,
  releaseMetaHuman,
  resetMetaHumanPool,
} from "./MetaHumanRegistry";

describe("MetaHumanRegistry", () => {
  afterEach(() => {
    resetMetaHumanPool();
  });

  it("resolves HOST_01 Marcus and GUEST_01 Elena", () => {
    expect(getMetaHumanConfig("HOST_01")).toMatchObject({
      name: "Marcus (Main Anchor)",
      liveLinkSubjectName: "Audio2Face_Marcus",
      blueprintPath: "/Game/MetaHumans/Marcus/BP_Marcus.BP_Marcus_C",
    });
    expect(getMetaHumanConfig("guest_01").id).toBe("GUEST_01");
    expect(listMetaHumans()).toHaveLength(Object.keys(METAHUMAN_REGISTRY).length);
  });

  it("rejects unknown host slots", () => {
    expect(() => getMetaHumanConfig("HOST_99")).toThrow(
      /non-existent in active library/,
    );
  });

  it("acquires a slot once and releases it back to the pool", () => {
    const marcus = acquireMetaHuman("HOST_01");
    expect(marcus.liveLinkSubjectName).toBe("Audio2Face_Marcus");
    expect(() => acquireMetaHuman("HOST_01")).toThrow(/already assigned/);
    releaseMetaHuman("HOST_01");
    expect(acquireMetaHuman("HOST_01").id).toBe("HOST_01");
  });
});
