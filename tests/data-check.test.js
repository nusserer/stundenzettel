const test = require('node:test');
const assert = require('node:assert/strict');
const { findIssues } = require('../app/data-check.js');

const base = { today: '2026-11-04', now: new Date(2026, 10, 4, 9, 0), tasks: [], log: [] };
const types = r => r.map(i => i.type);

test('Kommt ohne Geht an einem vergangenen Tag wird gefunden, heute nicht', () => {
  const days = { '2026-11-02': { stamps: ['08:00', '12:00', '12:30'] }, '2026-11-04': { stamps: ['08:00'] } };
  const r = findIssues({ ...base, days });
  const open = r.filter(i => i.type === 'open-day');
  assert.equal(open.length, 1); assert.equal(open[0].key, '2026-11-02'); assert.equal(open[0].fix.kind, 'addGeht');
});

test('Arbeitstag ohne Eintrag: nur Mo–Fr, nicht Wochenende, Feiertag oder Tag mit Code', () => {
  const days = { '2026-10-30': { stamps: ['08:00', '17:00'] }, '2026-11-03': { code: 'U' } };
  const r = findIssues({ ...base, days, isHoliday: k => k === '2026-11-02' });
  assert.deepEqual(r.filter(i => i.type === 'missing-day').map(i => i.key), []);   // Sa/So, Mo Feiertag, Di Code
  const r2 = findIssues({ ...base, days });
  assert.deepEqual(r2.filter(i => i.type === 'missing-day').map(i => i.key), ['2026-11-02']);
});

test('Tage vor dem ersten Eintrag des Jahres werden nicht gemeldet', () => {
  const r = findIssues({ ...base, days: { '2026-11-03': { stamps: ['08:00', '16:00'] } } });
  assert.deepEqual(types(r), []);
});

test('Auftrag läuft über Nacht: Vorschlag ist das letzte Geht des Starttags', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:30'] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const tasks = [{ id: 7, orderNr: 'A-1', status: 'in Arbeit', activeSince: new Date(2026, 10, 2, 8, 0).toISOString() }];
  const r = findIssues({ ...base, days, tasks });
  const running = r.find(i => i.type === 'order-running');
  assert.ok(running); assert.equal(running.fix.kind, 'stopTask');
  assert.equal(new Date(running.fix.stop).getHours(), 16); assert.equal(new Date(running.fix.stop).getMinutes(), 30);
});

test('Auftrag, der heute gestartet wurde, ist kein Fund', () => {
  const tasks = [{ id: 7, orderNr: 'A-1', status: 'in Arbeit', activeSince: new Date(2026, 10, 4, 8, 0).toISOString() }];
  assert.deepEqual(types(findIssues({ ...base, days: { '2026-11-04': { stamps: ['07:00'] } }, tasks })), []);
});

test('Protokolleintrag über Nacht: Kürzen auf das Geht', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:00'] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const log = [{ taskId: 3, art: 'auftrag', orderNr: 'B-2', start: new Date(2026, 10, 2, 14, 0).toISOString(), stop: new Date(2026, 10, 3, 9, 0).toISOString() }];
  const r = findIssues({ ...base, days, log });
  const issue = r.find(i => i.type === 'log-outside');
  assert.ok(issue); assert.equal(issue.fix.kind, 'trimLog'); assert.equal(issue.fix.logIndex, 0);
  assert.equal(new Date(issue.fix.stop).getHours(), 16);
});

test('Normaler Eintrag innerhalb der Anwesenheit und Pausen-Einträge sind kein Fund', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:00'] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const log = [{ taskId: 3, art: 'auftrag', start: new Date(2026, 10, 2, 8, 0).toISOString(), stop: new Date(2026, 10, 2, 15, 0).toISOString() },
    { kind: 'pause', start: new Date(2026, 10, 2, 12, 0).toISOString(), stop: new Date(2026, 10, 3, 12, 0).toISOString() }];
  assert.deepEqual(types(findIssues({ ...base, days, log })), []);
});

test('Geprüft markierte Hinweise werden ausgeblendet', () => {
  const days = { '2026-11-02': { stamps: ['08:00'] }, '2026-11-03': { stamps: ['08:00', '16:00'] } };
  const id = findIssues({ ...base, days })[0].id;
  assert.deepEqual(findIssues({ ...base, days, ignored: [id] }), []);
});

