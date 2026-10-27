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
function scheduler(time = '12:14:00') {
  const app = calculations('2026-10-26T' + time);
  app.alerts = [];
  app.writes = 0;
  Object.assign(app, {
    dataLoaded: true,
    currentView: 'heute',
    checkTenHourLimit() {},
    firePauseAlert(event) { app.alerts.push(event.id); },
    markDirty() { app.writes++; },
    renderCurrentView() {}, renderMiniPlayer() {}, toast() {},
    recentTasksList() { return app.run('state.tasks'); },
    setTimeout() {}
  });
  vm.runInContext(part('function logCloseActive(', '/* Störung beenden:'), app);
  vm.runInContext(part('function resumeLatestTaskOnOpen()', '/* ---------------- URLAUB'), app);
  vm.runInContext(part('function scheduledBreakState()', 'function initAutoScheduler()'), app);
  app.ensureTodayYear = () => true;
  app.ensureDay = key => app.run('state.days[' + JSON.stringify(key) + ']');
  app.renderHeute = () => {};
  app.run(`state.days['2026-10-26']={stamps:['07:00'],pause:'',dayPauses:[]};
    state.tasks=[{id:1,kind:'auftrag',orderNr:'Prüfauftrag',status:'in Arbeit',activeSince:new Date('2026-10-26T07:00:00').toISOString()}];`);
  app.tick = value => { app.setNow('2026-10-26T' + value); app.checkAutoStamps(); };
  return app;
}

test('Geplante Mittagspause unterbricht und setzt genau denselben Auftrag einmalig fort', () => {
  const app = scheduler();
  app.tick('12:14:00');
  assert.equal(app.run('state.tasks[0].status'), 'in Arbeit');
  app.tick('12:16:00');
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
  assert.equal(app.run("state.days['2026-10-26'].dayPauses.length"), 1);
  assert.equal(app.run('state.log[0].stop'), new Date('2026-10-26T12:15:00').toISOString());
  app.tick('12:20:00');
  assert.equal(app.run('state.log.length'), 1);
  app.tick('12:46:00');
  assert.equal(app.run('state.tasks[0].status'), 'in Arbeit');
  assert.equal(app.run('state.tasks[0].activeSince'), new Date('2026-10-26T12:45:00').toISOString());
  assert.equal(app.run("state.days['2026-10-26'].dayPauses[0].end"), new Date('2026-10-26T12:45:00').toISOString());
  app.tick('12:50:00');
  assert.equal(app.run('state.log.length'), 1);
  assert.equal(app.alerts.length, 1);
});

test('Automatische Pausen erhöhen weder den Regelabzug noch eine längere manuelle Tagespause', () => {
  const app = scheduler();
  app.run(`state.days['2026-10-26'].dayPauses=[{start:new Date('2026-10-26T09:00:00').toISOString(),end:new Date('2026-10-26T10:00:00').toISOString(),source:'manual'}];`);
  app.tick('12:16:00');
  app.tick('12:46:00');
  assert.equal(app.run("calcPauseMinutes(state.days['2026-10-26'],new Date('2026-10-26T12:46:00'),null,'12:46')"), 60);
  app.run("state.days['2026-10-26'].pause=0");
  assert.equal(app.run("calcPauseMinutes(state.days['2026-10-26'],new Date('2026-10-26T12:46:00'),null,'12:46')"), 0);
});

test('Erneutes Öffnen startet während der automatischen Pause keinen Auftrag', () => {
  const app = scheduler();
  app.run('state.settings.stempelnAktiv=true');
  app.tick('12:16:00');
  assert.equal(app.resumeLatestTaskOnOpen(), false);
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
  app.run('state=normalizeState(JSON.parse(JSON.stringify(state)))');
  app.tick('12:46:00');
  assert.equal(app.run('state.tasks[0].status'), 'in Arbeit');
});

test('In der Pause gewählter anderer Auftrag bleibt pausiert und startet erst zum Pausenende', () => {
  const app = scheduler();
  app.run("state.tasks.push({id:2,kind:'auftrag',orderNr:'Anderer',status:'warten',activeSince:null})");
  app.tick('12:16:00');
  app.setNow('2026-10-26T12:30:00');
  app.taskStart(2);
  assert.equal(app.run('state.tasks.find(t=>t.id===2).status'), 'Pause');
  assert.equal(app.run('state.tasks.find(t=>t.id===2).activeSince'), null);
  assert.equal(app.run('state.log.some(l=>l.taskId===2)'), false);
  assert.equal(app.run('state.tasks.find(t=>t.id===1).status'), 'warten');
  app.tick('12:46:00');
  assert.equal(app.run('state.tasks.find(t=>t.id===2).status'), 'in Arbeit');
  assert.equal(app.run('state.tasks.find(t=>t.id===2).activeSince'), new Date('2026-10-26T12:45:00').toISOString());
  assert.equal(app.run('state.tasks.find(t=>t.id===1).status'), 'warten');
  assert.equal(app.run('state.tasks.filter(t=>t.status==="in Arbeit").length'), 1);
});

