export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  north: number;
  east: number;
  south: number;
  west: number;
}

export interface GeoSearchResult {
  id: string;
  providerId: string;
  label: string;
  description?: string;
  category?: string;
  center: GeoPoint;
  bounds?: GeoBounds;
}

export interface GeoSearchOptions {
  signal?: AbortSignal;
  limit?: number;
  bounds?: GeoBounds;
  language?: string;
}

export interface GeoSearchProvider {
  id: string;
  label: string;
  attribution?: string;
  minQueryLength: number;
  search(query: string, options: GeoSearchOptions): Promise<GeoSearchResult[]>;
}

export interface GeoSearchProviderOutcome {
  providerId: string;
  label: string;
  attribution?: string;
  results: GeoSearchResult[];
  error?: Error;
}
