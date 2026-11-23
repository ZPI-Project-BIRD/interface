import type { GeoBounds, GeoSearchProvider, GeoSearchResult } from "./types";

export const PUBLIC_NOMINATIM_URL = "https://nominatim.openstreetmap.org";

export interface NominatimPlace {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  addresstype?: string;
  boundingbox?: [string, string, string, string];
}

export interface NominatimProviderConfig {
  id?: string;
  label?: string;
  baseUrl?: string;
  countryCodes?: string[];
  fetch?: typeof fetch;
}

function parseBoundingBox(box: NominatimPlace["boundingbox"]): GeoBounds | undefined {
  if (!box) return undefined;
  const [south, north, west, east] = box.map(Number);
  if (![south, north, west, east].every(Number.isFinite)) return undefined;
  if (south === north && west === east) return undefined;
  return { north, east, south, west };
}

export function toGeoSearchResult(providerId: string, place: NominatimPlace): GeoSearchResult | null {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label = place.name?.trim() || place.display_name.split(",")[0].trim();
  return {
    id: `${providerId}:${place.place_id}`,
    providerId,
    label,
    description: place.display_name === label ? undefined : place.display_name,
    category: place.addresstype ?? place.type,
    center: { lat, lng },
    bounds: parseBoundingBox(place.boundingbox),
  };
}

export function createNominatimProvider({
  id = "osm",
  label = "OpenStreetMap",
  baseUrl = PUBLIC_NOMINATIM_URL,
  countryCodes = ["pl"],
  fetch: fetchImpl = (...args) => fetch(...args),
}: NominatimProviderConfig = {}): GeoSearchProvider {
  return {
    id,
    label,
    attribution: "© OpenStreetMap contributors",
    minQueryLength: 2,
    async search(query, { signal, limit = 8, bounds, language }) {
      const params = new URLSearchParams({ q: query, format: "jsonv2", limit: String(limit) });
      if (countryCodes.length) params.set("countrycodes", countryCodes.join(","));
      if (bounds) {
        params.set("viewbox", [bounds.west, bounds.north, bounds.east, bounds.south].join(","));
        params.set("bounded", "1");
      }
      if (language) params.set("accept-language", language);

      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/search?${params}`, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`${label} search failed (${response.status}).`);
      const places = (await response.json()) as NominatimPlace[];
      return places.flatMap((place) => toGeoSearchResult(id, place) ?? []);
    },
  };
}
