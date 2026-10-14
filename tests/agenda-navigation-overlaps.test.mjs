import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const agenda = read("../src/components/agenda/StableAgendaContent.tsx");
const calendar = read("../src/components/agenda/AgendaCalendar.tsx");
const form = read("../src/components/agenda/AppointmentFormDialog.tsx");

test("empty employee months keep the calendar and own block controls available", () => {
  assert.doesNotMatch(agenda, /agendaData\.appts\.length === 0 && isEmployee/);
  assert.match(agenda, /aria-label="Data da agenda"/);
  assert.match(agenda, /setInitialSlot\(calendarDate\)/);
  assert.match(agenda, /professional\.id === professionalId/);
});

test("period navigation includes months in calendar and list views", () => {
  assert.match(agenda, /periodMode === "month" \? addMonths/);
  assert.match(agenda, /navigatePeriod\(-1\)/);
  assert.match(agenda, /navigatePeriod\(1\)/);
});

test("managers may overlap appointments, but blocks and employee conflicts stay protected", () => {
  assert.match(form, /found\.length && \(hasAbsoluteBlock \|\| !allowConflictOverride\)/);
  assert.match(agenda, /allowConflictOverride=\{establishmentRole === "owner" \|\| establishmentRole === "admin"\}/);
});

test("time views have separate lanes and month view exposes every event", () => {
  assert.match(calendar, /dayLayoutAlgorithm="no-overlap"/);
  assert.match(calendar, /showAllEvents/);
});