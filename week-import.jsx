// Import Week — paste Claude's schedule output, preview it, apply to the app.

const PROMPT_TEMPLATE = `Output my weekly schedule in this exact machine-readable format so I can paste it into my Schedule app. Wrap only the schedule in a \`\`\`schedule fenced code block. Do not include any other prose inside the code block.

Format:

WEEK: <label, e.g., Apr 27 – May 3, 2026>

<DAY3> <YYYY-MM-DD> :: <theme> :: <summary>
  HH:MM-HH:MM :: <kind> :: <title> :: <detail> :: [$earn]

Rules:
- DAY3 is one of MON TUE WED THU FRI SAT SUN (all 7 required, in that order).
- kind is one of: drive | reposition | break | sleep | personal
- Times are 24-hour HH:MM. Blocks must not overlap. Use 23:59 for end of day.
- [$earn] is optional; only include on drive blocks where you have an estimate.
- detail may be empty — use "" in that case.
- Produce nothing else outside the code block.`;

const DAY_META = {
  mon: { name: 'Monday',    short: 'Mon', dow: 1 },
  tue: { name: 'Tuesday',   short: 'Tue', dow: 2 },
  wed: { name: 'Wednesday', short: 'Wed', dow: 3 },
  thu: { name: 'Thursday',  short: 'Thu', dow: 4 },
  fri: { name: 'Friday',    short: 'Fri', dow: 5 },
  sat: { name: 'Saturday',  short: 'Sat', dow: 6 },
  sun: { name: 'Sunday',    short: 'Sun', dow: 0 },
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const VALID_KINDS = new Set(['drive', 'reposition', 'break', 'sleep', 'personal']);

function extractCodeBlock(text) {
  const m = text.match(/```(?:\w+)?\s*\r?\n?([\s\S]*?)```/);
  return m ? m[1] : text;
}

function normalizeTime(s) {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function parseSchedule(input) {
  const text = extractCodeBlock(input || '');
  const errors = [];
  const week = {
    weekLabel: '',
    weekOf: '',
    driver: (window.BASELINE_WEEK && window.BASELINE_WEEK.driver) || '',
    vehicle: (window.BASELINE_WEEK && window.BASELINE_WEEK.vehicle) || '',
    totals: { drive: 0, earnings: 0, miles: 0 },
    days: [],
  };
  let current = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const lineNo = idx + 1;

    const weekMatch = line.match(/^WEEK\s*:\s*(.+)$/i);
    if (weekMatch) {
      week.weekLabel = weekMatch[1].trim();
      return;
    }

    const dayMatch = line.match(/^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{4}-\d{2}-\d{2})\s*(?:::\s*(.*))?$/i);
    if (dayMatch) {
      const id = dayMatch[1].toLowerCase();
      const iso = dayMatch[2];
      const rest = (dayMatch[3] || '').split(/\s*::\s*/);
      const theme = (rest[0] || '').trim();
      const summary = (rest[1] || '').trim();
      const [y, m, d] = iso.split('-').map(Number);
      const meta = DAY_META[id];
      current = {
        id, isoDate: iso,
        name: meta.name, short: meta.short,
        date: `${MONTHS[m - 1]} ${d}`, dow: meta.dow,
        theme, summary,
        driveHours: 0, earnings: 0, blocks: [],
      };
      week.days.push(current);
      return;
    }

    const blockMatch = line.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*::\s*([A-Za-z]+)\s*::\s*(.*)$/);
    if (blockMatch) {
      if (!current) {
        errors.push(`Line ${lineNo}: block before any day header`);
        return;
      }
      const start = normalizeTime(blockMatch[1]);
      const end = normalizeTime(blockMatch[2]);
      const kind = blockMatch[3].toLowerCase();
      if (!start || !end) {
        errors.push(`Line ${lineNo}: bad time`);
        return;
      }
      if (!VALID_KINDS.has(kind)) {
        errors.push(`Line ${lineNo}: unknown kind "${kind}"`);
        return;
      }
      const parts = blockMatch[4].split(/\s*::\s*/);
      const title = (parts[0] || '').trim();
      let detail = (parts[1] || '').trim();
      if (detail === '""') detail = '';
      const block = { start, end, kind, title, detail };
      if (parts[2]) {
        const em = parts[2].match(/\$?\s*(\d+(?:\.\d+)?)/);
        if (em) block.earn = Math.round(Number(em[1]));
      }
      current.blocks.push(block);
      return;
    }

    errors.push(`Line ${lineNo}: could not parse "${line.slice(0, 60)}"`);
  });

  week.days.forEach(d => {
    let hrs = 0, earn = 0;
    d.blocks.forEach(b => {
      if (b.kind === 'drive') {
        hrs += t2h(b.end) - t2h(b.start);
        if (b.earn) earn += b.earn;
      }
    });
    d.driveHours = Math.round(hrs * 10) / 10;
    d.earnings = earn;
  });

  week.totals.drive = Math.round(week.days.reduce((s, d) => s + d.driveHours, 0) * 10) / 10;
  week.totals.earnings = week.days.reduce((s, d) => s + d.earnings, 0);
  week.totals.miles = 0;

  if (!week.weekLabel && week.days.length) {
    const first = week.days[0].date;
    const last = week.days[week.days.length - 1].date;
    week.weekLabel = `${first} – ${last.split(' ')[1] || last}`;
  }
  const iso = week.days[0] && week.days[0].isoDate;
  week.weekOf = iso ? `Week of ${iso}` : 'Week';

  return { week, errors };
}

