import { expect, test } from "bun:test";
import type { PolygonCoordinates } from "../src/api";
import { removeOutlineVertex } from "../src/geo/annotationCoordinates";

const polygon: PolygonCoordinates = [
  [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
  [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]],
];

test("deleting the first or last corner keeps the ring closed without mutating the saved outline", () => {
  const bounds = structuredClone([polygon]);
  expect(removeOutlineVertex(bounds, 0, 0, 0)[0][0]).toEqual([[10, 0], [10, 10], [0, 10], [10, 0]]);
  expect(removeOutlineVertex(bounds, 0, 0, 3)[0][0]).toEqual([[0, 0], [10, 0], [10, 10], [0, 0]]);
  expect(bounds).toEqual([polygon]);
});

test("deleting a hole's corner preserves the exterior and the other outlines", () => {
  const bounds = [polygon, structuredClone(polygon)];
  const next = removeOutlineVertex(bounds, 0, 1, 1);
  expect(next[0][1]).toEqual([[2, 2], [4, 4], [2, 4], [2, 2]]);
  expect(next[0][0]).toBe(bounds[0][0]);
  expect(next[1]).toBe(bounds[1]);
});

test("a ring cannot shrink below three corners or lose its closing point", () => {
  const bounds = removeOutlineVertex([polygon], 0, 0, 1);
  expect(removeOutlineVertex(bounds, 0, 0, 0)).toBe(bounds);
  expect(removeOutlineVertex([polygon], 0, 0, polygon[0].length - 1)).toEqual([polygon]);
  expect(removeOutlineVertex(bounds, 2, 0, 0)).toBe(bounds);
});
