import Link from "next/link";
import { ADMIN_ROUTE, FAN_MAP_ROUTE } from "@/lib/routes";

interface ViewToggleProps {
  /** Which view is currently active — drives which link gets aria-current. */
  variant: "fan" | "admin";
}

const linkClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-atx-red bg-atx-red/15 text-atx-red-deep"
      : "border-atx-line bg-atx-paper text-stone-500 hover:border-atx-blue/40 hover:text-atx-ink"
  }`;

/**
 * Shared top-bar toggle between the fan map and the admin dashboard.
 * Rendered in both headers so either view is always one click away from
 * the other; the active view is marked with aria-current="page".
 */
export default function ViewToggle({ variant }: ViewToggleProps) {
  return (
    <nav
      aria-label="View switcher"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-atx-line bg-atx-paper/80 p-1 backdrop-blur-md"
    >
      <Link
        href={FAN_MAP_ROUTE}
        aria-current={variant === "fan" ? "page" : undefined}
        className={linkClass(variant === "fan")}
      >
        Fan Map View
      </Link>
      <Link
        href={ADMIN_ROUTE}
        aria-current={variant === "admin" ? "page" : undefined}
        className={linkClass(variant === "admin")}
      >
        Civic / Admin Analytics Dashboard
      </Link>
    </nav>
  );
}