function WeekImport({ A, onBack, onApplied }) {
  const { useState, useMemo } = React;
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => text.trim() ? parseSchedule(text) : null, [text]);
  const isImported = window.WeekStore && window.WeekStore.isImported();

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const apply = () => {
    if (!parsed || !parsed.week.days.length) return;
    window.WeekStore.applyImported(parsed.week);
    onApplied();
  };

  const reset = () => {
    if (!confirm('Reset to the original Apr 20–26 week? Imported data will be cleared.')) return;
    window.WeekStore.resetToBaseline();
    onApplied();
  };

  return (
    <div style={{ padding: '4px 16px 60px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 0 12px',
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer',
          fontFamily: A.mono, fontSize: 11, color: A.muted,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>← Week</button>
        <div style={{
          fontFamily: A.mono, fontSize: 11, color: A.muted,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>Import</div>
      </div>

      <div style={{
        fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
        color: A.accent, fontFamily: A.mono, marginBottom: 6,
      }}>Paste from Claude</div>
      <div style={{
        fontSize: 24, fontWeight: 500, color: A.text,
        fontFamily: A.display, letterSpacing: -0.6, lineHeight: 1.15,
        marginBottom: 16,
      }}>Import a week</div>

      <div style={{
        padding: '12px 14px', background: A.colBg, borderRadius: 6,
        fontSize: 12, color: A.muted, fontFamily: A.sans, lineHeight: 1.45,
        marginBottom: 14,
      }}>
        <div style={{ marginBottom: 8 }}>
          1. Tap <strong style={{ color: A.text }}>Copy prompt</strong> and paste into your Claude chat after you've discussed the week.
        </div>
        <div style={{ marginBottom: 8 }}>
          2. Copy the <code style={{ fontFamily: A.mono, background: A.bg, padding: '1px 5px', borderRadius: 3 }}>```schedule</code> block Claude returns.
        </div>
        <div>
          3. Paste it below, review the preview, then <strong style={{ color: A.text }}>Apply</strong>.
        </div>
      </div>

      <button onClick={copyPrompt} style={{
        width: '100%', padding: '12px', marginBottom: 14,
        background: A.accent, color: '#0e0e10',
        border: 'none', borderRadius: 6, cursor: 'pointer',
        fontFamily: A.mono, fontSize: 12, fontWeight: 500,
        letterSpacing: 1.5, textTransform: 'uppercase',
      }}>{copied ? 'Copied ✓' : 'Copy prompt'}</button>

      <details style={{ marginBottom: 18 }}>
        <summary style={{
          fontFamily: A.mono, fontSize: 10, letterSpacing: 1.2,
          textTransform: 'uppercase', color: A.muted, cursor: 'pointer',
          padding: '6px 0',
        }}>Show prompt</summary>
        <pre style={{
          marginTop: 8, padding: 12, background: A.colBg, borderRadius: 4,
          fontFamily: A.mono, fontSize: 11, color: A.text,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4,
          maxHeight: 200, overflowY: 'auto',
        }}>{PROMPT_TEMPLATE}</pre>
      </details>

      <div style={{
        fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
        color: A.muted, fontFamily: A.mono, marginBottom: 6,
      }}>Paste schedule</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'```schedule\nWEEK: Apr 27 – May 3, 2026\n\nMON 2026-04-27 :: ...'}
        rows={10}
        style={{
          width: '100%', padding: 12,
          background: A.colBg, color: A.text,
          border: `1px solid ${A.gridLine}`, borderRadius: 4,
          fontFamily: A.mono, fontSize: 11, lineHeight: 1.5,
          resize: 'vertical', outline: 'none',
        }}
      />

      {parsed && (
        <Preview parsed={parsed} A={A} />
      )}

      {parsed && parsed.week.days.length > 0 && (
        <button onClick={apply} style={{
          width: '100%', padding: '14px', marginTop: 16,
          background: A.text, color: A.bg,
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontFamily: A.mono, fontSize: 12, fontWeight: 500,
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}>Apply {parsed.week.weekLabel || 'week'}</button>
      )}

      {isImported && (
        <button onClick={reset} style={{
          width: '100%', padding: '12px', marginTop: 10,
          background: 'transparent', color: A.muted,
          border: `1px solid ${A.gridLine}`, borderRadius: 6, cursor: 'pointer',
          fontFamily: A.mono, fontSize: 11,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>Reset to default week</button>
      )}
    </div>
  );
}

function Preview({ parsed, A }) {
  const { week, errors } = parsed;
  if (!week.days.length && !errors.length) return null;
  return (
    <div style={{
      marginTop: 16, padding: '14px 14px 8px',
      background: A.colBg, borderRadius: 6,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
        color: A.muted, fontFamily: A.mono, marginBottom: 8,
      }}>Preview</div>

      {week.weekLabel && (
        <div style={{
          fontSize: 18, fontWeight: 500, color: A.text,
          fontFamily: A.display, letterSpacing: -0.4, marginBottom: 10,
        }}>{week.weekLabel}</div>
      )}

      <div style={{
        display: 'flex', gap: 14, marginBottom: 10,
        fontFamily: A.mono, fontSize: 11, color: A.muted,
      }}>
        <span><span style={{ color: A.accent }}>${week.totals.earnings}</span> proj.</span>
        <span>{week.totals.drive}h drive</span>
        <span>{week.days.length}/7 days</span>
      </div>

      {week.days.map(d => (
        <div key={d.id} style={{
          display: 'flex', gap: 10, padding: '6px 0',
          borderTop: `1px solid ${A.gridLine}`,
          fontSize: 12, fontFamily: A.sans, color: A.text,
        }}>
          <div style={{
            width: 50, fontFamily: A.mono, fontSize: 10,
            letterSpacing: 1, textTransform: 'uppercase', color: A.muted,
            paddingTop: 2, flexShrink: 0,
          }}>{d.short} {d.date.split(' ')[1]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: A.text }}>{d.theme || '—'}</div>
            <div style={{
              fontSize: 10, color: A.faint, fontFamily: A.mono,
              marginTop: 2, letterSpacing: 0.5,
            }}>{d.blocks.length} blocks · {d.driveHours}h drive{d.earnings ? ` · $${d.earnings}` : ''}</div>
          </div>
        </div>
      ))}

      {errors.length > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 4,
          background: A.bg, fontFamily: A.mono, fontSize: 10,
          color: A.accent, lineHeight: 1.5,
        }}>
          {errors.length} parse issue{errors.length > 1 ? 's' : ''}:
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            {errors.length > 5 && <li>…and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

window.WeekImport = WeekImport;
window.parseSchedule = parseSchedule;
