const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../app/time-core.js');

test('Dauerwerte werden eindeutig als H:MM geparst und formatiert', () => {
  assert.equal(core.parseDuration('7:30'), 450);
  assert.equal(core.parseDuration('0:45'), 45);
  assert.equal(core.parseDuration('7.5'), null);
  assert.equal(core.formatDuration(450, 'hm'), '7:30');
  assert.equal(core.formatDuration(456, 'decimal'), '7,60');
  assert.equal(core.formatDuration(-1, 'hm'), '-0:01');
});

test('geplante Pausen werden verspätet einmalig fällig und verändern keinen Pausenstatus', () => {
  const breaks = [{ start: '12:15', end: '12:45', label: 'Mittag' }];
  const pending = core.dueScheduledBreaks({ date: '2026-01-02', nowMinutes: 12 * 60 + 19, breaks });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].type, 'start');
  const id = pending[0].id;
  const afterBreak = core.dueScheduledBreaks({ date: '2026-01-02', nowMinutes: 12 * 60 + 50, breaks, fired: { [id]: { start: true } } });
  assert.deepEqual(afterBreak, []);
});

test('Schließen wird nur bei offenem Tag oder laufendem Auftrag gewarnt', () => {
  assert.equal(core.shouldWarnBeforeUnload({ dayOpen: false, taskRunning: false }), false);
  assert.equal(core.shouldWarnBeforeUnload({ dayOpen: true, taskRunning: false }), true);
  assert.equal(core.shouldWarnBeforeUnload({ dayOpen: false, taskRunning: true }), true);
});

test('Januar und Februar erhalten den richtigen Kalenderrange', () => {
  const january = core.monthDayKeys(2026, 1);
  const february = core.monthDayKeys(2028, 2);
  assert.equal(january[0], '2026-01-01');
  assert.equal(january.at(-1), '2026-01-31');
  assert.equal(february.length, 29);
  assert.equal(february.at(-1), '2028-02-29');
});