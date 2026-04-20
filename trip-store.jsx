// Shared trip store — mutable layer on top of WEEK data.
// Waybill-shaped records live in localStorage.
// Reads merge WEEK baseline with stored additions.

// Active week's ID→ISO-date mapping is always derived from window.WEEK so that
// imported weeks route trips to the right storage key.
function dateForDay(dayId) {
  const day = (window.WEEK && window.WEEK.days || []).find(d => d.id === dayId);
  return day ? day.isoDate : null;
}
const BASELINE_DATES = new Proxy({}, {
  get: (_, k) => dateForDay(k),
});

// No seed data — waybills are added via the + Trip composer on the phone.
const SEED = {};
const STORAGE_KEY = 'sched-trips-v2';

function loadTrips() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      // First run on this version: clear the old seeded key if it exists,
      // then initialize empty.
      localStorage.removeItem('sched-trips');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return {};
    }
    return JSON.parse(stored);
  } catch { return {}; }
}
function saveTrips(t) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}
function resetTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  return {};
}

function allTrips(trips) {
  const t = trips || loadTrips();
  const out = [];
  Object.keys(t).forEach(dateKey => {
    (t[dateKey] || []).forEach(trip => out.push({ ...trip, dateKey }));
  });
  return out.sort((a, b) => (a.dateKey + a.start).localeCompare(b.dateKey + b.start));
}

function updateTrip(id, patch) {
  const t = loadTrips();
  Object.keys(t).forEach(k => {
    t[k] = (t[k] || []).map(tr => tr.id === id ? { ...tr, ...patch } : tr);
  });
  saveTrips(t);
  return t;
}

// Find conflicts in baseline
function findConflicts(dayId, startH, endH) {
  const day = WEEK.days.find(d => d.id === dayId);
  if (!day) return [];
  return day.blocks.filter(b => {
    const bs = t2h(b.start);
    const be = t2h(b.end);
    return bs < endH && be > startH;
  });
}

// Effective blocks = baseline with stored trips merged in
function getEffectiveBlocks(dayId, trips) {
  const day = WEEK.days.find(d => d.id === dayId);
  if (!day) return [];
  const dateKey = BASELINE_DATES[dayId];
  const added = (trips || loadTrips())[dateKey] || [];
  if (!added.length) return day.blocks;

  let blocks = [...day.blocks.map(b => ({ ...b }))];
  added.forEach(trip => {
    const ts = t2h(trip.start);
    const te = t2h(trip.end);
    const next = [];
    blocks.forEach(b => {
      const bs = t2h(b.start);
      const be = t2h(b.end);
      if (be <= ts || bs >= te) { next.push(b); return; }
      if (bs < ts) next.push({ ...b, end: trip.start });
      if (be > te) next.push({ ...b, start: trip.end });
    });
    next.push({
      ...trip, kind: 'drive', booked: true, added: true,
      earn: Number(trip.fare) || 0,
    });
    blocks = next.sort((a, b) => t2h(a.start) - t2h(b.start));
  });
  return blocks;
}

function getDayStats(dayId, trips) {
  const day = WEEK.days.find(d => d.id === dayId);
  if (!day) return { driveHours: 0, earnings: 0 };
  const t = trips || loadTrips();
  const dateKey = BASELINE_DATES[dayId];
  const added = (t[dateKey] || []);
  const blocks = getEffectiveBlocks(dayId, t);
  let driveHours = 0, earnings = 0;
  blocks.forEach(b => {
    if (b.kind === 'drive') driveHours += t2h(b.end) - t2h(b.start);
  });
  // earnings logic: baseline day.earnings + net from added trips
  let addedNet = 0;
  added.forEach(tr => {
    if (tr.category === 'dispatch') addedNet += Number(tr.commission) || 0;
    else addedNet += Number(tr.fare) || 0;
  });
  earnings = day.earnings + addedNet;
  return {
    driveHours: Math.round(driveHours * 10) / 10,
    earnings: Math.round(earnings),
  };
}

window.TripStore = {
  BASELINE_DATES, loadTrips, saveTrips, resetTrips,
  allTrips, updateTrip,
  findConflicts, getEffectiveBlocks, getDayStats,
};