test('Mehrfacher Wechsel in der Pause: der zuletzt gewählte Auftrag wird aktiviert', () => {
  const app = scheduler();
  app.run("state.tasks.push({id:2,kind:'auftrag',orderNr:'B',status:'warten',activeSince:null},{id:3,kind:'auftrag',orderNr:'C',status:'warten',activeSince:null})");
  app.tick('12:16:00');
  app.taskStart(2);
  app.taskStart(3);
  app.tick('12:46:00');
  assert.equal(app.run('state.tasks.find(t=>t.id===3).status'), 'in Arbeit');
  assert.equal(app.run('state.tasks.find(t=>t.id===2).status'), 'warten');
  assert.equal(app.run('state.tasks.find(t=>t.id===1).status'), 'warten');
});

test('Nach der Pause startet der neu gewählte Auftrag, auch wenn der ursprüngliche fertig ist', () => {
  const app = scheduler();
  app.run("state.tasks.push({id:2,kind:'auftrag',orderNr:'Anderer',status:'warten',activeSince:null})");
  app.tick('12:16:00');
  app.taskStart(2);
  app.taskFinish(1);
  app.tick('12:46:00');
  assert.equal(app.run('state.tasks.find(t=>t.id===1).status'), 'fertig');
  assert.equal(app.run('state.tasks.find(t=>t.id===2).status'), 'in Arbeit');
});

test('Manuelle laufende Pause wird weder verdoppelt noch automatisch beendet', () => {
  const app = scheduler();
  app.run("state.days['2026-10-26'].dayPauses=[{start:new Date('2026-10-26T12:10:00').toISOString(),end:'',source:'manual'}]");
  app.taskPause(1);
  app.tick('12:16:00');
  app.tick('12:46:00');
  assert.equal(app.run("state.days['2026-10-26'].dayPauses.length"), 1);
  assert.equal(app.run("state.days['2026-10-26'].dayPauses[0].end"), '');
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
});

test('Ohne Anwesenheit, ohne geöffnete Datei oder in gesperrtem Jahr gibt es keine automatische Stempelung', () => {
  for (const setup of ["state.days['2026-10-26'].stamps=[]", "state.days['2026-10-26'].stamps.push('12:00')", 'dataLoaded=false', 'state.settings.locked=true']) {
    const app = scheduler();
    app.run(setup);
    const before = app.run("JSON.stringify(state.days['2026-10-26'])");
    app.tick('12:16:00');
    assert.equal(app.run('state.log.length'), 0);
    assert.equal(app.run("state.days['2026-10-26'].dayPauses.length"), 0);
    assert.equal(app.alerts.length, 0);
    assert.equal(app.writes, 0);
    assert.equal(app.run("JSON.stringify(state.days['2026-10-26'])"), before);
  }
});

test('Ein alter Erinnerungsmarker blockiert die tatsächliche Pause nach dem Update nicht', () => {
  const app = scheduler();
  app.run("state.ui.scheduledBreaks={'2026-10-26:12:15:12:45:Mittag':{start:true,acknowledged:true}}");
  app.tick('12:16:00');
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
  assert.equal(app.run("state.days['2026-10-26'].dayPauses.length"), 1);
  assert.equal(app.alerts.length, 0);
});

test('Nach vollständig verpasstem Pausenfenster werden keine historischen Pausen erfunden', () => {
  const app = scheduler();
  const before = app.run("JSON.stringify(state.days['2026-10-26'])");
  app.tick('13:00:00');
  assert.equal(app.run("JSON.stringify(state.days['2026-10-26'])"), before);
  assert.equal(app.run('state.log.length'), 0);
});

test('Pausenende bleibt bei geänderter Konfiguration erhalten, Geht verhindert Fortsetzung', () => {
  const app = scheduler();
  app.tick('12:16:00');
  app.run("state.settings.rules.breaks.moDo=[];state.days['2026-10-26'].stamps.push('12:30')");
  app.tick('12:46:00');
  assert.equal(app.run('state.tasks[0].status'), 'Pause');
  assert.equal(app.run("state.days['2026-10-26'].dayPauses[0].end"), new Date('2026-10-26T12:30:00').toISOString());
});
