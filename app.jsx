// App shell — wires everything together, handles tweaks, platform, layout

const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "aesthetic": "dispatch",
  "platform": "ios",
  "showEarn": true,
  "theme": "dark",
  "compare": false
}/*EDITMODE-END*/;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('sched-state') || '{}');
    return { ...TWEAK_DEFAULTS, ...saved };
  } catch { return { ...TWEAK_DEFAULTS }; }
}

function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState(() => localStorage.getItem('sched-view') || 'week');
  const [pickedDay, setPickedDay] = useState(() => localStorage.getItem('sched-day') || null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => { localStorage.setItem('sched-state', JSON.stringify(state)); }, [state]);
  useEffect(() => { localStorage.setItem('sched-view', view); }, [view]);
  useEffect(() => { if (pickedDay) localStorage.setItem('sched-day', pickedDay); }, [pickedDay]);

  // Tweaks wiring
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') setEditMode(true);
      else if (d.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const update = (edits) => {
    setState(s => ({ ...s, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  };

  // Live clock — tick every minute so Auto theme flips at 7AM / 7PM without reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // On a real phone we drop the simulated device frame and fill the viewport.
  const [fullscreen, setFullscreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 500);
  useEffect(() => {
    const onResize = () => setFullscreen(window.innerWidth < 500);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const hour = now.getHours();
  const A = window.resolveAesthetic(state.aesthetic, state.theme, hour);
  const resolvedMode = A.mode;  // 'dark' | 'light'
  const isIOS = state.platform === 'ios';

  // Sync the document/body background so iOS safe areas and PWA chrome match the palette.
  useEffect(() => {
    document.body.style.background = A.bg;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', A.bg);
  }, [A.bg]);

  // For compare mode we render both at once
  const Alight = window.resolveAesthetic(state.aesthetic, 'light', hour);
  const Adark  = window.resolveAesthetic(state.aesthetic, 'dark', hour);

  const pickDay = (id) => { setPickedDay(id); setView('day'); };
  const back = () => setView('week');
  const goto = (v) => setView(v);

  const makeScreen = (palette) => (
    <AppScreen
      view={view} setView={setView} pickedDay={pickedDay}
      pickDay={pickDay} back={back} goto={goto}
      aesthetic={palette}
      showEarn={state.showEarn}
      now={now} themeMode={state.theme}
      toggleTheme={() => update({ theme: state.theme === 'dark' ? 'light' : 'dark' })}
    />
  );

  const deviceWrap = (palette, suffix) => {
    if (fullscreen) {
      return (
        <div key={suffix} style={{
          width: '100vw', height: '100dvh',
          background: palette.bg, color: palette.text,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {makeScreen(palette)}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'relative' }} key={suffix}>
        <DeviceLabel
          platform={state.platform}
          aesthetic={palette.label}
          themeMode={state.theme}
          resolved={palette.mode}
          now={now}
        />
        {isIOS
          ? <IOSDevice dark={palette.mode === 'dark'} width={402} height={874}>
              <div style={{ background: palette.bg, height: '100%' }}>{makeScreen(palette)}</div>
            </IOSDevice>
          : <AndroidDevice width={412} height={892}>
              <div style={{ background: palette.bg, height: '100%' }}>{makeScreen(palette)}</div>
            </AndroidDevice>
        }
      </div>
    );
  };

  // Background of the staging area — adapts to theme for the single-device case,
  // stays neutral when showing both side-by-side.
  const stageBg = fullscreen
    ? A.bg
    : state.compare
      ? '#1f1d1a'
      : (resolvedMode === 'dark' ? '#1a1815' : '#f4f2ec');

  const showCompare = state.compare && !fullscreen;

  return (
    <div style={{
      minHeight: '100vh', background: stageBg,
      padding: fullscreen ? 0 : '40px 20px',
      display: 'flex', alignItems: fullscreen ? 'stretch' : 'flex-start', justifyContent: 'center',
      gap: fullscreen ? 0 : 40, flexWrap: 'wrap',
      fontFamily: '-apple-system, system-ui, sans-serif',
      transition: 'background 0.3s ease',
    }}>
      {showCompare
        ? (<>{deviceWrap(Alight, 'light')}{deviceWrap(Adark, 'dark')}</>)
        : deviceWrap(A, 'single')
      }

      <TweaksPanel
        open={editMode}
        state={state}
        update={update}
        now={now}
      />
    </div>
  );
}

// iOS/Android-agnostic header + body
function AppScreen({ view, setView, pickedDay, pickDay, back, goto, aesthetic: A, showEarn, now, themeMode, toggleTheme }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  return (
    <div style={{
      background: A.bg, color: A.text,
      height: '100%', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ height: 54 }} />
        {view === 'week' && (
          <>
            <WeekHeader aesthetic={A} isDark={A.mode === 'dark'} toggleTheme={toggleTheme} />
            <WeekRings key={tick} onPickDay={pickDay} aesthetic={A} showEarn={showEarn} />
          </>
        )}
        {view === 'day' && (
          <DayDetail dayId={pickedDay} onBack={back} aesthetic={A} showEarn={showEarn} />
        )}
        {view === 'month' && (
          <MonthView A={A} showEarn={showEarn}
            onPickDay={pickDay}
            onAddAt={() => goto('add')} />
        )}
        {view === 'add' && (
          <AddTrip A={A} onBack={back}
            onSaved={() => { refresh(); goto('dispatch'); }} />
        )}
        {view === 'dispatch' && (
          <Dispatch A={A} key={tick}
            onOpenTrip={() => {}}
            onAdd={() => goto('add')} />
        )}
        <div style={{ height: 24 }} />
      </div>
      <TabBar view={view} goto={goto} A={A} />
    </div>
  );
}

function AutoThemeBadge() { return null; }

// Sun/moon icons used inline in the Week header.
function ThemeIcon({ isDark, small }) {
  const size = small ? 13 : 16;
  if (isDark) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

function ThemeToggle() { return null; }

function TabBar({ view, goto, A }) {
  const tabs = [
    { id: 'week',     label: 'Week' },
    { id: 'month',    label: 'Month' },
    { id: 'dispatch', label: '$' },
    { id: 'add',      label: '+' },
  ];
  return (
    <div style={{
      flexShrink: 0,
      padding: '10px 16px 30px',
      background: A.bg,
      borderTop: `1px solid ${A.gridLine}`,
      display: 'flex', gap: 4,
    }}>
      {tabs.map(t => {
        const active = view === t.id || (view === 'day' && t.id === 'week');
        return (
          <button key={t.id} onClick={() => goto(t.id)} style={{
            flex: 1, padding: '14px 8px', cursor: 'pointer',
            background: active ? A.accent : A.colBg,
            color: active ? '#0e0e10' : A.text,
            border: 'none', borderRadius: 6,
            fontFamily: A.mono, fontSize: 11,
            letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 500,
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

function WeekHeader({ aesthetic: A, isDark, toggleTheme }) {
  return (
    <div style={{ padding: '8px 16px 14px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
          color: A.muted, fontFamily: A.mono,
        }}>{WEEK.weekOf} · {WEEK.driver}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
            color: A.faint, fontFamily: A.mono,
          }}>{WEEK.vehicle.split(' · ')[0]}</div>
          {toggleTheme && (
            <button onClick={toggleTheme}
              aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
              title={isDark ? 'Day mode' : 'Night mode'}
              style={{
                width: 26, height: 26, padding: 0,
                background: 'transparent', color: A.muted,
                border: `1px solid ${A.gridLine}`, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                transition: 'color 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = A.accent; e.currentTarget.style.borderColor = A.accent; }}
              onMouseLeave={e => { e.currentTarget.style.color = A.muted; e.currentTarget.style.borderColor = A.gridLine.replace('rgba','rgba'); }}
            >
              <ThemeIcon isDark={isDark} small />
            </button>
          )}
        </div>
      </div>
      <div style={{
        fontSize: 30, fontWeight: 500, color: A.text,
        fontFamily: A.display, letterSpacing: -0.8, lineHeight: 1,
      }}>{WEEK.weekLabel}</div>
    </div>
  );
}

// ───────────────── Device label (outside the frame) ─────────────────
function DeviceLabel({ platform, aesthetic, themeMode, resolved, now }) {
  const mark = resolved === 'dark' ? '●' : '○';
  return (
    <div style={{
      textAlign: 'center', marginBottom: 14,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
      color: '#8a8680',
    }}>
      {mark} {platform === 'ios' ? 'iOS' : 'Android'} · {aesthetic}
    </div>
  );
}

// ───────────────── Tweaks panel ─────────────────
function TweaksPanel({ open, state, update, now }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, width: 280,
      background: '#17171a', color: '#f2efe8',
      padding: 16, borderRadius: 8,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 11, letterSpacing: 0.3,
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      zIndex: 1000,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
        color: '#8a8680', marginBottom: 14,
      }}>Tweaks</div>

      <TweakRow label="Theme" value={state.theme}
        options={['light', 'dark']}
        onChange={v => update({ theme: v })} />

      <TweakRow label="Show both (day / night)" value={state.compare ? 'on' : 'off'}
        options={['on', 'off']}
        onChange={v => update({ compare: v === 'on' })} />

      <TweakRow label="Aesthetic" value={state.aesthetic}
        options={['dispatch', 'paper', 'signal']}
        onChange={v => update({ aesthetic: v })} />

      <TweakRow label="Platform" value={state.platform}
        options={['ios', 'android']}
        onChange={v => update({ platform: v })} />

      <TweakRow label="Earnings" value={state.showEarn ? 'on' : 'off'}
        options={['on', 'off']}
        onChange={v => update({ showEarn: v === 'on' })} />
    </div>
  );
}

function TweakRow({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
        color: '#8a8680', marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, padding: '6px 4px', cursor: 'pointer',
            background: value === o ? '#d4a24c' : '#1a1a1e',
            color: value === o ? '#0e0e10' : '#f2efe8',
            border: 'none', borderRadius: 3,
            fontFamily: 'inherit', fontSize: 10,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
