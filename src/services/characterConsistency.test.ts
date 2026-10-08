import { describe, expect, it, vi } from "vitest";
import { validateCharacterConsistency } from "./characterConsistency";

describe("validateCharacterConsistency", () => {
  it("flags embeddings at or above the 0.85 anime lock threshold", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ similarity: 0.91 }],
      error: null,
    }));
    const result = await validateCharacterConsistency(
      "11111111-1111-4111-8111-111111111111",
      [0.1, 0.2, 0.3],
      0.85,
      { rpc: rpc as never },
    );
    expect(result.isWithinThreshold).toBe(true);
    expect(result.similarityScore).toBe(0.91);
    expect(rpc).toHaveBeenCalledWith("match_character_embedding", {
      target_character_id: "11111111-1111-4111-8111-111111111111",
      candidate_vector: [0.1, 0.2, 0.3],
    });
  });

  it("fails closed when the match RPC errors", async () => {
    await expect(
      validateCharacterConsistency("char-1", [1], 0.85, {
        rpc: (async () => ({
          data: null,
          error: { message: "vector missing" },
        })) as never,
      }),
    ).rejects.toThrow(/Vector similarity query failed/);
  });
});
