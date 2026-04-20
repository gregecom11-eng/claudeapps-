// Week Grid View — 7-day vertical strip with timeline bars
// Fast, scannable "at a glance this is my week"

const HOUR_HEIGHT = 1.2; // px per minute — 72px/hr, 4a–12a in 1440px but compact
const DAY_START = 4;  // 4 AM
const DAY_END = 24;   // midnight
const HOURS = DAY_END - DAY_START;

function formatHour(h) {
  if (h === 0 || h === 24) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function minsFromStart(time) {
  return (t2h(time) - DAY_START) * 60;
}

// ───────────────── Layout: Grid (default) ─────────────────
// 7 columns, vertically stacked timeline bars
function WeekGrid({ onPickDay, aesthetic, showEarn }) {
  const totalHeight = HOURS * 60 * (HOUR_HEIGHT / 60) * 60; // hrs * pxPerHour
  const pxPerMin = HOUR_HEIGHT;
  const height = HOURS * 60 * pxPerMin;

  const A = aesthetic;
  const isDark = A.mode === 'dark';

  const hourLines = [];
  for (let h = DAY_START; h <= DAY_END; h += 2) {
    hourLines.push(h);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: '4px 16px 40px',
    }}>
      {/* summary strip */}
      <WeekSummary aesthetic={A} showEarn={showEarn} />

      {/* grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px repeat(7, 1fr)',
        gap: 6,
        fontFamily: A.mono,
      }}>
        {/* header row */}
        <div />
        {WEEK.days.map(d => (
          <div key={d.id} style={{
            textAlign: 'center', padding: '6px 2px 10px',
          }}>
            <div style={{
              fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
              color: A.muted, fontFamily: A.mono,
            }}>{d.short}</div>
            <div style={{
              fontSize: 15, fontWeight: 600, color: A.text,
              fontFamily: A.display, marginTop: 2,
            }}>{d.date.split(' ')[1]}</div>
            {d.event && (
              <div style={{
                fontSize: 8, marginTop: 4, color: A.accent,
                letterSpacing: 0.5, textTransform: 'uppercase',
              }}>◆</div>
            )}
          </div>
        ))}

        {/* hour labels */}
        <div style={{ position: 'relative', height }}>
          {hourLines.map(h => (
            <div key={h} style={{
              position: 'absolute', top: (h - DAY_START) * 60 * pxPerMin - 5,
              right: 2, fontSize: 9, color: A.faint, fontFamily: A.mono,
              letterSpacing: 0.3,
            }}>{formatHour(h)}</div>
          ))}
        </div>

        {/* day columns */}
        {WEEK.days.map(d => (
          <DayColumn key={d.id} day={d} height={height} pxPerMin={pxPerMin}
            onPick={() => onPickDay(d.id)} aesthetic={A} />
        ))}
      </div>

      {/* legend */}
      <Legend aesthetic={A} />
    </div>
  );
}

function DayColumn({ day, height, pxPerMin, onPick, aesthetic: A }) {
  return (
    <button
      onClick={onPick}
      style={{
        position: 'relative', height, padding: 0, border: 'none',
        background: A.colBg, borderRadius: 6, cursor: 'pointer',
        overflow: 'hidden',
      }}>
      {/* hour grid lines */}
      {Array.from({ length: (HOURS / 2) + 1 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: i * 120 * pxPerMin, height: 1, background: A.gridLine,
        }} />
      ))}
      {/* blocks */}
      {day.blocks.map((b, i) => {
        const top = minsFromStart(b.start) * pxPerMin;
        const blockH = (t2h(b.end) - t2h(b.start)) * 60 * pxPerMin;
        const kind = KIND[b.kind];
        const isDrive = b.kind === 'drive';
        const isEvent = b.peak;
        return (
          <div key={i} style={{
            position: 'absolute', left: 2, right: 2, top, height: blockH,
            background: isDrive ? A.accent : kind.swatch,
            opacity: isDrive ? 1 : (b.kind === 'sleep' ? 0.4 : 0.75),
            borderRadius: 2,
            borderLeft: b.booked ? `2px solid ${A.text}` : 'none',
            boxShadow: isEvent ? `0 0 0 1px ${A.text}` : 'none',
          }} />
        );
      })}
    </button>
  );
}

// ───────────────── Summary strip ─────────────────
function WeekSummary({ aesthetic: A, showEarn }) {
  const t = WEEK.totals;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: showEarn ? '1fr 1fr 1fr' : '1fr 1fr',
      gap: 1, padding: '14px 2px 18px 2px',
      borderBottom: `1px solid ${A.gridLine}`,
    }}>
      {showEarn && (
        <Stat label="Projected" value={`$${t.earnings.toLocaleString()}`} aesthetic={A} big />
      )}
      <Stat label="Drive hrs" value={t.drive} aesthetic={A} />
      <Stat label="Miles" value={t.miles} aesthetic={A} />
    </div>
  );
}