test('Ungewöhnlich langer Zeitraum (über 14 h)', () => {
  const days = { '2026-11-02': { stamps: ['05:00', '21:00'] } };
  assert.ok(types(findIssues({ ...base, days })).includes('long-pair'));
});

test('Ungeprüftes (automatisches) Geht ist keine Grundlage für einen Korrekturvorschlag', () => {
  const tasks = [{ id: 7, orderNr: 'A-1', status: 'in Arbeit', activeSince: new Date(2026, 10, 2, 8, 0).toISOString() }];
  const days = { '2026-11-02': { stamps: ['07:00', '16:30'], autoIdx: [1] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const running = findIssues({ ...base, days, tasks }).find(i => i.type === 'order-running');
  assert.equal(running.fix, null); assert.equal(running.unchecked, true); assert.match(running.detail, /ungeprüft/);
  // nach dem Prüfen/Korrigieren (autoIdx entfernt) erscheint der Vorschlag mit der korrigierten Zeit
  days['2026-11-02'] = { stamps: ['07:00', '16:45'] };
  const after = findIssues({ ...base, days, tasks }).find(i => i.type === 'order-running');
  assert.equal(after.fix.kind, 'stopTask'); assert.equal(new Date(after.fix.stop).getMinutes(), 45);
});

test('Protokolleintrag: ungeprüftes Geht blockiert die Kürzung, geprüftes nicht', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:00'], autoIdx: [1] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const log = [{ taskId: 3, art: 'auftrag', orderNr: 'B-2', start: new Date(2026, 10, 2, 14, 0).toISOString(), stop: new Date(2026, 10, 3, 9, 0).toISOString() }];
  assert.equal(findIssues({ ...base, days, log }).find(i => i.type === 'log-outside').fix, null);
  days['2026-11-02'] = { stamps: ['07:00', '16:00'] };
  assert.equal(findIssues({ ...base, days, log }).find(i => i.type === 'log-outside').fix.kind, 'trimLog');
});

const iso = (d, h, m) => new Date(2026, 10, d, h, m).toISOString();

test('Morgens: der zuletzt gewählte Auftrag beginnt erst nach dem Kommt der Stempeluhr', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:00'] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const log = [{ taskId: 5, art: 'auftrag', orderNr: 'A-1', start: iso(2, 8, 0), stop: iso(2, 16, 0) }, { taskId: 5, art: 'auftrag', orderNr: 'A-1', start: iso(3, 7, 8), stop: iso(3, 12, 0) }];
  const gap = findIssues({ ...base, days, log }).find(i => i.type === 'start-gap');
  assert.ok(gap); assert.equal(gap.key, '2026-11-03'); assert.equal(gap.fix.kind, 'extendLog'); assert.equal(gap.fix.logIndex, 1);
  assert.equal(new Date(gap.fix.start).getHours(), 7); assert.equal(new Date(gap.fix.start).getMinutes(), 0);
});

test('Morgens: ein anderer Auftrag als der letzte (und nicht automatisch gestartet) wird nicht vorgezogen', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:00'] }, '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const log = [{ taskId: 5, art: 'auftrag', start: iso(2, 8, 0), stop: iso(2, 16, 0) }, { taskId: 9, art: 'auftrag', start: iso(3, 7, 8), stop: iso(3, 12, 0) }];
  assert.equal(findIssues({ ...base, days, log }).some(i => i.type === 'start-gap'), false);
  log[1].autoStart = true;                                                     // automatisch beim Öffnen fortgesetzt
  assert.equal(findIssues({ ...base, days, log }).some(i => i.type === 'start-gap'), true);
});

test('Morgens: Lücke über 90 Minuten, Störungen und ungeprüftes Kommt', () => {
  const days = { '2026-11-03': { stamps: ['07:00', '16:00'] } };
  assert.equal(findIssues({ ...base, days, log: [{ taskId: 9, art: 'auftrag', autoStart: true, start: iso(3, 9, 0), stop: iso(3, 12, 0) }] }).some(i => i.type === 'start-gap'), false);
  assert.equal(findIssues({ ...base, days, log: [{ taskId: 9, art: 'stoerung', autoStart: true, start: iso(3, 7, 10), stop: iso(3, 8, 0) }] }).some(i => i.type === 'start-gap'), false);
  const unchecked = { '2026-11-03': { stamps: ['07:00', '16:00'], autoIdx: [0] } };
  const gap = findIssues({ ...base, days: unchecked, log: [{ taskId: 9, art: 'auftrag', autoStart: true, start: iso(3, 7, 8), stop: iso(3, 12, 0) }] }).find(i => i.type === 'start-gap');
  assert.equal(gap.fix, null); assert.equal(gap.unchecked, true);
});

