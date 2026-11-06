export interface Point {
  latitude: number;
  longitude: number;
}

export interface Project {
  id: string;
  name: string;
  organizationId: string;
  topLeft: Point;
  bottomRight: Point;
}

export interface CreateProjectPayload {
  name: string;
  topLeft: Point;
  bottomRight: Point;
}

export interface StageProgress {
  completed: number;
  total: number;
}

export interface ProjectProgress {
  featureDownloads: StageProgress;
  recognitionJobs: StageProgress;
}

/**
 * Polygon rings of `[easting, northing]` pairs in meters, outer ring first. Coordinates are in
 * the source raster's CRS: PL-2000 (EPSG:2176–2179) for current orthophotos, or EPSG:2180.
 */
export type PolygonCoordinates = [number, number][][];

export interface Detection {
  id: string;
  recognitionJobId: string;
  /** One detection batch can contain many building polygons. */
  bounds: PolygonCoordinates[] | null;
}

export interface FeatureDetections {
  featureId: string;
  detections: Detection[];
}