function Stat({ label, value, aesthetic: A, big }) {
  return (
    <div>
      <div style={{
        fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
        color: A.muted, fontFamily: A.mono, marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 26 : 22, fontWeight: 500, color: A.text,
        fontFamily: A.display, letterSpacing: -0.5,
        lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function Legend({ aesthetic: A }) {
  const items = [
    ['drive', 'Drive'], ['reposition', 'Reposition'], ['break', 'Break'],
    ['personal', 'Personal'], ['sleep', 'Out'],
  ];
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '10px 16px',
      padding: '16px 2px', borderTop: `1px solid ${A.gridLine}`,
      fontFamily: A.mono, fontSize: 10, color: A.muted,
      letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {items.map(([k, lbl]) => {
        const color = k === 'drive' ? A.accent : KIND[k].swatch;
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: color, borderRadius: 2, opacity: k === 'sleep' ? 0.4 : k === 'drive' ? 1 : 0.75 }} />
            <span>{lbl}</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, background: A.accent, borderLeft: `2px solid ${A.text}`, borderRadius: 2 }} />
        <span>Booked</span>
      </div>
    </div>
  );
}

// ───────────────── Layout: Timeline (horizontal) ─────────────────
// Each day is a horizontal row with blocks flowing left→right
function WeekTimeline({ onPickDay, aesthetic: A, showEarn }) {
  const pxPerHour = 38;
  const gridW = HOURS * pxPerHour;
  return (
    <div style={{ padding: '4px 16px 40px' }}>
      <WeekSummary aesthetic={A} showEarn={showEarn} />

      <div style={{ marginTop: 18 }}>
        {/* hour header */}
        <div style={{ display: 'flex', paddingLeft: 56, marginBottom: 6 }}>
          <div style={{ width: gridW, position: 'relative', height: 14, fontFamily: A.mono }}>
            {Array.from({ length: HOURS / 2 + 1 }).map((_, i) => {
              const h = DAY_START + i * 2;
              return (
                <div key={i} style={{
                  position: 'absolute', left: i * 2 * pxPerHour,
                  fontSize: 9, color: A.faint,
                }}>{formatHour(h)}</div>
              );
            })}
          </div>
        </div>

        {WEEK.days.map(d => (
          <button key={d.id} onClick={() => onPickDay(d.id)} style={{
            display: 'flex', alignItems: 'stretch', width: '100%',
            background: 'transparent', border: 'none', padding: 0,
            marginBottom: 8, cursor: 'pointer',
          }}>
            <div style={{
              width: 56, textAlign: 'left', paddingTop: 2, flexShrink: 0,
            }}>
              <div style={{
                fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
                color: A.muted, fontFamily: A.mono,
              }}>{d.short}</div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: A.text,
                fontFamily: A.display,
              }}>{d.date.split(' ')[1]}</div>
            </div>
            <div style={{
              position: 'relative', width: gridW, height: 34,
              background: A.colBg, borderRadius: 4,
            }}>
              {Array.from({ length: HOURS / 2 }).map((_, i) => (
                <div key={i} style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: (i + 1) * 2 * pxPerHour, width: 1,
                  background: A.gridLine,
                }} />
              ))}
              {d.blocks.map((b, i) => {
                const left = (t2h(b.start) - DAY_START) * pxPerHour;
                const w = (t2h(b.end) - t2h(b.start)) * pxPerHour;
                const kind = KIND[b.kind];
                const isDrive = b.kind === 'drive';
                return (
                  <div key={i} style={{
                    position: 'absolute', left, width: w, top: 2, bottom: 2,
                    background: isDrive ? A.accent : kind.swatch,
                    opacity: isDrive ? 1 : (b.kind === 'sleep' ? 0.3 : 0.7),
                    borderRadius: 2,
                    borderLeft: b.booked ? `2px solid ${A.text}` : 'none',
                    boxShadow: b.peak ? `0 0 0 1px ${A.text}` : 'none',
                  }} />
                );
              })}
            </div>
          </button>
        ))}
      </div>

      <Legend aesthetic={A} />
    </div>
  );
}

// ───────────────── Layout: List ─────────────────
function WeekList({ onPickDay, aesthetic: A, showEarn }) {
  return (
    <div style={{ padding: '4px 16px 40px' }}>
      <WeekSummary aesthetic={A} showEarn={showEarn} />

      <div style={{ marginTop: 20 }}>
        {WEEK.days.map(d => (
          <button key={d.id} onClick={() => onPickDay(d.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'transparent', border: 'none', padding: '14px 0',
            borderBottom: `1px solid ${A.gridLine}`, cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <div style={{
                fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
                color: A.muted, fontFamily: A.mono, width: 36,
              }}>{d.short}</div>
              <div style={{
                fontSize: 22, fontWeight: 600, color: A.text,
                fontFamily: A.display, letterSpacing: -0.5,
              }}>{d.date.split(' ')[1]}</div>
              <div style={{
                flex: 1, fontSize: 12, color: A.muted,
                fontFamily: A.sans,
              }}>{d.theme}</div>
              {showEarn && (
                <div style={{
                  fontSize: 14, fontWeight: 500, color: A.accent,
                  fontFamily: A.mono,
                }}>${d.earnings}</div>
              )}
            </div>
            {/* mini bar */}
            <div style={{
              position: 'relative', height: 6, marginLeft: 48,
              background: A.colBg, borderRadius: 2,
            }}>
              {d.blocks.map((b, i) => {
                const left = ((t2h(b.start) - DAY_START) / HOURS) * 100;
                const w = ((t2h(b.end) - t2h(b.start)) / HOURS) * 100;
                const kind = KIND[b.kind];
                const isDrive = b.kind === 'drive';
                return (
                  <div key={i} style={{
                    position: 'absolute', left: `${left}%`, width: `${w}%`, top: 0, bottom: 0,
                    background: isDrive ? A.accent : kind.swatch,
                    opacity: isDrive ? 1 : (b.kind === 'sleep' ? 0.3 : 0.6),
                    borderRadius: 1,
                  }} />
                );
              })}
            </div>
          </button>
        ))}
      </div>

      <Legend aesthetic={A} />
    </div>
  );
}

window.WeekGrid = WeekGrid;
window.WeekTimeline = WeekTimeline;
window.WeekList = WeekList;
window.HOURS_CONST = { DAY_START, DAY_END, HOURS };
