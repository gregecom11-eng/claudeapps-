// Month view — April 2026 + May 2026 scroll.
// Tap a day to jump to the week / day detail.
// Current week (Apr 20-26) highlighted.

function MonthView({ A, onPickDay, onAddAt, showEarn }) {
  const trips = window.TripStore.loadTrips();

  // Weeks start Monday so Apr 20–26 renders as a single row.
  // firstDow = offset from Monday (0=Mon, 6=Sun)
  const months = [
    { name: 'April 2026',  firstDow: 2, days: 30, y: 2026, m: 4 },  // Apr 1 is Wed → offset 2 from Mon
    { name: 'May 2026',    firstDow: 4, days: 31, y: 2026, m: 5 },  // May 1 is Fri → offset 4 from Mon
  ];

  // dayId for dates in the current week (Apr 20–26)
  const currentWeek = {
    20: 'mon', 21: 'tue', 22: 'wed', 23: 'thu',
    24: 'fri', 25: 'sat', 26: 'sun',
  };

  const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div style={{ padding: '0 16px 40px' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '4px 0 14px',
      }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
            color: A.muted, fontFamily: A.mono, marginBottom: 4,
          }}>Month</div>
          <div style={{
            fontSize: 28, fontWeight: 500, color: A.text,
            fontFamily: A.display, letterSpacing: -0.8, lineHeight: 1,
          }}>Apr – May 2026</div>
        </div>
      </div>

      {/* weekday header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
        marginBottom: 10,
      }}>
        {dayHeaders.map((d, i) => (
          <div key={i} style={{
            fontSize: 9, letterSpacing: 1.5, color: A.faint,
            fontFamily: A.mono, textAlign: 'center', padding: '4px 0',
          }}>{d}</div>
        ))}
      </div>

      {months.map(month => (
        <div key={month.name} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
            color: A.accent, fontFamily: A.mono, padding: '4px 2px 10px',
          }}>{month.name}</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3,
          }}>
            {/* leading empty cells */}
            {Array.from({ length: month.firstDow }).map((_, i) => (
              <div key={`e-${i}`} style={{ aspectRatio: '1 / 1.1' }} />
            ))}
            {Array.from({ length: month.days }).map((_, i) => {
              const d = i + 1;
              const isCurrent = month.m === 4 && currentWeek[d];
              const dayId = isCurrent ? currentWeek[d] : null;
              const dateKey = `${month.y}-${String(month.m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const hasTrip = (trips[dateKey] || []).length > 0;
              const day = dayId ? WEEK.days.find(x => x.id === dayId) : null;
              const stats = dayId ? window.TripStore.getDayStats(dayId, trips) : null;

              return (
                <button key={d}
                  onClick={() => {
                    if (dayId) onPickDay(dayId);
                    else onAddAt(dateKey, d, month);
                  }}
                  style={{
                    aspectRatio: '1 / 1.1', padding: '6px 4px',
                    minWidth: 0, overflow: 'hidden',
                    background: isCurrent ? A.colBg : 'transparent',
                    border: isCurrent ? `1px solid ${A.gridLine}` : `1px solid transparent`,
                    borderRadius: 4, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'stretch', justifyContent: 'space-between',
                    position: 'relative',
                  }}>
                  <div style={{
                    fontSize: 13, fontFamily: A.display, fontWeight: 500,
                    color: isCurrent ? A.text : A.muted, textAlign: 'left',
                    lineHeight: 1,
                  }}>{d}</div>

                  {/* mini ring for current week */}
                  {dayId && day && (
                    <MiniRing day={day} A={A} size={28} />
                  )}

                  {/* trip dot for additions */}
                  {hasTrip && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 5, height: 5, borderRadius: '50%',
                      background: A.accent,
                    }} />
                  )}

                  {/* earnings for current week */}
                  {showEarn && stats && stats.earnings > 0 && (
                    <div style={{
                      fontSize: 8, fontFamily: A.mono, color: A.accent,
                      textAlign: 'left', marginTop: 2,
                    }}>${stats.earnings}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{
        padding: '14px', background: A.colBg, borderRadius: 6,
        fontSize: 11, color: A.muted, fontFamily: A.mono,
        lineHeight: 1.5, letterSpacing: 0.3,
      }}>
        Tap a day in Apr 20–26 to view schedule. Tap any other day to add a trip.
        <span style={{ display: 'inline-block', marginLeft: 6 }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: A.accent, marginRight: 4, verticalAlign: 'middle',
          }} /> = booked trip
        </span>
      </div>
    </div>
  );
}

function MiniRing({ day, A, size = 26 }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ alignSelf: 'center', marginTop: 2 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={A.gridLine} strokeWidth={stroke} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {day.blocks.map((b, i) => {
          const s = t2h(b.start), e = t2h(b.end);
          const offset = (s / 24) * circ;
          const len = ((e - s) / 24) * circ;
          const color = b.kind === 'drive' ? A.accent : KIND[b.kind].swatch;
          const op = b.kind === 'drive' ? 1 : b.kind === 'sleep' ? 0.2 : 0.5;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeOpacity={op} strokeWidth={stroke}
              strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offset} />
          );
        })}
      </g>
    </svg>
  );
}

window.MonthView = MonthView;
