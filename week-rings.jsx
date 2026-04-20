// Week view — Clock rings (Option C)
// Each day = 24h radial. Tap to drill into the day.

const { DAY_START: _DS, DAY_END: _DE, HOURS: _H } = window.HOURS_CONST;

function WeekRings({ onPickDay, aesthetic: A, showEarn }) {
  const trips = window.TripStore ? window.TripStore.loadTrips() : {};
  const actuals = window.EarningsStore ? window.EarningsStore.getAll() : {};
  const t = WEEK.totals;
  // recompute week earnings with added trips
  let addedEarn = 0, addedHrs = 0;
  WEEK.days.forEach(d => {
    const s = window.TripStore ? window.TripStore.getDayStats(d.id, trips) : { driveHours: d.driveHours, earnings: d.earnings };
    addedEarn += s.earnings - d.earnings;
    addedHrs += s.driveHours - d.driveHours;
  });
  const totalEarn = t.earnings + addedEarn;
  const totalHrs = Math.round((t.drive + addedHrs) * 10) / 10;
  const totalActual = window.EarningsStore ? window.EarningsStore.totalActual() : 0;
  const hasAnyActual = Object.keys(actuals).length > 0;
  return (
    <div style={{ padding: '4px 16px 40px' }}>
      {/* summary strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: showEarn ? '1fr 1fr 1fr' : '1fr 1fr',
        gap: 10, padding: '14px 2px 18px 2px',
        borderBottom: `1px solid ${A.gridLine}`,
      }}>
        {showEarn && (
          <StatCell label="Actual"
            value={hasAnyActual ? `$${totalActual.toLocaleString()}` : '—'}
            A={A} big accent={hasAnyActual} />
        )}
        {showEarn && (
          <StatCell label="Projected"
            value={`~$${totalEarn.toLocaleString()}`}
            A={A} muted />
        )}
        <StatCell label="Drive hrs" value={totalHrs} A={A} />
      </div>

      {/* day rings */}
      <div style={{ marginTop: 4 }}>
        {WEEK.days.map((d, i) => {
          const stats = window.TripStore ? window.TripStore.getDayStats(d.id, trips) : { driveHours: d.driveHours, earnings: d.earnings };
          const actual = actuals[d.id];
          const hasActual = typeof actual === 'number';
          return (
          <button key={d.id} onClick={() => onPickDay(d.id)} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            width: '100%', padding: '14px 4px',
            background: 'transparent', border: 'none',
            borderBottom: i === WEEK.days.length - 1 ? 'none' : `1px solid ${A.gridLine}`,
            cursor: 'pointer', textAlign: 'left',
          }}>
            <RingChart day={d} A={A} size={86} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{
                  fontSize: 10, letterSpacing: 1.5, color: A.muted,
                  fontFamily: A.mono, textTransform: 'uppercase',
                }}>{d.short}</div>
                <div style={{
                  fontSize: 22, fontWeight: 500, color: A.text,
                  fontFamily: A.display, letterSpacing: -0.5, lineHeight: 1,
                }}>{d.date.split(' ')[1]}</div>
                <div style={{ flex: 1 }} />
                {showEarn && (
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 6,
                    fontFamily: A.mono,
                  }}>
                    {hasActual ? (
                      <span style={{ fontSize: 13, color: A.accent, fontWeight: 500 }}>
                        ${actual.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: A.faint }}>
                        ~${stats.earnings}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 11, letterSpacing: 1.2, color: A.accent,
                fontFamily: A.mono, textTransform: 'uppercase', marginTop: 6,
              }}>{d.theme}</div>
              <div style={{
                fontSize: 12, color: A.muted, fontFamily: A.sans,
                marginTop: 3, lineHeight: 1.35, textWrap: 'pretty',
              }}>{d.summary}</div>
              {d.event && (
                <div style={{
                  fontSize: 10, color: A.faint, fontFamily: A.mono,
                  marginTop: 5, letterSpacing: 0.5,
                }}>◆ {d.event.name} · {d.event.time}</div>
              )}
            </div>
          </button>
          );
        })}
      </div>

      {/* legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px 16px',
        padding: '18px 2px 4px', borderTop: `1px solid ${A.gridLine}`,
        marginTop: 8,
        fontFamily: A.mono, fontSize: 10, color: A.muted,
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>
        {[['drive','Drive'],['reposition','Reposition'],['break','Break'],['personal','Personal'],['sleep','Out']].map(([k,l]) => {
          const c = k === 'drive' ? A.accent : KIND[k].swatch;
          const op = k === 'drive' ? 1 : k === 'sleep' ? 0.25 : 0.6;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, background: c, opacity: op, borderRadius: 2 }} />
              <span>{l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCell({ label, value, A, big, muted, accent }) {
  const color = accent ? A.accent : muted ? A.faint : A.text;
  return (
    <div>
      <div style={{
        fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
        color: accent ? A.accent : A.muted, fontFamily: A.mono, marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 24 : 20, fontWeight: 500, color,
        fontFamily: A.display, letterSpacing: -0.5, lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

// ───────────────── 24h ring ─────────────────
// 0h at 12 o'clock position, clockwise.
// Stroke width proportional to size.
function RingChart({ day, A, size = 80 }) {
  const stroke = Math.round(size * 0.13);
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const effective = (window.TripStore ? window.TripStore.getEffectiveBlocks(day.id) : day.blocks);
  const segs = effective.map(b => {
    const s = t2h(b.start);
    const e = t2h(b.end);
    const offset = (s / 24) * circ;
    const len = ((e - s) / 24) * circ;
    const color = b.kind === 'drive' ? A.accent : KIND[b.kind].swatch;
    const op = b.kind === 'drive' ? 1 : b.kind === 'sleep' ? 0.25 : 0.6;
    return { offset, len, color, op, peak: b.peak, booked: b.booked };
  });

  return (
    <svg width={size} height={size} style={{ flexShrink: 0, display: 'block' }}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={A.gridLine} strokeWidth={stroke} />

      {/* 6/12/18 tick marks */}
      {[0, 6, 12, 18].map(h => {
        const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
        const inner = r - stroke / 2 - 3;
        const outer = r + stroke / 2 + 3;
        return (
          <line key={h}
            x1={cx + Math.cos(a) * inner} y1={cy + Math.sin(a) * inner}
            x2={cx + Math.cos(a) * outer} y2={cy + Math.sin(a) * outer}
            stroke={A.faint} strokeWidth={0.8} opacity={0.7} />
        );
      })}

      {/* segments — clockwise from 12 o'clock */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segs.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeOpacity={s.op}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${s.len} ${circ}`}
            strokeDashoffset={-s.offset} />
        ))}
      </g>

      {/* center label */}
      <text x={cx} y={cy - 2} textAnchor="middle"
        fontFamily={A.display} fontSize={size * 0.22}
        fontWeight="500" fill={A.text}>
        {day.driveHours}
      </text>
      <text x={cx} y={cy + size * 0.15} textAnchor="middle"
        fontFamily={A.mono} fontSize={size * 0.1}
        fill={A.muted} letterSpacing="1">
        HRS
      </text>
    </svg>
  );
}

window.WeekRings = WeekRings;
