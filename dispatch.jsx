// Dispatch / Earnings dashboard — filter by category, payment status, stacked bar chart

const { useState: useStateDP, useMemo: useMemoDP } = React;

const CAT = {
  private:  { label: 'My Rides',    color: '#d4a24c', short: 'Private' },
  dispatch: { label: 'Dispatch',    color: '#6b9dcc', short: 'Dispatch' },
  uber:     { label: 'Uber Black',  color: '#9a9a9a', short: 'Uber' },
};

const PAY = {
  pending:  { label: 'Pending',   color: '#8a8680' },
  invoiced: { label: 'Invoiced',  color: '#c79a55' },
  captured: { label: 'Captured',  color: '#6b9dcc' },
  paid:     { label: 'Paid',      color: '#6ba96b' },
};

function Dispatch({ A, onOpenTrip, onAdd }) {
  const [catFilter, setCatFilter] = useStateDP('all');
  const [payFilter, setPayFilter] = useStateDP('all');
  const [trips, setTrips] = useStateDP(() => window.TripStore.allTrips());

  const refresh = () => setTrips(window.TripStore.allTrips());

  const totals = useMemoDP(() => {
    const t = { private: 0, dispatch: 0, uber: 0, payOut: 0, byStatus: {} };
    trips.forEach(tr => {
      if (tr.category === 'dispatch') {
        t.dispatch += Number(tr.commission) || 0;
        t.payOut  += Number(tr.driverPay) || 0;
      } else if (tr.category === 'private') {
        t.private += Number(tr.fare) || 0;
      } else if (tr.category === 'uber') {
        t.uber += Number(tr.fare) || 0;
      }
      const s = tr.payStatus || 'pending';
      t.byStatus[s] = (t.byStatus[s] || 0) + (
        tr.category === 'dispatch' ? (Number(tr.commission) || 0) : (Number(tr.fare) || 0)
      );
    });
    t.gross = t.private + t.dispatch + t.uber;
    return t;
  }, [trips]);

  const filtered = trips.filter(tr =>
    (catFilter === 'all' || tr.category === catFilter) &&
    (payFilter === 'all' || tr.payStatus === payFilter)
  );

  const cycleStatus = (id, cur) => {
    const seq = ['pending', 'invoiced', 'captured', 'paid'];
    const i = seq.indexOf(cur || 'pending');
    const next = seq[(i + 1) % seq.length];
    window.TripStore.updateTrip(id, { payStatus: next });
    refresh();
  };

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '4px 0 14px',
      }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
            color: A.muted, fontFamily: A.mono, marginBottom: 4,
          }}>Dispatch · Apr 20–26</div>
          <div style={{
            fontSize: 26, fontWeight: 500, color: A.text,
            fontFamily: A.display, letterSpacing: -0.8, lineHeight: 1,
          }}>${Math.round(totals.gross).toLocaleString()}</div>
        </div>
        <button onClick={onAdd} style={{
          background: A.accent, color: '#0e0e10',
          border: 'none', padding: '10px 14px', borderRadius: 6,
          cursor: 'pointer', fontFamily: A.mono, fontSize: 11,
          letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500,
        }}>+ Waybill</button>
      </div>

      {/* Stacked bar */}
      <StackedBar totals={totals} A={A} />

      {/* Category rows */}
      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <CatRow A={A} cat="private"  value={totals.private}  total={totals.gross} />
        <CatRow A={A} cat="dispatch" value={totals.dispatch} total={totals.gross}
          sub={`Owed to drivers: $${Math.round(totals.payOut).toLocaleString()}`} />
        <CatRow A={A} cat="uber"     value={totals.uber}     total={totals.gross} />
      </div>

      {/* Payment status pills */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        background: A.colBg, borderRadius: 6, marginBottom: 14,
        overflowX: 'auto',
      }}>
        {['pending','invoiced','captured','paid'].map(s => (
          <div key={s} style={{
            flex: 1, textAlign: 'center', padding: '2px 4px',
            borderRight: s !== 'paid' ? `1px solid ${A.gridLine}` : 'none',
          }}>
            <div style={{
              fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
              color: PAY[s].color, fontFamily: A.mono, marginBottom: 4,
            }}>{PAY[s].label}</div>
            <div style={{
              fontSize: 13, fontFamily: A.mono, color: A.text, fontWeight: 500,
            }}>${Math.round(totals.byStatus[s] || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
          color: A.faint, fontFamily: A.mono, marginBottom: 6,
        }}>Filter</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <FilterPill A={A} active={catFilter === 'all'} onClick={() => setCatFilter('all')} label="All" />
          <FilterPill A={A} active={catFilter === 'private'}  onClick={() => setCatFilter('private')}  label="Private" swatch={CAT.private.color} />
          <FilterPill A={A} active={catFilter === 'dispatch'} onClick={() => setCatFilter('dispatch')} label="Dispatch" swatch={CAT.dispatch.color} />
          <FilterPill A={A} active={catFilter === 'uber'}     onClick={() => setCatFilter('uber')}     label="Uber" swatch={CAT.uber.color} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <FilterPill A={A} active={payFilter === 'all'} onClick={() => setPayFilter('all')} label="Any" small />
          {['pending','invoiced','captured','paid'].map(s => (
            <FilterPill key={s} A={A}
              active={payFilter === s}
              onClick={() => setPayFilter(s)}
              label={PAY[s].label} swatch={PAY[s].color} small />
          ))}
        </div>
      </div>

      {/* Waybill list */}
      <div>
        {filtered.length === 0 && (
          <div style={{
            padding: '24px 12px', textAlign: 'center',
            fontFamily: A.mono, fontSize: 11, color: A.faint,
          }}>No rides match filter.</div>
        )}
        {filtered.map(tr => (
          <WaybillRow key={tr.id} trip={tr} A={A}
            onClick={() => onOpenTrip(tr)}
            onStatus={() => cycleStatus(tr.id, tr.payStatus)} />
        ))}
      </div>
    </div>
  );
}

function StackedBar({ totals, A }) {
  const segs = [
    { k: 'private',  v: totals.private,  c: CAT.private.color },
    { k: 'dispatch', v: totals.dispatch, c: CAT.dispatch.color },
    { k: 'uber',     v: totals.uber,     c: CAT.uber.color },
  ].filter(s => s.v > 0);
  const total = totals.gross || 1;
  return (
    <div>
      <div style={{
        display: 'flex', height: 36, borderRadius: 4, overflow: 'hidden',
        background: A.colBg,
      }}>
        {segs.map(s => (
          <div key={s.k} style={{
            width: `${(s.v / total) * 100}%`,
            background: s.c, color: '#0e0e10',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: A.mono, fontSize: 10, fontWeight: 600,
            letterSpacing: 0.5,
          }}>
            {(s.v / total) > 0.12 ? `${Math.round((s.v / total) * 100)}%` : ''}
          </div>
        ))}
      </div>
      {/* y-axis ticks as little labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, fontFamily: A.mono, color: A.faint,
        letterSpacing: 0.5, marginTop: 4,
      }}>
        <span>$0</span>
        <span>${Math.round(total / 2).toLocaleString()}</span>
        <span>${Math.round(total).toLocaleString()}</span>
      </div>
    </div>
  );
}

function CatRow({ A, cat, value, total, sub }) {
  const info = CAT[cat];
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div style={{
      padding: '12px 2px', borderBottom: `1px solid ${A.gridLine}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 2, background: info.color, flexShrink: 0,
          alignSelf: 'center',
        }} />
        <div style={{
          fontSize: 13, color: A.text, fontFamily: A.display, fontWeight: 500,
          flex: 1,
        }}>{info.label}</div>
        <div style={{
          fontSize: 15, color: A.text, fontFamily: A.mono, fontWeight: 500,
        }}>${Math.round(value).toLocaleString()}</div>
      </div>
      <div style={{
        height: 3, background: A.gridLine, borderRadius: 2,
        marginTop: 6, marginLeft: 20,
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: info.color, borderRadius: 2,
        }} />
      </div>
      {sub && (
        <div style={{
          fontSize: 10, color: A.faint, fontFamily: A.mono,
          marginTop: 5, marginLeft: 20, letterSpacing: 0.3,
        }}>{sub}</div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, swatch, A, small }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, minWidth: 0, padding: small ? '6px 6px' : '8px 8px',
      background: active ? A.text : A.colBg,
      color: active ? A.bg : A.muted,
      border: 'none', borderRadius: 4, cursor: 'pointer',
      fontFamily: A.mono, fontSize: small ? 9 : 10,
      letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      {swatch && <span style={{
        width: 6, height: 6, borderRadius: '50%', background: swatch, flexShrink: 0,
      }} />}
      {label}
    </button>
  );
}

function WaybillRow({ trip, A, onClick, onStatus }) {
  const cat = CAT[trip.category] || CAT.private;
  const pay = PAY[trip.payStatus || 'pending'];
  const amt = trip.category === 'dispatch' ? trip.commission : trip.fare;
  const dateShort = trip.dateKey.slice(5);
  return (
    <div onClick={onClick} style={{
      display: 'flex', gap: 10, padding: '12px 4px',
      borderBottom: `1px solid ${A.gridLine}`,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 3, alignSelf: 'stretch', background: cat.color, borderRadius: 2,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline',
        }}>
          <div style={{
            fontSize: 13, color: A.text, fontFamily: A.sans, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{trip.title}</div>
          <div style={{
            fontSize: 13, color: A.text, fontFamily: A.mono, flexShrink: 0,
          }}>${Math.round(amt || 0)}</div>
        </div>
        <div style={{
          fontSize: 10, color: A.muted, fontFamily: A.mono,
          letterSpacing: 0.5, marginTop: 3,
          display: 'flex', gap: 10,
        }}>
          <span>{dateShort} · {trip.start}</span>
          <span style={{ color: cat.color }}>{cat.short}</span>
          {trip.category === 'dispatch' && trip.assignedTo && (
            <span style={{ color: A.faint }}>→ {trip.assignedTo}</span>
          )}
        </div>
        {trip.category === 'dispatch' && (
          <div style={{
            fontSize: 10, color: A.faint, fontFamily: A.mono,
            marginTop: 3, letterSpacing: 0.3,
          }}>
            Fare ${trip.fare} · Pay ${trip.driverPay} · Keep ${trip.commission}
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); onStatus(); }} style={{
            padding: '3px 8px', background: 'transparent',
            border: `1px solid ${pay.color}`, borderRadius: 3,
            color: pay.color, cursor: 'pointer',
            fontFamily: A.mono, fontSize: 9, letterSpacing: 1,
            textTransform: 'uppercase', fontWeight: 500,
          }}>{pay.label}</button>
        </div>
      </div>
    </div>
  );
}

window.Dispatch = Dispatch;
