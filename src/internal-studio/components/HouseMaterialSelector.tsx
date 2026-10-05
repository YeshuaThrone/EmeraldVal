"use client";

import React, { useMemo, useState } from "react";
import {
  CARTOON_HOUSING_STYLES,
  HOUSING_TIERS,
  TIER_MATERIALS,
  compileCartoonStructurePrompt,
  formatHousingLabel,
  type CartoonHousingStyle,
  type HousingTier,
} from "@/config/housingMaterials";

interface HouseMaterialSelectorProps {
  onCompiledPromptChange?: (prompt: string) => void;
}

export function HouseMaterialSelector({
  onCompiledPromptChange,
}: HouseMaterialSelectorProps) {
  const [tier, setTier] = useState<HousingTier>("PALAIS_ROSE_MANSION");
  const [style, setStyle] = useState<CartoonHousingStyle>("GHIBLI_WATERCOLOR");
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState(0);

  const compiledPrompt = useMemo(
    () =>
      compileCartoonStructurePrompt({
        tier,
        style,
        materialIndex: selectedMaterialIndex,
      }),
    [tier, style, selectedMaterialIndex],
  );

  const activeMaterial =
    TIER_MATERIALS[tier][selectedMaterialIndex] ?? TIER_MATERIALS[tier][0]!;

  return (
    <div className="w-full max-w-4xl space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 font-sans text-white">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold text-emerald-400">
            Cartoon Housing & Material Builder
          </h3>
          <p className="text-xs text-slate-400">
            Configure architectural structures from primitive dirt to French Palais
            Rose estates.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-400">
          Active: {formatHousingLabel(tier)}
        </span>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold tracking-wider text-slate-300 uppercase">
          1. Architectural Tier
        </label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {HOUSING_TIERS.map((nextTier) => (
            <button
              key={nextTier}
              type="button"
              onClick={() => {
                setTier(nextTier);
                setSelectedMaterialIndex(0);
                onCompiledPromptChange?.(
                  compileCartoonStructurePrompt({
                    tier: nextTier,
                    style,
                    materialIndex: 0,
                  }),
                );
              }}
              className={`rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                tier === nextTier
                  ? "border-emerald-400 bg-emerald-500/20 text-white shadow-lg shadow-emerald-500/10"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="mb-1 block text-[10px] text-slate-500">TIER</div>
              {formatHousingLabel(nextTier)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <label className="block text-xs font-bold tracking-wider text-slate-300 uppercase">
            2. Material Palette
          </label>
          <div className="space-y-2">
            {TIER_MATERIALS[tier].map((mat, idx) => (
              <button
                key={`${tier}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedMaterialIndex(idx);
                  onCompiledPromptChange?.(
                    compileCartoonStructurePrompt({
                      tier,
                      style,
                      materialIndex: idx,
                    }),
                  );
                }}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  selectedMaterialIndex === idx
                    ? "border-emerald-500/50 bg-slate-800 text-emerald-300"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-bold">{mat.facade}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Primary: <span className="text-slate-200">{mat.primary}</span> |
                  Roof: <span className="text-slate-200">{mat.roof}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <label className="block text-xs font-bold tracking-wider text-slate-300 uppercase">
            3. Cartoon Art Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CARTOON_HOUSING_STYLES.map((nextStyle) => (
              <button
                key={nextStyle}
                type="button"
                onClick={() => {
                  setStyle(nextStyle);
                  onCompiledPromptChange?.(
                    compileCartoonStructurePrompt({
                      tier,
                      style: nextStyle,
                      materialIndex: selectedMaterialIndex,
                    }),
                  );
                }}
                className={`rounded-lg border p-2.5 text-center text-xs font-medium transition-all ${
                  style === nextStyle
                    ? "border-emerald-400 bg-emerald-500/20 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                {formatHousingLabel(nextStyle)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase">
            Compiled Engine Prompt
          </span>
          <span className="font-mono text-[10px] text-emerald-400">
            Ready for Render
          </span>
        </div>
        <p className="rounded-lg border border-slate-800/80 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
          {compiledPrompt}
        </p>
        <p className="text-[10px] text-slate-500">
          Active facade: {activeMaterial.facade}
        </p>
      </div>
    </div>
  );
}
