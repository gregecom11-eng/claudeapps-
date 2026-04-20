// Day Detail View — tap a day from week view to dive in

function DayDetail({ dayId, onBack, aesthetic: A, showEarn }) {
  const { useState } = React;
  const day = WEEK.days.find(d => d.id === dayId);
  const [actual, setActual] = useState(() => window.EarningsStore ? window.EarningsStore.get(dayId) : null);
  if (!day) return null;

  const saveActual = (v) => {
    window.EarningsStore.set(dayId, v);
    setActual(window.EarningsStore.get(dayId));
  };

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
        gridTemplateColumns: showEarn ? '1fr 1fr 1fr' : '1fr',
        gap: 10,
        margin: '0 16px 24px', padding: '14px 0',
        borderTop: `1px solid ${A.gridLine}`,
        borderBottom: `1px solid ${A.gridLine}`,
      }}>
        <Stat label="Drive hrs" value={day.driveHours} aesthetic={A} />
        {showEarn && <Stat label="Projected" value={`$${day.earnings}`} aesthetic={A} muted />}
        {showEarn && <ActualEntry value={actual} onSave={saveActual} aesthetic={A} />}
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

function Stat({ label, value, aesthetic: A, muted }) {
  return (
    <div>
      <div style={{
        fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
        color: A.muted, fontFamily: A.mono, marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 500,
        color: muted ? A.faint : A.text,
        fontFamily: A.display, letterSpacing: -0.5, lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function ActualEntry({ value, onSave, aesthetic: A }) {
  const { useState, useRef, useEffect } = React;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { setDraft(value != null ? String(value) : ''); }, [value]);

  const commit = () => {
    const num = draft.trim() === '' ? null : Number(draft.replace(/[^\d.-]/g, ''));
    onSave(num);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value != null ? String(value) : '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <div style={{
          fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
          color: A.accent, fontFamily: A.mono, marginBottom: 3,
        }}>Actual</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 18, color: A.text, fontFamily: A.display,
          }}>$</span>
          <input ref={inputRef}
            inputMode="decimal"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            placeholder="0"
            style={{
              width: '100%', minWidth: 0, padding: 0,
              background: 'transparent', border: 'none',
              color: A.text, fontFamily: A.display,
              fontSize: 22, fontWeight: 500, letterSpacing: -0.5,
              outline: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  const hasValue = value != null;
  return (
    <button onClick={() => setEditing(true)} style={{
      background: 'transparent', border: 'none', padding: 0, margin: 0,
      textAlign: 'left', cursor: 'pointer',
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
        color: hasValue ? A.accent : A.muted, fontFamily: A.mono, marginBottom: 3,
      }}>{hasValue ? 'Actual' : 'Actual · tap'}</div>
      <div style={{
        fontSize: 22, fontWeight: 500,
        color: hasValue ? A.accent : A.faint,
        fontFamily: A.display, letterSpacing: -0.5, lineHeight: 1,
      }}>{hasValue ? `$${value.toLocaleString()}` : '—'}</div>
    </button>
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
              fontSize: 11, color: A.faint, fontFamily: A.mono,
              flexShrink: 0, letterSpacing: 0.3,
            }}>~${block.earn}</div>
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
