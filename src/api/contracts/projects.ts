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
