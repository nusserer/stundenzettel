const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { calculations } = require('./helpers/calculations');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
function part(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'App-Abschnitt vorhanden: ' + from);
  return source.slice(start, end);
}
function feierabendApp(stamps = ['07:00'], time = '17:00:00') {
  const app = calculations('2026-10-26T' + time);
  Object.assign(app, {
    closed: 0, saves: 0, saveResult: true, toasts: [], fileWriteTimer: null,
    ensureTodayYear: () => true,
    ensureDay: key => app.run('state.days[' + JSON.stringify(key) + ']'),
    renderHeute() {}, renderMiniPlayer() {},
    toast(message, kind) { app.toasts.push({ message, kind }); },
    writeToFile: async () => { app.saves++; return app.saveResult; },
    setTimeout() {},
    close() { app.closed++; }
  });
  vm.runInContext(part('function logCloseActive(', '/* Störung beenden:'), app);
  vm.runInContext(part('function activeTaskPause()', 'function activeTaskResume()'), app);
  vm.runInContext(part('function scheduledBreakState()', 'function finishScheduledPause('), app);
  vm.runInContext(part('function markAutoStamp(', 'function doFeierabend()'), app);
  app.run('state.settings.stempelOffsetGehenMin=0');
  app.run(`state.days['2026-10-26']={stamps:${JSON.stringify(stamps)},pause:'',dayPauses:[],autoIdx:[]};
    state.tasks=[{id:1,kind:'auftrag',orderNr:'Prüfauftrag',status:'in Arbeit',activeSince:new Date('2026-10-26T07:00:00').toISOString()}];`);
  return app;
}
const day = app => JSON.parse(app.run("JSON.stringify(state.days['2026-10-26'])"));

test('Feierabend trägt Geht ein und markiert es rot zum Prüfen', async () => {
  const app = feierabendApp();
  await app.doGehen(true);
  assert.deepEqual(day(app).stamps, ['07:00', '17:00']);
  assert.deepEqual(day(app).autoIdx, [1]);
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
  assert.equal(app.saves, 1);
  assert.equal(app.closed, 1);
});

test('Normales Zwischen-Geht bleibt unmarkiert', async () => {
  const app = feierabendApp();
  await app.doGehen(false);
  assert.deepEqual(day(app).stamps, ['07:00', '17:00']);
  assert.deepEqual(day(app).autoIdx, []);
  assert.equal(app.closed, 0);
});

test('Erneutes Feierabend nach Wiederöffnen speichert und schließt ohne neues Geht', async () => {
  const app = feierabendApp(['07:00', '17:00']);
  app.run("state.days['2026-10-26'].autoIdx=[1]");
  app.setNow('2026-10-26T17:20:00');
  await app.doGehen(true);
  assert.deepEqual(day(app).stamps, ['07:00', '17:00']);
  assert.deepEqual(day(app).autoIdx, [1]);
  assert.equal(app.saves, 1);
  assert.equal(app.closed, 1);
  assert.equal(app.toasts.some(t => t.kind === 'warn'), false);
});

test('Beim erneuten Feierabend wird ein beim Öffnen gestarteter Auftrag beendet', async () => {
  const app = feierabendApp(['07:00', '17:00']);
  await app.doGehen(true);
  app.run("state.tasks[0].status='in Arbeit';state.tasks[0].activeSince=new Date('2026-10-26T17:05:00').toISOString()");
  app.setNow('2026-10-26T17:20:00');
  await app.doGehen(true);
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
  assert.equal(app.run('state.log.at(-1).stop'), new Date('2026-10-26T17:20:00').toISOString());
  assert.equal(app.closed, 2);
});

test('Schlägt das Speichern beim erneuten Feierabend fehl, wird nicht geschlossen', async () => {
  const app = feierabendApp(['07:00', '17:00']);
  app.saveResult = false;
  await app.doGehen(true);
  assert.equal(app.closed, 0);
  assert.equal(app.toasts.at(-1).kind, 'warn');
});

test('Feierabend ohne jede Stempelung schließt nicht und verlangt Kommt', async () => {
  const app = feierabendApp([]);
  await app.doGehen(true);
  assert.deepEqual(day(app).stamps, []);
  assert.equal(app.closed, 0);
  assert.equal(app.saves, 0);
  assert.equal(app.toasts.at(-1).kind, 'warn');
});
