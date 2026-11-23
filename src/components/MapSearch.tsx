import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as L from "leaflet";
import { Input, Spin } from "antd";
import { palette } from "../theme";
import { useGeoSearch } from "../hooks/useGeoSearch";
import { normalizeGeoSearchQuery } from "../geo/search/providers";
import type { GeoBounds, GeoSearchResult } from "../geo/search/types";

const POINT_RESULT_ZOOM = 15;
const MAX_FIT_ZOOM = 16;

export function MapSearch({ map, bounds }: { map: L.Map; bounds?: GeoBounds }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const listId = useId();
  const search = useGeoSearch(query, { bounds });

  const outcomes = useMemo(() => search.data ?? [], [search.data]);
  const results = useMemo(() => outcomes.flatMap(({ results }) => results), [outcomes]);
  const showProviderLabels = outcomes.length > 1;

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const clearMarker = () => {
    markerRef.current?.remove();
    markerRef.current = null;
  };

  const select = (result: GeoSearchResult) => {
    clearMarker();
    if (result.bounds) {
      const { north, east, south, west } = result.bounds;
      map.fitBounds(L.latLngBounds([south, west], [north, east]), { maxZoom: MAX_FIT_ZOOM, padding: [40, 40] });
    } else {
      map.setView(result.center, Math.max(map.getZoom(), POINT_RESULT_ZOOM));
    }
    markerRef.current = L.circleMarker(result.center, {
      radius: 7,
      color: palette.surface,
      weight: 2,
      fillColor: palette.primary,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    setInput(result.label);
    setOpen(false);
    setActiveIndex(-1);
  };

  const submit = (value: string) => {
    if (open && activeIndex >= 0 && results[activeIndex]) {
      select(results[activeIndex]);
      return;
    }
    const normalized = normalizeGeoSearchQuery(value);
    if (!normalized) {
      clearMarker();
      setQuery("");
      setOpen(false);
      return;
    }
    setQuery(normalized);
    setActiveIndex(-1);
    setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || !results.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActiveIndex((current) => {
      const next = current + step;
      if (next >= results.length) return -1;
      if (next < -1) return results.length - 1;
      return next;
    });
  };

  const failures = outcomes.filter(({ error }) => error);
  const searchedQuery = normalizeGeoSearchQuery(input) === query;

  return (
    <div ref={containerRef} className="pointer-events-auto relative w-full">
      <Input.Search
        value={input}
        placeholder="Search for a place"
        allowClear
        enterButton
        loading={search.isFetching}
        aria-label="Search for a place"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        role="combobox"
        onChange={(event) => {
          setInput(event.target.value);
          setActiveIndex(-1);
          if (!event.target.value) {
            clearMarker();
            setOpen(false);
          }
        }}
        onFocus={() => { if (query && searchedQuery) setOpen(true); }}
        onKeyDown={handleKeyDown}
        onSearch={submit}
      />
      {open && query && (
        <div id={listId} role="listbox"
          className="absolute top-full right-0 left-0 mt-1 max-h-80 overflow-y-auto rounded-xl border border-app-border bg-surface py-1 shadow-lg">
          {search.isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-secondary"><Spin size="small" /> Searching…</div>
          )}
          {search.isError && (
            <div className="px-3 py-2 text-sm text-danger-ink">
              {search.error instanceof Error ? search.error.message : "Search failed."}
            </div>
          )}
          {search.isSuccess && !results.length && !failures.length && (
            <div className="px-3 py-2 text-sm text-secondary">No places found for “{query}”.</div>
          )}
          {outcomes.map(({ providerId, label, results: providerResults, error }) => (
            <div key={providerId}>
              {showProviderLabels && (
                <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
              )}
              {error && (
                <div className="px-3 py-2 text-sm text-danger-ink">{error.message}</div>
              )}
              {providerResults.map((result) => {
                const index = results.indexOf(result);
                const active = index === activeIndex;
                return (
                  <div key={result.id} id={`${listId}-${index}`} role="option" aria-selected={active}
                    className={`cursor-pointer px-3 py-2 ${active ? "bg-brand-soft" : "hover:bg-surface-hover"}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(result)}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-ink">{result.label}</span>
                      {result.category && <span className="shrink-0 text-xs text-muted">{result.category}</span>}
                    </div>
                    {result.description && (
                      <div className="truncate text-xs text-secondary" title={result.description}>{result.description}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {results.length > 0 && (
            <div className="border-t border-app-border px-3 pt-1.5 pb-1 text-[11px] text-muted">
              {[...new Set(outcomes.flatMap(({ attribution, results }) => (attribution && results.length ? [attribution] : [])))].join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
