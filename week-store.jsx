// Week store — lets the user replace the hardcoded WEEK with one imported from
// a Claude conversation. The baseline WEEK stays available for reset.
// Loads immediately after schedule-data.jsx so every consumer (week-rings,
// day-detail, month-view, dispatch, trip-store) sees the active week.

(function initWeekStore() {
  const BASELINE = window.WEEK;
  window.BASELINE_WEEK = BASELINE;

  function loadStored() {
    try {
      const raw = localStorage.getItem('sched-week');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) return null;
      return parsed;
    } catch { return null; }
  }

  const stored = loadStored();
  if (stored) window.WEEK = stored;

  window.WeekStore = {
    getBaseline: () => BASELINE,
    getActive: () => window.WEEK,
    isImported: () => loadStored() !== null,
    applyImported(week) {
      localStorage.setItem('sched-week', JSON.stringify(week));
      window.WEEK = week;
    },
    resetToBaseline() {
      localStorage.removeItem('sched-week');
      window.WEEK = BASELINE;
    },
  };
})();
