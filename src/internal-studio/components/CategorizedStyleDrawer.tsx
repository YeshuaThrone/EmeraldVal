"use client";

import React, { useMemo, useState } from "react";
import {
  ANIMATION_STYLE_CATEGORIES,
  COMPLETE_30_ANIMATION_STYLES,
  type AnimationStyleCategory,
  type AnimationStyleType,
} from "@/config/animationStyles";

interface CategorizedStyleDrawerProps {
  shotId: string;
  projectId: string;
  onSingleRender: (styleType: AnimationStyleType) => void;
  onBatchRender: (selectedStyles: AnimationStyleType[]) => void;
}

export function CategorizedStyleDrawer({
  shotId,
  projectId,
  onSingleRender,
  onBatchRender,
}: CategorizedStyleDrawerProps) {
  void shotId;
  void projectId;

  const [activeCategory, setActiveCategory] =
    useState<AnimationStyleCategory>("Golden Age");
  const [selectedStyles, setSelectedStyles] = useState<AnimationStyleType[]>([
    "golden_age_cel",
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  const allPresets = useMemo(
    () => Object.values(COMPLETE_30_ANIMATION_STYLES),
    [],
  );

  const filteredPresets = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allPresets.filter((preset) => {
      const matchesCategory = searchQuery
        ? true
        : preset.category === activeCategory;
      const matchesSearch =
        preset.name.toLowerCase().includes(query) ||
        preset.era.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [allPresets, activeCategory, searchQuery]);

  const toggleStyleSelection = (id: AnimationStyleType) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAllInCategory = () => {
    const categoryIds = filteredPresets.map((preset) => preset.id);
    setSelectedStyles(Array.from(new Set([...selectedStyles, ...categoryIds])));
  };

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold text-emerald-400">
            30-Style Animation Registry
          </h2>
          <p className="text-xs text-slate-400">
            Select a preset or queue a multi-style batch render.
          </p>
        </div>

        <input
          type="text"
          placeholder="Search 30 styles..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none md:w-64"
        />
      </div>

      {!searchQuery && (
        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {ANIMATION_STYLE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === cat
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 grid max-h-80 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPresets.map((preset) => {
          const isSelected = selectedStyles.includes(preset.id);
          return (
            <div
              key={preset.id}
              onClick={() => toggleStyleSelection(preset.id)}
              className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3 transition ${
                isSelected
                  ? "border-emerald-500 bg-emerald-950/30 text-white"
                  : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    {preset.name}
                  </span>
                  <span className="text-[10px] text-slate-500">{preset.era}</span>
                </div>
                <p className="mb-2 line-clamp-2 text-[11px] text-slate-400">
                  {preset.promptDirective}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/50 pt-2">
                <span className="font-mono text-[9px] tracking-wider text-slate-500 uppercase">
                  W: {preset.styleWeight}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSingleRender(preset.id);
                  }}
                  className="rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-emerald-600"
                >
                  Render Single
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-3 sm:flex-row">
        <button
          type="button"
          onClick={selectAllInCategory}
          className="text-xs text-slate-400 transition hover:text-emerald-400"
        >
          Select All in Category ({filteredPresets.length})
        </button>

        <button
          type="button"
          disabled={selectedStyles.length === 0}
          onClick={() => onBatchRender(selectedStyles)}
          className="w-full rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
        >
          Trigger Parallel Batch Render ({selectedStyles.length} Styles)
        </button>
      </div>
    </div>
  );
}
