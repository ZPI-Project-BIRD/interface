import { createNominatimProvider } from "./nominatim";
import type { GeoSearchOptions, GeoSearchProvider, GeoSearchProviderOutcome } from "./types";

export const geoSearchProviders: GeoSearchProvider[] = [
  createNominatimProvider({ baseUrl: import.meta.env.VITE_NOMINATIM_URL?.trim() || undefined }),
];

export function normalizeGeoSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export async function searchAll(
  providers: GeoSearchProvider[],
  query: string,
  options: GeoSearchOptions = {},
): Promise<GeoSearchProviderOutcome[]> {
  const normalized = normalizeGeoSearchQuery(query);
  const applicable = providers.filter((provider) => normalized.length >= provider.minQueryLength);
  const settled = await Promise.allSettled(applicable.map((provider) => provider.search(normalized, options)));

  return settled.map((outcome, index) => {
    const { id: providerId, label, attribution } = applicable[index];
    if (outcome.status === "fulfilled") return { providerId, label, attribution, results: outcome.value };
    if (outcome.reason instanceof Error && outcome.reason.name === "AbortError") throw outcome.reason;
    const error = outcome.reason instanceof Error ? outcome.reason : new Error(String(outcome.reason));
    return { providerId, label, attribution, results: [], error };
  });
}
