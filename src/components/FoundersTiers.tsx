import { Mic2, Sparkles, Star } from "lucide-react";

/** Static support tier content — no backend, no pin data, just the offer. */
const TIERS = [
  {
    name: "Founding Supporter",
    price: "$10/mo",
    icon: Star,
    description:
      "Back the street performers keeping Austin's live music alive.",
    perks: [
      "Name on the Founders wall",
      "Monthly supporter shoutout",
      "Early access to festival lineups",
    ],
    cta: "Become a Founding Supporter",
  },
  {
    name: "Headliner",
    price: "$25/mo",
    icon: Mic2,
    description: "For fans who want their support to go further, every month.",
    perks: [
      "Everything in Founding Supporter",
      "Priority tip routing to featured acts",
      "Quarterly Headliner badge",
    ],
    cta: "Go Headliner",
  },
  {
    name: "Backstage",
    price: "$50/mo",
    icon: Sparkles,
    description: "The top tier for Austin's most dedicated music patrons.",
    perks: [
      "Everything in Headliner",
      "Invite to the annual Founders meetup",
      "Direct line to featured performers",
    ],
    cta: "Get Backstage Access",
  },
] as const;

/**
 * Founders Tier — static support-tier cards with dark-red primary CTAs.
 * Content-only: no backend, no payment processing, no state.
 */
export default function FoundersTiers() {
  return (
    <section aria-label="Founders Tier" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-atx-ink">
          Founders Tier
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Support the scene year-round with a recurring Founders membership.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map(({ name, price, icon: Icon, description, perks, cta }) => (
          <article
            key={name}
            className="flex flex-col gap-4 rounded-2xl border border-atx-line bg-atx-paper p-5 shadow-[0_0_0_1px_rgba(28,25,23,0.05)]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-atx-red/15 text-atx-red-deep">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-atx-ink">
                  {name}
                </h3>
                <p className="text-xs font-semibold text-atx-red-deep">
                  {price}
                </p>
              </div>
            </div>

            <p className="text-sm text-stone-500">{description}</p>

            <ul className="flex flex-1 flex-col gap-1.5 text-sm text-stone-600">
              {perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-atx-red" />
                  {perk}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="mt-1 inline-flex items-center justify-center rounded-2xl bg-atx-red px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(155,27,48,0.35)] transition hover:bg-atx-red-deep"
            >
              {cta}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
