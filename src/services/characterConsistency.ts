import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/internal-studio/api/supabaseAdmin";

export const CHARACTER_CONSISTENCY_THRESHOLD = 0.85;

export interface VectorValidationResult {
  isWithinThreshold: boolean;
  similarityScore: number;
  characterId: string;
}

export interface CharacterEmbeddingRpc {
  rpc: SupabaseClient["rpc"];
}

/**
 * Validates a frame embedding against a canonical character embedding stored in pgvector.
 * Threshold defaults to 0.85 for high fidelity anime character consistency.
 */
export async function validateCharacterConsistency(
  characterId: string,
  candidateEmbedding: number[],
  similarityThreshold = CHARACTER_CONSISTENCY_THRESHOLD,
  client?: CharacterEmbeddingRpc,
): Promise<VectorValidationResult> {
  if (!characterId.trim()) {
    throw new Error("characterId is required");
  }
  if (!Array.isArray(candidateEmbedding) || candidateEmbedding.length === 0) {
    throw new Error("candidateEmbedding must be a non-empty number array");
  }

  const supabase = client ?? getSupabaseAdmin();
  const { data, error } = await supabase.rpc("match_character_embedding", {
    target_character_id: characterId,
    candidate_vector: candidateEmbedding,
  });

  if (error) {
    throw new Error(`Vector similarity query failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const similarityScore: number =
    typeof rows[0]?.similarity === "number" ? rows[0].similarity : 0;

  return {
    isWithinThreshold: similarityScore >= similarityThreshold,
    similarityScore,
    characterId,
  };
}
