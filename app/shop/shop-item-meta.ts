/**
 * Presentation metadata for points-shop prizes.
 *
 * The shop API only carries a `kind` + a small kind-specific `details`
 * payload. This maps each item to the imagery, copy, and stat strip the
 * premium prize cards render, so the card component stays purely visual.
 */
import { formatNumber } from "@/utils/format";
import type { V2ShopItem } from "@/hooks/v2-points-shop";

export interface ShopStat {
  label: string;
  value: string;
}

export interface ShopItemMeta {
  /** Full-bleed photo, or null for the punched-ticket treatment. */
  image: string | null;
  /** Short overline rendered as a chip. */
  eyebrow: string;
  /** Display headline (cleaner than the raw API label where needed). */
  headline: string;
  /** One-line descriptor under the headline. */
  tagline: string;
  /** A sentence of context. */
  blurb: string;
  /** Up to two compact stats. */
  stats: ShopStat[];
  /** Featured headline-prize items get the warm accent + "Mega prize" treatment. */
  isFeatured: boolean;
  /** `early_access` renders as a punched ticket instead of a photo card. */
  isTicket: boolean;
}

function numDetail(
  details: Record<string, unknown> | null,
  key: string,
): number | null {
  const v = details?.[key];
  return typeof v === "number" ? v : null;
}

export function shopItemMeta(item: V2ShopItem): ShopItemMeta {
  const d = item.details ?? null;
  // The weekly headline prize is now a normal miner/watts item flagged with
  // `details.featured`; it keeps the warm "Mega prize" headline treatment.
  const isFeatured = d?.featured === true;

  switch (item.kind) {
    case "miner": {
      const usd = numDetail(d, "minerValueUsd");
      if (isFeatured) {
        return {
          image: "/images/shop/miner.jpg",
          eyebrow: "Mega prize",
          headline: item.label,
          tagline: "This week's headline reward",
          blurb:
            "The single biggest prize in this week's shop. Limited stock; once it's gone, it's gone.",
          stats: [],
          isFeatured: true,
          isTicket: false,
        };
      }
      return {
        image: "/images/shop/miner.jpg",
        eyebrow: "Mining position",
        headline: item.label,
        tagline: usd
          ? `A $${usd} stake in a live solar farm`
          : "A stake in a live solar farm",
        blurb:
          "A real mining position in a Glow solar farm, fulfilled straight to your wallet.",
        stats: [
          { label: "Position value", value: usd ? `$${usd}` : "-" },
          { label: "Reward horizon", value: "100 weeks" },
        ],
        isFeatured: false,
        isTicket: false,
      };
    }

    case "watts": {
      const watts = numDetail(d, "wattsQuantity");
      if (isFeatured) {
        return {
          // Curated hero used only as a FALLBACK: the cards (view.tsx /
          // purchase-dialog.tsx) prefer the live source-farm photo (the "farm
          // story") via impactSourcePreview, and drop to this image when no
          // source preview exists.
          image: "/images/shop/watts-mega.jpg",
          eyebrow: "Mega prize",
          headline: item.label,
          tagline: "This week's headline reward",
          blurb:
            "The single biggest prize in this week's shop. Limited stock; once it's gone, it's gone.",
          stats: [],
          isFeatured: true,
          isTicket: false,
        };
      }
      const sources = item.impactSourcePreview?.sources ?? [];
      const source = sources[0];
      const farmName = source?.farmName ?? "a Foundation solar farm";
      const region = source?.regionName ?? null;
      const extraCount = Math.max(0, sources.length - 1);
      const carbon = sources.reduce(
        (acc, s) => acc + (Number(s.carbonCredits) || 0),
        0,
      );
      const sourceLabel =
        extraCount > 0
          ? `${farmName} and ${extraCount} more farm${
              extraCount === 1 ? "" : "s"
            }`
          : farmName;
      return {
        image: source?.imageUrl ?? "/images/shop/watts-100.jpg",
        eyebrow: "Farm-backed solar",
        headline: item.label,
        tagline: region ? `From ${sourceLabel} in ${region}` : `From ${sourceLabel}`,
        blurb:
          "Redeem points for farm-backed watts. The watts are the main thing; the associated impact comes with them, including Carbon Credits today and the Solar Footprint equivalents they power.",
        stats: [
          {
            label: "Watts attributed",
            value: watts ? `${formatNumber(watts)} W` : item.label,
          },
          {
            label: "Carbon attributed",
            value: sources.length > 0 ? formatNumber(carbon) : "-",
          },
        ],
        isFeatured: false,
        isTicket: false,
      };
    }

    case "early_access": {
      const minutes = numDetail(d, "earlyAccessMinutes") ?? 15;
      const weeks = numDetail(d, "earlyAccessValidityWeeks") ?? 4;
      return {
        image: null,
        eyebrow: "Early access",
        headline: `${minutes}-min head start`,
        tagline: "Skip the line on new miner windows",
        blurb: `Enter miner windows ${minutes} minutes ahead of everyone else. Valid for ${weeks} weeks, miners only. A head start does not guarantee inventory.`,
        stats: [],
        isFeatured: false,
        isTicket: true,
      };
    }

    default:
      return {
        image: null,
        eyebrow: "Prize",
        headline: item.label,
        tagline: "",
        blurb: "",
        stats: [],
        isFeatured: false,
        isTicket: false,
      };
  }
}
