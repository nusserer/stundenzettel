const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, taskTotal } = require('../app/task-evaluation.js');

const log = (start, stop, extra = {}) => ({ taskId: 1, art: 'auftrag', orderNr: 'A', start, stop, ...extra });
const run = (logs, days, extra = {}) => evaluate({ logs, days, tasks: [], now: new Date('2026-10-22T10:00:00'), ...extra });

test('Über Nacht zählt nur die gestempelte Anwesenheit; Protokoll bleibt unverändert', () => {
  const logs = [log('2026-10-19T15:00:00', '2026-10-20T09:00:00')];
  const days = { '2026-10-19': { stamps: ['08:00', '16:00'] }, '2026-10-20': { stamps: ['08:00', '16:00'] } };
  const before = JSON.stringify({ logs, days });
  const r = run(logs, days);
  assert.equal(r.entries[0].rawMinutes, 1080);
  assert.equal(r.byTask[1].minutes, 120);
  assert.equal(r.byDay['2026-10-19'].total, 60);
  assert.equal(r.entries[0].clipped, true);
  assert.equal(JSON.stringify({ logs, days }), before);
});

test('Monats- und Jahresgrenzen werden nach Anwesenheitstag aufgeteilt', () => {
  const r = run([log('2025-12-31T15:00:00', '2026-01-02T10:00:00')], {
    '2025-12-31': { stamps: ['08:00', '16:00'] }, '2026-01-02': { stamps: ['08:00', '16:00'] }
  });
  assert.equal(r.byDay['2025-12-31'].total, 60);
  assert.equal(r.byDay['2026-01-02'].total, 120);
  assert.equal(r.byTask[1].minutes, 180);
});

test('Mehrere Stempelpaare lassen die Lücke unberücksichtigt', () => {
  const r = run([log('2026-10-21T08:00:00', '2026-10-21T16:00:00')], {
    '2026-10-21': { stamps: ['08:00', '12:00', '13:00', '16:00'] }
  });
  assert.equal(r.entries[0].minutes, 420);
});

test('Heute offen und laufender Auftrag zählen nur bis jetzt, nicht bis zur Empfehlung', () => {
  const r = run([], { '2026-10-22': { stamps: ['08:00'] } }, {
    tasks: [{ id: 1, orderNr: 'A', kind: 'auftrag', status: 'in Arbeit', activeSince: '2026-10-22T08:30:00' }]
  });
  assert.equal(r.byTask[1].minutes, 90);
  assert.equal(r.entries[0].id, 'live:1');
});

test('Offener historischer Tag wird nicht bis heute hochgerechnet', () => {
  const r = run([log('2026-10-21T08:00:00', '2026-10-22T09:00:00')], { '2026-10-21': { stamps: ['08:00'] } });
  assert.equal(r.byTask[1].minutes, 0);
});

test('Gleichzeitige Einträge werden als Überlappung gekennzeichnet', () => {
  const r = run([
    log('2026-10-21T08:00:00', '2026-10-21T10:00:00'),
    log('2026-10-21T09:00:00', '2026-10-21T11:00:00', { taskId: 2, art: 'stoerung' })
  ], { '2026-10-21': { stamps: ['08:00', '16:00'] } });
  assert.ok(r.entries.every(e => e.overlap));
  assert.equal(r.byDay['2026-10-21'].overlap, true);
});

test('Bestehende anteilige Tagesbegrenzung wird als Schätzung sichtbar', () => {
  const r = run([
    log('2026-10-21T08:00:00', '2026-10-21T16:00:00'),
    log('2026-10-21T08:00:00', '2026-10-21T16:00:00', { taskId: 2, art: 'stoerung' })
  ], { '2026-10-21': { stamps: ['08:00', '16:00'] } }, { netMinutesForDay: () => 450 });
  assert.equal(r.byTask[1].minutes, 225);
  assert.equal(r.byTask[2].minutes, 225);
  assert.equal(r.byDay['2026-10-21'].total, 450);
  assert.ok(r.entries.every(e => e.estimated));
});

test('Rundung: Einzelzeiten, Aufträge und Tagesgesamt ergeben dieselbe Summe', () => {
  const r = run([1, 2, 3].map(taskId => log('2026-10-21T08:00:00', '2026-10-21T16:00:00', { taskId })), {
    '2026-10-21': { stamps: ['08:00', '16:00'] }
  }, { netMinutesForDay: () => 451 });
  assert.equal(r.entries.reduce((n, e) => n + e.minutes, 0), 451);
  assert.equal(Object.values(r.byTask).reduce((n, e) => n + e.minutes, 0), 451);
  assert.equal(r.byDay['2026-10-21'].total, 451);
});

test('Zusatzzeit wird nur ausdrücklich am Auftrag ergänzt, nicht auf Monate erfunden', () => {
  const r = run([log('2026-10-21T08:00:00', '2026-10-21T09:00:00')], { '2026-10-21': { stamps: ['08:00', '16:00'] } });
  assert.equal(taskTotal(r, { id: 1, manualDurationOffsetMinutes: 30 }), 90);
  assert.equal(taskTotal(r, { id: 1, manualDurationOffsetMinutes: -120 }), 0);
  assert.equal(r.byDay['2026-10-21'].total, 60);
});

test('Nachtschicht bleibt dem Stempeltag zugeordnet', () => {
  const r = run([log('2026-10-21T23:00:00', '2026-10-22T02:00:00')], { '2026-10-21': { stamps: ['22:00', '06:00'] } });
  assert.equal(r.byDay['2026-10-21'].total, 180);
});

test('Fehlende Anwesenheit und ungültige Protokollzeiten erfinden keine Arbeitszeit', () => {
  const r = run([log('invalid', '2026-10-21T09:00:00'), log('2026-10-21T08:00:00', '2026-10-21T09:00:00')], {});
  assert.equal(r.byTask[1].minutes, 0);
  assert.equal(Object.keys(r.byDay).length, 0);
});

test('Auftragsnamen wie constructor werden als normale Bezeichnung summiert', () => {
  const r = run([log('2026-10-21T08:00:00', '2026-10-21T09:00:00', { orderNr: 'constructor' })], {
    '2026-10-21': { stamps: ['08:00', '16:00'] }
  });
  assert.equal(r.byDay['2026-10-21'].orders.constructor, 60);
});
