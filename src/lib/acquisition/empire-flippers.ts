import type { AcquisitionTarget } from "./types";

const API_URL = "https://api.empireflippers.com/api/v1/listings/list";

type EmpireListing = {
  listing_number?: number;
  listing_price?: number;
  average_annual_net_profit?: number;
  average_annual_gross_revenue?: number;
  annual_listing_multiple?: number;
  monetization?: string;
  monetizations?: string[];
  niche?: string;
  niches?: string[];
  country?: string;
  first_made_money_at?: string;
  days_on_marketplace?: number;
  listing_status?: string;
  title?: string;
  description?: string;
};

type EmpireResponse = {
  data?: EmpireListing[];
  listings?: EmpireListing[];
};

export async function fetchEmpireFlippersListings(options: {
  page?: number;
  limit?: number;
  query?: string;
} = {}) {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(Math.min(options.limit ?? 20, 100)),
    listing_status: "For Sale",
  });

  if (options.query) params.set("q", options.query);

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Empire Flippers API returned ${response.status}`);
  }

  const payload = (await response.json()) as EmpireResponse;
  const listings = payload.data ?? payload.listings ?? [];
  return listings.map(normalizeEmpireListing);
}

function normalizeEmpireListing(item: EmpireListing): AcquisitionTarget {
  const price = item.listing_price ?? 0;
  const profit = item.average_annual_net_profit ?? 0;
  const revenue = item.average_annual_gross_revenue ?? 0;
  const multiple = item.annual_listing_multiple ?? (profit > 0 ? price / profit : 0);
  const category = item.niches?.[0] ?? item.niche ?? "Online Business";
  const model = item.monetizations?.join(", ") ?? item.monetization ?? "Unknown";
  const listingNumber = item.listing_number ?? Math.floor(Math.random() * 1_000_000);

  return {
    id: `ef-${listingNumber}`,
    name: item.title?.trim() || `Empire Flippers #${listingNumber}`,
    category,
    model,
    summary: item.description?.trim() || `${model} business listed for sale.`,
    description: item.description?.trim() || "",
    signals: [
      item.listing_status === "For Sale" ? "For sale" : "Marketplace listing",
      profit > 0 ? "Profitable" : "Profit unverified",
      multiple > 0 ? `${multiple.toFixed(1)}x listing multiple` : "Multiple unavailable",
    ],
    stage: "For Sale",
    score: calculateScreenScore({ price, profit, revenue, multiple }),
    revenueProfile: revenue ? `Annual revenue: $${Math.round(revenue).toLocaleString()}` : "Revenue unavailable",
    growthProfile: "Validate recent growth before acquisition.",
    aiOpportunity: "AI opportunity requires target-specific research.",
    acquisitionRationale: [
      profit > 0 ? "Public listing reports positive annual net profit." : "Profitability requires validation.",
      multiple > 0 ? `Public asking-price multiple is approximately ${multiple.toFixed(1)}x.` : "Valuation multiple requires validation.",
    ],
    risks: [
      "Public listing data is not a substitute for financial due diligence.",
      "Validate traffic, customer concentration, retention, and owner dependence.",
    ],
    sourceType: "import",
  };
}

function calculateScreenScore(input: { price: number; profit: number; revenue: number; multiple: number }) {
  let score = 50;
  if (input.profit > 0) score += 15;
  if (input.revenue > 0) score += 10;
  if (input.multiple > 0 && input.multiple <= 3) score += 15;
  else if (input.multiple > 3 && input.multiple <= 5) score += 5;
  if (input.price > 0 && input.price <= 1_000_000) score += 5;
  return Math.min(score, 100);
}
