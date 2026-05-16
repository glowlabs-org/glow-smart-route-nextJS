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
  /** `mega` items get the warm headline-prize accent. */
  isMega: boolean;
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

function strDetail(
  details: Record<string, unknown> | null,
  key: string,
): string | null {
  const v = details?.[key];
  return typeof v === "string" ? v : null;
}

export function shopItemMeta(item: V2ShopItem): ShopItemMeta {
  const d = item.details ?? null;

  switch (item.kind) {
    case "miner": {
      const usd = numDetail(d, "minerValueUsd");
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
        isMega: false,
        isTicket: false,
      };
    }

    case "watts": {
      const watts = numDetail(d, "wattsQuantity");
      return {
        image: "/images/shop/watts-100.jpg",
        eyebrow: "Real solar",
        headline: item.label,
        tagline: "Clean capacity credited to your impact",
        blurb:
          "Real solar watts drawn from the Foundation's balance and added to your lifetime impact.",
        stats: [
          {
            label: "Added to impact",
            value: watts ? `${formatNumber(watts)} W` : item.label,
          },
          { label: "Source", value: "Foundation" },
        ],
        isMega: false,
        isTicket: false,
      };
    }

    case "mega": {
      const megaKey = strDetail(d, "megaKey") ?? "";
      const isWatts = megaKey.includes("watts");
      return {
        image: isWatts
          ? "/images/shop/watts-mega.jpg"
          : "/images/shop/miner.jpg",
        eyebrow: "Mega prize",
        headline: item.label,
        tagline: "This week's headline reward",
        blurb:
          "The single biggest prize in this week's shop. Limited stock; once it's gone, it's gone.",
        stats: [],
        isMega: true,
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
        isMega: false,
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
        isMega: false,
        isTicket: false,
      };
  }
}
