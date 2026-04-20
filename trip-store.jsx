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

// Seed examples covering all 3 categories + payment states
const SEED = {
  '2026-04-20': [
    {
      id: 's1', start: '05:30', end: '07:45',
      title: 'Patel · BH → LAX',
      category: 'private',           // private | dispatch | uber
      passenger: 'Rajiv Patel',
      pickup: 'Peninsula Beverly Hills',
      dropoff: 'LAX Terminal B',
      vehicle: '2024 Escalade',
      flight: 'UA 2318 · 9:15 AM PDT',
      fare: 185, driverPay: 0, commission: 0,
      payStatus: 'paid',             // pending | invoiced | captured | paid
      invoiceNo: 'SD-2604-018',
      notes: 'Repeat client · 2 bags',
    },
  ],
  '2026-04-21': [
    {
      id: 's2', start: '17:30', end: '19:00',
      title: 'Cohen · Hancock Pk → Crypto',
      category: 'private',
      passenger: 'Howard Cohen',
      pickup: '450 S June St, Hancock Park',
      dropoff: 'Crypto.com Arena · Star Plaza',
      vehicle: '2024 Escalade',
      fare: 220, driverPay: 0, commission: 0,
      payStatus: 'invoiced',
      invoiceNo: 'SD-2604-019',
      notes: 'Lakers Game 2 drop. No post-game pickup.',
    },
    {
      id: 's3', start: '20:30', end: '22:15',
      title: 'Uber Black · WeHo surge',
      category: 'uber',
      pickup: 'Sunset Tower',
      dropoff: 'Santa Monica',
      fare: 142, driverPay: 0, commission: 0,
      payStatus: 'paid',
      notes: '2 rides · Uber payout',
    },
  ],
  '2026-04-22': [
    {
      id: 's4', start: '05:30', end: '07:45',
      title: 'Duval · Newport → SaMo',
      category: 'private',
      passenger: 'Bennett Duval',
      pickup: '1 Cape Danbury, Newport Beach',
      dropoff: 'Santa Monica',
      vehicle: '2024 Escalade',
      fare: 310, driverPay: 0, commission: 0,
      payStatus: 'captured',
      invoiceNo: 'SD-2604-020',
      notes: 'Weekly confirmed booking',
    },
  ],
  '2026-04-23': [
    {
      id: 's5', start: '06:00', end: '08:00',
      title: 'Dispatch · Gray → ONT',
      category: 'dispatch',
      passenger: 'Franci Gray',
      pickup: '169 S Poplar Ave, Brea',
      dropoff: 'Ontario Intl (ONT)',
      vehicle: '2024 Escalade',
      flight: 'DL 2104 · 9:55 PM PDT',
      fare: 115, driverPay: 75, commission: 40,
      payStatus: 'paid',
      invoiceNo: 'SD-2604-021',
      assignedTo: 'Marco R.',
      notes: 'Return leg May 2 also dispatched',
    },
    {
      id: 's6', start: '17:00', end: '18:30',
      title: 'Dispatch · Kings G3 drop',
      category: 'dispatch',
      passenger: 'T. Ichiro (corp)',
      pickup: 'Newport Beach',
      dropoff: 'Crypto.com Arena',
      fare: 285, driverPay: 180, commission: 105,
      payStatus: 'invoiced',
      invoiceNo: 'SD-2604-022',
      assignedTo: 'Luis M.',
    },
  ],
  '2026-04-24': [
    {
      id: 's7', start: '06:00', end: '07:30',
      title: 'Private · Irvine → SNA',
      category: 'private',
      passenger: 'M. Chen',
      pickup: 'Irvine',
      dropoff: 'SNA',
      fare: 135, driverPay: 0, commission: 0,
      payStatus: 'pending',
      notes: 'New client — confirm card',
    },
  ],
  '2026-04-25': [
    {
      id: 's8', start: '11:30', end: '12:45',
      title: 'Dispatch · Pizza Fest VIP',
      category: 'dispatch',
      passenger: 'J. Soto + 2',
      pickup: 'Waldorf BH',
      dropoff: 'LA LIVE Event Deck',
      fare: 165, driverPay: 110, commission: 55,
      payStatus: 'captured',
      invoiceNo: 'SD-2604-023',
      assignedTo: 'Marco R.',
    },
    {
      id: 's9', start: '22:30', end: '23:45',
      title: 'Uber Black · Miku egress',
      category: 'uber',
      pickup: 'Peacock Theater',
      dropoff: 'LAX Westin',
      fare: 168, driverPay: 0, commission: 0,
      payStatus: 'pending',
    },
  ],
  '2026-04-26': [
    {
      id: 's10', start: '11:00', end: '12:30',
      title: 'Private · Kings G4 drop',
      category: 'private',
      passenger: 'Cohen party (3)',
      pickup: 'Hancock Park',
      dropoff: 'Crypto.com Arena',
      fare: 240, driverPay: 0, commission: 0,
      payStatus: 'invoiced',
      invoiceNo: 'SD-2604-024',
    },
    {
      id: 's11', start: '16:30', end: '18:00',
      title: 'Private · SNA long-haul',
      category: 'private',
      passenger: 'Mr. Patel',
      pickup: 'Newport Beach',
      dropoff: 'SNA',
      fare: 195, driverPay: 0, commission: 0,
      payStatus: 'paid',
      invoiceNo: 'SD-2604-025',
    },
  ],
};

function loadTrips() {
  try {
    const stored = localStorage.getItem('sched-trips');
    if (stored === null) {
      localStorage.setItem('sched-trips', JSON.stringify(SEED));
      return JSON.parse(JSON.stringify(SEED));
    }
    return JSON.parse(stored);
  } catch { return JSON.parse(JSON.stringify(SEED)); }
}
function saveTrips(t) {
  localStorage.setItem('sched-trips', JSON.stringify(t));
}
function resetTrips() {
  localStorage.setItem('sched-trips', JSON.stringify(SEED));
  return JSON.parse(JSON.stringify(SEED));
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
