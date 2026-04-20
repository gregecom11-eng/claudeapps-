// Week of April 20–26, 2026
// Block kinds: drive (active earning), reposition, break, sleep, personal, event-anchor
// Earnings are realistic projections for Uber Black / TCP work in LA

const WEEK = {
  weekLabel: 'Apr 20 – 26, 2026',
  weekOf: 'Week 17',
  driver: 'Greg',
  vehicle: 'Escalade · TCP #38283-A',
  totals: { drive: 52.5, earnings: 3280, miles: 1180 },
  days: [
    {
      id: 'mon',
      name: 'Monday',
      short: 'Mon',
      date: 'Apr 20',
      isoDate: '2026-04-20',
      dow: 1,
      theme: 'Corporate airport day',
      summary: 'BH/CC → LAX morning, executive dinners evening',
      driveHours: 8.5,
      earnings: 520,
      blocks: [
        { start: '04:30', end: '05:30', kind: 'reposition', title: 'Deadhead → Beverly Hills', detail: 'Peninsula / Waldorf / Four Seasons corridor' },
        { start: '05:30', end: '09:30', kind: 'drive', title: 'BH/CC → LAX lane', detail: 'Aim for 2 long-hauls', earn: 280 },
        { start: '10:00', end: '12:30', kind: 'drive', title: 'LAX inbound loop', detail: 'Execs landing for the week', earn: 140 },
        { start: '12:30', end: '15:30', kind: 'break', title: 'Rest', detail: 'El Segundo / Playa Vista hold' },
        { start: '16:00', end: '20:00', kind: 'drive', title: 'Brentwood / SaMo / WeHo', detail: 'Soho House, Sunset Tower, SVB', earn: 100 },
        { start: '21:00', end: '23:59', kind: 'sleep', title: 'Hard out', detail: 'Fresh for Tuesday' },
      ],
    },
    {
      id: 'tue',
      name: 'Tuesday',
      short: 'Tue',
      date: 'Apr 21',
      isoDate: '2026-04-21',
      dow: 2,
      theme: 'Lakers Game 2 drops',
      summary: 'Drop play, not pickup — arena curb avoided',
      driveHours: 7,
      earnings: 480,
      event: { name: 'Lakers vs Rockets · Game 2', venue: 'Crypto.com Arena', time: '7:30 PM' },
      blocks: [
        { start: '07:00', end: '13:00', kind: 'break', title: 'Sleep in / admin', detail: "Don't burn the tank on cold Tue AM" },
        { start: '14:00', end: '17:30', kind: 'reposition', title: 'BH → DTLA corridor', detail: 'Position for dinner/arena drops' },
        { start: '17:30', end: '19:15', kind: 'drive', title: 'Pre-game drops', detail: 'BH/WeHo/Hancock → Arena + LA Live', earn: 320, peak: true },
        { start: '19:30', end: '21:30', kind: 'drive', title: 'DTLA hotels + WeHo', detail: 'Ritz / Conrad / InterCon runs', earn: 100 },
        { start: '21:30', end: '23:30', kind: 'drive', title: 'WeHo / Sunset Strip', detail: 'Dinner surge', earn: 60 },
        { start: '23:30', end: '23:59', kind: 'sleep', title: 'Out', detail: '' },
      ],
    },
    {
      id: 'wed',
      name: 'Wednesday',
      short: 'Wed',
      date: 'Apr 22',
      isoDate: '2026-04-22',
      dow: 3,
      theme: 'Confirmed money day',
      summary: 'Duval → SaMo, then airport hunt, clean corporate evening',
      driveHours: 9,
      earnings: 680,
      highlight: true,
      blocks: [
        { start: '04:30', end: '05:30', kind: 'reposition', title: 'Drive to Newport Beach', detail: 'Hacienda Heights → 1 Cape Danbury' },
        { start: '05:30', end: '07:45', kind: 'drive', title: 'Bennett Duval · NB → SaMo', detail: 'CONFIRMED · direct book', earn: 260, booked: true },
        { start: '08:00', end: '11:00', kind: 'drive', title: 'SaMo / Brentwood / BH → LAX', detail: 'Hunt another airport long-haul', earn: 180 },
        { start: '11:00', end: '14:00', kind: 'break', title: 'Midday break', detail: 'Rest / reposition home' },
        { start: '15:00', end: '19:00', kind: 'drive', title: 'Century City / BH eve', detail: 'Clean corporate evening — no arena', earn: 240 },
        { start: '20:00', end: '23:59', kind: 'sleep', title: 'Out', detail: '' },
      ],
    },
    {
      id: 'thu',
      name: 'Thursday',
      short: 'Thu',
      date: 'Apr 23',
      isoDate: '2026-04-23',
      dow: 4,
      theme: 'Kings Game 3 + AM airport',
      summary: 'Heaviest corporate AM of the week + Kings drops',
      driveHours: 9,
      earnings: 620,
      event: { name: 'Kings vs Avalanche · Game 3', venue: 'Crypto.com Arena', time: '7:00 PM' },
      blocks: [
        { start: '04:30', end: '09:30', kind: 'drive', title: 'LAX long-haul hunt', detail: 'BH/CC heavy AM corporate', earn: 340 },
        { start: '10:00', end: '14:00', kind: 'break', title: 'Break — truly', detail: 'Recover mid-day' },
        { start: '14:30', end: '17:00', kind: 'reposition', title: 'DTLA / BH position', detail: 'For Kings drops' },
        { start: '17:00', end: '18:45', kind: 'drive', title: 'Kings pre-game drops', detail: 'OC execs + corporate fans', earn: 220, peak: true },
        { start: '19:00', end: '21:30', kind: 'drive', title: 'WeHo dinner surge', detail: 'Away from arena', earn: 60 },
        { start: '22:30', end: '23:59', kind: 'sleep', title: 'Out', detail: '' },
      ],
    },
    {
      id: 'fri',
      name: 'Friday',
      short: 'Fri',
      date: 'Apr 24',
      isoDate: '2026-04-24',
      dow: 5,
      theme: 'OC home turf',
      summary: 'No events LA — SNA morning, Newport evening',
      driveHours: 8.5,
      earnings: 480,
      blocks: [
        { start: '05:30', end: '09:30', kind: 'drive', title: 'Newport / Irvine → SNA', detail: 'Friday AM Bay Area biz travel', earn: 260 },
        { start: '10:00', end: '15:00', kind: 'personal', title: 'Recovery + admin', detail: 'Before heavy weekend' },
        { start: '16:00', end: '21:00', kind: 'drive', title: 'OC restaurant surge', detail: 'Nobu Newport, The Winery, CdM', earn: 220 },
        { start: '23:00', end: '23:59', kind: 'sleep', title: 'Out', detail: '' },
      ],
    },
    {
      id: 'sat',
      name: 'Saturday',
      short: 'Sat',
      date: 'Apr 25',
      isoDate: '2026-04-25',
      dow: 6,
      theme: 'Double LA Live event night',
      summary: 'Pizza City Fest + Hatsune Miku — best evening of the week',
      driveHours: 9.5,
      earnings: 740,
      event: { name: 'Pizza City Fest + Miku', venue: 'LA Live · Peacock Theater', time: '1–5 PM · 8 PM' },
      highlight: true,
      blocks: [
        { start: '09:00', end: '11:30', kind: 'break', title: 'Optional sleep in', detail: 'Sat AM Black is weak' },
        { start: '11:30', end: '13:30', kind: 'drive', title: 'Pizza Fest drops', detail: 'BH / WeHo / Pasadena hotels', earn: 160 },
        { start: '14:00', end: '18:00', kind: 'drive', title: 'DTLA hotels + Westside cycle', detail: "Don't sit — cycle", earn: 220 },
        { start: '18:30', end: '20:00', kind: 'drive', title: 'Miku drop window', detail: 'South Bay + OC long-hauls in', earn: 180, peak: true },
        { start: '20:00', end: '22:00', kind: 'drive', title: 'WeHo dinner/club', detail: 'Avoid arena curb', earn: 100 },
        { start: '22:00', end: '23:30', kind: 'drive', title: 'Miku post-show pickup', detail: 'Fig south of venue → LAX/OC', earn: 80 },
      ],
    },
    {
      id: 'sun',
      name: 'Sunday',
      short: 'Sun',
      date: 'Apr 26',
      isoDate: '2026-04-26',
      dow: 0,
      theme: 'Triple LA Live overlap',
      summary: 'Kings matinee + Pizza Fest Day 2 + Miku',
      driveHours: 10,
      earnings: 760,
      event: { name: 'Kings G4 · Pizza Fest · Miku', venue: 'LA Live · Crypto · Peacock', time: '1:30 PM / 1–5 / 8 PM' },
      highlight: true,
      blocks: [
        { start: '10:00', end: '11:00', kind: 'reposition', title: 'DTLA / BH position', detail: '' },
        { start: '11:00', end: '12:45', kind: 'drive', title: 'Kings G4 drops', detail: 'Sunday AM BH — clean traffic', earn: 240, peak: true },
        { start: '12:45', end: '14:30', kind: 'drive', title: 'Pizza Fest overlap cycle', detail: 'BH/WeHo → LA Live, 6–10 min', earn: 160 },
        { start: '14:30', end: '16:00', kind: 'break', title: 'Break — avoid arena exit', detail: 'Matinee exit + Pizza crowd = brutal' },
        { start: '16:00', end: '19:00', kind: 'drive', title: 'SNA/LAX Sunday eve', detail: 'Biz return — best $/mi window', earn: 260 },
        { start: '19:00', end: '20:00', kind: 'drive', title: 'Last Miku drop cycle', detail: '', earn: 40 },
        { start: '21:30', end: '23:00', kind: 'drive', title: 'Miku post-show', detail: '', earn: 60 },
        { start: '23:30', end: '23:59', kind: 'sleep', title: 'Out', detail: '' },
      ],
    },
  ],
};

// Kind styling — single source of truth
const KIND = {
  drive:      { label: 'Drive',      swatch: '#d4a24c', dot: '●' },
  reposition: { label: 'Reposition', swatch: '#6b7a8f', dot: '→' },
  break:      { label: 'Break',      swatch: '#3a3a3e', dot: '○' },
  sleep:      { label: 'Out',        swatch: '#1c1c20', dot: '·' },
  personal:   { label: 'Personal',   swatch: '#4a6b5a', dot: '◇' },
};

// Helper: convert "HH:MM" to float hours
const t2h = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
};

window.WEEK = WEEK;
window.KIND = KIND;
window.t2h = t2h;