test('Morgens: laufender Auftrag von heute wird vorgezogen', () => {
  const days = { '2026-11-04': { stamps: ['07:00'] } };
  const tasks = [{ id: 5, orderNr: 'A-1', status: 'in Arbeit', autoStart: true, activeSince: iso(4, 7, 9) }];
  const gap = findIssues({ ...base, days, tasks }).find(i => i.type === 'start-gap');
  assert.equal(gap.fix.kind, 'extendTask'); assert.equal(gap.fix.taskId, 5);
});

test('Überlappung zweier Aufträge innerhalb der Anwesenheit wird gemeldet', () => {
  const days = { '2026-11-03': { stamps: ['07:00', '16:00'] } };
  const log = [{ taskId: 1, art: 'auftrag', orderNr: 'A', start: iso(3, 8, 0), stop: iso(3, 11, 0) }, { taskId: 2, art: 'auftrag', orderNr: 'B', start: iso(3, 10, 30), stop: iso(3, 12, 0) }];
  const o = findIssues({ ...base, days, log }).filter(i => i.type === 'overlap');
  assert.equal(o.length, 1); assert.match(o[0].text, /30 min/);
  log[1].start = iso(3, 11, 0);
  assert.equal(findIssues({ ...base, days, log }).some(i => i.type === 'overlap'), false);
});

test('Geschätzte Tage aus der Auswertung werden gemeldet', () => {
  const evaluation = { byDay: { '2026-11-03': { estimated: true, total: 300 }, '2026-11-02': { estimated: false, total: 400 } } };
  const e = findIssues({ ...base, days: { '2026-11-03': { stamps: ['07:00', '16:00'] } }, evaluation }).filter(i => i.type === 'estimate');
  assert.deepEqual(e.map(i => i.key), ['2026-11-03']);
});

const fillInfo = { breaks: k => [{ s: 9 * 60 + 15, e: 9 * 60 + 30 }, { s: 12 * 60 + 15, e: 12 * 60 + 45 }], net: () => 8 * 60 };

test('Tag ohne Auftragszeit: zuletzt benutzter Auftrag für die Anwesenheit ohne Pausen', () => {
  const days = { '2026-11-02': { stamps: ['07:00', '16:00'] }, '2026-11-03': { stamps: ['07:58', '17:00'] } };
  const tasks = [{ id: 5, orderNr: 'A-1', status: 'Pause' }];
  const log = [{ taskId: 5, art: 'auftrag', orderNr: 'A-1', start: iso(2, 8, 0), stop: iso(2, 16, 0) }];
  const r = findIssues({ ...base, days, tasks, log, fillInfo }).find(i => i.type === 'no-order-time');
  assert.ok(r); assert.equal(r.key, '2026-11-03'); assert.equal(r.fix.kind, 'fillDay'); assert.equal(r.fix.taskId, 5);
  const mins = r.fix.segments.reduce((n, s) => n + (new Date(s.stop) - new Date(s.start)) / 60000, 0);
  assert.equal(mins, 8 * 60);                                    // auf die Netto-IST-Zeit begrenzt
  assert.equal(r.fix.segments.length >= 3, true);                // um die Pausen geteilt
});

test('Tag ohne Auftragszeit: nicht bei vorhandener Auftragszeit, ohne offenen Auftrag oder vor der ersten Nutzung', () => {
  const days = { '2026-11-03': { stamps: ['07:58', '17:00'] } };
  const covered = [{ taskId: 5, art: 'auftrag', start: iso(3, 9, 0), stop: iso(3, 10, 0) }];
  assert.equal(findIssues({ ...base, days, tasks: [{ id: 5, status: 'Pause' }], log: covered, fillInfo }).some(i => i.type === 'no-order-time'), false);
  const done = findIssues({ ...base, days: { ...days, '2026-11-02': { stamps: ['07:00', '16:00'] } }, tasks: [{ id: 5, status: 'fertig' }], log: [{ taskId: 5, art: 'auftrag', start: iso(2, 8, 0), stop: iso(2, 16, 0) }], fillInfo }).find(i => i.type === 'no-order-time');
  assert.equal(done.fix, null);
  assert.equal(findIssues({ ...base, days, tasks: [], log: [], fillInfo }).some(i => i.type === 'no-order-time'), false);
});
