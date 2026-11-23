import { expect, test } from "bun:test";
import { createNominatimProvider, toGeoSearchResult, type NominatimPlace } from "../src/geo/search/nominatim";
import { normalizeGeoSearchQuery, searchAll } from "../src/geo/search/providers";
import type { GeoSearchProvider } from "../src/geo/search/types";

const wroclaw: NominatimPlace = {
  place_id: 1,
  lat: "51.1079",
  lon: "17.0385",
  name: "Wrocław",
  display_name: "Wrocław, województwo dolnośląskie, Polska",
  addresstype: "city",
  boundingbox: ["51.0426", "51.2100", "16.8073", "17.1762"],
};

function provider(id: string, search: GeoSearchProvider["search"]): GeoSearchProvider {
  return { id, label: id.toUpperCase(), minQueryLength: 2, search };
}

test("maps a Nominatim place with a bounding box", () => {
  expect(toGeoSearchResult("osm", wroclaw)).toEqual({
    id: "osm:1",
    providerId: "osm",
    label: "Wrocław",
    description: "Wrocław, województwo dolnośląskie, Polska",
    category: "city",
    center: { lat: 51.1079, lng: 17.0385 },
    bounds: { south: 51.0426, north: 51.21, west: 16.8073, east: 17.1762 },
  });
});

test("maps a Nominatim point without bounds or name", () => {
  const result = toGeoSearchResult("osm", {
    place_id: 2,
    lat: "51.1",
    lon: "17.0",
    display_name: "Plac Grunwaldzki 1, Wrocław",
    type: "house",
    boundingbox: ["51.1", "51.1", "17.0", "17.0"],
  });
  expect(result?.label).toBe("Plac Grunwaldzki 1");
  expect(result?.bounds).toBeUndefined();
  expect(result?.category).toBe("house");
});

test("drops places with invalid coordinates", () => {
  expect(toGeoSearchResult("osm", { ...wroclaw, lat: "nope" })).toBeNull();
});

test("Nominatim provider builds a bounded Polish query", async () => {
  let requested = "";
  const search = createNominatimProvider({
    baseUrl: "https://example.test/nominatim/",
    fetch: (async (url: string) => {
      requested = url;
      return new Response(JSON.stringify([wroclaw]));
    }) as typeof fetch,
  });

  const results = await search.search("Wrocław", {
    limit: 3,
    language: "pl",
    bounds: { north: 55, east: 25, south: 49, west: 14 },
  });

  const url = new URL(requested);
  expect(url.origin + url.pathname).toBe("https://example.test/nominatim/search");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    q: "Wrocław",
    format: "jsonv2",
    limit: "3",
    countrycodes: "pl",
    viewbox: "14,55,25,49",
    bounded: "1",
    "accept-language": "pl",
  });
  expect(results.map(({ id }) => id)).toEqual(["osm:1"]);
});

test("Nominatim provider reports HTTP errors", async () => {
  const search = createNominatimProvider({
    fetch: (async () => new Response("", { status: 429 })) as unknown as typeof fetch,
  });
  await expect(search.search("Wrocław", {})).rejects.toThrow("OpenStreetMap search failed (429).");
});

test("searchAll keeps results from providers that succeed", async () => {
  const outcomes = await searchAll([
    provider("good", async (query) => [{ id: "good:1", providerId: "good", label: query, center: { lat: 0, lng: 0 } }]),
    provider("bad", async () => { throw new Error("down"); }),
  ], "  Rynek   Wrocław ");

  expect(outcomes).toEqual([
    { providerId: "good", label: "GOOD", results: [{ id: "good:1", providerId: "good", label: "Rynek Wrocław", center: { lat: 0, lng: 0 } }] },
    { providerId: "bad", label: "BAD", results: [], error: new Error("down") },
  ]);
});

test("searchAll skips providers below their minimum query length", async () => {
  let called = false;
  const outcomes = await searchAll([provider("p", async () => { called = true; return []; })], " a ");
  expect(called).toBeFalse();
  expect(outcomes).toEqual([]);
});

test("searchAll propagates aborts", async () => {
  const abort = new DOMException("aborted", "AbortError");
  await expect(searchAll([provider("p", async () => { throw abort; })], "Wrocław")).rejects.toBe(abort);
});

test("normalizes whitespace in queries", () => {
  expect(normalizeGeoSearchQuery("  a \n b ")).toBe("a b");
});
