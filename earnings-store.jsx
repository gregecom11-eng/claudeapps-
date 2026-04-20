// Actual-earnings store — per-day overrides that represent what the driver
// really made. When unset, views fall back to the schedule's projection.
// Storage key pairs the active week's first isoDate with dayId so imports
// don't collide with the baseline week's actuals.

(function initEarningsStore() {
  const KEY = 'sched-actuals';

  function weekKey() {
    const first = window.WEEK && window.WEEK.days && window.WEEK.days[0];
    return (first && first.isoDate) || 'default';
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }
  function saveAll(all) {
    localStorage.setItem(KEY, JSON.stringify(all));
  }
  function loadWeek() {
    const all = loadAll();
    return all[weekKey()] || {};
  }
  function saveWeek(data) {
    const all = loadAll();
    all[weekKey()] = data;
    saveAll(all);
  }

  window.EarningsStore = {
    get(dayId) {
      const d = loadWeek();
      return typeof d[dayId] === 'number' ? d[dayId] : null;
    },
    set(dayId, amount) {
      const d = loadWeek();
      if (amount === null || amount === '' || isNaN(Number(amount))) {
        delete d[dayId];
      } else {
        d[dayId] = Math.round(Number(amount));
      }
      saveWeek(d);
    },
    getAll() { return loadWeek(); },
    totalActual() {
      const d = loadWeek();
      return Object.values(d).reduce((s, v) => s + (Number(v) || 0), 0);
    },
    daysWithActuals() {
      return Object.keys(loadWeek()).length;
    },
    clearWeek() {
      saveWeek({});
    },
  };
})();
