/* Runs before first paint: hide the announcement bar if it was dismissed (no flash, no layout shift). */
try { if (localStorage.getItem('gf-ann') === 'webinar-2026-10-24') document.documentElement.classList.add('ann-off'); } catch (e) {}
