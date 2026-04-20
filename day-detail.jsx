// Day Detail View — tap a day from week view to dive in

function DayDetail({ dayId, onBack, aesthetic: A, showEarn }) {
  const day = WEEK.days.find(d => d.id === dayId);
  if (!day) return null;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 16px 12px',
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer',
          fontFamily: A.mono, fontSize: 11, color: A.muted,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>← Week</button>
        <div style={{
          fontFamily: A.mono, fontSize: 11, color: A.muted,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>{day.name} · {day.date}</div>
      </div>

      {/* hero */}
      <div style={{ padding: '8px 16px 20px' }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
          color: A.accent, fontFamily: A.mono, marginBottom: 6,
        }}>{day.theme}</div>
        <div style={{
          fontSize: 28, fontWeight: 500, color: A.text,
          fontFamily: A.display, letterSpacing: -0.8,
          lineHeight: 1.1, textWrap: 'pretty',
        }}>{day.summary}</div>
      </div>

      {/* event anchor card */}
      {day.event && (
        <div style={{
          margin: '0 16px 20px', padding: '14px 16px',
          background: A.colBg, borderRadius: 6,
          borderLeft: `2px solid ${A.accent}`,
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
            color: A.muted, fontFamily: A.mono, marginBottom: 4,
          }}>Event anchor</div>
          <div style={{
            fontSize: 16, fontWeight: 500, color: A.text,
            fontFamily: A.display, marginBottom: 2,
          }}>{day.event.name}</div>
          <div style={{
            fontSize: 12, color: A.muted, fontFamily: A.mono,
          }}>{day.event.venue} · {day.event.time}</div>
        </div>
      )}

      {/* stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showEarn ? '1fr 1fr' : '1fr',
        gap: 1,
        margin: '0 16px 24px', padding: '14px 0',
        borderTop: `1px solid ${A.gridLine}`,
        borderBottom: `1px solid ${A.gridLine}`,
      }}>
        <Stat label="Drive hours" value={day.driveHours} aesthetic={A} />
        {showEarn && <Stat label="Projected" value={`$${day.earnings}`} aesthetic={A} />}
      </div>

      {/* timeline */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
          color: A.muted, fontFamily: A.mono, marginBottom: 14,
        }}>Schedule</div>

        {day.blocks.map((b, i) => (
          <BlockRow key={i} block={b} aesthetic={A} showEarn={showEarn}
            isLast={i === day.blocks.length - 1} />
        ))}
      </div>
    </div>
  );
}

function BlockRow({ block, aesthetic: A, showEarn, isLast }) {
  const kind = KIND[block.kind];
  const isDrive = block.kind === 'drive';
  const color = isDrive ? A.accent : kind.swatch;

  const dur = t2h(block.end) - t2h(block.start);
  const durLbl = dur >= 1 ? `${dur % 1 === 0 ? dur : dur.toFixed(1)}h` : `${Math.round(dur * 60)}m`;

  return (
    <div style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
      {/* time column */}
      <div style={{
        width: 58, fontFamily: A.mono, fontSize: 11,
        color: A.text, letterSpacing: -0.2, paddingTop: 2, flexShrink: 0,
      }}>
        <div style={{ fontWeight: 500 }}>{fmtTime(block.start)}</div>
        <div style={{ color: A.faint, fontSize: 10 }}>{fmtTime(block.end)}</div>
      </div>

      {/* rail */}
      <div style={{ position: 'relative', width: 12, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', left: 5, top: 6, width: 2,
          bottom: isLast ? 'auto' : -16, height: isLast ? 0 : 'auto',
          background: A.gridLine,
        }} />
        <div style={{
          position: 'absolute', left: 0, top: 3, width: 12, height: 12,
          borderRadius: 2, background: color,
          opacity: isDrive ? 1 : block.kind === 'sleep' ? 0.4 : 0.75,
          boxShadow: block.peak ? `0 0 0 2px ${A.bg}, 0 0 0 3px ${A.text}` : 'none',
        }} />
      </div>

      {/* content */}
      <div style={{ flex: 1, paddingBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: A.text,
            fontFamily: A.sans, lineHeight: 1.3, flex: 1,
          }}>{block.title}</div>
          {showEarn && isDrive && block.earn && (
            <div style={{
              fontSize: 12, color: A.accent, fontFamily: A.mono,
              fontWeight: 500, flexShrink: 0,
            }}>${block.earn}</div>
          )}
        </div>
        <div style={{
          display: 'flex', gap: 8, marginTop: 3, alignItems: 'baseline',
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
            color: A.muted, fontFamily: A.mono,
          }}>{kind.label} · {durLbl}</div>
          {block.booked && (
            <div style={{
              fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
              color: A.accent, fontFamily: A.mono,
            }}>· Booked</div>
          )}
          {block.peak && (
            <div style={{
              fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
              color: A.text, fontFamily: A.mono,
            }}>· Peak</div>
          )}
        </div>
        {block.detail && (
          <div style={{
            fontSize: 12, color: A.muted, fontFamily: A.sans,
            marginTop: 4, lineHeight: 1.4, textWrap: 'pretty',
          }}>{block.detail}</div>
        )}
      </div>
    </div>
  );
}

function fmtTime(s) {
  const [h, m] = s.split(':').map(Number);
  if (h === 23 && m === 59) return '12:00a';
  const per = h < 12 ? 'a' : 'p';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}${per}`;
}

window.DayDetail = DayDetail;
