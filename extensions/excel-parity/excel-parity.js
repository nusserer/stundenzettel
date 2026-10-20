/*
 * Optionale Excel-Parität, ohne DOM, Speicherung oder UI-Abhängigkeiten.
 * Classic script: <script src="excel-parity.js"></script> -> window.ExcelParity
 * Node: const ExcelParity = require('./excel-parity.js')
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ExcelParity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EXCEL_FORMULAS = Object.freeze({
    monthlyClosingG40: 'IF(H39="",ROUND(G36+G38-G37-G39,2),IF(H40>0,IF(H40>30,G36+H40-30,G36-G39),G36+H40))',
    monthlySpecialH40: "G38-G37",
    workedS4: 'IF(B4="",0,IF(IF(E4<F4,F4-E4,IF(F4="",0,F4-E4+1))+IF(G4<H4,H4-G4,IF(H4="",0,H4-G4+1))>0,IF(E4<F4,F4-E4,IF(F4="",0,F4-E4+1))+IF(G4<H4,H4-G4,IF(H4="",0,H4-G4+1)),0))',
    pauseJ4: 'IF(S4=0,"",IF(I4<>"",I4,IF((S4-IF(OR(WEEKDAY(B4,2)=7,WEEKDAY(B4,2)=6,WEEKDAY(B4,2)=5,D4<>""),"00:30","00:45"))*24>=9,"00:45",IF(OR(WEEKDAY(B4,2)=7,WEEKDAY(B4,2)=6,WEEKDAY(B4,2)=5,D4<>""),"00:30","00:45"))))',
    actualM4: 'IF(S4*24=0,"",ROUND(S4*24-J4*24,2))',
    travelD2: "SUM(Jahresübersicht!B38:AW38)",
    travelD4: "D2*D3*2",
    travelD6: "D5*MONTH(TODAY())",
    travelD13: "(D4/100*D10*D11)+D9",
    travelD12: "D13/MONTH(TODAY())"
  });

  function roundExcel(value, decimals) {
    const multiplier = Math.pow(10, decimals || 0);
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
  }
  function assertFinite(value, name) {
    if (!Number.isFinite(value)) throw new TypeError(name + " muss eine endliche Zahl sein.");
  }
  function toDateKey(date) {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    if (date instanceof Date && !Number.isNaN(date.valueOf())) return date.toISOString().slice(0, 10);
    throw new TypeError("Datum muss YYYY-MM-DD oder ein gültiges Date sein.");
  }
  function dateUTC(year, month, day) { return new Date(Date.UTC(year, month - 1, day)); }
  function keyUTC(date) { return date.toISOString().slice(0, 10); }
  function addDays(date, days) { const x = new Date(date.valueOf()); x.setUTCDate(x.getUTCDate() + days); return x; }
  function easterSunday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return dateUTC(year, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
  }
  function entry(date, name, factor, regions, source) {
    return { date: keyUTC(date), name: name, factor: factor, regions: regions || null, source: source || "Arbeitsmappe" };
  }
  const ALL = "ALL";
  const REGIONS = Object.freeze({
    BW: "Baden-Württemberg", BY: "Bayern", HE: "Hessen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SL: "Saarland", ST: "Sachsen-Anhalt"
  });
  function workbookHolidays(year, options) {
    const region = (options && options.region) || null;
    const easter = easterSunday(year);
    const list = [
      entry(dateUTC(year, 1, 1), "Neujahr", 0, [ALL]),
      entry(dateUTC(year, 1, 6), "Heilige Drei Könige", 0, ["BW", "BY", "ST"]),
      entry(addDays(easter, -49), "Fasching", 1, [ALL]),
      entry(addDays(easter, -2), "Karfreitag", 0, [ALL]),
      entry(easter, "Ostersonntag", 0, [ALL]),
      entry(addDays(easter, 1), "Ostermontag", 0, [ALL]),
      entry(dateUTC(year, 5, 1), "Maifeiertag", 0, [ALL]),
      entry(addDays(easter, 39), "Christi Himmelfahrt", 0, [ALL]),
      entry(addDays(easter, 49), "Pfingstsonntag", 0, [ALL]),
      entry(addDays(easter, 50), "Pfingstmontag", 0, [ALL]),
      entry(addDays(easter, 60), "Fronleichnam", 0, ["BW", "BY", "HE", "NW", "RP", "SL"]),
      entry(dateUTC(year, 8, 15), "Mariä Himmelfahrt", 0, ["SL"]),
      entry(dateUTC(year, 10, 3), "Tag der dt. Einheit", 0, [ALL]),
      entry(dateUTC(year, 11, 1), "Allerheiligen", 0, ["BW", "BY", "NW", "RP", "SL"]),
      entry(dateUTC(year, 12, 24), "Heiliger Abend", 0.5, [ALL]),
      entry(dateUTC(year, 12, 25), "1.Weihnachtsfeiertag", 0, [ALL]),
      entry(dateUTC(year, 12, 26), "2.Weihnachtsfeiertag", 0, [ALL]),
      entry(dateUTC(year, 12, 31), "Silvester", 0.5, [ALL])
    ];
    // Without a region, the UI promises only holidays shared nationwide.
    // A selected region receives that common base plus its regional entries.
    const selected = list.filter(function (item) { return region ? item.regions.indexOf(ALL) !== -1 || item.regions.indexOf(region) !== -1 : item.regions.indexOf(ALL) !== -1; });
    const custom = (options && options.custom) || [];
    custom.forEach(function (item) {
      if (!item || !item.name || !Number.isFinite(item.factor)) throw new TypeError("Eigene Feiertage benötigen Datum, Bezeichnung und Faktor.");
      selected.push({ date: toDateKey(item.date), name: item.name, factor: item.factor, regions: null, source: "Eigene Einstellung" });
    });
    return selected.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  function dateFactor(date, options) {
    const dateKey = toDateKey(date);
    const year = Number(dateKey.slice(0, 4));
    const matches = workbookHolidays(year, options).filter(function (item) { return item.date === dateKey; });
    if (!matches.length) return { factor: 1, entries: [] };
    // Excel VLOOKUP uses the first matching table row. Custom duplicates are intentionally exposed.
    return { factor: matches[0].factor, entries: matches, ambiguous: matches.length > 1 };
  }
  function pairMinutes(start, end) {
    if (start == null || end == null) return 0;
    assertFinite(start, "Start"); assertFinite(end, "Ende");
    return end > start ? end - start : end - start + 1440;
  }
  function calculateDailyTarget(input) {
    input = input || {};
    assertFinite(input.weekdayTargetHours, "Wochensoll");
    if (input.code === "GLZ") {
      assertFinite(input.glzTargetHours, "GLZ-Tagessoll");
      return input.glzTargetHours;
    }
    // Excel N4 checks M4 before ordinary absence-code handling: without IST, N4 stays blank.
    if (!input.hasTimes) return null;
    if (input.holidayFactor != null) { assertFinite(input.holidayFactor, "Feiertagsfaktor"); return roundExcel(input.holidayFactor * input.weekdayTargetHours, 2); }
    if (input.codeFactor != null) { assertFinite(input.codeFactor, "Codefaktor"); return roundExcel(input.codeFactor * input.weekdayTargetHours, 2); }
    return input.weekdayTargetHours;
  }
  function calculateWorkingTime(input) {
    input = input || {};
    if (input.present === false) return { rawMinutes: 0, pauseMinutes: 0, actualHours: null, formula: EXCEL_FORMULAS.workedS4 };
    const first = pairMinutes(input.start1, input.end1);
    const second = pairMinutes(input.start2, input.end2);
    const rawMinutes = first + second;
    if (rawMinutes <= 0) return { rawMinutes: 0, pauseMinutes: 0, actualHours: null, formula: EXCEL_FORMULAS.workedS4 };
    let pauseMinutes;
    if (input.manualPauseMinutes != null) { assertFinite(input.manualPauseMinutes, "Manuelle Pause"); pauseMinutes = input.manualPauseMinutes; }
    else {
      const weekday = input.weekday; // Excel WEEKDAY(...,2): Mo=1...So=7
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new TypeError("Wochentag muss 1 (Mo) bis 7 (So) sein.");
      const base = (weekday >= 5 || input.isHoliday) ? 30 : 45;
      pauseMinutes = rawMinutes - base >= 540 ? 45 : base;
    }
    return { rawMinutes: rawMinutes, pauseMinutes: pauseMinutes, actualHours: roundExcel((rawMinutes - pauseMinutes) / 60, 2), formula: EXCEL_FORMULAS.actualM4 };
  }
  function monthlyClosingBalance(input) {
    input = input || {};
    ["carryOver", "actual", "target", "payout"].forEach(function (key) { assertFinite(input[key], key); });
    if (input.special == null || input.special === "") return roundExcel(input.carryOver + input.actual - input.target - input.payout, 2);
    // Excel checks H39, but uses H40 (=G38-G37) in both paths. H39's business meaning is not inferable from the formula.
    const h40 = input.actual - input.target;
    return h40 > 0 ? (h40 > 30 ? input.carryOver + h40 - 30 : input.carryOver - input.payout) : input.carryOver + h40;
  }
  function calculateWorktimeCalculator(input) {
    input = input || {};
    ["arrivalMinutes", "regularTargetHours", "tenHourTargetHours", "breakMoThuMinutes", "breakFridayMinutes"].forEach(function (key) { assertFinite(input[key], key); });
    const isFriday = Boolean(input.isFriday);
    const pause = isFriday ? input.breakFridayMinutes : input.breakMoThuMinutes;
    const result = {
      regularEndMinutes: input.arrivalMinutes + input.regularTargetHours * 60 + pause,
      tenHourEndMinutes: input.arrivalMinutes + input.tenHourTargetHours * 60 + pause,
      formula: isFriday ? "A12/C12" : "A7/C7"
    };
    if (input.departureMinutes != null) {
      assertFinite(input.departureMinutes, "departureMinutes");
      const actualHours = (pairMinutes(input.arrivalMinutes, input.departureMinutes) - pause) / 60;
      result.actualHours = actualHours;
      result.deviationHours = actualHours - input.regularTargetHours;
    }
    return result;
  }
  function calculateTravelCosts(input) {
    input = input || {};
    ["travelDays", "oneWayKilometres", "ratePerKilometre", "month", "fixedCost", "percent", "multiplier"].forEach(function (key) { assertFinite(input[key], key); });
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) throw new RangeError("Monat muss 1 bis 12 sein.");
    const d2 = input.travelDays, d3 = input.oneWayKilometres, d4 = d2 * d3 * 2;
    const d5 = input.ratePerKilometre * input.oneWayKilometres;
    const d6 = d5 * input.month;
    const d13 = (d4 / 100 * input.percent * input.multiplier) + input.fixedCost;
    return { annualTravelDays: d2, annualKilometres: d4, monthlyRateBase: d5, projectedMonthlyAmount: d6, totalAmount: d13, monthlyAmount: d13 / input.month, formulas: EXCEL_FORMULAS };
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function createSnapshot(state, metadata) {
    metadata = metadata || {};
    if (!metadata.id || !metadata.createdAt) throw new TypeError("Snapshot benötigt id und createdAt für einen nachvollziehbaren Stand.");
    return { id: String(metadata.id), createdAt: String(metadata.createdAt), label: metadata.label || "Stand", data: clone(state) };
  }
  function restoreSnapshot(snapshot) {
    if (!snapshot || !snapshot.data || !snapshot.id || !snapshot.createdAt) throw new TypeError("Ungültiger Snapshot.");
    return clone(snapshot.data);
  }
  function latestSnapshot(snapshots) {
    return (snapshots || []).slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })[0] || null;
  }
  return Object.freeze({ EXCEL_FORMULAS: EXCEL_FORMULAS, REGIONS: REGIONS, workbookHolidays: workbookHolidays, dateFactor: dateFactor, calculateDailyTarget: calculateDailyTarget, calculateWorkingTime: calculateWorkingTime, monthlyClosingBalance: monthlyClosingBalance, calculateWorktimeCalculator: calculateWorktimeCalculator, calculateTravelCosts: calculateTravelCosts, createSnapshot: createSnapshot, restoreSnapshot: restoreSnapshot, latestSnapshot: latestSnapshot });
});
