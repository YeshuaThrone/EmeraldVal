"use client";

import React, { useState } from "react";

interface CraftingIngredient {
  itemId: string;
  count: number;
}

interface RecipeStep {
  outputItemId: string;
  outputCount: number;
  craftingTableType: string;
  ingredients: CraftingIngredient[];
}

interface CraftingTreeResult {
  targetItem: string;
  targetCount: number;
  rawMaterialsNeeded: Record<string, number>;
  executionSteps: RecipeStep[];
}

export default function CraftingVisualizer() {
  const [itemId, setItemId] = useState("minecraft:netherite_chestplate");
  const [count, setCount] = useState(1);
  const [result, setResult] = useState<CraftingTreeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/minecraft/crafting/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, count }),
      });
      const json = (await response.json()) as {
        error?: string;
        data?: CraftingTreeResult;
      };
      if (!response.ok) throw new Error(json.error || "Failed to solve crafting tree");
      setResult(json.data ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to solve crafting tree");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h2>Minecraft Recipe Solver</h2>
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <input
          type="text"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          placeholder="e.g. minecraft:netherite_chestplate"
          style={{ flex: 1, padding: "8px", fontSize: "14px" }}
        />
        <input
          type="number"
          min="1"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ width: "80px", padding: "8px", fontSize: "14px" }}
        />
        <button onClick={handleSolve} disabled={loading} style={{ padding: "8px 16px", cursor: "pointer" }}>
          {loading ? "Solving..." : "Solve Tree"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginBottom: "16px" }}>Error: {error}</div>}

      {result && (
        <div>
          <h3>Raw Material Requirements</h3>
          <ul style={{ background: "#f5f5f5", padding: "16px 24px", borderRadius: "6px" }}>
            {Object.entries(result.rawMaterialsNeeded).map(([mat, qty]) => (
              <li key={mat}>
                <strong>{mat}</strong>: {qty}
              </li>
            ))}
          </ul>

          <h3>Execution Crafting Sequence</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {result.executionSteps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  background: "#fff",
                }}
              >
                <div>
                  <strong>Step {idx + 1}:</strong> Craft {step.outputCount}x {step.outputItemId}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  Station: <code>{step.craftingTableType}</code>
                </div>
                <div style={{ fontSize: "13px", marginTop: "6px" }}>
                  Ingredients:{" "}
                  {step.ingredients.map((i) => `${i.count}x ${i.itemId}`).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
