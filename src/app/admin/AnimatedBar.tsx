"use client";

import { useEffect, useState } from "react";

/**
 * A horizontal progress-bar track + fill that animates its width from 0 to
 * `percent` on mount via a CSS width transition. Under
 * prefers-reduced-motion the transition is stripped (motion-reduce:), so
 * the bar still lands on its final width immediately with no animation.
 */
export default function AnimatedBar({
  percent,
  fillClassName = "bg-gradient-to-r from-[#0055FF] to-[#00D2FF]",
  trackClassName = "bg-atx-line",
  className = "",
}: {
  percent: number;
  fillClassName?: string;
  trackClassName?: string;
  className?: string;
}) {
  const target = Math.max(0, Math.min(100, percent));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Paint at 0 first, then flip to the target on the next frame so the
    // width transition actually has a starting value to animate from.
    const frame = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div
      className={`h-3 overflow-hidden rounded-full ${trackClassName} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${fillClassName}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
