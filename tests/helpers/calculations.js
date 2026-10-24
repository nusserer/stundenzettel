const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../app/app.js'), 'utf8');
const between = (from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error('Rechentest: Quellabschnitt fehlt: ' + from);
  return source.slice(start, end);
};
function calculations(iso = '2026-10-22T10:00:00') {
  let instant = iso;
  const RealDate = Date;
  class ClockDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return new RealDate(instant).getTime(); }
  }
  const context = vm.createContext({
    Date: ClockDate,
    ExcelParity: require('../../extensions/excel-parity/excel-parity.js'),
    StundenzettelTimeCore: require('../../app/time-core.js'),
    StundenzettelDayPause: require('../../app/day-pause.js'),
    markDirty: () => {},
    console
  });
  context.window = context;
  const code = between('const WEEKDAY_KEYS', 'function toast(')
    + between('function easterSunday(', 'let state = null;')
    + '\nlet state = null;\n'
    + between('function isHolidayOn(', '/* ---------------- Rendering: nav')
    + between('function trimTrailingEmptyStamps(', 'function renderStempelList(')
    + between('function monthBalanceSeries(', 'function drawMonthChart(')
    + between('function buildArchiveViewState(', 'function renderSettingsYearSwitcher(')
    + between('function shiftLimitTime(', 'function checkTenHourLimit(');
  vm.runInContext(code, context);
  context.run = expression => vm.runInContext(expression, context);
  context.setNow = value => { instant = value; };
  context.run('state=normalizeState(freshYearState(2026));');
  return context;
}
module.exports = { calculations };
