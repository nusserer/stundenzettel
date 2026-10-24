const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const key = 'stundenzettel-v3-sidebar-collapsed';
function sidebar(saved = new Map(), blocked = false) {
  const classes = new Set();
  const elements = {
    btnToggleRail: {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, callback) { this[name] = callback; }
    },
    railYearMenu: { hidden: true },
    railYearBtn: { setAttribute() {} }
  };
  const storage = {
    getItem(name) { if (blocked) throw new Error('Storage blocked'); return saved.get(name) ?? null; },
    setItem(name, value) { if (blocked) throw new Error('Storage blocked'); saved.set(name, value); }
  };
  const state = { days: { '2026-10-24': { stamps: ['07:00'] } } };
  const start = source.indexOf('/* SIDEBAR_TOGGLE_START */');
  const end = source.indexOf('/* SIDEBAR_TOGGLE_END */', start);
  assert.ok(start >= 0 && end > start, 'Klappbare Sidebar ist implementiert');
  vm.runInNewContext(source.slice(start, end), {
    document: {
      body: { classList: {
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      } },
      getElementById: id => elements[id]
    },
    localStorage: storage,
    state,
    markDirty() { throw new Error('Ein UI-Schalter darf keine Stundendaten speichern'); }
  });
  return { classes, elements, saved, state, button: elements.btnToggleRail };
}

test('Sidebar klappt per Schalter ein und merkt sich die Auswahl beim erneuten Öffnen', () => {
  const ui = sidebar();
  assert.equal(ui.classes.has('rail-collapsed'), false);
  assert.equal(ui.button.attributes['aria-expanded'], 'true');
  ui.button.click();
  assert.equal(ui.classes.has('rail-collapsed'), true);
  assert.equal(ui.button.attributes['aria-expanded'], 'false');
  assert.equal(ui.button.attributes['aria-label'], 'Seitenleiste ausklappen');
  assert.equal(ui.saved.get(key), 'true');
  assert.equal(sidebar(ui.saved).classes.has('rail-collapsed'), true);
});

test('Gesperrter Browserspeicher verhindert weder Start noch Ein- und Ausklappen', () => {
  const ui = sidebar(new Map(), true);
  assert.equal(ui.button.attributes['aria-expanded'], 'true');
  ui.button.click();
  assert.equal(ui.classes.has('rail-collapsed'), true);
  ui.button.click();
  assert.equal(ui.classes.has('rail-collapsed'), false);
  assert.equal(ui.button.attributes['aria-expanded'], 'true');
  assert.equal(JSON.stringify(ui.state), '{"days":{"2026-10-24":{"stamps":["07:00"]}}}');
});

test('Beim Klappen bleibt kein geöffnetes Jahrmenü über dem Inhalt stehen', () => {
  const ui = sidebar();
  ui.elements.railYearMenu.hidden = false;
  ui.button.click();
  assert.equal(ui.elements.railYearMenu.hidden, true);
  ui.button.click();
  assert.equal(ui.saved.get(key), 'false');
  assert.equal(sidebar(ui.saved).classes.has('rail-collapsed'), false);
});

test('Mini-Player-Beschriftung aktualisiert sich ohne das Symbol zu entfernen', () => {
  const label = { textContent: '' };
  const icon = {};
  const button = {
    children: [icon, label],
    attributes: {},
    querySelector(selector) { return selector === '.rail-label' ? this.children[1] : this.children[0]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    set textContent(value) { this.children = []; }
  };
  const start = source.indexOf('function updateMiniPlayerButtonLabel()');
  const end = source.indexOf('document.getElementById("btnMiniPlayer").addEventListener', start);
  const context = vm.createContext({ document: { getElementById: () => button }, pipWindow: null });
  vm.runInContext(source.slice(start, end), context);
  context.updateMiniPlayerButtonLabel();
  assert.equal(button.children[0], icon);
  assert.equal(label.textContent, '🗗 Mini-Player öffnen');
  context.pipWindow = {};
  context.updateMiniPlayerButtonLabel();
  assert.equal(button.children[0], icon);
  assert.equal(label.textContent, '🗗 Mini-Player im Vordergrund');
  assert.equal(button.attributes['aria-label'], 'Mini-Player im Vordergrund');
});
