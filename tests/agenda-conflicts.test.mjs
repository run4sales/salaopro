import assert from "node:assert/strict";
import test from "node:test";
import { findAgendaConflicts } from "../src/lib/agendaConflicts.ts";

const interval = (id, start, end, professionalId = "a", type = "appointment") => ({
  id, start: `2026-09-26T${start}:00Z`, end: `2026-09-26T${end}:00Z`, professionalId, type, label: id,
});
const conflicts = (start, end, professionals, occupied, excluded) => findAgendaConflicts(
  new Date(`2026-09-26T${start}:00Z`), new Date(`2026-09-26T${end}:00Z`), professionals, occupied, excluded,
);

test("adjacent intervals do not collide", () => {
  assert.equal(conflicts("10:00", "10:30", ["a"], [interval("before", "09:30", "10:00"), interval("after", "10:30", "11:00")]).length, 0);
});
test("partial and encompassing overlaps collide for the same professional", () => {
  assert.deepEqual(conflicts("10:00", "11:00", ["a"], [
    interval("partial", "10:45", "11:30"), interval("encompassing", "09:00", "12:00"), interval("other", "10:00", "10:30", "b"),
  ]).map(row => row.id), ["partial", "encompassing"]);
});
test("blocks and multi-professional assignments collide, except the edited appointment", () => {
  assert.deepEqual(conflicts("10:00", "11:00", ["a", "b"], [
    interval("self", "10:00", "11:00", "a"), interval("block", "10:30", "11:30", "b", "block"),
  ], "self").map(row => row.id), ["block"]);
});