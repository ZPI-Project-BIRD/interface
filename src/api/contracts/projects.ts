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
  discovery?: DiscoveryStatus;
  jobStates?: { pending: number; running: number; finished: number; failed: number };
}

export interface DiscoveryStatus {
  status: "UNKNOWN" | "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  lastError: string | null;
  lockedUntil: string | null;
}

export interface SourceFeature {
  id: string;
  colorSpace: string;
  pixelSize: number;
  sourceUrl: string;
  objectName: string | null;
  fileSize: number | null;
}

/**
 * Polygon rings of `[easting, northing]` pairs in meters, outer ring first. Coordinates are in
 * the source raster's CRS: PL-2000 (EPSG:2176–2179) for current orthophotos, or EPSG:2180.
 */
export type PolygonCoordinates = [number, number][][];

export interface Detection {
  id: string;
  recognitionJobId: string | null;
  /** One detection batch can contain many building polygons. */
  bounds: PolygonCoordinates[] | null;
  version: number;
  source: "MODEL" | "MANUAL";
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface DetectionState extends Omit<Detection, "source"> {
  projectId: string;
  featureId: string;
  sourceDetectionId: string | null;
  deleted: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface AnnotationHistoryEntry {
  id: string;
  detectionId: string;
  action: "CREATED" | "UPDATED" | "DELETED" | "VERIFIED" | "UNVERIFIED";
  actor: string;
  occurredAt: string;
  before: DetectionState | null;
  after: DetectionState;
}

export interface FeatureDetections {
  featureId: string;
  detections: Detection[];
}
