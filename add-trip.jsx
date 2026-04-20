// Add Trip screen — full waybill composer

const { useState: useStateAT } = React;

function AddTrip({ A, onBack, onSaved }) {
  const [dayId, setDayId] = useStateAT('tue');
  const [category, setCategory] = useStateAT('private');
  const [start, setStart] = useStateAT('18:00');
  const [end, setEnd] = useStateAT('19:30');
  const [title, setTitle] = useStateAT('');
  const [passenger, setPassenger] = useStateAT('');
  const [pickup, setPickup] = useStateAT('');
  const [dropoff, setDropoff] = useStateAT('');
  const [vehicle, setVehicle] = useStateAT('2024 Escalade');
  const [flight, setFlight] = useStateAT('');
  const [fare, setFare] = useStateAT('');
  const [driverPay, setDriverPay] = useStateAT('');
  const [assignedTo, setAssignedTo] = useStateAT('');
  const [invoiceNo, setInvoiceNo] = useStateAT('');
  const [payStatus, setPayStatus] = useStateAT('pending');
  const [notes, setNotes] = useStateAT('');

  const startH = t2h(start);
  const endH = t2h(end);
  const valid = endH > startH && title.trim();
  const conflicts = valid ? window.TripStore.findConflicts(dayId, startH, endH) : [];
  const day = WEEK.days.find(d => d.id === dayId);

  const fareN = Number(fare) || 0;
  const payN = Number(driverPay) || 0;
  const commission = category === 'dispatch' ? Math.max(0, fareN - payN) : 0;

  const save = () => {
    const trips = window.TripStore.loadTrips();
    const key = window.TripStore.BASELINE_DATES[dayId];
    const list = trips[key] || [];
    list.push({
      id: 'u' + Date.now(),
      start, end,
      title: title.trim(),
      category, passenger, pickup, dropoff, vehicle, flight,
      fare: fareN,
      driverPay: category === 'dispatch' ? payN : 0,
      commission,
      assignedTo: category === 'dispatch' ? assignedTo : '',
      invoiceNo, payStatus, notes,
    });
    trips[key] = list;
    window.TripStore.saveTrips(trips);
    onSaved();
  };

  const input = {
    width: '100%', background: A.colBg, border: `1px solid ${A.gridLine}`,
    color: A.text, fontFamily: A.sans, fontSize: 15,
    padding: '10px 12px', borderRadius: 4, outline: 'none', boxSizing: 'border-box',
  };
  const label = {
    fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
    color: A.muted, fontFamily: A.mono, marginBottom: 6,
  };

  const Pills = ({ value, onChange, options }) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: '8px 4px', cursor: 'pointer',
          background: value === o.v ? A.accent : A.colBg,
          color: value === o.v ? '#0e0e10' : A.text,
          border: 'none', borderRadius: 4,
          fontFamily: A.mono, fontSize: 10, letterSpacing: 0.8,
          textTransform: 'uppercase', fontWeight: 500,
        }}>{o.l}</button>
      ))}
    </div>
  );

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
        color: A.faint, fontFamily: A.mono, marginBottom: 10,
        paddingBottom: 6, borderBottom: `1px solid ${A.gridLine}`,
      }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 0 12px',
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer',
          fontFamily: A.mono, fontSize: 11, color: A.muted,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>← Back</button>
        <div style={{
          fontFamily: A.mono, fontSize: 11, color: A.muted,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>Waybill · New</div>
      </div>

      <div style={{
        fontSize: 26, fontWeight: 500, color: A.text,
        fontFamily: A.display, letterSpacing: -0.8, lineHeight: 1.05,
        padding: '4px 0 18px',
      }}>Add ride</div>

      <Section title="Category">
        <Pills value={category} onChange={setCategory} options={[
          { v: 'private',  l: 'Private' },
          { v: 'dispatch', l: 'Dispatch' },
          { v: 'uber',     l: 'Uber Black' },
        ]} />
      </Section>

      <Section title="When">
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Day</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WEEK.days.map(d => (
              <button key={d.id} onClick={() => setDayId(d.id)} style={{
                padding: '8px 2px', minWidth: 0,
                background: dayId === d.id ? A.accent : A.colBg,
                color: dayId === d.id ? '#0e0e10' : A.text,
                border: 'none', borderRadius: 4, cursor: 'pointer',
                fontFamily: A.mono, fontSize: 9, letterSpacing: 0.3,
                textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3,
              }}>
                <div>{d.short}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{d.date.split(' ')[1]}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={label}>Pickup</div>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              style={{ ...input, fontFamily: A.mono, colorScheme: A.mode }} />
          </div>
          <div>
            <div style={label}>Drop-off</div>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              style={{ ...input, fontFamily: A.mono, colorScheme: A.mode }} />
          </div>
        </div>
      </Section>

      <Section title="Trip">
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Label</div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Duval · Newport → LAX" style={input} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Passenger</div>
          <input value={passenger} onChange={e => setPassenger(e.target.value)}
            placeholder="Franci Gray" style={input} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Pickup address</div>
          <input value={pickup} onChange={e => setPickup(e.target.value)}
            placeholder="169 S Poplar Ave, Brea CA" style={input} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Drop-off</div>
          <input value={dropoff} onChange={e => setDropoff(e.target.value)}
            placeholder="Ontario Intl (ONT)" style={input} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={label}>Vehicle</div>
            <input value={vehicle} onChange={e => setVehicle(e.target.value)}
              style={input} />
          </div>
          <div>
            <div style={label}>Flight</div>
            <input value={flight} onChange={e => setFlight(e.target.value)}
              placeholder="DL 2104 · 9:55 PM" style={input} />
          </div>
        </div>
      </Section>

      <Section title={category === 'dispatch' ? 'Billing · Dispatch' : 'Billing'}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: category === 'dispatch' ? '1fr 1fr 1fr' : '1fr',
          gap: 10, marginBottom: 10,
        }}>
          <div>
            <div style={label}>Fare $</div>
            <input type="number" inputMode="numeric" value={fare}
              onChange={e => setFare(e.target.value)} placeholder="260"
              style={{ ...input, fontFamily: A.mono }} />
          </div>
          {category === 'dispatch' && (
            <>
              <div>
                <div style={label}>Driver pay</div>
                <input type="number" inputMode="numeric" value={driverPay}
                  onChange={e => setDriverPay(e.target.value)} placeholder="160"
                  style={{ ...input, fontFamily: A.mono }} />
              </div>
              <div>
                <div style={label}>Commission</div>
                <div style={{
                  ...input, fontFamily: A.mono, color: A.accent,
                  display: 'flex', alignItems: 'center',
                }}>${commission}</div>
              </div>
            </>
          )}
        </div>
        {category === 'dispatch' && (
          <div style={{ marginBottom: 10 }}>
            <div style={label}>Assigned to</div>
            <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              placeholder="Marco R." style={input} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={label}>Invoice #</div>
            <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
              placeholder="SD-2604-026"
              style={{ ...input, fontFamily: A.mono }} />
          </div>
          <div>
            <div style={label}>Status</div>
            <Pills value={payStatus} onChange={setPayStatus} options={[
              { v: 'pending',   l: 'Pend' },
              { v: 'invoiced',  l: 'Inv' },
              { v: 'captured',  l: 'Cap' },
              { v: 'paid',      l: 'Paid' },
            ]} />
          </div>
        </div>
        <div>
          <div style={label}>Notes</div>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Repeat client · 2 bags" style={input} />
        </div>
      </Section>

      {/* conflict preview */}
      {valid && conflicts.length > 0 && (
        <div style={{
          padding: '12px', background: A.colBg, borderRadius: 6,
          borderLeft: `2px solid ${A.accent}`, marginBottom: 16,
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
            color: A.accent, fontFamily: A.mono, marginBottom: 6,
          }}>Will replace {conflicts.length} block{conflicts.length > 1 ? 's' : ''}</div>
          {conflicts.map((c, i) => (
            <div key={i} style={{
              fontSize: 11, color: A.muted, fontFamily: A.sans,
              padding: '2px 0',
            }}>
              <span style={{ fontFamily: A.mono, marginRight: 8 }}>{c.start}–{c.end}</span>
              <span style={{ textDecoration: 'line-through' }}>{c.title}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={!valid} style={{
        width: '100%', padding: '16px', cursor: valid ? 'pointer' : 'not-allowed',
        background: valid ? A.accent : A.colBg,
        color: valid ? '#0e0e10' : A.muted,
        border: 'none', borderRadius: 6,
        fontFamily: A.display, fontSize: 15, fontWeight: 500,
      }}>Save waybill</button>
    </div>
  );
}

window.AddTrip = AddTrip;
