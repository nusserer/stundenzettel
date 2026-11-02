const test = require('node:test');
const assert = require('node:assert/strict');
const { calculations } = require('./helpers/calculations');

// 2026-10-26 = Montag, 2026-10-30 = Freitag, 2026-10-31 = Samstag, 2026-10-03 = Feiertag (Samstag)
function pauseFor(date, stamps, extra = {}, setup = '') {
  const app = calculations(date + 'T20:00:00');
  if (setup) app.run(setup);
  app.run(`state.days['${date}']=Object.assign({stamps:${JSON.stringify(stamps)},pause:''},${JSON.stringify(extra)})`);
  return app.run(`calcPauseMinutes(state.days['${date}'],keyToDate('${date}'),isHolidayOn('${date}'),null)`);
}

test('Nur Pausen, in denen man anwesend war, werden abgezogen', () => {
  assert.equal(pauseFor('2026-10-26', ['07:00', '11:00']), 15);        // nur Brotzeit
  assert.equal(pauseFor('2026-10-26', ['13:00', '17:00']), 0);         // nach beiden Pausen
  assert.equal(pauseFor('2026-10-26', ['07:00', '09:20']), 5);         // Brotzeit anteilig
});

test('Teilweise Überschneidung zählt anteilig', () => {
  assert.equal(pauseFor('2026-10-26', ['07:00', '12:30']), 30);        // 15 + 15 Min. des Mittags
  assert.equal(pauseFor('2026-10-26', ['09:20', '12:20']), 15);        // 10 + 5 Min.
});

test('Lücken zwischen Stempelpaaren (Abwesenheit) werden nicht abgezogen', () => {
  // Mittag 12:15–12:45 liegt in der Lücke; Brotzeit 15 Min.; Netto >= 6 h -> gesetzliche Mindestpause 30
  assert.equal(pauseFor('2026-10-26', ['07:00', '12:00', '13:00', '17:00']), 30);
  // Kürzerer Tag mit Lücke: nur die Brotzeit, Netto unter 6 h
  assert.equal(pauseFor('2026-10-26', ['07:00', '11:00', '13:00', '14:00']), 15);
});

test('Vollständiger Tag: Summe der Pausen, gesetzliche Mindestpause bleibt Untergrenze', () => {
  assert.equal(pauseFor('2026-10-26', ['07:00', '16:00']), 45);
  assert.equal(pauseFor('2026-10-26', ['07:00', '17:30']), 45);        // Netto >= 9 h: mindestens 45
  assert.equal(pauseFor('2026-10-26', ['10:00', '16:30']), 30);        // nur Mittag 30, Netto 6 h
});

test('Eigene Pause überschreibt immer, auch 0', () => {
  assert.equal(pauseFor('2026-10-26', ['07:00', '16:00'], { pause: 0 }), 0);
  assert.equal(pauseFor('2026-10-26', ['07:00', '16:00'], { pause: 20 }), 20);
});

test('Neue Dateien haben freitags 30 Min. Pause, nicht 60', () => {
  assert.equal(pauseFor('2026-10-30', ['07:00', '15:30']), 30);
  const app = calculations('2026-10-30T12:00:00');
  assert.equal(app.run('rulesOf().breaks.fr.reduce((s,b)=>s+timeToMin(b.end)-timeToMin(b.start),0)'), 30);
});

test('Samstag/Sonntag und Feiertag: Pauschale in Minuten', () => {
  assert.equal(pauseFor('2026-10-31', ['08:00', '14:00']), 30);
  assert.equal(pauseFor('2026-10-03', ['08:00', '14:00']), 30);
  assert.equal(pauseFor('2026-10-31', ['08:00', '08:20']), 20);   // Pauschale wird durch die Anwesenheit begrenzt
  assert.equal(pauseFor('2026-10-31', ['08:00', '14:00'], {}, "rulesOf().pause.sa=20"), 20);
  assert.equal(pauseFor('2026-10-03', ['08:00', '14:00'], {}, "rulesOf().pause.holiday=15"), 15);
});

test('Ohne Pausenzeiten gilt die Pauschale des Tagestyps', () => {
  assert.equal(pauseFor('2026-10-26', ['07:00', '12:00'], {}, 'rulesOf().breaks.moDo=[]'), 45);
  assert.equal(pauseFor('2026-10-26', ['07:00', '12:00'], {}, 'rulesOf().breaks.moDo=[];rulesOf().pause.moDo=20'), 20);
  assert.equal(pauseFor('2026-10-26', ['07:00', '15:00'], {}, 'rulesOf().breaks.moDo=[];rulesOf().pause.moDo=20'), 30); // gesetzliche Mindestpause
});

test('Sich überlappende Pausen zählen nicht doppelt', () => {
  const setup = "rulesOf().breaks.moDo=[{start:'12:00',end:'12:45',label:'A'},{start:'12:30',end:'13:00',label:'B'}]";
  assert.equal(pauseFor('2026-10-26', ['07:00', '15:00'], {}, setup), 60);
});

test('Ungültige Pausenzeiten (Ende vor Beginn) werden ignoriert', () => {
  const setup = "rulesOf().breaks.moDo=[{start:'12:45',end:'12:15',label:'X'},{start:'09:15',end:'09:30',label:'B'}]";
  assert.equal(pauseFor('2026-10-26', ['07:00', '11:00'], {}, setup), 15);
});

test('Geht-Empfehlung findet die frühste Zeit, bei der die Netto-Zeit erreicht ist, auch mitten in einer Pause', () => {
  const app = calculations('2026-10-26T08:00:00');
  app.run("state.days['2026-10-26']={stamps:['07:00'],pause:''};state.settings.rules.latestEnd='18:30'");
  // 5 h 15 Min. netto ab 07:00: bis 12:15 sind erst 5 h 00 netto (Brotzeit 15), Mittag ist neutral -> 13:00
  assert.equal(app.run('gehtForNetHours(5.25)'), '13:00');
  assert.equal(app.run('gehtForNetHours(1)'), '08:00');
});

test('Pausenherkunft wird erklärt', () => {
  const app = calculations('2026-10-26T20:00:00');
  app.run("state.days['2026-10-26']={stamps:['07:00','12:30'],pause:''}");
  const text = app.run("pauseExplanation(state.days['2026-10-26'],keyToDate('2026-10-26'),false,null)");
  assert.match(text, /Brotzeit 15/);
  assert.match(text, /Mittag 15/);
  assert.match(text, /= 30 Min/);
  app.run("state.days['2026-10-26'].pause=0");
  assert.match(app.run("pauseExplanation(state.days['2026-10-26'],keyToDate('2026-10-26'),false,null)"), /Eigene Eingabe/);
});
