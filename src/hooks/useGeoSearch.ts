import { useQuery } from "react-query";
import { geoSearchProviders, searchAll } from "../geo/search/providers";
import type { GeoBounds, GeoSearchProvider } from "../geo/search/types";

export function useGeoSearch(
  query: string,
  { bounds, providers = geoSearchProviders }: { bounds?: GeoBounds; providers?: GeoSearchProvider[] } = {},
) {
  return useQuery({
    queryKey: ["geo-search", providers.map(({ id }) => id), bounds ?? null, query],
    queryFn: ({ signal }) => searchAll(providers, query, { signal, bounds, language: navigator.language }),
    enabled: query.length > 0,
    staleTime: 10 * 60_000,
    cacheTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
