
/* =========================================================================
   STUNDENZETTEL – Offline-Zeiterfassung
   Einzelne HTML-Datei, läuft ohne Installation im Browser.
   ========================================================================= */

const WEEKDAY_KEYS = ["mo","di","mi","do","fr","sa","so"]; // Mon..Sun
const WEEKDAY_LABELS = {mo:"Montag",di:"Dienstag",mi:"Mittwoch",do:"Donnerstag",fr:"Freitag",sa:"Samstag",so:"Sonntag"};
const MONTH_NAMES = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

/* ---------------- Utilities ---------------- */
function pad2(n){return String(n).padStart(2,"0");}
function dateKey(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
function keyToDate(k){ const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); }
function fmtDateDE(k){ const d=keyToDate(k); return pad2(d.getDate())+"."+pad2(d.getMonth()+1)+"."+d.getFullYear(); }
function jsWeekdayKey(d){ const idx = (d.getDay()+6)%7; return WEEKDAY_KEYS[idx]; } // Mon=0..Sun=6
function isoWeekNumber(dateObj){
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mo=0..So=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Donnerstag dieser Woche
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7*24*3600*1000));
}
function isFriSatSun(d){ const k=jsWeekdayKey(d); return k==="fr"||k==="sa"||k==="so"; }
function timeToMin(t){ if(!t) return null; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minToTime(m){ if(m==null) return ""; m=Math.round(m); const h=Math.floor(m/60), mm=m%60; return pad2(h)+":"+pad2(mm); }
function hoursToHM(h){
  if(h==null || isNaN(h)) return "–";
  const sign = h<0 ? "-" : "";
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs-hh)*60);
  return sign+hh+":"+pad2(mm);
}
function round2(x){ return Math.round(x*100)/100; }
function todayKey(){ return dateKey(new Date()); }
function nowTimeStr(){ const d=new Date(); return pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function addMinutesToTimeStr(t, mins){ const m=timeToMin(t)+mins; return minToTime(((m%1440)+1440)%1440); }
function localDateKeyFromIso(iso){ return dateKey(new Date(iso)); }
function localTimeFromIso(iso){ const d=new Date(iso); return pad2(d.getHours())+":"+pad2(d.getMinutes())+":"+pad2(d.getSeconds()); }
function localDateTimeInputFromIso(iso){ const d=new Date(iso); return dateKey(d)+"T"+localTimeFromIso(iso); }

/* TASK_MANAGEMENT_HELPERS_START */
(function(){
  function durationMinutes(entry){
    const start = new Date(entry.start).getTime(), stop = new Date(entry.stop).getTime();
    return Number.isFinite(start) && Number.isFinite(stop) ? Math.max(0, Math.round((stop-start)/60000)) : 0;
  }
  function totalTaskMinutes(task, log){
    return Math.max(0, log.filter(entry=>entry.taskId===task.id).reduce((sum,entry)=>sum+durationMinutes(entry), 0) + (Number(task.manualDurationOffsetMinutes)||0));
  }
  function pauseEntries(state){
    return Object.entries(state.days||{}).flatMap(([date, day])=>(day.dayPauses||[]).map((pause,index)=>({
      id:`pause:${date}:${index}`, kind:"pause", date, pauseIndex:index, orderNr:"Pause", modul:"", station:"", aenderung:pause.source||"manuell", start:pause.start, stop:pause.end || ""
    }))).filter(entry=>entry.start && entry.stop);
  }
  function allLogEntries(state){
    return (state.log||[]).map((entry,index)=>Object.assign({id:`log:${index}`,kind:"task"},entry)).concat(pauseEntries(state));
  }
  function visibleLogEntries(state, options){
    const opt=Object.assign({search:"",type:"all",sort:{col:"start",dir:1}}, options||{});
    const term=opt.search.trim().toLowerCase();
    const entries=allLogEntries(state).filter(entry=>{
      if(opt.type==="tasks" && entry.kind!=="task") return false;
      if(opt.type==="pauses" && entry.kind!=="pause") return false;
      if(opt.type==="stoerungen" && !(entry.kind==="task" && entry.art==="stoerung")) return false;
      if(opt.type==="auftraege" && !(entry.kind==="task" && entry.art!=="stoerung")) return false;
      return !term || [entry.orderNr,entry.modul,entry.station,entry.aenderung,entry.kind].join(" ").toLowerCase().includes(term);
    });
    return entries.sort((a,b)=>{
      const av=opt.sort.col==="dauer" ? durationMinutes(a) : (a[opt.sort.col]||"").toString().toLowerCase();
      const bv=opt.sort.col==="dauer" ? durationMinutes(b) : (b[opt.sort.col]||"").toString().toLowerCase();
      if(av<bv) return -1*opt.sort.dir;
      if(av>bv) return 1*opt.sort.dir;
      return a.id.localeCompare(b.id);
    });
  }
  function formatLogTime(iso){ const d=new Date(iso); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")+":"+String(d.getSeconds()).padStart(2,"0"); }
  function applyLogEdit(record, field, value){
    const next=Object.assign({},record,{[field]:value});
    if((field==="start"||field==="stop") && (!next.start || !next.stop || new Date(next.stop)<new Date(next.start))) return false;
    record[field]=value; return true;
  }
  const api={durationMinutes,totalTaskMinutes,pauseEntries,allLogEntries,visibleLogEntries,formatLogTime,applyLogEdit};
  if(typeof module!=="undefined") module.exports=api;
  if(typeof globalThis!=="undefined") globalThis.StundenzettelTaskManagement=api;
})();
/* TASK_MANAGEMENT_HELPERS_END */

function toast(msg, kind){
  const el=document.createElement("div");
  el.className="toastmsg";
  if(kind==="warn") el.style.borderLeftColor="var(--rust)";
  el.textContent=msg;
  document.getElementById("toast").appendChild(el);
  setTimeout(()=>{ el.style.transition="opacity .4s"; el.style.opacity="0"; setTimeout(()=>el.remove(),400); }, 5200);
}

/* ---------------- Easter / German holidays ---------------- */
function easterSunday(year){
  // Gaussian Easter algorithm
  const a=year%19, b=Math.floor(year/100), c=year%100;
  const d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(year, month-1, day);
}
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function computeHolidays(year){
  const easter = easterSunday(year);
  const mk=(d,label,factor)=>({date:dateKey(d), label, factor});
  return [
    mk(new Date(year,0,1), "Neujahr", 0),
    mk(new Date(year,4,1), "Maifeiertag", 0),
    mk(addDays(easter,-2), "Karfreitag", 0),
    mk(addDays(easter,1), "Ostermontag", 0),
    mk(addDays(easter,39), "Christi Himmelfahrt", 0),
    mk(addDays(easter,50), "Pfingstmontag", 0),
    mk(new Date(year,9,3), "Tag der Deutschen Einheit", 0),
    mk(new Date(year,11,24), "Heiliger Abend", 0.5),
    mk(new Date(year,11,25), "1. Weihnachtsfeiertag", 0),
    mk(new Date(year,11,26), "2. Weihnachtsfeiertag", 0),
    mk(new Date(year,11,31), "Silvester", 0.5),
  ].sort((a,b)=>a.date.localeCompare(b.date));
}

/* ---------------- Default state ---------------- */
/* Pausen- und Kernzeitregeln je Tagesgruppe: moDo = Mo–Do, fr = Freitag, sa = Samstag/Sonntag. Pro Person einstellbar. */
function defaultRules(){
  return {
    pause: {moDo:45, fr:30, sa:30, holiday:30},       // Minuten, wenn nicht anders eingetragen
    longThresholdHours: 9, longPauseMin: 45,           // ab dieser Netto-Anwesenheit gilt die lange Pause
    latestEnd: "18:30",                                // spätestes Arbeitsende (für 9h/10h-Grenzen)
    kernzeit: {moDo:"14:15", fr:"14:15", sa:"14:15"},  // Geht-Empfehlung „zur Kernzeit“
    breaks: {                                          // feste Pausen für Erinnerung/Auto-Pause
      moDo:[{start:"09:15", end:"09:30", label:"Brotzeit"},{start:"12:15", end:"12:45", label:"Mittag"}],
      fr:[{start:"09:45", end:"10:15", label:"BrotzeitFr"},{start:"12:15", end:"12:45", label:"Mittag"}],
      sa:[]
    }
  };
}
function mergeRules(r, legacyKern){
  const d=defaultRules(), x=r||{};
  const out=Object.assign({}, d, x);
  out.pause=Object.assign({}, d.pause, x.pause||{});
  out.kernzeit=Object.assign({}, d.kernzeit, legacyKern&&!x.kernzeit?{moDo:legacyKern,fr:legacyKern,sa:legacyKern}:{}, x.kernzeit||{});
  out.breaks=Object.assign({}, d.breaks, x.breaks||{});
  return out;
}
function dayGroup(dateObj){ const k=jsWeekdayKey(dateObj); return k==="fr"?"fr":(k==="sa"||k==="so")?"sa":"moDo"; }
function rulesOf(){ return state.settings.rules || (state.settings.rules=defaultRules()); }
function defaultSettings(year){
  return {
    year: year,
    name: "",
    personalNr: "",
    locked: false,
    stempelnAktiv: false,
    stempelOffsetKommenMin: 3,
    stempelOffsetGehenMin: 2,
    miniPlayerAutoOpen: true,
    weekly: {mo:7.6, di:7.6, mi:7.6, do:7.6, fr:7.6, sa:0, so:0},
    absenceCodes: [
      {code:"F", label:"Feiertag", factor:0, color:"#FFC000"},
      {code:"K", label:"Krank", factor:0, color:"#FFFF00"},
      {code:"U", label:"Urlaub", factor:0, color:"#8DB4E2"},
      {code:"UH", label:"Urlaub ½ Tag", factor:0.5, color:"#00B0F0"},
      {code:"GLZ", label:"Gleitzeitausgleich", factor:0, color:"#92D050"},
      {code:"VU", label:"Vorab-Urlaub", factor:0, color:"#8DB4E2"},
      {code:"KA", label:"Kurzarbeit", factor:0, color:"#FF7C80"},
      {code:"T", label:"T-Zug", factor:0, color:"#0070C0"},
    ],
    vacation: { entitlement: 30, carryOver: 0, plannedNextYear: 0 },
    glz: { carryOverHours: 0, bufferHours: 40, dayHours: 7.6 },
    travel: { distanceKm: 0, pricePerKm: 0.30, fixedPerYear: 0, consumptionPer100: 7, pricePerLiter: 1.7 },
    rules: defaultRules(),
    gehtEmpfehlung: {
      freeGoalMoDo: 8, freeGoalFr: 6, kernzeit: "14:15",
      friAdjustWeek: 2, friAdjustWZ: 2, activeCode: "WZF"
    },
  };
}
function ensureMonthAdjust(monthNumber){
  if(!state.monthAdjust[monthNumber]) state.monthAdjust[monthNumber] = {payout:0, wochenziel:0, monatsziel:0, kaTarget:null};
  if(state.monthAdjust[monthNumber].kaTarget === undefined) state.monthAdjust[monthNumber].kaTarget = null;
  return state.monthAdjust[monthNumber];
}
function freshYearState(year, prevState){
  const holidays = computeHolidays(year);
  const settings = prevState ? JSON.parse(JSON.stringify(prevState.settings)) : defaultSettings(year);
  settings.year = year;
  return {
    version: 1,
    settings,
    holidays,
    days: {},          // key: "YYYY-MM-DD" -> {stamps:[HH:MM,...], pause, code, bemerkung}
    tasks: [],          // Auftragszeiten
    log: [],             // Stempelzeiten
    monthAdjust: {},    // month(1-12) -> {payout: hours manually paid out}
    archive: {}          // previous years' closing snapshots: year -> {closingBalance, name,...}
  };
}

function normalizeState(s){
  // Absicherung für Stände aus einer älteren App-Version oder importierte Rohdaten:
  // fehlende Felder werden mit Standardwerten ergänzt, nichts Vorhandenes wird überschrieben.
  const def = defaultSettings(s.settings?.year || new Date().getFullYear());
  s.settings = Object.assign({}, def, s.settings||{});
  s.settings.weekly = Object.assign({}, def.weekly, s.settings.weekly||{});
  s.settings.absenceCodes = (s.settings.absenceCodes && s.settings.absenceCodes.length) ? s.settings.absenceCodes : def.absenceCodes;
  // Farbzuordnung je Code-Name (nicht Position!) — vermeidet Verrutschen, falls Codes umsortiert wurden.
  // Werte 1:1 aus der Original-Excel übernommen (Voreinstellungen-Blatt, Spalte Code).
  const excelCodeColors = {F:"#FFC000", K:"#FFFF00", U:"#8DB4E2", UH:"#00B0F0", GLZ:"#92D050", VU:"#8DB4E2", KA:"#FF7C80", T:"#0070C0"};
  // Alle bisher automatisch (nicht vom Nutzer per Farbwähler) vergebenen Werte aus früheren Versionen —
  // werden korrigiert, sobald ein aktueller Wert erkannt wird. Eine echte Nutzeränderung wird nie überschrieben.
  const knownAutoColors = new Set([
    "#f6ece2","#fbe3e1","#e6f2e6","#eef7ee","#e7edf7","#e7f5f0","#fdf2df","#f1e9f7","#e9f2f5","#f5e9ec",
    "#e8c48f","#f0a8a1","#a8d5ab","#c7e6c9","#a9c3ea","#9edcc6","#f5d67f","#cfb0e2","#a9d4dc","#e6b3c2",
    "#ffd966","#c7e6c9","#0070c0",
  ]);
  const fallbackPalette = ["#FFC000","#FFFF00","#8DB4E2","#00B0F0","#92D050","#8DB4E2","#FF7C80","#0070C0"];
  s.settings.absenceCodes.forEach((c,i)=>{
    if(!c.color){ c.color = excelCodeColors[c.code] || fallbackPalette[i % fallbackPalette.length]; return; }
    if(knownAutoColors.has(c.color.toLowerCase()) && excelCodeColors[c.code]){ c.color = excelCodeColors[c.code]; }
  });
  s.settings.vacation = Object.assign({}, def.vacation, s.settings.vacation||{});
  s.settings.glz = Object.assign({}, def.glz, s.settings.glz||{});
  s.settings.travel = Object.assign({}, def.travel, s.settings.travel||{});
  s.settings.gehtEmpfehlung = Object.assign({}, def.gehtEmpfehlung, s.settings.gehtEmpfehlung||{});
  s.settings.rules = mergeRules(s.settings.rules, s.settings.gehtEmpfehlung.kernzeit);
  s.holidays = (s.holidays && s.holidays.length) ? s.holidays : computeHolidays(s.settings.year);
  s.days = s.days || {};
  // Migration: alte Tage mit festen k1/g1/k2/g2-Feldern (max. 2 Kommt/Geht-Paare) auf die
  // neue flexible stamps-Liste (beliebig viele Paare) umstellen — bestehende Zeiten bleiben erhalten.
  for(const k in s.days){
    const day = s.days[k];
    if(!day) continue;
    if(!Array.isArray(day.stamps)){
      const st = [];
      for(const f of ["k1","g1","k2","g2"]){
        if(day[f]){ st.push(day[f]); } else break;
      }
      day.stamps = st;
      delete day.k1; delete day.g1; delete day.k2; delete day.g2;
    }
  }
  s.tasks = s.tasks || []; s.log = s.log || [];
  // Ältere Stände speicherten Aufträge/Protokoll je Jahr im Archiv – sie werden jahresübergreifend zusammengeführt.
  Object.values(s.archive||{}).forEach(entry=>{
    if(Array.isArray(entry.tasks)){ entry.tasks.forEach(t=>{ if(!s.tasks.some(x=>x.id===t.id)) s.tasks.push(t); }); delete entry.tasks; }
    if(Array.isArray(entry.log)){ entry.log.forEach(l=>{ if(!s.log.some(x=>x.taskId===l.taskId&&x.start===l.start&&x.stop===l.stop)) s.log.push(l); }); delete entry.log; }
  });
  s.tasks.forEach(task=>{
    if(task.manualDurationOffsetMinutes==null) task.manualDurationOffsetMinutes=0; if(task.pinned==null) task.pinned=false;
    // Störungen: bisher als Aufträge „Störung …“ geführt -> Art „stoerung“, Beschreibung wird je Stempelung erfasst.
    if(!task.kind) task.kind = /^\s*störung/i.test(task.orderNr||"") ? "stoerung" : "auftrag";
    if(task.kind==="stoerung" && task.aenderung && task.aenderung===task.orderNr) task.aenderung="";
  });
  const stoerIds = new Set((s.tasks||[]).filter(t=>t.kind==="stoerung").map(t=>t.id));
  (s.log||[]).forEach(entry=>{
    if(!entry.art) entry.art = stoerIds.has(entry.taskId) ? "stoerung" : "auftrag";
    if(entry.art==="stoerung" && entry.aenderung && entry.aenderung===entry.orderNr) entry.aenderung="";
  });
  s.log = s.log || [];
  s.ui = s.ui || {};
  const defaultTaskColumnWidths = [42,36,130,100,100,220,105,104,92,96,72];
  s.ui.taskTableColumnWidths = s.ui.taskTableColumnWidths || defaultTaskColumnWidths;
  // V3 vor Spalte „Angelegt am“: alte gespeicherte Breiten behalten und neue Breite gezielt einfügen.
  if(s.ui.taskTableColumnWidths.length===9) s.ui.taskTableColumnWidths.splice(6,0,104);
  if(s.ui.taskTableColumnWidths.length===10) s.ui.taskTableColumnWidths.splice(1,0,36);
  // Pin-Spalte von 74 auf 36 px verkleinern (Icon-only-Button).
  if(s.ui.taskTableColumnWidths.length===11 && s.ui.taskTableColumnWidths[1]===74) s.ui.taskTableColumnWidths[1]=36;
  s.ui.taskStatusFilter = s.ui.taskStatusFilter || "open";
  s.ui.taskKindTab = s.ui.taskKindTab || "auftrag";
  s.ui.stoerTableColumnWidths = s.ui.stoerTableColumnWidths || [42,36,320,105,104,92,96,90];
  if(s.ui.interruptedTaskId===undefined) s.ui.interruptedTaskId = null;
  s.ui.logTableColumnWidths = s.ui.logTableColumnWidths || [76,130,240,205,205,78];
  s.ui.holidayTableColumnWidths = s.ui.holidayTableColumnWidths || [135,360,90];
  s.monthAdjust = s.monthAdjust || {};
  s.archive = s.archive || {};
  return s;
}
let state = null;
let dirty = false;
let currentView = "heute";
let currentMonthIdx = new Date().getMonth(); // 0-11

/* ---------------- Speichern ----------------
   Die gewählte JSON-Datei ist die einzige Datenquelle (File System Access API, Chrome/Edge).
   - Beim Start wird nichts geschrieben; V3 liest nur die zuvor gewählte Datei (oder zeigt den Startbildschirm).
   - Der Browser merkt sich nur die Dateiverknüpfung, keine Daten.
   - Nur wenn das Schreiben in die Datei scheitert, hält ein Notfall-Puffer im Browser den Stand fest;
     er wird beim nächsten Öffnen der Datei als Wiederherstellung angeboten. */
let dataLoaded = false;   // erst nach Laden/Anlegen einer Datei true – davor wird nie gespeichert oder gestempelt
const NOTFALL_KEY = "stundenzettel-v3-notfall";
function saveNotfall(){
  try{ localStorage.setItem(NOTFALL_KEY, JSON.stringify({savedAt:Date.now(), fileName:fileHandle?fileHandle.name:null, state})); return true; }catch(e){ return false; }
}
function loadNotfall(){ try{ const raw=localStorage.getItem(NOTFALL_KEY); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
function clearNotfall(){ try{ localStorage.removeItem(NOTFALL_KEY); }catch(e){} }

const FS_SUPPORTED = typeof window.showSaveFilePicker === "function";
const FS_OPEN_SUPPORTED = typeof window.showOpenFilePicker === "function";
const IDB_NAME = "stundenzettel_fs", IDB_STORE = "handles";
let fileHandle = null;          // aktives FileSystemFileHandle, falls verbunden
let fileNeedsReconnect = false; // Berechtigung abgelaufen -> Klick nötig (Browser-Sicherheitsvorgabe)
let fileWriteTimer = null;
let lastFileWriteAt = null;

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
async function idbGet(key){
  try{
    const db = await idbOpen();
    return await new Promise((resolve,reject)=>{
      const rq = db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(key);
      rq.onsuccess=()=>resolve(rq.result||null); rq.onerror=()=>reject(rq.error);
    });
  }catch(e){ return null; }
}
async function idbSet(key,val){
  try{
    const db = await idbOpen();
    return await new Promise((resolve,reject)=>{
      const tx = db.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).put(val,key);
      tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error);
    });
  }catch(e){ return false; }
}
async function idbDel(key){
  try{
    const db = await idbOpen();
    return await new Promise((resolve,reject)=>{
      const tx = db.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error);
    });
  }catch(e){ return false; }
}

const PICKER_TYPES = [{description:"Stundenzettel (JSON)", accept:{"application/json":[".json"]}}];
async function connectAutosaveFile(){
  if(!FS_SUPPORTED){ toast("Dieser Browser unterstützt automatisches Datei-Speichern nicht (nur Chrome/Edge).", "warn"); return; }
  if(!dataLoaded){ toast("Bitte zuerst eine Datei öffnen oder neu beginnen.", "warn"); return; }
  try{
    const handle = await window.showSaveFilePicker({
      id: "stundenzettel-daten", startIn: "documents",
      suggestedName: `Stundenzettel-${state.settings.year}.json`, types: PICKER_TYPES
    });
    fileHandle = handle;
    fileNeedsReconnect = false;
    await idbSet("backupFile", handle);
    await writeToFile();
    toast("Datei gewählt – ab jetzt wird dort automatisch gespeichert.");
  }catch(err){
    if(err && err.name==="AbortError") return;
    toast("Datei-Verbindung fehlgeschlagen: "+err.message, "warn");
  }
  renderSicherung();
}
async function reconnectAutosaveFile(){
  if(!fileHandle) return;
  try{
    const perm = await fileHandle.requestPermission({mode:"readwrite"});
    if(perm==="granted"){
      fileNeedsReconnect = false;
      await writeToFile();
      toast("Datei-Speicherung reaktiviert.");
    } else {
      toast("Berechtigung nicht erteilt.", "warn");
    }
  }catch(err){ toast("Reaktivieren fehlgeschlagen: "+err.message, "warn"); }
  renderSicherung();
}
async function writeToFile(){
  if(!fileHandle || !dataLoaded) return false;
  try{
    const perm = await fileHandle.queryPermission({mode:"readwrite"});
    if(perm!=="granted"){ fileNeedsReconnect = true; saveNotfall(); updateSaveStatusUI(); return false; }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    lastFileWriteAt = new Date();
    fileNeedsReconnect = false; dirty = false;
    clearNotfall();
    updateSaveStatusUI();
    return true;
  }catch(err){
    fileNeedsReconnect = true;
    saveNotfall();
    updateSaveStatusUI();
    return false;
  }
}
const FILE_WRITE_DEBOUNCE_MS = 800;     // wartet auf eine kurze Tippunterbrechung
const FILE_WRITE_MIN_INTERVAL_MS = 3000; // harte Untergrenze: nie öfter als alle 3s tatsächlich schreiben
function scheduleFileWrite(){
  if(!fileHandle || !dataLoaded) return;
  clearTimeout(fileWriteTimer);
  const sinceLast = lastFileWriteAt ? (Date.now() - lastFileWriteAt.getTime()) : Infinity;
  const wait = sinceLast < FILE_WRITE_MIN_INTERVAL_MS
    ? Math.max(FILE_WRITE_DEBOUNCE_MS, FILE_WRITE_MIN_INTERVAL_MS - sinceLast)
    : FILE_WRITE_DEBOUNCE_MS;
  fileWriteTimer = setTimeout(()=>{ fileWriteTimer=null; writeToFile(); }, wait);
}
// Steht ein Schreibvorgang noch aus und der Tab wird verlassen/versteckt -> sofort schreiben.
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden" && fileWriteTimer && fileHandle){
    clearTimeout(fileWriteTimer); fileWriteTimer = null; writeToFile();
  }
});

/* ---------------- Datei lesen / Daten übernehmen ---------------- */
function confirmFindings(obj){
  if(!window.StundenzettelTimeCore) return true;
  const findings = StundenzettelTimeCore.validateYearData(obj);
  if(!findings.length) return true;
  const kindLabel = {"non-chronological":"nicht chronologisch","open-stamp":"offene Stempelung (ungerade Anzahl)","invalid-time":"ungültige Zeit","invalid-stamps":"kein Array"};
  const lines = findings.slice(0,10).map(f=>`• ${f.date}: ${kindLabel[f.kind]||f.kind}${f.stamps?" ["+f.stamps.join(", ")+"]":""}`);
  const more = findings.length > 10 ? `\n…und ${findings.length-10} weitere` : "";
  return confirm(`Die Datei enthält ${findings.length} auffällige Tag${findings.length===1?"":"e"}:\n\n${lines.join("\n")}${more}\n\nTrotzdem laden?`);
}
function parseStundenzettel(text){
  if(!text.trim()) throw new Error("Die Datei ist leer.");
  const obj = JSON.parse(text);
  if(!obj || typeof obj!=="object" || !obj.settings || !obj.days) throw new Error("Das ist keine Stundenzettel-Datei.");
  return obj;
}
async function openFromHandle(handle){
  const file = await handle.getFile();
  const obj = parseStundenzettel(await file.text());
  if(!confirmFindings(obj)) return false;
  adoptState(obj, handle, {fileName:handle.name, lastModified:file.lastModified});
  return true;
}
function adoptState(obj, handle, meta){
  state = normalizeState(JSON.parse(JSON.stringify(obj)));
  dataLoaded = true; fileHandle = handle||null; fileNeedsReconnect = false; dirty = false;
  if(handle) idbSet("backupFile", handle);
  const nf = loadNotfall();
  if(nf && nf.state && nf.state.settings){
    const sameFile = !nf.fileName || !meta || nf.fileName===meta.fileName;
    if(sameFile && nf.savedAt > ((meta&&meta.lastModified)||0)){
      if(confirm("Es gibt ungespeicherte Änderungen vom "+new Date(nf.savedAt).toLocaleString("de-DE")+" (Notfall-Kopie, weil das Speichern in die Datei nicht möglich war).\n\nWiederherstellen?")){
        state = normalizeState(JSON.parse(JSON.stringify(nf.state))); dirty = true;
      } else clearNotfall();
    }
  }
  closeStartDialog();
  currentMonthIdx = new Date().getMonth();
  const autoKommen = autoStampKommenOnOpen();
  const taskResumed = resumeLatestTaskOnOpen();
  switchView("heute");
  if(dirty || autoKommen || taskResumed) markDirty(); else markClean();
}
async function openExistingFile(){
  if(FS_OPEN_SUPPORTED){
    try{
      const [handle] = await window.showOpenFilePicker({id:"stundenzettel-daten", startIn:"documents", types:PICKER_TYPES, multiple:false});
      const perm = await handle.requestPermission({mode:"readwrite"});
      if(perm!=="granted"){ startMessage("Ohne Schreibberechtigung kann V3 nicht speichern. Bitte die Berechtigung erteilen."); return; }
      await openFromHandle(handle);
    }catch(err){
      if(err && err.name==="AbortError") return;
      startMessage("Datei konnte nicht geöffnet werden: "+err.message);
    }
  } else {
    document.getElementById("startFileInput").click();
  }
}
document.getElementById("startFileInput").addEventListener("change", async (e)=>{
  const file = e.target.files[0]; e.target.value=""; if(!file) return;
  try{
    const obj = parseStundenzettel(await file.text());
    if(!confirmFindings(obj)) return;
    adoptState(obj, null, {fileName:file.name, lastModified:file.lastModified});
    toast("Dieser Browser kann nicht automatisch in die Datei speichern. Bitte unter „Dateien & Sicherung“ regelmäßig eine Kopie speichern.", "warn");
  }catch(err){ startMessage("Datei konnte nicht gelesen werden: "+err.message); }
});

/* ---------------- App-Installation (nur über localhost/https verfügbar) ---------------- */
let installEvt = null;
const isInstalledApp = ()=>window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
function installCardHtml(){ return `<div class="start-card" id="startInstallCard"><div><strong>Als App installieren</strong><br><span class="hint">Eigenes Fenster, Desktop-Meldungen und Start über das Startmenü. Deine Daten bleiben in der JSON-Datei.</span></div><button id="btnStartInstall" class="secondary run-btn">Installieren</button></div>`; }
async function doInstallApp(){
  if(!installEvt) return;
  const evt=installEvt; installEvt=null;
  try{ evt.prompt(); const r=await evt.userChoice; if(r&&r.outcome==="accepted") toast("App wird installiert …"); else installEvt=evt; }catch(e){ installEvt=evt; }
  updateInstallUI();
}
function updateInstallUI(){
  const row=document.getElementById("installRow");
  if(row){
    row.hidden = !installEvt && !isInstalledApp();
    const btn=document.getElementById("btnInstallApp"), txt=document.getElementById("installStatus");
    if(isInstalledApp()){ btn.hidden=true; txt.textContent="Die App ist installiert."; }
    else { btn.hidden=!installEvt; txt.textContent="Eigenes Fenster, Desktop-Meldungen und Start über das Startmenü."; }
  }
  const body=document.getElementById("startBody"), dlg=document.getElementById("startDlg");
  if(dlg && dlg.open && body && document.getElementById("btnStartNew") && !document.getElementById("startInstallCard") && installEvt){
    body.insertAdjacentHTML("beforeend", installCardHtml());
    document.getElementById("btnStartInstall").onclick=doInstallApp;
  }
}
window.addEventListener("beforeinstallprompt",(e)=>{ e.preventDefault(); installEvt=e; updateInstallUI(); });
window.addEventListener("appinstalled",()=>{ installEvt=null; toast("App installiert. Du kannst sie jetzt über das Startmenü oder chrome://apps öffnen."); updateInstallUI(); });
document.addEventListener("click",(ev)=>{ if(ev.target && ev.target.id==="btnInstallApp") doInstallApp(); });

/* ---------------- Programm-Updates (ausschließlich manuell) ---------------- */
let updateRegistration = null;
let updateReady = false;
function setUpdateStatus(text){ const el=document.getElementById("updateStatus"); if(el) el.textContent=text; }
function renderUpdateUI(){
  const row=document.getElementById("updateRow");
  if(!row) return;
  row.hidden=!(navigator.serviceWorker && (updateRegistration || navigator.serviceWorker.controller));
  const check=document.getElementById("btnCheckUpdate"), install=document.getElementById("btnInstallUpdate");
  if(check) check.disabled=false;
  if(install) install.hidden=!updateReady;
}
function markUpdateReady(){
  updateReady=true;
  setUpdateStatus("Ein Update wurde heruntergeladen und ist zur Installation bereit.");
  renderUpdateUI();
}
function watchUpdateRegistration(reg){
  updateRegistration=reg;
  if(reg.waiting) markUpdateReady();
  reg.addEventListener("updatefound",()=>{
    const worker=reg.installing;
    if(!worker) return;
    worker.addEventListener("statechange",()=>{
      if(worker.state==="installed" && navigator.serviceWorker.controller) markUpdateReady();
    });
  });
  renderUpdateUI();
}
async function initUpdateUI(){
  if(!("serviceWorker" in navigator) || location.protocol==="file:") return;
  try{
    const reg=await navigator.serviceWorker.getRegistration("sw.js");
    if(reg) watchUpdateRegistration(reg);
    navigator.serviceWorker.addEventListener("controllerchange",()=>location.reload());
  }catch(e){}
}
async function checkForUpdate(){
  const check=document.getElementById("btnCheckUpdate");
  if(check) check.disabled=true;
  updateReady=false; renderUpdateUI();
  setUpdateStatus("Prüfe auf Updates …");
  try{
    const reg=updateRegistration || await navigator.serviceWorker.getRegistration("sw.js");
    if(!reg){ setUpdateStatus("Die Update-Funktion ist noch nicht verfügbar. Bitte die App einmal neu öffnen."); return; }
    watchUpdateRegistration(reg);
    await reg.update();
    if(reg.waiting) markUpdateReady();
    else setUpdateStatus("Kein neues Update verfügbar.");
  }catch(e){ setUpdateStatus("Update konnte nicht geprüft werden. Bitte Internetverbindung und GitHub-Adresse prüfen."); }
  finally{ if(check) check.disabled=false; }
}
function installPendingUpdate(){
  const worker=updateRegistration && updateRegistration.waiting;
  if(!worker) return;
  setUpdateStatus("Installiere Update …");
  worker.postMessage({type:"activate-update"});
}
document.addEventListener("click",(ev)=>{
  if(!ev.target) return;
  if(ev.target.id==="btnCheckUpdate") checkForUpdate();
  if(ev.target.id==="btnInstallUpdate") installPendingUpdate();
});
initUpdateUI();

/* ---------------- Startbildschirm & Assistent ---------------- */
function startMessage(text){ const el=document.getElementById("startMsg"); if(el){ el.textContent=text; el.hidden=!text; } }
function closeStartDialog(){ const d=document.getElementById("startDlg"); if(d.open) d.close(); }
function openStartDialog(storedHandle, message){
  const d=document.getElementById("startDlg"), body=document.getElementById("startBody");
  const reopen = storedHandle ? `<div class="start-card"><div><strong>Zuletzt verwendete Datei</strong><br><span class="hint">${escapeHtml(storedHandle.name||"")}</span></div><button id="btnStartReopen" class="go run-btn">Öffnen &amp; weitermachen</button></div>` : "";
  body.innerHTML=`<h2>Stundenzettel</h2>
    <p class="hint">Deine Daten liegen in einer Datei auf diesem Rechner. Ohne Datei zeigt V3 nichts an und speichert nichts.</p>
    <p id="startMsg" class="start-msg" ${message?"":"hidden"}>${escapeHtml(message||"")}</p>
    ${reopen}
    <div class="start-card"><div><strong>Bestehende Datei öffnen</strong><br><span class="hint">Eine vorhandene Stundenzettel-JSON.</span></div><button id="btnStartOpen" class="${storedHandle?"secondary":""} run-btn">Datei öffnen…</button></div>
    <div class="start-card"><div><strong>Neu beginnen</strong><br><span class="hint">Ein kurzer Assistent legt eine neue, leere Datei an.</span></div><button id="btnStartNew" class="${storedHandle?"secondary":""} run-btn">Neu beginnen…</button></div>
    ${installEvt?installCardHtml():""}
    ${FS_SUPPORTED?"":'<p class="hint">Hinweis: Dieser Browser kann nicht automatisch in eine Datei speichern. Für den vollen Komfort Chrome oder Edge verwenden.</p>'}`;
  if(!d.open) d.showModal();
  const ib=document.getElementById("btnStartInstall"); if(ib) ib.onclick=doInstallApp;
  document.getElementById("btnStartOpen").onclick=openExistingFile;
  document.getElementById("btnStartNew").onclick=openWizard;
  const re=document.getElementById("btnStartReopen");
  if(re) re.onclick=async()=>{
    try{
      const perm=await storedHandle.requestPermission({mode:"readwrite"});
      if(perm!=="granted"){ startMessage("Berechtigung nicht erteilt – ohne sie kann V3 die Datei nicht öffnen und speichern."); return; }
      await openFromHandle(storedHandle);
    }catch(err){ startMessage("Die Datei konnte nicht geöffnet werden (verschoben oder gelöscht?): "+err.message); }
  };
}
function openWizard(){
  const body=document.getElementById("startBody"), y=new Date().getFullYear();
  const regions=(window.ExcelParity&&ExcelParity.REGIONS)||{};
  body.innerHTML=`<h2>Neu beginnen</h2>
    <p class="hint">Alles lässt sich später in den Einstellungen ändern.</p>
    <p id="startMsg" class="start-msg" hidden></p>
    <div class="wiz-grid">
      <div><label>Name</label><input id="wName"></div>
      <div><label>Personalnummer</label><input id="wNr"></div>
      <div><label>Jahr</label><input id="wYear" type="number" value="${y}"></div>
      <div><label>Bundesland (Feiertage)</label><select id="wRegion"><option value="">Bundesweit (nur gemeinsame Tage)</option>${Object.entries(regions).map(([k,v])=>`<option value="${k}">${k} – ${v}</option>`).join("")}</select></div>
      <div><label>SOLL Mo–Do (Std./Tag)</label><input id="wSollMoDo" type="number" step="0.1" value="7.6"></div>
      <div><label>SOLL Freitag (Std.)</label><input id="wSollFr" type="number" step="0.1" value="7.6"></div>
      <div><label>Pause Mo–Do (Min.)</label><input id="wPauseMoDo" type="number" value="45"></div>
      <div><label>Pause Freitag (Min.)</label><input id="wPauseFr" type="number" value="30"></div>
      <div><label>Gleitzeit-Anfangssaldo (Std.)</label><input id="wGlz" type="number" step="0.01" value="0"></div>
      <div><label>Urlaubsanspruch (Tage)</label><input id="wVac" type="number" step="0.5" value="30"></div>
      <div><label>Resturlaub aus Vorjahr (Tage)</label><input id="wCarry" type="number" step="0.5" value="0"></div>
    </div>
    <p class="hint">Im nächsten Schritt wählst du, wo die Datei gespeichert wird. Empfehlung: ein Ordner, den du leicht wiederfindest (z. B. derselbe wie diese HTML-Datei).</p>
    <div class="btnrow"><button id="wCreate" class="go run-btn">Weiter: Speicherort wählen</button><button id="wBack" class="secondary run-btn">Zurück</button></div>`;
  document.getElementById("wBack").onclick=()=>openStartDialog(null);
  document.getElementById("wCreate").onclick=createFromWizard;
  document.getElementById("wName").focus();
}
async function createFromWizard(){
  const g=id=>document.getElementById(id).value, n=id=>Number(g(id))||0;
  const year=Math.round(n("wYear"));
  if(year<2000||year>2100){ startMessage("Bitte ein gültiges Jahr eingeben."); return; }
  const ns=freshYearState(year);
  const s=ns.settings;
  s.name=g("wName").trim(); s.personalNr=g("wNr").trim();
  ["mo","di","mi","do"].forEach(k=>s.weekly[k]=n("wSollMoDo")); s.weekly.fr=n("wSollFr"); s.weekly.sa=0; s.weekly.so=0;
  s.rules.pause.moDo=n("wPauseMoDo"); s.rules.pause.fr=n("wPauseFr");
  s.glz.carryOverHours=n("wGlz"); s.glz.carryOverManual=true;
  s.vacation.entitlement=n("wVac"); s.vacation.carryOver=n("wCarry"); s.vacation.carryOverManual=true;
  s.stempelnAktiv=false;
  if(window.StundenzettelExcelViews && window.ExcelParity){
    const ep=StundenzettelExcelViews.ensure(ns); ep.region=g("wRegion");
    ns.holidays=ExcelParity.workbookHolidays(year,{region:ep.region||null,custom:[]}).map(x=>({date:x.date,label:x.name,factor:x.factor,source:x.source}));
  }
  if(!FS_SUPPORTED){ adoptState(ns,null,null); toast("Dieser Browser kann nicht automatisch in eine Datei speichern. Bitte unter „Dateien & Sicherung“ eine Kopie speichern.","warn"); return; }
  try{
    const handle=await window.showSaveFilePicker({id:"stundenzettel-daten", startIn:"documents", suggestedName:`Stundenzettel-${year}.json`, types:PICKER_TYPES});
    const w=await handle.createWritable(); await w.write(JSON.stringify(ns,null,2)); await w.close();
    adoptState(ns, handle, {fileName:handle.name, lastModified:Date.now()});
    toast("Datei angelegt: "+handle.name+" – V3 speichert ab jetzt automatisch dorthin.");
  }catch(err){
    if(err && err.name==="AbortError") return;
    startMessage("Datei konnte nicht angelegt werden: "+err.message);
  }
}
document.getElementById("startDlg").addEventListener("cancel",(e)=>e.preventDefault());

function updateSaveStatusUI(){
  const dot = document.getElementById("dotDirty");
  const label = document.getElementById("saveState");
  const reconnectButton = document.getElementById("btnReconnectHeader");
  const showReconnect = fileHandle && fileNeedsReconnect;
  reconnectButton.style.display = showReconnect ? "block" : "none";
  reconnectButton.onclick = showReconnect ? reconnectAutosaveFile : null;
  if(showReconnect) setTimeout(maybeShowStorageModal, 0);
  if(!dataLoaded){
    dot?.classList.remove("show");
    label.textContent = "Keine Datei geöffnet";
  } else if(fileHandle && fileNeedsReconnect){
    dot?.classList.add("show");
    label.textContent = "Datei-Speicherung pausiert – bitte jetzt reaktivieren";
  } else if(fileHandle){
    dot?.classList.remove("show");
    label.textContent = "Datei aktuell · "+(lastFileWriteAt?lastFileWriteAt.toLocaleTimeString("de-DE"):"—");
  } else {
    dot?.classList.add("show");
    label.textContent = "NICHT gespeichert – keine Datei verbunden";
  }
}

function markDirty(){
  dirty = true;
  if(dataLoaded){
    scheduleFileWrite();
    if(!fileHandle || fileNeedsReconnect) saveNotfall();
  }
  updateSaveStatusUI();
}
function markClean(){
  updateSaveStatusUI();
}
window.addEventListener("beforeunload", (e)=>{
  // Schließen stempelt NICHT aus und pausiert keinen Auftrag. Gewarnt wird nur,
  // solange heute noch eingestempelt ist, ein Auftrag läuft oder Änderungen nicht in einer Datei liegen.
  if(!dataLoaded) return;
  const day = state && state.days && state.days[todayKey()];
  const stampedIn = Boolean(day && isDayOpen(day));
  const taskRunning = Boolean(state && state.tasks.some(t=>t.status==="in Arbeit"));
  const unsaved = dirty && (!fileHandle || fileNeedsReconnect);
  if(stampedIn || taskRunning || unsaved){ e.preventDefault(); e.returnValue=""; }
});
window.addEventListener("pagehide", ()=>{ if(fileWriteTimer && fileHandle){ clearTimeout(fileWriteTimer); fileWriteTimer=null; writeToFile(); } });

/* ---------------- Business logic ---------------- */
function isHolidayOn(k){ return state.holidays.find(h=>h.date===k) || null; }
function codeInfo(code){ return state.settings.absenceCodes.find(c=>c.code===code) || null; }

function rawWorkedMinutes(day, liveNow){
  function span(a,b){
    const A=timeToMin(a), B=timeToMin(b);
    if(A==null || B==null) return 0;
    return B>=A ? (B-A) : (B-A+1440);
  }
  const st = day.stamps || [];
  let total = 0;
  for(let i=0; i+1<st.length; i+=2){ total += span(st[i], st[i+1]); }
  // Noch offene (ungeschlossene) letzte Kommt-Stempelung: bei "liveNow" bis zur aktuellen Uhrzeit mitzählen,
  // damit "IST heute" auch während man noch gestempelt ist live mitläuft.
  if(liveNow && st.length%2===1){ total += span(st[st.length-1], liveNow); }
  return total;
}

function calcPauseMinutes(day, dateObj, holiday, liveNow){
  if(day.pause != null && day.pause !== "" ) return Number(day.pause);
  if(Array.isArray(day.dayPauses) && day.dayPauses.length && window.StundenzettelDayPause){
    return StundenzettelDayPause.minutes(day, liveNow);
  }
  const raw = rawWorkedMinutes(day, liveNow);
  if(raw<=0) return 0;
  const r = rulesOf();
  const base = holiday ? r.pause.holiday : r.pause[dayGroup(dateObj)];
  if((raw - base) >= r.longThresholdHours*60) return r.longPauseMin;
  return base;
}

function weekdayTarget(dateObj){
  return state.settings.weekly[jsWeekdayKey(dateObj)] || 0;
}

function calcDay(k){
  const day = state.days[k] || {};
  const dateObj = keyToDate(k);
  const holiday = isHolidayOn(k);
  const liveNow = (k===todayKey() && isDayOpen(day)) ? nowTimeStr() : null;
  const raw = rawWorkedMinutes(day, liveNow);
  const pauseMin = calcPauseMinutes(day, dateObj, holiday, liveNow);
  const hasTimes = raw>0;
  const ist = hasTimes ? Math.max(0,(raw-pauseMin))/60 : null;
  const wTarget = weekdayTarget(dateObj);

  // Wichtig (1:1 aus dem Original übernommen): ein Tag ohne jede Eintragung
  // (weder Zeiten noch Code — typischerweise ein noch nicht erreichter künftiger
  // Werktag) zählt NICHT mit vollem Tagessoll, sondern bleibt komplett außen vor
  // (SOLL = null, +/- = 0). Nur sobald Zeiten ODER ein Code eingetragen sind,
  // fließt der Tag in SOLL/IST/Saldo ein. GLZ ist die einzige Ausnahme (fixer Tag).
  let soll, diff;
  if(day.code === "GLZ"){
    soll = state.settings.glz.dayHours;
    diff = -state.settings.glz.dayHours;
  } else if(!hasTimes && !day.code){
    soll = null;
    diff = 0;
  } else if(!hasTimes && day.code){
    // Excel N4 bleibt ohne IST leer; GLZ ist der explizite Sonderfall.
    const ci = codeInfo(day.code);
    soll = window.ExcelParity?.calculateDailyTarget
      ? ExcelParity.calculateDailyTarget({ hasTimes:false, code:day.code, weekdayTargetHours:wTarget, glzTargetHours:state.settings.glz.dayHours, codeFactor:ci?.factor })
      : (day.code === "GLZ" ? state.settings.glz.dayHours : null);
    diff = 0;
  } else if(day.code){
    // Seltener Fall: Zeiten UND ein Code am selben Tag eingetragen.
    const ci = codeInfo(day.code);
    const factor = ci ? ci.factor : 0;
    soll = holiday ? round2(holiday.factor*wTarget) : round2(factor*wTarget);
    diff = round2(ist - soll);
  } else if(holiday){
    soll = round2(holiday.factor*wTarget);
    diff = round2(ist - soll);
  } else {
    soll = wTarget;
    diff = round2(ist - soll);
  }

  // legal break warning
  let warn = "";
  if(raw>0){
    if(raw/60 >= 9 && pauseMin < 45) warn="!";
    else if(raw/60 >= 6 && pauseMin < 30) warn="!";
  }

  return {day, dateObj, holiday, raw, pauseMin, ist, soll: soll == null ? null : round2(soll), diff, warn};
}

function monthRange(monthIdx /*0-11*/){
  const y = state.settings.year;
  const first = new Date(y, monthIdx, 1);
  const last = new Date(y, monthIdx+1, 0);
  const keys=[];
  for(let d=new Date(first); d<=last; d.setDate(d.getDate()+1)) keys.push(dateKey(d));
  return keys;
}

function monthOpeningBalance(monthIdx){
  if(monthIdx===0) return state.settings.glz.carryOverHours || 0;
  return monthClosingBalance(monthIdx-1);
}
function monthClosingBalance(monthIdx){
  const opening = monthOpeningBalance(monthIdx);
  const keys = monthRange(monthIdx);
  let sumDiff=0;
  for(const k of keys){ sumDiff += calcDay(k).diff; }
  const payout = (state.monthAdjust[monthIdx+1] && state.monthAdjust[monthIdx+1].payout) || 0;
  return round2(opening + sumDiff - payout);
}
function monthSums(monthIdx){
  const keys = monthRange(monthIdx);
  let ist=0, soll=0, diff=0;
  for(const k of keys){ const c=calcDay(k); ist+=c.ist||0; soll+=c.soll||0; diff+=c.diff||0; }
  return {ist:round2(ist), soll:round2(soll), diff:round2(diff)};
}
function yearBalanceSeries(){
  const y = state.settings.year;
  const first = new Date(y,0,1), last=new Date(y,11,31);
  let bal = state.settings.glz.carryOverHours || 0;
  const pts=[];
  for(let d=new Date(first); d<=last; d.setDate(d.getDate()+1)){
    const k=dateKey(d);
    bal = round2(bal + calcDay(k).diff);
    pts.push({date:k, bal});
  }
  return pts;
}
/* Resturlaub aus dem Vorjahr verfällt zum Stichtag (Standard 31.03., je Jahr verlängerbar).
   Urlaub bis zum Stichtag wird zuerst vom Resturlaub abgezogen; der Rest verfällt. */
function vacationInfo(){
  const v=state.settings.vacation, year=state.settings.year;
  const expiry=v.carryExpiry || (year+"-03-31");
  let used=0, vu=0, usedUntilExpiry=0;
  for(const k in state.days){
    const code=state.days[k]&&state.days[k].code; if(!code) continue;
    const val = code==="U"?1 : code==="UH"?0.5 : 0;
    if(code==="VU") vu+=1;
    used+=val; if(k<=expiry) usedUntilExpiry+=val;
  }
  const carry=Math.max(0, Number(v.carryOver)||0);
  const lapsed=round2(Math.max(0, carry-Math.min(carry, usedUntilExpiry)));
  const base=round2(v.entitlement+carry-used-vu);
  // Ins Folgejahr geht nur ein Guthaben; Urlaub kann nicht ins Minus übertragen werden.
  const balance=round2(v.entitlement+carry-lapsed-used-vu);
  const carryToNext=Math.max(0, balance);
  const expired = todayKey()>expiry;
  return {used, vu, carry, expiry, lapsed, expired,
    avail: round2(base-(expired?lapsed:0)),
    yearEnd: carryToNext, balance};
}
function vacationUsed(){
  let used=0, vu=0;
  for(const k in state.days){
    const d=state.days[k];
    if(!d.code) continue;
    if(d.code==="U") used+=1;
    else if(d.code==="UH") used+=0.5;
    else if(d.code==="VU") vu+=1;
  }
  return {used, vu};
}
/* ---- Woche/Monat-Hilfsfunktionen (für Kennzahlen + Geht-Empfehlung) ---- */
function startOfISOWeek(d){ const wd=(d.getDay()+6)%7; const r=new Date(d); r.setDate(d.getDate()-wd); r.setHours(0,0,0,0); return r; }
function endOfISOWeek(d){ const s=startOfISOWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); return e; }
function weekBalanceUpTo(d){
  const s = startOfISOWeek(d);
  let sum=0;
  for(let x=new Date(s); x<=d; x.setDate(x.getDate()+1)) sum += calcDay(dateKey(x)).diff;
  return round2(sum);
}
function remainingWorkdaysInWeek(from){
  const end = endOfISOWeek(from);
  let n=0;
  for(let d=new Date(from); d<=end; d.setDate(d.getDate()+1)){
    const wd=jsWeekdayKey(d);
    if(wd==="sa"||wd==="so") continue;
    if(state.days[dateKey(d)]?.code) continue; // schon verplanter Abwesenheitstag
    n++;
  }
  return n||1;
}
function monthEndDate(monthIdx){ return new Date(state.settings.year, monthIdx+1, 0); }
function remainingWorkdaysInMonth(from, monthIdx){
  const end = monthEndDate(monthIdx);
  let n=0;
  for(let d=new Date(from); d<=end; d.setDate(d.getDate()+1)){
    const wd=jsWeekdayKey(d);
    if(wd==="sa"||wd==="so") continue;
    const k=dateKey(d);
    if(isHolidayOn(k)) continue;
    if(state.days[k]?.code) continue;
    n++;
  }
  return n||1;
}
function isCurrentRealMonth(monthIdx){
  const now=new Date();
  return now.getFullYear()===state.settings.year && now.getMonth()===monthIdx;
}

/* ---- Geht-Empfehlung ("wann kann ich heute gehen") ---- */
function computeGehtEmpfehlungen(monthIdx){
  const g = state.settings.gehtEmpfehlung;
  const adj = ensureMonthAdjust(monthIdx+1);
  const today = new Date();
  const tKey = dateKey(today);
  const kommt = state.days[tKey]?.stamps?.[0] || "";
  const holidayToday = isHolidayOn(tKey);
  const friSatSun = isFriSatSun(today);
  const rl = rulesOf();
  const breakMin = holidayToday ? rl.pause.holiday : rl.pause[dayGroup(today)];
  const targetToday = weekdayTarget(today);
  const freeGoal = friSatSun ? g.freeGoalFr : g.freeGoalMoDo;
  const weekBal = weekBalanceUpTo(today);
  const monthBal = monthSums(monthIdx).diff;
  const remWeek = remainingWorkdaysInWeek(today);
  const remMonth = remainingWorkdaysInMonth(today, monthIdx);
  const wochenziel = adj.wochenziel || 0;
  const monatsziel = adj.monatsziel || 0;
  const isFri = jsWeekdayKey(today)==="fr";

  const J42 = round2((wochenziel - weekBal + ((g.activeCode==="WZF" && !isFri) ? g.friAdjustWZ : 0)) / remWeek);
  const J44 = round2((monatsziel - monthBal) / remMonth);

  // Kurzarbeit: Geht-Zeit(en), um auf den niedrigsten Gleitzeit-Stand der letzten 12 Monate zu kommen.
  const kaTarget = kaTargetForMonth(monthIdx);
  const todayOpeningBal = dayOpeningBalanceToday();
  const todayAbsBalLive = yearBalanceSeries().find(p=>p.date===tKey)?.bal ?? todayOpeningBal;
  const desiredTodayDiffKA = round2(kaTarget - todayOpeningBal);
  const monatszielKA = kaTarget - monthOpeningBalance(monthIdx);
  const J44_KA = round2((monatszielKA - monthBal) / remMonth);
  const weekOpeningBal = round2(todayAbsBalLive - weekBal);
  const wochenzielKA = kaTarget - weekOpeningBal;
  const J42_KA = round2((wochenzielKA - weekBal) / remWeek);

  function fromKommt(extraHoursMin){
    if(!kommt) return null;
    return addMinutesToTimeStr(kommt, breakMin + Math.round(extraHoursMin*60));
  }

  const rows = [
    {code:"O",  label:"Heute Geht ohne Minus", time: fromKommt(targetToday)},
    {code:"S",  label:`Heute Geht nach ${freeGoal}h`, time: fromKommt(freeGoal)},
    {code:"J",  label:"Heute Geht Jetzt", time: nowTimeStr()},
    {code:"K",  label:"Heute Geht zur Kernzeit", time: rl.kernzeit[dayGroup(today)]},
    {code:"W",  label:"Heute Geht nach Woche 0h", time: fromKommt(targetToday - weekBal)},
    {code:"WF", label:"Heute Geht nach Woche 0h / Freitag -Xh", time: friSatSun ? fromKommt(targetToday - g.friAdjustWeek) : fromKommt(targetToday - weekBal + g.friAdjustWeek)},
    {code:"WZ", label:"Heute Geht nach Wochenziel/Resttage", time: fromKommt(targetToday + J42)},
    {code:"WZF",label:"Heute Geht nach Wochenziel/Resttage / Freitag -Xh", time: friSatSun ? fromKommt(targetToday - g.friAdjustWZ) : fromKommt(targetToday + J42)},
    {code:"10", label:"Heute Geht nach 10h", time: shiftLimitTime(10)},
    {code:"M",  label:"Heute Geht nach Monat 0h", time: fromKommt(targetToday - monthBal)},
    {code:"MZ", label:"Heute Geht nach Monatsziel/Resttage", time: fromKommt(targetToday + J44)},
    {code:"KA", label:`Heute Geht für KA-Tiefststand (${hoursToHM(kaTarget)}) — heute`, time: fromKommt(targetToday + desiredTodayDiffKA)},
    {code:"MKA",label:`Heute Geht für KA-Tiefststand (${hoursToHM(kaTarget)}) — Monats-Resttage`, time: fromKommt(targetToday + J44_KA)},
    {code:"WKA",label:`Heute Geht für KA-Tiefststand (${hoursToHM(kaTarget)}) — Wochen-Resttage`, time: fromKommt(targetToday + J42_KA)},
  ];
  return {rows, J42, J44, weekBal, monthBal, remWeek, remMonth, kommt, kaTarget};
}

function glzTageVerfuegbar(){
  const bal = yearBalanceSeries().slice(-1)[0]?.bal ?? (state.settings.glz.carryOverHours||0);
  const weekSoll = Object.values(state.settings.weekly).reduce((a,b)=>a+b,0);
  const perDay = weekSoll/5 || 1;
  const buf = state.settings.glz.bufferHours || 0;
  return Math.max(0, round2((bal-buf)/perDay));
}

/* ---------------- Rendering: nav ---------------- */
function switchView(v){
  if(v==="heute") ensureTodayYear(true); // Heute zeigt immer das Jahr des heutigen Datums
  currentView=v;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active", t.dataset.view===v));
  document.querySelectorAll(".view").forEach(el=>el.classList.remove("active"));
  document.getElementById("view-"+v).classList.add("active");
  renderCurrentView();
}
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>switchView(t.dataset.view)));

function renderRailYearMenu(){
  const menu=document.getElementById("railYearMenu"), btn=document.getElementById("railYearBtn");
  const cur=state.settings.year, thisYear=new Date().getFullYear();
  menu.innerHTML=allYears().slice().reverse().map(y=>{
    const locked = y===cur ? state.settings.locked : Boolean(state.archive[y]?.settings?.locked);
    return `<button type="button" role="option" data-year="${y}" class="${y===cur?"active":""}">${y}${y===thisYear?' <small>laufend</small>':""}${locked?" 🔒":""}</button>`;
  }).join("");
  menu.querySelectorAll("[data-year]").forEach(b=>b.onclick=()=>{
    menu.hidden=true; btn.setAttribute("aria-expanded","false");
    const y=Number(b.dataset.year);
    if(y!==state.settings.year) activateArchivedYear(y);
    if(currentView==="heute" && y!==new Date().getFullYear()) switchView("monat");
  });
  btn.onclick=(e)=>{ e.stopPropagation(); menu.hidden=!menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
}
document.addEventListener("click",()=>{ const m=document.getElementById("railYearMenu"); if(m && !m.hidden){ m.hidden=true; document.getElementById("railYearBtn").setAttribute("aria-expanded","false"); } });
function applyYearNotCurrent(){
  const thisYear=new Date().getFullYear(), other=state.settings.year!==thisYear;
  const banner=document.getElementById("yearOtherBanner");
  document.getElementById("railYearBtn").classList.toggle("not-current", other);
  banner.style.display = other ? "flex" : "none";
  if(!other) return;
  const exists = Boolean(state.archive && state.archive[thisYear]);
  banner.innerHTML=`<span class="txt">📅 Du siehst <strong>${state.settings.year}</strong> – nicht das laufende Jahr ${thisYear}. Gestempelt wird weiterhin in ${thisYear}.</span>${exists?`<button type="button" id="btnBackToCurrentYear">Zurück zu ${thisYear}</button>`:`<span class="hint">Jahr ${thisYear} existiert noch nicht (Einstellungen → Jahre).</span>`}`;
  const b=document.getElementById("btnBackToCurrentYear");
  if(b) b.onclick=()=>activateArchivedYear(thisYear);
}
function applyYearLock(){
  applyYearNotCurrent();
  const locked=Boolean(state.settings.locked);
  ["heute","monat","urlaub","fahrtkosten"].forEach(v=>{ const el=document.getElementById("view-"+v); if(el) el.inert = locked; });
  const banner=document.getElementById("yearLockBanner");
  const show = locked && ["heute","monat","jahr","urlaub","fahrtkosten"].includes(currentView);
  banner.style.display = show ? "flex" : "none";
  if(show){
    banner.innerHTML=`<span class="txt">🔒 Jahr ${state.settings.year} ist gesperrt (nur Lesen).</span><button type="button" class="secondary" id="btnUnlockYear">Entsperren</button>`;
    document.getElementById("btnUnlockYear").onclick=()=>{ state.settings.locked=false; markDirty(); renderAll(); toast("Jahr "+state.settings.year+" entsperrt."); };
  }
}
function renderCurrentView(){
  recomputeCarryovers();
  document.getElementById("railYear").textContent = state.settings.year + (state.settings.locked?" 🔒":"");
  renderRailYearMenu();
  if(currentView==="heute") renderHeute();
  else if(currentView==="monat") renderMonat();
  else if(currentView==="jahr") renderJahr();
  else if(currentView==="auftraege") renderAuftraege();
  else if(currentView==="urlaub") renderUrlaub();
  else if(currentView==="fahrtkosten") renderFahrtkosten();
  else if(currentView==="rechner" && window.StundenzettelExcelViews) StundenzettelExcelViews.renderCalculator({state, markDirty, toast, todayKommt:()=>state.days[todayKey()]?.stamps?.[0]||""});
  else if(currentView==="einstellungen") renderEinstellungen();
  else if(currentView==="sicherung") renderSicherung();
  applyYearLock();
}

/* ---------------- Pop-up: Datei-Autospeicherung ----------------
   Erscheint aktiv als Dialog (statt nur einer Leiste), sobald eine Reaktivierung nötig ist —
   auch mitten in der Sitzung, falls die Berechtigung unerwartet wegfällt. Wird sie einmal
   weggeklickt ("Später"), erscheint sie in dieser Sitzung nicht nochmal von selbst; der Status
   bleibt dann nur noch dezent in der Fußzeile sichtbar, und im Reiter „Sicherung“ jederzeit erreichbar. */
let reconnectModalDismissedThisSession = false;

function openModal(html, urgent){
  const box = document.getElementById("modalBox");
  box.className = "modal-box"+(urgent?" urgent":"");
  box.innerHTML = html;
  document.getElementById("modalOverlay").classList.add("show");
}
function closeModal(){
  document.getElementById("modalOverlay").classList.remove("show");
}

function maybeShowStorageModal(){
  if(fileHandle && fileNeedsReconnect && !reconnectModalDismissedThisSession){
    openModal(`
      <h3>🔔 Automatische Speicherung reaktivieren</h3>
      <p>Deine Datei-Autospeicherung ist eingerichtet, braucht nach dem Öffnen der App aber einmal eine
      Bestätigung (das verlangt der Browser aus Sicherheitsgründen so). Ein Klick, dann läuft alles wieder
      automatisch im Hintergrund.</p>
      <div class="btnrow">
        <button id="mdReconnect">Jetzt reaktivieren</button>
        <button class="secondary" id="mdLater">Später</button>
      </div>`, true);
    document.getElementById("mdReconnect").onclick = async ()=>{ await reconnectAutosaveFile(); closeModal(); };
    document.getElementById("mdLater").onclick = ()=>{ reconnectModalDismissedThisSession=true; closeModal(); };
    return;
  }
}

/* ---------------- HEUTE ---------------- */
function ensureDay(k){
  // Tage außerhalb des aktuell geladenen Jahres werden nie angelegt (kein Vermischen von Jahren).
  if(String(k).slice(0,4)!==String(state.settings.year)) return {stamps:[],pause:"",code:"",bemerkung:"",autoIdx:[]};
  if(!state.days[k]) state.days[k]={stamps:[],pause:"",code:"",bemerkung:"",autoIdx:[]}; if(!state.days[k].stamps) state.days[k].stamps=[]; if(!state.days[k].autoIdx) state.days[k].autoIdx=[]; return state.days[k]; }

function isDayOpen(day){ return ((day&&day.stamps)||[]).length % 2 === 1; }

function renderStempelList(k, day){
  const box = document.getElementById("heuteStempelForm");
  box.innerHTML = "";
  const list = document.createElement("div");
  list.className = "stamp-list";
  const stamps = day.stamps || (day.stamps = []);
  if(!stamps.length){
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Heute noch keine Stempelung.";
    list.appendChild(empty);
  }
  stamps.forEach((t,i)=>{
    const label = i%2===0 ? "Kommt "+(Math.floor(i/2)+1) : "Geht "+(Math.floor(i/2)+1);
    const isAuto = (day.autoIdx||[]).includes(i);
    const row = document.createElement("div");
    row.className = "stamp-row";
    row.innerHTML = `<span class="stamp-label">${label}</span>
      <input type="time" lang="de-DE" class="${isAuto?"auto-pending":""}" data-idx="${i}" value="${t||""}" title="${isAuto?"Automatisch eingetragen — bitte prüfen und bestätigen":""}">
      <button type="button" class="stamp-del" data-idx="${i}" title="Löschen">✕</button>`;
    list.appendChild(row);
  });
  box.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type="button"; addBtn.className="secondary"; addBtn.style.marginTop="8px";
  addBtn.textContent = "+ Zeit manuell hinzufügen";
  box.appendChild(addBtn);

  list.querySelectorAll('input[type="time"]').forEach(el=>{
    el.addEventListener("blur",(e)=>{
      const idx=Number(e.target.dataset.idx);
      const val=e.target.value;
      const wasAuto = (day.autoIdx||[]).includes(idx);
      clearAutoStamp(day, idx); // jede Interaktion mit dem Feld gilt als Bestätigung
      if(val===""){
        // Eine geleerte Zeit, die nicht die letzte ist, würde eine Lücke reißen -> Feld ganz entfernen.
        if(idx!==stamps.length-1){ stamps.splice(idx,1); reindexAutoAfterSplice(day, idx); }
        else { stamps[idx]=""; }
      } else {
        if(stamps[idx]===val && !wasAuto) return; // unverändert -> kein Re-Render nötig
        stamps[idx]=val;
      }
      markDirty(); renderHeute(); renderMiniPlayer();
    });
  });
  list.querySelectorAll(".stamp-del").forEach(el=>{
    el.addEventListener("click",()=>{
      const idx=Number(el.dataset.idx);
      stamps.splice(idx,1);
      reindexAutoAfterSplice(day, idx);
      markDirty(); renderHeute(); renderMiniPlayer();
    });
  });
  addBtn.disabled = isDayOpen({stamps});
  addBtn.title = addBtn.disabled ? "Bitte zuerst die offene Geht-Zeit eintragen oder löschen." : "";
  addBtn.addEventListener("click", ()=>{
    if(isDayOpen({stamps})){ toast("Bitte zuerst die offene Geht-Zeit eintragen oder löschen, bevor eine neue Zeit hinzugefügt wird.", "warn"); return; }
    stamps.push(nowTimeStr());
    markDirty(); renderHeute(); renderMiniPlayer();
  });
}

function renderHeuteKpis(k){
  const c = calcDay(k);
  const kpis = document.getElementById("heuteKpis");
  if(!kpis) return;
  const openBal = yearBalanceSeries().find(p=>p.date===k)?.bal;
  kpis.innerHTML = "";
  const items = [
    ["IST heute", c.ist==null?"–":hoursToHM(c.ist), null],
    ["SOLL heute", hoursToHM(c.soll), null],
    ["+/- heute", hoursToHM(c.diff), c.diff>=0?"pos":"neg"],
    ["Gleitzeitsaldo", hoursToHM(openBal), openBal>=0?"pos":"neg"],
  ];
  const gr = computeGehtEmpfehlungen(new Date().getMonth());
  const activeRow = gr.rows.find(x=>x.code===state.settings.gehtEmpfehlung.activeCode);
  items.push(["Empfohlene Geht-Zeit ("+state.settings.gehtEmpfehlung.activeCode+")", activeRow?.time || "–", null]);
  for(const [l,v,cls] of items){
    const d=document.createElement("div"); d.className="kpi";
    d.innerHTML = `<div class="l">${l}</div><div class="v ${cls||""}">${v}</div>`;
    kpis.appendChild(d);
  }
}
function renderHeute(){
  const k = todayKey();
  document.getElementById("heuteDatum").textContent = fmtDateDE(k)+" · "+WEEKDAY_LABELS[jsWeekdayKey(keyToDate(k))];
  renderHeuteKpis(k);

  const day = ensureDay(k);
  renderStempelList(k, day);

  document.getElementById("btnKommen").onclick=doKommen;
  document.getElementById("btnGehen").onclick=()=>doGehen(false);
  document.getElementById("btnFeierabend").onclick=doFeierabend;
  document.getElementById("btnPauseStart").onclick=doPauseStart;
  document.getElementById("btnPauseStop").onclick=doPauseStop;

  renderHeuteAuftrag();
  renderHeuteHistorie(k);
}

function renderHeuteHistorie(k){
  const box = document.getElementById("heuteHistorie");
  if(!box) return;
  const items = [];
  // Kommt/Geht-Stempelungen
  const stamps = state.days[k]?.stamps || [];
  stamps.forEach((t,i)=>{
    if(!t) return;
    items.push({time:t, text:(i%2===0?"Kommt":"Geht")+" gestempelt", icon:i%2===0?"→":"←"});
  });
  // Auftrags-Log (abgeschlossene Start/Pause-Intervalle heute)
  state.log.filter(l=>localDateKeyFromIso(l.start)===k).forEach(l=>{
    const label = (l.orderNr||"(ohne Nr.)") + (l.aenderung?" – "+l.aenderung:"");
    items.push({time:localTimeFromIso(l.start).slice(0,5), text:"Auftragsstempelung Start: "+label, icon:"▶"});
    items.push({time:localTimeFromIso(l.stop).slice(0,5), text:"Auftragsstempelung Pause: "+label, icon:"⏸"});
  });
  // aktuell noch laufender Auftrag (offen, kein Stop-Eintrag)
  const active = state.tasks.find(t=>t.status==="in Arbeit" && t.activeSince && localDateKeyFromIso(t.activeSince)===k);
  if(active){
    items.push({time:localTimeFromIso(active.activeSince).slice(0,5), text:"Auftragsstempelung Start: "+(active.orderNr||"(ohne Nr.)")+(active.aenderung?" – "+active.aenderung:"")+" (läuft noch)", icon:"▶"});
  }
  items.sort((a,b)=>a.time.localeCompare(b.time));
  if(!items.length){ box.innerHTML = '<p class="hint">Heute noch keine Einträge.</p>'; return; }
  box.innerHTML = '<table class="compact-kv"><tbody>' + items.map(it=>
    `<tr><td class="lbl">${it.time}</td><td class="val">${it.icon} ${escapeHtml(it.text)}</td></tr>`
  ).join("") + '</tbody></table>';
}

/* ---------------- Gemeinsame Stempel-Aktionen (Hauptansicht + Mini-Player) ---------------- */
function markAutoStamp(day, idx){
  day.autoIdx = day.autoIdx || [];
  if(!day.autoIdx.includes(idx)) day.autoIdx.push(idx);
}
function clearAutoStamp(day, idx){
  if(day.autoIdx) day.autoIdx = day.autoIdx.filter(i=>i!==idx);
}
function reindexAutoAfterSplice(day, removedIdx){
  if(day.autoIdx) day.autoIdx = day.autoIdx.filter(i=>i!==removedIdx).map(i=>i>removedIdx?i-1:i);
}
function doKommen(){
  if(!ensureTodayYear()) return;
  const k = todayKey();
  const d=ensureDay(k);
  if(isDayOpen(d)){ toast("Es ist noch eine offene „Kommt“-Stempelung ohne „Geht“ vorhanden."); return; }
  const t = nowTimeStr(); // manuell: exakt jetzt, ohne Vorlauf
  d.stamps.push(t);
  markDirty(); renderHeute(); renderMiniPlayer(); toast("Kommt gestempelt: "+t);
}
function doGehen(feierabend){
  if(!ensureTodayYear()) return;
  feierabend = feierabend===true; // Klick-Events (Objekte) zählen nicht als Feierabend
  const k = todayKey();
  const d=ensureDay(k);
  if(!isDayOpen(d)){ toast("Bitte zuerst „Kommt“ stempeln.", "warn"); return; }
  // Zwischen-Geht: exakt jetzt. Feierabend: Nachlauf-Offset (Weg vom Platz zur Stempeluhr).
  const t = feierabend ? addMinutesToTimeStr(nowTimeStr(), state.settings.stempelOffsetGehenMin||0) : nowTimeStr();
  d.stamps.push(t);
  activeTaskPause(); // laufender Auftrag wird in beiden Fällen pausiert
  markDirty(); renderHeute(); renderMiniPlayer();
  if(!feierabend){ toast("Geht gestempelt: "+t+". Mit „Kommt“ geht es weiter."); return; }
  const saveHint = fileHandle && !fileNeedsReconnect
    ? "wird automatisch in die verbundene Datei gespeichert."
    : "ist NICHT in einer Datei gespeichert – bitte Datei verbinden bzw. reaktivieren!";
  toast("Feierabend gestempelt: "+t+" – "+saveHint, fileHandle&&!fileNeedsReconnect?undefined:"warn");
  if(confirm("Feierabend gestempelt: "+t+". Tab jetzt schließen?")){
    window.close();
    setTimeout(()=>{
      toast("Der Browser hat das automatische Schließen verhindert (nur bei per Skript geöffneten Tabs möglich). Bitte den Tab manuell schließen.", "warn");
    }, 300);
  }
}
function doFeierabend(){ doGehen(true); }
function doPauseStart(){
  if(!ensureTodayYear()) return;
  const day = ensureDay(todayKey());
  try {
    if(window.StundenzettelDayPause) StundenzettelDayPause.start(day, new Date().toISOString(), 'manual');
    activeTaskPause();
    markDirty(); renderHeute(); renderMiniPlayer();
  } catch(error) { toast(error.message, 'warn'); }
}
function doPauseStop(){
  if(!ensureTodayYear()) return;
  const day = ensureDay(todayKey());
  try {
    if(window.StundenzettelDayPause) StundenzettelDayPause.end(day, new Date().toISOString(), 'manual');
    activeTaskResume();
    markDirty(); renderHeute(); renderMiniPlayer();
  } catch(error) { toast(error.message, 'warn'); }
}

/* ---------------- Mini-Player (Document Picture-in-Picture) ---------------- */
let pipWindow = null;
function pipSupported(){ return "documentPictureInPicture" in window; }

async function openMiniPlayer(auto){
  if(!auto) ensureNotificationPermission(); // echter Klick = guter Moment, um nach Benachrichtigungs-Erlaubnis zu fragen
  if(!pipSupported()){
    if(!auto) toast("Mini-Player wird von diesem Browser nicht unterstützt (Chrome/Edge nötig).", "warn");
    return;
  }
  if(pipWindow){ try{ pipWindow.focus(); }catch(e){} return; }
  try{
    pipWindow = await documentPictureInPicture.requestWindow({width:300, height:360});
  }catch(e){
    if(!auto) toast("Mini-Player konnte nicht geöffnet werden: "+e.message, "warn");
    // Im Auto-Modus (beim Minimieren) still fehlschlagen: der Browser blockiert das Öffnen
    // ohne frischen Klick kurz zuvor — kein Fehler der App, daher kein Toast, den man eh
    // erst nach dem Zurückkehren sähe.
    return;
  }
  const styleEl = pipWindow.document.createElement("style");
  styleEl.textContent = `
    :root{ --ink:#22262b; --ink-soft:#565f68; --paper:#f6f4ee; --line:#d8d3c4;
      --moss:#3f6b52; --rust:#a8442c; --amber:#b8791f;
      --mono: ui-monospace,"SFMono-Regular","JetBrains Mono",Consolas,"Courier New",monospace;
      --sans: -apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; }
    *{box-sizing:border-box;}
    body{margin:0; font-family:var(--sans); background:var(--paper); color:var(--ink); padding:10px 12px; font-size:12.5px;}
    .pp-head{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;}
    .pp-head .t{font-weight:700; font-size:13px;}
    .pp-head .clock{font-family:var(--mono); color:var(--ink-soft); font-size:12px;}
    .pp-stat{display:flex; gap:8px; margin-bottom:10px; font-family:var(--mono);}
    .pp-stat div{flex:1; min-width:0;}
    .pp-stat .l{font-size:9.5px; color:var(--ink-soft); font-family:var(--sans); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
    .pp-stat .v{font-size:14px; font-weight:600;}
    .pp-stat .v.pos{color:var(--moss);} .pp-stat .v.neg{color:var(--rust);} .pp-stat .v.warnclose{color:var(--amber);}
    .pp-btns{display:grid; grid-template-columns:1fr 1fr; gap:6px;}
    button{font-family:var(--sans); font-size:12px; padding:7px 6px; border-radius:3px; border:1px solid var(--ink);
      background:var(--ink); color:#fff; cursor:pointer;}
    button.secondary{background:#fff; color:var(--ink); border:1px solid var(--line);}
    button:disabled{opacity:.4; cursor:default;}
    #ppPauseToggle{width:100%; margin-top:6px; font-size:11px; padding:5px 6px;}
    .pp-alert{display:none; margin-top:8px; padding:7px 9px; border-radius:3px; font-size:11.5px; font-weight:700; cursor:pointer;}
    .pp-alert.show{display:block; animation:pp-pulse 1s ease-in-out infinite;}
    .pp-alert.warn{background:#fdf2df; color:#7a5311; border:1px solid var(--amber);}
    .pp-alert.danger{background:#fbe6e1; color:#7a2415; border:1px solid var(--rust);}
    @keyframes pp-pulse{0%,100%{opacity:1;} 50%{opacity:.5;}}
    body.pp-flash, body.pp-flash *{ transition:none !important; }
    body.pp-flash{ animation:pp-boxflash .45s steps(1,end) infinite; cursor:pointer; }
    body.pp-flash.danger{ animation-name:pp-boxflash-danger; }
    @keyframes pp-boxflash{ 0%,49.9%{background:#f5a623; color:#fff;} 50%,100%{background:#ffffff; color:var(--ink);} }
    @keyframes pp-boxflash-danger{ 0%,49.9%{background:#c0392b; color:#fff;} 50%,100%{background:#ffffff; color:var(--ink);} }
    .pp-projLabel{font-size:10px; color:var(--ink-soft); margin:10px 0 4px; text-transform:uppercase; letter-spacing:.3px;}
    .pp-projects{display:flex; flex-direction:column; gap:4px; max-height:110px; overflow-y:auto;}
    .pp-proj{
      padding:5px 7px; border-radius:3px; border:1px solid var(--line); background:#fff;
      cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      display:flex; align-items:center; gap:5px;
    }
    .pp-proj:hover{border-color:var(--ink);}
    .pp-proj .dot{width:6px; height:6px; border-radius:50%; background:var(--line); flex:0 0 auto;}
    .pp-proj.active{background:#eef5ee; border-color:var(--moss);}
    .pp-proj.active .dot{background:var(--moss);}
    .pp-proj.pausing{background:#fdf2df; border-color:var(--amber);}
    .pp-proj.pausing .dot{background:var(--amber);}
    .pp-noproj{font-size:11px; color:var(--ink-soft);}
    .pp-hint{font-size:10px; color:var(--ink-soft); margin-top:8px; line-height:1.4;}
  `;
  pipWindow.document.head.appendChild(styleEl);

  const root = pipWindow.document.createElement("div");
  root.innerHTML = `
    <div class="pp-head"><span class="t">Stundenzettel</span><span class="clock" id="ppClock"></span></div>
    <div class="pp-stat">
      <div><div class="l">IST heute</div><div class="v" id="ppIst">–</div></div>
      <div><div class="l">Saldo</div><div class="v" id="ppSaldo">–</div></div>
      <div><div class="l">10h-Grenze</div><div class="v" id="ppTenH">–</div></div>
    </div>
    <div class="pp-btns">
      <button id="ppKommen">Kommt</button>
      <button id="ppGehen" class="secondary">Geht</button>
      <button id="ppFeierabend" class="secondary">Feierabend</button>
    </div>
    <button id="ppPauseToggle" class="secondary" disabled>Pause</button>
    <div class="pp-alert" id="ppAlert"></div>
    <div class="pp-projLabel">Zuletzt bearbeitet — Klick zum Umstempeln</div>
    <div class="pp-projects" id="ppProjects"></div>
    <div class="pp-hint" id="ppHint"></div>
  `;
  pipWindow.document.body.appendChild(root);

  pipWindow.document.getElementById("ppKommen").addEventListener("click", doKommen);
  pipWindow.document.getElementById("ppGehen").addEventListener("click", ()=>doGehen(false));
  pipWindow.document.getElementById("ppFeierabend").addEventListener("click", doFeierabend);

  pipWindow.addEventListener("pagehide", ()=>{
    pipWindow = null;
    updateMiniPlayerButtonLabel();
  }, {once:true});

  updateMiniPlayerButtonLabel();
  renderMiniPlayer();
}

function recentTasksList(n){
  const lastActivity = t=>{
    let best = t.id; // Fallback: neuer angelegt = weiter oben, falls nie gestempelt
    if(t.activeSince) best = Math.max(best, new Date(t.activeSince).getTime());
    for(const l of state.log){
      if(l.taskId===t.id){ const st=new Date(l.stop).getTime(); if(st>best) best=st; }
    }
    return best;
  };
  return state.tasks
    .filter(t=>t.status!=="fertig")
    .slice()
    .sort((a,b)=>lastActivity(b)-lastActivity(a))
    .slice(0, n);
}

function doQuickSwitchTask(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  const active = state.tasks.find(x=>x.status==="in Arbeit");
  if(active && active.id===id) return; // schon aktiv, nichts zu tun
  const label = (t.orderNr||"(ohne Nr.)") + (t.aenderung ? " – "+t.aenderung : "");
  const dlg = pipWindow || window;
  if(!dlg.confirm("Wirklich auf „"+label+"“ umstempeln?")) return;
  taskStart(id);
  markDirty(); renderHeute(); renderMiniPlayer(); renderHeuteAuftrag();
  if(currentView==="auftraege") renderAuftraege();
}

function showMiniPlayerAlert(msg, kind){
  if(!pipWindow) return;
  const el = pipWindow.document.getElementById("ppAlert");
  if(!el) return;
  el.textContent = msg;
  el.className = "pp-alert show "+(kind||"warn");
  el.onclick = ()=>{ el.classList.remove("show"); };
}

/* ---------------- Große, kaum zu übersehende Warnung (Pause/10h) ---------------- */
function flashMiniPlayerBox(kind, durationMs){
  if(!pipWindow) return;
  const body = pipWindow.document.body;
  if(!body) return;
  body.classList.remove("danger");
  if(kind==="danger") body.classList.add("danger");
  body.classList.add("pp-flash");
  clearTimeout(pipWindow.__flashTimer);
  const stop = ()=>{ body.classList.remove("pp-flash","danger"); body.onclick=null; };
  body.onclick = stop; // Klick irgendwo im Mini-Player beendet das Blitzen sofort
  pipWindow.__flashTimer = setTimeout(stop, durationMs||8000);
}

let alertAudioCtx = null;
function playAlertSound(){
  try{
    alertAudioCtx = alertAudioCtx || new (window.AudioContext||window.webkitAudioContext)();
    if(alertAudioCtx.state==="suspended") alertAudioCtx.resume();
    const beep = (freq, delay)=>setTimeout(()=>{
      const o=alertAudioCtx.createOscillator(), g=alertAudioCtx.createGain();
      o.type="sine"; o.frequency.value=freq;
      g.gain.setValueAtTime(0.0001, alertAudioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, alertAudioCtx.currentTime+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, alertAudioCtx.currentTime+0.35);
      o.connect(g); g.connect(alertAudioCtx.destination);
      o.start(); o.stop(alertAudioCtx.currentTime+0.4);
    }, delay);
    beep(880,0); beep(1046,220);
  }catch(e){
    // Manche Browser blockieren Ton ohne frische Nutzerinteraktion (Autoplay-Regel) — dann bleibt es stumm.
  }
}

let titleFlashTimer=null;
const ORIGINAL_TITLE = document.title;
function flashPageTitle(msg, durationMs){
  if(titleFlashTimer) clearInterval(titleFlashTimer);
  let toggle=false;
  titleFlashTimer = setInterval(()=>{ document.title = toggle?ORIGINAL_TITLE:msg; toggle=!toggle; }, 900);
  setTimeout(()=>{ clearInterval(titleFlashTimer); titleFlashTimer=null; document.title=ORIGINAL_TITLE; }, durationMs||15000);
}

function notificationsSupported(){ return typeof Notification!=="undefined"; }
function ensureNotificationPermission(){
  if(!notificationsSupported()) return;
  if(Notification.permission==="default") Notification.requestPermission();
}
function sendBrowserNotification(title, body){
  if(!notificationsSupported()) return;
  // Bei file:// meldet Chrome oft „default“, obwohl in der Adressleiste „Zugelassen“ steht – dann trotzdem versuchen.
  if(Notification.permission==="denied" || (Notification.permission!=="granted" && location.protocol!=="file:")) return;
  try{ new Notification(title, {body, tag:"stundenzettel-alert", renotify:true}); }catch(e){}
}

function fireBigAlert(msg, kind){
  toast(msg, "warn");
  showMiniPlayerAlert(msg, kind);
  flashMiniPlayerBox(kind, 8000);
  playAlertSound();
  flashPageTitle(kind==="danger" ? "⚠️ 10h-Grenze!" : "☕ Pause!", 15000);
  sendBrowserNotification(kind==="danger" ? "Stundenzettel — 10-Stunden-Grenze" : "Stundenzettel — Pausenerinnerung", msg);
}

function renderMiniPlayer(){
  if(!pipWindow) return;
  const doc = pipWindow.document;
  const k = todayKey();
  const c = calcDay(k);
  const d = ensureDay(k);
  const openBal = yearBalanceSeries().find(p=>p.date===k)?.bal;
  const setText = (id,val)=>{ const el=doc.getElementById(id); if(el) el.textContent=val; };
  setText("ppClock", new Date().toLocaleTimeString("de-DE"));
  setText("ppIst", c.ist==null?"–":hoursToHM(c.ist));
  const saldoEl = doc.getElementById("ppSaldo");
  if(saldoEl){ saldoEl.textContent = hoursToHM(openBal); saldoEl.className = "v "+(openBal>=0?"pos":"neg"); }
  const tLimit = tenHourLimitTime();
  const tenHEl = doc.getElementById("ppTenH");
  if(tenHEl){
    tenHEl.textContent = tLimit || "–";
    let cls = "v";
    if(tLimit){
      const nowStr = nowTimeStr();
      if(nowStr>=tLimit) cls += " neg";
      else if(timeToMin(tLimit)-timeToMin(nowStr) <= 30) cls += " warnclose";
    }
    tenHEl.className = cls;
  }
  const kBtn = doc.getElementById("ppKommen"); if(kBtn) kBtn.disabled = isDayOpen(d);
  const gBtn = doc.getElementById("ppGehen"); if(gBtn) gBtn.disabled = !isDayOpen(d);
  const fBtn = doc.getElementById("ppFeierabend"); if(fBtn) fBtn.disabled = !isDayOpen(d);

  const active = state.tasks.find(t=>t.status==="in Arbeit");
  const pausing = state.tasks.find(t=>t.status==="Pause");
  const pauseBtn = doc.getElementById("ppPauseToggle");
  if(pauseBtn){
    if(active){ pauseBtn.textContent="⏸ Pause ("+(active.orderNr||"ohne Nr.")+")"; pauseBtn.disabled=false; pauseBtn.onclick=doPauseStart; }
    else if(pausing){ pauseBtn.textContent="▶ Weiter ("+(pausing.orderNr||"ohne Nr.")+")"; pauseBtn.disabled=false; pauseBtn.onclick=doPauseStop; }
    else { pauseBtn.textContent="Pause"; pauseBtn.disabled=true; pauseBtn.onclick=null; }
  }

  const projBox = doc.getElementById("ppProjects");
  if(projBox){
    const list = recentTasksList(5);
    if(!list.length){
      projBox.innerHTML = '<div class="pp-noproj">Keine Aufträge angelegt.</div>';
    } else {
      projBox.innerHTML = list.map(t=>{
        const label = (t.orderNr||"(ohne Nr.)") + (t.aenderung ? " – "+t.aenderung : "");
        const cls = t.status==="in Arbeit" ? "active" : (t.status==="Pause" ? "pausing" : "");
        return `<div class="pp-proj ${cls}" data-id="${t.id}">`
             + `<span class="dot"></span><span>${escapeHtml(label)}</span></div>`;
      }).join("");
      projBox.querySelectorAll(".pp-proj").forEach(el=>{
        el.addEventListener("click", ()=>doQuickSwitchTask(Number(el.dataset.id)));
      });
    }
  }

  const stCount = (d.stamps||[]).length;
  setText("ppHint", stCount===0 ? "Noch nicht gestempelt." : (isDayOpen(d) ? "Aktuell gestempelt (Kommt: "+d.stamps[stCount-1]+")." : stCount+" Zeiten heute erfasst."));
}

function updateMiniPlayerButtonLabel(){
  const btn = document.getElementById("btnMiniPlayer");
  if(!btn) return;
  btn.textContent = pipWindow ? "🗗 Mini-Player im Vordergrund" : "🗗 Mini-Player öffnen";
}

document.getElementById("btnMiniPlayer").addEventListener("click", ()=>openMiniPlayer(false));
setInterval(renderMiniPlayer, 15000);

document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden" && state?.settings?.miniPlayerAutoOpen){
    openMiniPlayer(true);
  }
});

function codeSelectHtml(dayKey, current){
  let html = `<select data-day="${dayKey}" data-f="code"><option value=""></option>`;
  for(const c of state.settings.absenceCodes){
    html += `<option value="${c.code}" ${c.code===current?"selected":""}>${c.code} – ${c.label}</option>`;
  }
  html += "</select>";
  return html;
}

function renderHeuteAuftrag(){
  const box = document.getElementById("heuteAuftrag");
  const active = state.tasks.find(t=>t.status==="in Arbeit");
  const pausing = state.tasks.find(t=>t.status==="Pause");
  const stoerToday = state.log.filter(l=>l.art==="stoerung" && localDateKeyFromIso(l.start)===todayKey()).reduce((sum,l)=>sum+StundenzettelTaskManagement.durationMinutes(l),0);
  const stoerHint = stoerToday ? ` <span class="hint">· Störzeit heute: ${minToTime(stoerToday)}</span>` : "";
  if(active){
    box.innerHTML = `<span class="badge ${active.kind==="stoerung"?"stoer":"on"}">${active.kind==="stoerung"?"Störung":"in Arbeit"}</span> <strong>${escapeHtml(active.orderNr||"(ohne Nr.)")}</strong> — ${escapeHtml(active.aenderung||"")}${stoerHint}`;
  } else if(pausing){
    box.innerHTML = `<span class="badge pause">pausiert</span> <strong>${escapeHtml(pausing.orderNr||"(ohne Nr.)")}</strong> — ${escapeHtml(pausing.aenderung||"")}${stoerHint}`;
  } else {
    box.innerHTML = `<span class="hint">Kein Auftrag aktiv. Im Reiter „Aufträge“ einen starten.</span>${stoerHint}`;
  }
}

/* ---------------- Zeitverteilung: Aufträge vs. Störungsarten ---------------- */
function timeDistribution(monthIdx){ // monthIdx: 0-11 oder null = ganzes Jahr
  const res={auftrag:0, stoer:{}, total:0};
  (state.log||[]).forEach(l=>{
    const d=new Date(l.start); if(Number.isNaN(d.getTime())) return;
    if(d.getFullYear()!==state.settings.year) return;
    if(monthIdx!=null && d.getMonth()!==monthIdx) return;
    const min=StundenzettelTaskManagement.durationMinutes(l);
    if(l.art==="stoerung"){ const name=l.orderNr||"Störung"; res.stoer[name]=(res.stoer[name]||0)+min; }
    else res.auftrag+=min;
    res.total+=min;
  });
  return res;
}
const fmtMin = m => minToTime(m);
function renderZeitverteilung(monthIdx, istHours){
  const box=document.getElementById("zeitverteilungMonat"); if(!box) return;
  const dist=timeDistribution(monthIdx);
  const ist=Math.round((istHours||0)*60);
  const pct=m=>ist>0?Math.round(m/ist*100)+" %":"–";
  const rows=Object.entries(dist.stoer).sort((x,y)=>y[1]-x[1]);
  const stoerSum=rows.reduce((s,[,m])=>s+m,0);
  const unassigned=Math.max(0,ist-dist.total);
  box.innerHTML=`<h2>Zeitverteilung <small>Anteil an der IST-Zeit des Monats</small></h2>
    <table class="compact-kv"><tbody>
      <tr><td class="lbl">Aufträge</td><td class="val">${fmtMin(dist.auftrag)}</td><td class="val">${pct(dist.auftrag)}</td></tr>
      <tr><td class="lbl">⚡ Störungen gesamt</td><td class="val">${fmtMin(stoerSum)}</td><td class="val">${pct(stoerSum)}</td></tr>
      ${rows.map(([n,m])=>`<tr><td class="lbl" style="padding-left:22px;font-weight:400;">${escapeHtml(n)}</td><td class="val">${fmtMin(m)}</td><td class="val">${pct(m)}</td></tr>`).join("")}
      <tr><td class="lbl">Nicht zugeordnet</td><td class="val">${fmtMin(unassigned)}</td><td class="val">${pct(unassigned)}</td></tr>
      <tr><td class="lbl">IST laut Stempeluhr</td><td class="val">${fmtMin(ist)}</td><td class="val"></td></tr>
    </tbody></table>`;
}
function renderZeitverteilungJahr(){
  const box=document.getElementById("zeitverteilungJahr"); if(!box) return;
  const perMonth=[...Array(12)].map((_,m)=>timeDistribution(m));
  const names=[...new Set(perMonth.flatMap(d=>Object.keys(d.stoer)))].sort();
  const cell=m=>m?fmtMin(m):"–";
  const rowOf=(label,get,bold)=>{ const vals=perMonth.map(get); const sum=vals.reduce((s,v)=>s+v,0); return `<tr><td class="lbl"${bold?"":' style="font-weight:400;"'}>${label}</td>${vals.map(v=>`<td class="val">${cell(v)}</td>`).join("")}<td class="val"><strong>${cell(sum)}</strong></td></tr>`; };
  box.innerHTML=`<h2>Zeitverteilung Aufträge / Störungen</h2><div class="tablewrap"><table class="compact-kv"><thead><tr><th></th>${MONTH_NAMES.map(m=>`<th>${m.slice(0,3)}</th>`).join("")}<th>Summe</th></tr></thead><tbody>
    ${rowOf("Aufträge",d=>d.auftrag,true)}
    ${rowOf("⚡ Störungen gesamt",d=>Object.values(d.stoer).reduce((s,v)=>s+v,0),true)}
    ${names.map(n=>rowOf(escapeHtml(n),d=>d.stoer[n]||0,false)).join("")}
  </tbody></table></div>`;
}

/* ---------------- MONAT ---------------- */
function fillMonatSelect(){
  const box=document.getElementById("monatTabs");
  box.innerHTML = MONTH_NAMES.map((m,i)=>
    `<div class="sheet-tab${i===currentMonthIdx?" active":""}" data-idx="${i}">${m.slice(0,3)}</div>`
  ).join("");
  box.querySelectorAll(".sheet-tab").forEach(t=>{
    t.addEventListener("click", ()=>{ currentMonthIdx=Number(t.dataset.idx); renderMonat(); });
  });
}
let expandedTimesDays = new Set();
function buildTimesCellHTML(k, day){
  const stamps = day.stamps || [];
  const autoIdx = day.autoIdx || [];
  const p1k = stamps[0]||"", p1g = stamps[1]||"";
  const rest = stamps.slice(2);
  const expanded = expandedTimesDays.has(k);
  const open = stamps.length % 2 === 1;
  const ac = i => autoIdx.includes(i) ? "auto-pending" : "";
  let html = `<div class="times-wrap" data-day="${k}">`
    + `<div class="time-row">`
    + `<input type="time" lang="de-DE" class="time-stamp ${ac(0)}" data-day="${k}" data-idx="0" value="${p1k}">`
    + `<input type="time" lang="de-DE" class="time-stamp ${ac(1)}" data-day="${k}" data-idx="1" value="${p1g}">`;
  if(rest.length){
    html += `<span class="time-toggle" data-day="${k}">${expanded?"▾ weniger":"▸ +"+rest.length}</span>`;
  }
  if(!rest.length || expanded){
    html += `<button type="button" class="time-add" data-day="${k}"${open?" disabled title=\"Bitte zuerst Geht eintragen\"":""}>+ Zeit</button>`;
  }
  html += `</div>`;
  if(expanded && rest.length){
    html += rest.map((t,i)=>{
      const idx = i+2;
      return `<div class="time-line"><input type="time" lang="de-DE" class="time-stamp ${ac(idx)}" data-day="${k}" data-idx="${idx}" value="${t||""}">`
        + `<button type="button" class="time-del" data-day="${k}" data-idx="${idx}" title="Löschen">✕</button></div>`;
    }).join("");
  }
  html += `</div>`;
  return html;
}

function applyAutoGehtPrediction(){
  // Empfehlungen bleiben sichtbar; V3 schreibt beim Rendern niemals eigenständig einen Stempelvorschlag.
  return;
  const k = todayKey();
  const d = ensureDay(k);
  const stamps = d.stamps;
  const autoIdx = d.autoIdx || [];
  let targetIdx;
  if(isDayOpen(d)){
    targetIdx = stamps.length; // noch keine Geht-Zeit -> neuer Slot
  } else if(stamps.length>0 && autoIdx.includes(stamps.length-1)){
    // Letzte Zeit ist noch ein unbestätigter (roter) Vorschlag -> darf durch neue Code-Wahl ersetzt werden.
    targetIdx = stamps.length-1;
  } else {
    return; // Tag komplett leer (kein Kommt) oder Geht bereits manuell bestätigt -> nichts anfassen
  }
  const monthIdx = new Date().getMonth();
  const gr = computeGehtEmpfehlungen(monthIdx);
  const activeRow = gr.rows.find(x=>x.code===state.settings.gehtEmpfehlung.activeCode);
  const predicted = activeRow && activeRow.time;
  if(!predicted) return; // keine Berechnung möglich (z. B. kein Kommt)
  const nowStr = nowTimeStr();
  // Code-Zeit noch in der Zukunft -> genau diese Zeit eintragen. Liegt sie schon in der Vergangenheit,
  // wäre sie veraltet -> stattdessen die aktuelle Uhrzeit eintragen, die mit jedem Neuzeichnen mitläuft.
  const displayTime = (timeToMin(predicted) > timeToMin(nowStr)) ? predicted : nowStr;
  if(stamps[targetIdx] === displayTime) return; // unverändert
  if(targetIdx === stamps.length) stamps.push(displayTime); else stamps[targetIdx] = displayTime;
  markAutoStamp(d, targetIdx);
  markDirty();
}

function renderMonat(){
  fillMonatSelect();
  if(currentMonthIdx === new Date().getMonth()) applyAutoGehtPrediction();
  const keys = monthRange(currentMonthIdx);
  const sums = monthSums(currentMonthIdx);

  const thead=document.querySelector("#monatTable thead");
  const tbody=document.querySelector("#monatTable tbody");
  thead.innerHTML = `<tr>
    <th>KW</th><th>Datum</th><th>Tag</th><th>Feiertag</th>
    <th>Kommt/Geht</th>
    <th>Sonst.Pause</th><th>Pause</th><th></th>
    <th>Code</th><th>Bemerkung</th>
    <th>IST</th><th>SOLL</th><th>+/-</th><th>Saldo</th>
  </tr>`;
  tbody.innerHTML="";
  let running = monthOpeningBalance(currentMonthIdx);
  const tk = todayKey();
  for(const k of keys){
    const c = calcDay(k);
    running = round2(running + c.diff);
    const wk = jsWeekdayKey(c.dateObj);
    const tr=document.createElement("tr");
    let cls=[];
    if(wk==="sa") cls.push("saturday");
    else if(wk==="so") cls.push("sunday");
    if(c.holiday) cls.push("holiday");
    if(k===tk) cls.push("today");
    tr.className = cls.join(" ");
    const dayCode = state.days[k]?.code;
    const codeCol = dayCode ? codeColor(dayCode) : null;
    if(codeCol) tr.style.setProperty("--row-bg", codeCol);
    const stamps = state.days[k]?.stamps || [];
    const timesHtml = buildTimesCellHTML(k, ensureDay(k));
    tr.innerHTML = `
      <td class="num">${isoWeekNumber(c.dateObj)}</td>
      <td class="num">${pad2(c.dateObj.getDate())}.${pad2(c.dateObj.getMonth()+1)}.</td>
      <td>${WEEKDAY_LABELS[wk].slice(0,2)}</td>
      <td>${c.holiday?escapeHtml(c.holiday.label):""}</td>
      <td>${timesHtml}</td>
      <td><input data-day="${k}" data-f="pause" placeholder="Min." value="${state.days[k]?.pause||""}" style="width:56px;"></td>
      <td class="num">${minToTime(c.pauseMin)}</td>
      <td class="warnflag">${c.warn}</td>
      <td>${codeSelectHtml(k, state.days[k]?.code||"")}</td>
      <td><input class="wide" data-day="${k}" data-f="bemerkung" value="${String(state.days[k]?.bemerkung||"").replace(/"/g,'&quot;')}"></td>
      <td class="num">${c.ist==null?"":hoursToHM(c.ist)}</td>
      <td class="num">${hoursToHM(c.soll)}</td>
      <td class="num">${hoursToHM(c.diff)}</td>
      <td class="num">${hoursToHM(running)}</td>
    `;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("input[data-f],select[data-f]").forEach(el=>{
    el.addEventListener("change",(e)=>{
      const dk=e.target.dataset.day, f=e.target.dataset.f, v=e.target.value;
      const day=ensureDay(dk);
      if(f==="code" && (v==="U"||v==="UH")){
        // Mehr Urlaub als verfügbar kann nicht eingetragen werden.
        const prev=day.code, before=vacationInfo().balance;
        day.code=v; const after=vacationInfo().balance;
        if(after<0 && after<before){
          day.code=prev;
          toast(`Nicht eingetragen: Für ${fmtDateDE(dk)} ist kein Urlaub mehr verfügbar (Rest ${Math.max(0,before)} Tage).`,"warn");
          renderMonat(); return;
        }
      } else day[f]=v;
      markDirty(); renderMonat();
    });
  });
  tbody.querySelectorAll(".time-stamp").forEach(el=>{
    el.addEventListener("blur",(e)=>{
      const dk=e.target.dataset.day, idx=Number(e.target.dataset.idx);
      const d=ensureDay(dk);
      const st=d.stamps;
      while(st.length<=idx) st.push("");
      const val=e.target.value;
      const wasAuto = (d.autoIdx||[]).includes(idx);
      clearAutoStamp(d, idx);
      if(val===""){
        if(idx!==st.length-1){ st.splice(idx,1); reindexAutoAfterSplice(d, idx); }
        else { st[idx]=""; }
      } else {
        if(st[idx]===val && !wasAuto) return;
        st[idx]=val;
      }
      markDirty(); renderMonat(); renderMiniPlayer();
    });
  });
  tbody.querySelectorAll(".time-del").forEach(el=>{
    el.addEventListener("click",(e)=>{
      const dk=e.target.dataset.day, idx=Number(e.target.dataset.idx);
      const d=ensureDay(dk);
      d.stamps.splice(idx,1);
      reindexAutoAfterSplice(d, idx);
      markDirty(); renderMonat(); renderMiniPlayer();
    });
  });
  tbody.querySelectorAll(".time-add").forEach(el=>{
    el.addEventListener("click",(e)=>{
      const dk=e.target.dataset.day;
      const d=ensureDay(dk);
      if(isDayOpen(d)){ toast("Bitte zuerst die offene Geht-Zeit an diesem Tag eintragen oder löschen, bevor eine neue Zeit hinzugefügt wird.", "warn"); return; }
      d.stamps.push("");
      markDirty(); renderMonat();
    });
  });
  tbody.querySelectorAll(".time-toggle").forEach(el=>{
    el.addEventListener("click",(e)=>{
      const dk=e.target.dataset.day;
      if(expandedTimesDays.has(dk)) expandedTimesDays.delete(dk); else expandedTimesDays.add(dk);
      renderMonat();
    });
  });

  renderCodeLegend();
  drawMonthChart(currentMonthIdx);
  renderMonatKennzahlen(currentMonthIdx, sums);
  renderGehtPanel(currentMonthIdx);
  if(window.StundenzettelExcelViews){
    renderZeitverteilung(currentMonthIdx, sums.ist);
    StundenzettelExcelViews.renderMonth({state, ensureMonthAdjust, markDirty, renderMonth: renderMonat, toast}, currentMonthIdx+1, sums, monthOpeningBalance(currentMonthIdx));
  }
}

function codeColor(code){
  const ci = codeInfo(code);
  return ci && ci.color ? ci.color : null;
}

function renderCodeLegend(){
  const box = document.getElementById("monatLegend");
  if(!box) return;
  const items = state.settings.absenceCodes.map(c=>
    `<span class="chip"><span class="swatch" style="background:${c.color||'#fff'}"></span>${escapeHtml(c.code)} – ${escapeHtml(c.label)}</span>`
  );
  items.push(`<span class="chip"><span class="swatch" style="background:#FFD250"></span>Samstag</span>`);
  items.push(`<span class="chip"><span class="swatch" style="background:#FFC000"></span>Sonntag</span>`);
  items.push(`<span class="chip"><span class="swatch" style="background:#e0b988"></span>Feiertag</span>`);
  box.innerHTML = items.join("");
}

function countCode(monthIdx, code){
  return monthRange(monthIdx).filter(k=>state.days[k]?.code===code).length;
}
function renderMonatKennzahlen(monthIdx, sums){
  const monthNum = monthIdx+1;
  const adj = ensureMonthAdjust(monthNum);
  const krank = countCode(monthIdx,"K");
  const urlaub = countCode(monthIdx,"U") + countCode(monthIdx,"UH")*0.5;
  const glzTage = countCode(monthIdx,"GLZ");
  const anwesenheit = monthRange(monthIdx).filter(k=>calcDay(k).ist!=null).length;
  const vac = vacationUsed();
  const vacAvail = vacationInfo().avail;
  const weekBal = isCurrentRealMonth(monthIdx) ? weekBalanceUpTo(new Date()) : null;
  const kaTarget = kaTargetForMonth(monthIdx);

  const tbl = document.getElementById("monatKennzahlenTable");
  const kv=(label,value)=>`<div class="kv-row"><span>${label}</span><span class="v">${value}</span></div>`;
  const kvIn=(label,id,value,unit)=>`<div class="kv-row"><label for="${id}">${label}</label><span class="v"><input type="number" step="0.1" id="${id}" value="${value}"> ${unit}</span></div>`;
  tbl.innerHTML =
    `<div class="kv-card"><h3>Anwesenheit &amp; Abwesenheit</h3>
      ${kv("Anwesenheitstage", anwesenheit)}
      ${kv("Krank (K)", krank+" Tage")}
      ${kv("Urlaub in diesem Monat", urlaub+" Tage")}
      ${kv("Urlaub noch verfügbar", vacAvail+" Tage")}
      ${kv("GLZ-Tage genommen", glzTage)}
      ${kv("GLZ-Tage noch verfügbar", glzTageVerfuegbar())}
    </div>
    <div class="kv-card"><h3>Wochensaldo &amp; Ziele</h3>
      ${kv("Saldo aktuelle Woche", weekBal==null?"nur im laufenden Monat":hoursToHM(weekBal))}
      ${kvIn("Wochenziel","mWochenziel",adj.wochenziel||0,"h")}
      ${kvIn("Monatsziel","mMonatsziel",adj.monatsziel||0,"h")}
      ${kvIn("Kurzarbeit: Zielstand (niedrigster Stand der letzten 12 Monate)","mKaTarget",kaTarget,"h")}
    </div>`;

  document.getElementById("mWochenziel").onchange=(e)=>{ ensureMonthAdjust(monthNum).wochenziel=Number(e.target.value)||0; markDirty(); renderMonat(); };
  document.getElementById("mMonatsziel").onchange=(e)=>{ ensureMonthAdjust(monthNum).monatsziel=Number(e.target.value)||0; markDirty(); renderMonat(); };
  document.getElementById("mKaTarget").onchange=(e)=>{ ensureMonthAdjust(monthNum).kaTarget=Number(e.target.value)||0; markDirty(); renderMonat(); };
}

function applyWishGehtTime(wish){
  const k=todayKey(), d=ensureDay(k);
  if(!wish || !isDayOpen(d)){ toast("Wunsch-Geht-Zeit benötigt einen offenen Kommt-Stempel für heute.", "warn"); return false; }
  const now=nowTimeStr();
  const effective=timeToMin(wish) > timeToMin(now) ? wish : now;
  d.stamps.push(effective);
  clearAutoStamp(d, d.stamps.length-1);
  markDirty(); renderHeute(); renderMiniPlayer();
  toast("Geht eingetragen: "+effective+(effective===now && wish!==now ? " (Wunschzeit lag bereits in der Vergangenheit)" : ""));
  return true;
}
function renderGehtPanel(monthIdx){
  const sub = document.getElementById("gehtPanelSub");
  const isNow = isCurrentRealMonth(monthIdx);
  sub.textContent = isNow ? "(bezieht sich immer auf das heutige Datum)" : "— nur im aktuell laufenden Monat berechenbar, dieser Monat ist nicht der aktuelle";
  const tbody = document.querySelector("#gehtTable tbody");
  const activeBox = document.getElementById("gehtActive");
  tbody.innerHTML=""; activeBox.innerHTML="";
  const g = state.settings.gehtEmpfehlung;

  if(!isNow){
    tbody.innerHTML = `<tr><td colspan="3" class="hint" style="padding:10px;">Zeig den aktuellen Monat, um die Geht-Empfehlung für heute zu sehen.</td></tr>`;
  } else {
    const r = computeGehtEmpfehlungen(monthIdx);
    if(!r.kommt){
      activeBox.innerHTML = `<span class="hint">Noch kein „Kommt“ für heute eingetragen — Geht-Empfehlung erst danach berechenbar.</span>`;
    } else {
      const active = r.rows.find(x=>x.code===g.activeCode);
      activeBox.innerHTML = `<span class="badge on" style="font-size:13px; padding:4px 10px;">Aktiv: ${g.activeCode}</span>
        <strong style="font-family:var(--mono); font-size:18px; margin-left:8px;">${active?.time || "–"}</strong>
        <span class="hint" style="margin-left:8px;">${active?.label||""}</span>
        <select id="gActiveCode" style="width:auto; display:inline-block; margin-left:14px;">
          ${r.rows.map(x=>`<option value="${x.code}" ${x.code===g.activeCode?"selected":""}>${x.code}</option>`).join("")}
        </select>`;
      document.getElementById("gActiveCode").onchange=(e)=>{ g.activeCode=e.target.value; markDirty(); renderMonat(); };
    }
    r.rows.forEach(row=>{
      const tr=document.createElement("tr");
      if(row.code===g.activeCode) tr.style.background="#fdf2df";
      tr.innerHTML = `<td class="num">${row.code}</td><td>${escapeHtml(row.label)}</td><td class="num">${row.time||"–"}</td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("gFreeMoDo").value = g.freeGoalMoDo;
  document.getElementById("gFreeFr").value = g.freeGoalFr;
  document.getElementById("gFriAdjust").value = g.friAdjustWeek;
  const wishEl=document.getElementById("gWunschGeht");
  wishEl.value=g.wunschGeht||"";
  wishEl.disabled=!isNow;
  document.getElementById("gFreeMoDo").onchange=(e)=>{ g.freeGoalMoDo=Number(e.target.value)||0; markDirty(); renderGehtPanel(monthIdx); };
  document.getElementById("gFreeFr").onchange=(e)=>{ g.freeGoalFr=Number(e.target.value)||0; markDirty(); renderGehtPanel(monthIdx); };
  document.getElementById("gFriAdjust").onchange=(e)=>{ g.friAdjustWeek=Number(e.target.value)||0; g.friAdjustWZ=g.friAdjustWeek; markDirty(); renderGehtPanel(monthIdx); };
  wishEl.onchange=(e)=>{
    g.wunschGeht=e.target.value;
    if(applyWishGehtTime(g.wunschGeht)) renderMonat(); else markDirty();
  };
}

/* ---------------- JAHR: Kalenderraster ---------------- */
function renderJahrKalender(){
  const thead=document.querySelector("#jahrKalender thead");
  const tbody=document.querySelector("#jahrKalender tbody");
  thead.innerHTML = `<tr><th>Tag</th>${MONTH_NAMES.map(m=>`<th>${m.slice(0,3)}</th>`).join("")}</tr>`;
  tbody.innerHTML="";
  const tk = todayKey();
  for(let day=1; day<=31; day++){
    const tr=document.createElement("tr");
    let rowHtml = `<td class="num">${day}</td>`;
    for(let m=0;m<12;m++){
      const dateObj = new Date(state.settings.year, m, day);
      if(dateObj.getMonth()!==m){ rowHtml += `<td class="cal"></td>`; continue; }
      const k = dateKey(dateObj);
      const c = calcDay(k);
      const wk = jsWeekdayKey(dateObj);
      const wkLabel = WEEKDAY_LABELS[wk].slice(0,2);
      let cls = "cal ";
      let val = "";
      let bg = null;
      if(k===tk) cls += "cal-today ";
      if(state.days[k]?.code){
        val = state.days[k].code;
        bg = codeColor(state.days[k].code);
      } else if(c.holiday){
        val = "F";
        bg = codeColor("F");
      } else if(c.ist!=null){
        cls += "cal-work ";
        val = (c.diff>0?"+":"")+c.diff.toFixed(2).replace(".",",");
      } else if(wk==="sa"){
        bg = "#FFD250";
      } else if(wk==="so"){
        bg = "#FFC000";
      } else {
        cls += "cal-empty ";
        val = "·";
      }
      const title = `${fmtDateDE(k)}${c.holiday?" · "+c.holiday.label:""}${c.ist!=null?" · IST "+hoursToHM(c.ist)+" +/- "+hoursToHM(c.diff):""}`;
      const styleAttr = bg ? ` style="background:${bg};"` : "";
      rowHtml += `<td class="${cls}"${styleAttr} title="${escapeHtml(title)}"><div class="cal-wk">${wkLabel}</div><div class="cal-val">${val}</div></td>`;
    }
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  }
  document.getElementById("jahrLegende").textContent =
    "Zahl = Tages-Saldo (+/-) · · leer/offen · F Feiertag · K Krank · U Urlaub · UH Urlaub ½ Tag · GLZ Gleitzeitausgleich · VU Vorab-Urlaub · KA Kurzarbeit · T T-Zug";
}

/* ---------------- JAHR ---------------- */
let viewingArchiveYear = null;
function allYears(){
  return [...new Set([state.settings.year, ...Object.keys(state.archive||{}).map(Number)])].sort((x,y)=>x-y);
}
function settingsOf(year){ return year===state.settings.year ? state.settings : state.archive[year].settings; }
function withYear(year, fn){
  if(year===state.settings.year) return fn();
  const view=buildArchiveViewState(year); if(!view) return undefined;
  const real=state; state=view;
  try{ return fn(); } finally { state=real; }
}
/* Saldo und Resturlaub eines Jahres werden live aus dem Vorjahr berechnet – außer der Nutzer hat den Übertrag fest eingetragen. */
function recomputeCarryovers(){
  const ys=allYears();
  for(let i=1;i<ys.length;i++){
    const y=ys[i], prev=ys[i-1]; if(prev!==y-1) continue;
    const st=settingsOf(y);
    const pc=withYear(prev, ()=>({closing:monthClosingBalance(11), vac:vacationInfo().yearEnd}));
    if(!pc) continue;
    if(!st.glz.carryOverManual) st.glz.carryOverHours=pc.closing;
    if(!st.vacation.carryOverManual) st.vacation.carryOver=pc.vac;
  }
}
function ensureTodayYear(silent){
  const y=new Date().getFullYear();
  if(state.settings.year!==y && state.archive && state.archive[y]) activateArchivedYear(y, silent);
  if(state.settings.year===y){
    if(state.settings.locked){ toast(`Jahr ${y} ist gesperrt. Zum Stempeln unter Einstellungen → „Jahr sperren“ entsperren.`,"warn"); return false; }
    return true;
  }
  toast(`Jahr ${y} existiert noch nicht. Bitte in der Jahresübersicht „Jahr ${y} hinzufügen“ wählen.`,"warn");
  return false;
}
function buildArchiveViewState(year){
  const a = state.archive && state.archive[year];
  if(!a) return null;
  const def=defaultSettings(Number(year));
  a.settings = Object.assign({}, def, a.settings||{}, {year:Number(year)});
  a.settings.glz = Object.assign({}, def.glz, a.settings.glz||{});
  a.settings.vacation = Object.assign({}, def.vacation, a.settings.vacation||{});
  a.settings.weekly = Object.assign({}, def.weekly, a.settings.weekly||{});
  a.settings.absenceCodes = a.settings.absenceCodes && a.settings.absenceCodes.length ? a.settings.absenceCodes : def.absenceCodes;
  a.settings.gehtEmpfehlung = Object.assign({}, def.gehtEmpfehlung, a.settings.gehtEmpfehlung||{});
  a.settings.rules = mergeRules(a.settings.rules, a.settings.gehtEmpfehlung.kernzeit);
  a.days = a.days || {}; a.holidays = a.holidays || computeHolidays(Number(year)); a.monthAdjust = a.monthAdjust || {};
  // Aufträge, Zeitprotokoll und UI-Zustand gehören zu keinem Jahr – sie werden gemeinsam genutzt.
  return { settings:a.settings, days:a.days, tasks:state.tasks, log:state.log, holidays:a.holidays, monthAdjust:a.monthAdjust, archive:state.archive, ui:state.ui };
}

/* ---------------- Kurzarbeit: niedrigster Gleitzeit-Stand der letzten 12 Monate ---------------- */
function balanceSeriesForYear(year){
  if(year === state.settings.year) return yearBalanceSeries();
  const snap = buildArchiveViewState(year);
  if(!snap) return [];
  const real = state;
  state = snap;
  let result;
  try{ result = yearBalanceSeries(); } finally { state = real; }
  return result;
}
function computeLowest12MoBalance(monthIdx){
  const y = state.settings.year;
  const monthStart = new Date(y, monthIdx, 1);
  const cutoff = new Date(monthStart); cutoff.setMonth(cutoff.getMonth()-12);
  let vals = [];
  const collect = (year)=>{
    balanceSeriesForYear(year).forEach(p=>{
      const d = keyToDate(p.date);
      if(d>=cutoff && d<monthStart) vals.push(p.bal);
    });
  };
  collect(y);
  if(cutoff.getFullYear() < y) collect(y-1);
  if(!vals.length) return 0;
  return round2(Math.min(...vals));
}
function kaTargetForMonth(monthIdx){
  const adj = ensureMonthAdjust(monthIdx+1);
  if(adj.kaTarget != null && adj.kaTarget !== "") return Number(adj.kaTarget);
  // Beim ersten Ansehen dieses Monats einmalig berechnen und fixieren ("Stand bei Monatswechsel zählt") —
  // danach bleibt der Wert stabil und ist manuell überschreibbar.
  const v = computeLowest12MoBalance(monthIdx);
  adj.kaTarget = v;
  markDirty();
  return v;
}
function dayOpeningBalanceToday(){
  const k = todayKey();
  const series = yearBalanceSeries();
  const idx = series.findIndex(p=>p.date===k);
  if(idx<=0) return state.settings.glz.carryOverHours||0;
  return series[idx-1].bal;
}
function renderSettingsYearSwitcher(){
  const sel = document.getElementById("sArchiveYear");
  const liveYear = state.settings.year;
  const archivedYears = Object.keys(state.archive||{}).map(Number).sort((a,b)=>b-a);
  const options = [liveYear, ...archivedYears.filter(y=>y!==liveYear)];
  sel.innerHTML = options.map(y=>`<option value="${y}">${y}${y===new Date().getFullYear()?" (laufendes Jahr)":""}</option>`).join("");
  sel.value = viewingArchiveYear || liveYear;
  const lockCb=document.getElementById("sYearLocked");
  if(lockCb){ lockCb.checked=Boolean(state.settings.locked); lockCb.onchange=()=>{ state.settings.locked=lockCb.checked; markDirty(); renderAll(); toast(lockCb.checked?`Jahr ${state.settings.year} gesperrt.`:`Jahr ${state.settings.year} entsperrt.`); }; }
  if(!sel.dataset.wired){
    sel.dataset.wired="1";
    sel.addEventListener("change",(e)=>{
      activateArchivedYear(Number(e.target.value));
    });
  }
}
function renderJahr(){
  renderSettingsYearSwitcher();
  const banner = document.getElementById("jahrArchiveBanner");
  const wechselPanel = document.getElementById("jahreswechselPanel");
  if(viewingArchiveYear && viewingArchiveYear!==state.settings.year){
    const snap = buildArchiveViewState(viewingArchiveYear);
    if(snap){
      banner.style.display="block";
      banner.textContent = "📁 Archiv-Ansicht (nur Lesen) — Jahr "+viewingArchiveYear+". Zum Bearbeiten oben auf das aktuelle Jahr zurückwechseln.";
      wechselPanel.style.display = "none";
      const real = state;
      state = snap;
      try{ renderJahrBody(); } finally { state = real; }
      return;
    } else {
      viewingArchiveYear = null;
    }
  }
  banner.style.display="none";
  wechselPanel.style.display="";
  renderJahrBody();
}
function renderJahrBody(){
  renderJahrKalender();
  renderZeitverteilungJahr();
  const kpis=document.getElementById("jahrKpis"); kpis.innerHTML="";
  let ist=0,soll=0;
  for(let m=0;m<12;m++){ const s=monthSums(m); ist+=s.ist; soll+=s.soll; }
  const closing = monthClosingBalance(11);
  const vac = vacationUsed();
  const vacAvail = vacationInfo().avail;
  const items=[
    ["IST Jahr", hoursToHM(ist), null],
    ["SOLL Jahr", hoursToHM(soll), null],
    ["Saldo Jahresende", hoursToHM(closing), closing>=0?"pos":"neg"],
    ["Resturlaub", vacAvail+" Tage", vacAvail>=0?"pos":"neg"],
  ];
  for(const [l,v,cls] of items){
    const d=document.createElement("div"); d.className="kpi";
    d.innerHTML=`<div class="l">${l}</div><div class="v ${cls||""}">${v}</div>`;
    kpis.appendChild(d);
  }

  drawYearChart();

  const thead=document.querySelector("#jahrTable thead");
  const tbody=document.querySelector("#jahrTable tbody");
  thead.innerHTML = `<tr><th>Monat</th><th>Übertrag</th><th>IST</th><th>SOLL</th><th>+/-</th><th>Saldo Ende</th>
    <th>Anwesenheit</th><th>U (U)/(UH)</th><th>K (K)</th><th>GLZ (GLZ)</th><th>VU (VU)</th></tr>`;
  tbody.innerHTML="";
  let sumAnwesenheit=0, sumU=0, sumK=0, sumGLZ=0, sumVU=0;
  for(let m=0;m<12;m++){
    const s=monthSums(m);
    const open=monthOpeningBalance(m), close=monthClosingBalance(m);
    const anwesenheit = monthRange(m).filter(k=>calcDay(k).ist!=null).length;
    const uDays = countCode(m,"U") + countCode(m,"UH")*0.5;
    const kDays = countCode(m,"K");
    const glzDays = countCode(m,"GLZ");
    const vuDays = countCode(m,"VU");
    sumAnwesenheit+=anwesenheit; sumU+=uDays; sumK+=kDays; sumGLZ+=glzDays; sumVU+=vuDays;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${MONTH_NAMES[m]}</td><td class="num">${hoursToHM(open)}</td><td class="num">${hoursToHM(s.ist)}</td>
      <td class="num">${hoursToHM(s.soll)}</td><td class="num">${hoursToHM(s.diff)}</td><td class="num">${hoursToHM(close)}</td>
      <td class="num">${anwesenheit}</td><td class="num">${uDays}</td><td class="num">${kDays}</td><td class="num">${glzDays}</td><td class="num">${vuDays}</td>`;
    tbody.appendChild(tr);
  }
  const totIst = [...Array(12)].reduce((a,_,m)=>a+monthSums(m).ist,0);
  const totSoll = [...Array(12)].reduce((a,_,m)=>a+monthSums(m).soll,0);
  const totDiff = [...Array(12)].reduce((a,_,m)=>a+monthSums(m).diff,0);
  const trTotal=document.createElement("tr");
  trTotal.style.fontWeight="600";
  trTotal.style.borderTop="2px solid var(--ink)";
  trTotal.innerHTML=`<td>Jahr</td><td class="num">${hoursToHM(monthOpeningBalance(0))}</td><td class="num">${hoursToHM(round2(totIst))}</td>
    <td class="num">${hoursToHM(round2(totSoll))}</td><td class="num">${hoursToHM(round2(totDiff))}</td><td class="num">${hoursToHM(monthClosingBalance(11))}</td>
    <td class="num">${sumAnwesenheit}</td><td class="num">${round2(sumU)}</td><td class="num">${sumK}</td><td class="num">${sumGLZ}</td><td class="num">${sumVU}</td>`;
  tbody.appendChild(trTotal);
}
function monthBalanceSeries(monthIdx){
  const keys = monthRange(monthIdx);
  let bal = monthOpeningBalance(monthIdx);
  const pts = [];
  for(const k of keys){
    bal = round2(bal + calcDay(k).diff);
    pts.push({date:k, bal});
  }
  return pts;
}
function drawMonthChart(monthIdx){
  const svg=document.getElementById("monatChart");
  if(!svg) return;
  const pts=monthBalanceSeries(monthIdx);
  const W=1600,H=420,padL=60,padR=20,padT=20,padB=34;
  const vals=pts.map(p=>p.bal);
  const rawMin=Math.min(...vals), rawMax=Math.max(...vals);
  const pad = Math.max((rawMax-rawMin)*0.12, 1); // etwas Luft oben/unten, statt starr bei 0 zu beginnen
  const min = rawMin - pad, max = rawMax + pad;
  const range=(max-min)||1;
  const x = i => padL + (W-padL-padR)*(i/(pts.length-1||1));
  const y = v => padT + (H-padT-padB)*(1-(v-min)/range);
  let path="", dots="";
  pts.forEach((p,i)=>{
    const px=x(i).toFixed(1), py=y(p.bal).toFixed(1);
    path += (i===0?"M":"L")+px+","+py+" ";
    dots += `<circle cx="${px}" cy="${py}" r="3.4" fill="#4472c4"><title>${fmtDateDE(p.date)}: ${hoursToHM(p.bal)}</title></circle>`;
  });
  const zeroInRange = min<=0 && 0<=max;
  const zeroLine = zeroInRange ? `<line x1="${padL}" y1="${y(0).toFixed(1)}" x2="${W-padR}" y2="${y(0).toFixed(1)}" stroke="#d8d3c4" stroke-width="1"/>
    <text x="${padL}" y="${(y(0)-6).toFixed(1)}" font-size="13" fill="#565f68" font-family="var(--mono)">0</text>` : "";
  // Tages-Nummern als X-Achsenbeschriftung, wie im Original
  let dayLabels = "";
  pts.forEach((p,i)=>{
    dayLabels += `<text x="${x(i).toFixed(1)}" y="${H-10}" font-size="13" fill="#565f68" text-anchor="middle">${i+1}</text>`;
  });
  svg.innerHTML = `
    ${zeroLine}
    <path d="${path}" fill="none" stroke="#4472c4" stroke-width="2.5"/>
    ${dots}
    ${dayLabels}
    <text x="6" y="${padT+11}" font-size="13" fill="#565f68">${round2(rawMax)}</text>
    <text x="6" y="${H-padB-6}" font-size="13" fill="#565f68">${round2(rawMin)}</text>
  `;
}
function drawYearChart(){
  const svg=document.getElementById("jahrChart");
  const pts=yearBalanceSeries();
  const W=1080,H=290,padL=44,padR=14,padT=14,padB=50;
  const vals=pts.map(p=>p.bal);
  const rawMin=Math.min(...vals), rawMax=Math.max(...vals);
  const pad = Math.max((rawMax-rawMin)*0.12, 1);
  const min = rawMin-pad, max = rawMax+pad;
  const range=(max-min)||1;
  const x = i => padL + (W-padL-padR)*(i/(pts.length-1||1));
  const y = v => padT + (H-padT-padB)*(1-(v-min)/range);
  let path="";
  pts.forEach((p,i)=>{ path += (i===0?"M":"L")+x(i).toFixed(1)+","+y(p.bal).toFixed(1)+" "; });
  const zeroInRange = min<=0 && 0<=max;

  // Monats-Trennlinien + Achsenbeschriftung, wie manuell in der Excel ergänzt
  const yr = state.settings.year;
  let dayIdx = 0, monthLines = "", monthLabels = "";
  for(let m=0; m<12; m++){
    const mx = x(dayIdx).toFixed(1);
    monthLines += `<line x1="${mx}" y1="${padT}" x2="${mx}" y2="${H-padB}" stroke="#d99694" stroke-width="1.5" opacity="0.7"/>`;
    monthLabels += `<text x="${mx}" y="${H-padB+14}" font-size="9.5" fill="#565f68" text-anchor="end" transform="rotate(-45 ${mx} ${H-padB+14})">${MONTH_NAMES[m].slice(0,3)} ${String(yr).slice(-2)}</text>`;
    dayIdx += new Date(yr, m+1, 0).getDate();
  }
  const zeroLine = zeroInRange ? `<line x1="${padL}" y1="${y(0).toFixed(1)}" x2="${W-padR}" y2="${y(0).toFixed(1)}" stroke="#d8d3c4" stroke-width="1"/>
    <text x="${padL}" y="${(y(0)-4).toFixed(1)}" font-size="10" fill="#565f68" font-family="var(--mono)">0</text>` : "";
  svg.innerHTML = `
    ${zeroLine}
    ${monthLines}
    <path d="${path}" fill="none" stroke="#4472c4" stroke-width="1.75"/>
    ${monthLabels}
    <text x="4" y="${padT+8}" font-size="10" fill="#565f68">${round2(rawMax)}</text>
    <text x="4" y="${H-padB}" font-size="10" fill="#565f68">${round2(rawMin)}</text>
  `;
}

function snapshotYearState(source){
  // Aufträge und Zeitprotokoll sind jahresübergreifend und werden nicht im Jahreseintrag gespeichert.
  return { settings: JSON.parse(JSON.stringify(source.settings)), days: source.days, holidays: source.holidays, monthAdjust: source.monthAdjust };
}
function activateArchivedYear(year, silent){
  if(year===state.settings.year) return;
  const target=state.archive?.[year];
  if(!target) return;
  const currentSnapshot=snapshotYearState(state);
  const archive=Object.assign({},state.archive,{[state.settings.year]:currentSnapshot});
  delete archive[year];
  state=normalizeState(Object.assign({},target,{settings:Object.assign({},state.settings,target.settings||{},{year}),archive,tasks:state.tasks,log:state.log,ui:state.ui}));
  currentMonthIdx=new Date().getMonth();
  viewingArchiveYear=null;
  if(!silent){ markDirty(); renderAll(); }
}

document.getElementById("btnJahreswechsel").addEventListener("click", ()=>{
  const nextYear = Math.max(...allYears())+1;
  if(!confirm(`Jahr ${nextYear} hinzufügen?\n\nDas bisherige Jahr bleibt unverändert und weiter bearbeitbar. Gleitzeitsaldo und Resturlaub werden aus dem Vorjahr berechnet und aktualisieren sich automatisch.`)) return;
  const base = withYear(nextYear-1, ()=>state);
  const ns = freshYearState(nextYear, base);
  ns.settings.locked = false;
  ns.settings.glz.carryOverHours = 0; ns.settings.glz.carryOverManual = false;
  Object.assign(ns.settings.vacation, {carryOver:0, plannedNextYear:0, carryOverManual:false, carryExpiry:nextYear+"-03-31"});
  if(ns.settings.excelParity){
    ns.settings.excelParity.customHolidays = [];
    if(window.ExcelParity){
      ns.holidays = ExcelParity.workbookHolidays(nextYear,{region:ns.settings.excelParity.region||null,custom:[]}).map(x=>({date:x.date,label:x.name,factor:x.factor,source:x.source}));
    }
  }
  state.archive = Object.assign({}, state.archive, {[nextYear]: snapshotYearState(ns)});
  recomputeCarryovers();
  markDirty();
  toast(`Jahr ${nextYear} hinzugefügt. Es erscheint im Jahr-Umschalter; heute wird immer im Jahr des Datums gestempelt.`);
  renderAll();
});

/* ---------------- AUFTRÄGE ---------------- */
let taskSortState = {col:"id", dir:-1}; // Standard: neueste zuerst
let taskSearchTerm = "";
let logSortState = {col:"start", dir:1};
let holidaySortState = {col:"date", dir:1};
const LOG_COLS = [
  {key:"kind",label:"Typ"}, {key:"orderNr",label:"Auftragsnr."}, {key:"aenderung",label:"Änderung / Beschreibung"},
  {key:"start",label:"Start (Datum · Uhrzeit)"}, {key:"stop",label:"Stop (Datum · Uhrzeit)"}, {key:"dauer",label:"Dauer"},
];
const STOER_COLS = [
  {key:"", label:"", sortable:false},
  {key:"pinned", label:"📌"},
  {key:"orderNr", label:"Störungsart"},
  {key:"status", label:"Status"},
  {key:"datum", label:"Angelegt am"},
  {key:"dauer", label:"Dauer gesamt"},
  {key:"offset", label:"Korrektur (Min.)", sortable:false},
  {key:"", label:"", sortable:false},
];
const TASK_COLS = [
  {key:"", label:"", sortable:false},
  {key:"pinned", label:"Angeheftet"},
  {key:"orderNr", label:"Auftragsnr."},
  {key:"modul", label:"Modul"},
  {key:"station", label:"Station"},
  {key:"aenderung", label:"Änderung"},
  {key:"status", label:"Status"},
  {key:"datum", label:"Angelegt am"},
  {key:"dauer", label:"Dauer gesamt"},
  {key:"offset", label:"Korrektur (Min.)", sortable:false},
  {key:"", label:"", sortable:false},
];
function applyTableColumnWidths(table, widths){
  let colgroup=table.querySelector("colgroup");
  if(!colgroup){ colgroup=document.createElement("colgroup"); table.prepend(colgroup); }
  colgroup.innerHTML=widths.map(width=>`<col style="width:${width}px">`).join("");
  table.style.tableLayout="fixed";
  table.style.minWidth=widths.reduce((sum,width)=>sum+width,0)+"px";
}
function installColumnResizers(table, widths){
  table.querySelectorAll("th").forEach((th,index)=>{
    const handle=document.createElement("span"); handle.className="resize-task-column"; handle.title="Spaltenbreite ziehen";
    handle.onmousedown=event=>{ const startX=event.clientX, start=widths[index]||th.offsetWidth; const move=e=>{widths[index]=Math.max(48,Math.round(start+e.clientX-startX)); applyTableColumnWidths(table,widths);}; const up=()=>{document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);markDirty();}; document.addEventListener("mousemove",move);document.addEventListener("mouseup",up);}; th.appendChild(handle);
  });
}
function renderRunningTask(){
  const box=document.getElementById("runningTaskPanel"); if(!box) return;
  const t=state.tasks.find(x=>x.status==="in Arbeit");
  if(!t){
    const paused=state.tasks.find(x=>x.status==="Pause");
    box.className="panel running-panel idle";
    box.innerHTML=`<h2>Aktueller Auftrag</h2><span class="hint">Kein Auftrag läuft.${paused?` Pausiert: <strong>${escapeHtml(paused.orderNr||"(ohne Nr.)")}</strong> `:""}</span>${paused?`<button data-run="start" data-id="${paused.id}" class="go run-btn">▶ Weiter</button>`:""}`;
  } else {
    const live=t.activeSince?Math.max(0,Math.round((Date.now()-new Date(t.activeSince).getTime())/60000)):0;
    const isSt=t.kind==="stoerung";
    const interrupted=isSt?state.tasks.find(x=>x.id===state.ui.interruptedTaskId):null;
    box.className="panel running-panel"+(isSt?" stoer":"");
    box.innerHTML=`<h2>${isSt?"Aktuelle Störung":"Aktueller Auftrag"} <span class="badge ${isSt?"stoer":"on"}">${isSt?"Störung":"in Arbeit"}</span></h2>
      <div class="run-main"><div class="run-nr">${escapeHtml(t.orderNr||"(ohne Nr.)")}</div>
      <div class="run-meta">${isSt?(interrupted?"unterbricht Auftrag "+escapeHtml(interrupted.orderNr||"(ohne Nr.)"):"&nbsp;"):([t.modul,t.station,t.aenderung].filter(Boolean).map(escapeHtml).join(" · ")||"&nbsp;")}</div></div>
      <div class="run-time"><span class="hint">Gesamt</span> <strong>${minToTime(totalTaskMinutes(t.id)+live)}</strong> <span class="hint">· seit Start ${live} Min.</span></div>
      <div class="run-actions">${isSt?`<button data-run="stop" data-id="${t.id}" class="run-btn">⏹ Störung beenden</button>`:`<button data-run="stop" data-id="${t.id}" class="run-btn">⏸ Pause</button><button data-run="fertig" data-id="${t.id}" class="secondary fertig-btn run-btn">✔ Fertig</button>`}</div>`;
  }
  box.querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>{
    const id=Number(b.dataset.id), act=b.dataset.run;
    if(act==="start") taskStart(id);
    else if(act==="stop"){
      const tk=state.tasks.find(x=>x.id===id);
      if(tk && tk.kind==="stoerung"){ endStoerung(id); return; }
      taskPause(id);
    }
    else if(act==="fertig"){
      const task=state.tasks.find(x=>x.id===id);
      if(!confirm(`Auftrag „${(task&&task.orderNr)||"(ohne Nr.)"}" als fertig markieren?`)) return;
      taskFinish(id);
    }
    markDirty(); renderAuftraege(); renderHeuteAuftrag();
  });
}
setInterval(()=>{ if(typeof currentView!=="undefined" && currentView==="auftraege" && state && !document.activeElement?.closest?.("#view-auftraege input,#view-auftraege select")) renderRunningTask(); }, 30000);
function renderAuftraege(){
  renderRunningTask();
  const isStoer = state.ui.taskKindTab==="stoerung";
  document.querySelectorAll("#taskKindTabs .sheet-tab").forEach(tab=>{
    tab.classList.toggle("active", tab.dataset.kind===(isStoer?"stoerung":"auftrag"));
    tab.onclick=()=>{ state.ui.taskKindTab=tab.dataset.kind; markDirty(); renderAuftraege(); };
  });
  document.getElementById("taskListTitle").innerHTML = isStoer
    ? 'Störungen <small>Klick auf ▶ stempelt die Störung und unterbricht den laufenden Auftrag</small>'
    : 'Auftragsliste <small>Klick auf ▶ startet den Auftrag, andere laufende werden pausiert</small>';
  document.getElementById("btnNewTaskToggle").textContent = isStoer ? "+ Neue Störungsart" : "+ Neuer Auftrag";
  document.getElementById("taskDatum").value = todayKey();
  const thead=document.querySelector("#taskTable thead");
  const tbody=document.querySelector("#taskTable tbody");
  const widths = isStoer ? state.ui.stoerTableColumnWidths : state.ui.taskTableColumnWidths;
  applyTableColumnWidths(document.getElementById("taskTable"), widths);
  thead.innerHTML = "<tr>" + (isStoer?STOER_COLS:TASK_COLS).map(c=>{
    if(c.sortable===false) return `<th></th>`;
    const arrow = taskSortState.col===c.key ? (taskSortState.dir===1?" ▲":" ▼") : "";
    return `<th class="sortable" data-col="${c.key}" style="cursor:pointer;">${c.label}${arrow}</th>`;
  }).join("") + "</tr>";
  tbody.innerHTML="";

  let anyActive = state.tasks.some(t=>t.status==="in Arbeit");
  const term = taskSearchTerm.trim().toLowerCase();
  let rows = state.tasks.filter(t=>(t.kind||"auftrag")===(isStoer?"stoerung":"auftrag")).map(t=>({t, dauer:totalTaskMinutes(t.id)}));
  if(term){
    rows = rows.filter(({t})=>
      (t.orderNr||"").toLowerCase().includes(term) ||
      (t.modul||"").toLowerCase().includes(term) ||
      (t.station||"").toLowerCase().includes(term) ||
      (t.aenderung||"").toLowerCase().includes(term)
    );
  }
  rows=rows.filter(({t})=>t.status!=="in Arbeit"); // läuft separat im Panel oben
  const statusFilter=state.ui.taskStatusFilter || "open";
  if(statusFilter==="open") rows=rows.filter(({t})=>t.status!=="fertig");
  if(statusFilter==="finished") rows=rows.filter(({t})=>t.status==="fertig");
  const {col, dir} = taskSortState;
  rows.sort((a,b)=>{
    // Angeheftete Aufträge bleiben bei jeder Sortierung sichtbar ganz oben.
    if(Boolean(a.t.pinned)!==Boolean(b.t.pinned)) return a.t.pinned ? -1 : 1;
    let av, bv;
    if(col==="pinned"){ av=Number(Boolean(a.t.pinned)); bv=Number(Boolean(b.t.pinned)); }
    else if(col==="dauer"){ av=a.dauer; bv=b.dauer; }
    else if(col==="id"){ av=a.t.id; bv=b.t.id; }
    else { av=(a.t[col]||"").toString().toLowerCase(); bv=(b.t[col]||"").toString().toLowerCase(); }
    if(av<bv) return -1*dir;
    if(av>bv) return 1*dir;
    return 0;
  });

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="11" class="hint" style="padding:14px;">${term?"Keine Einträge gefunden.":(isStoer?"Keine Störungsarten – mit „+ Neue Störungsart“ anlegen.":"Keine Aufträge für diesen Filter.")}</td></tr>`;
  }
  rows.forEach(({t, dauer})=>{
    const tr=document.createElement("tr");
    tr.className = "taskrow "+(t.status==="in Arbeit"?"active":(t.status==="Pause"?"pausing":""))+(t.pinned?" is-pinned-row":"")+(isStoer?" stoer-row":"");
    const canStart = t.status!=="in Arbeit";
    const startCell = canStart?`<button data-act="start" data-id="${t.id}" ${anyActive&&t.status!=="Pause"?"":""}>▶</button>`:`<button data-act="stop" data-id="${t.id}">⏸</button>`;
    const pinCell = `<td style="text-align:center"><button class="secondary pin-task ${t.pinned?"is-pinned":""}" data-act="pin" data-id="${t.id}" title="${t.pinned?"Anheftung lösen":"Anheften"}">${t.pinned?"📌":"📍"}</button></td>`;
    const statusCell = `<td><select class="task-inline" data-task-id="${t.id}" data-task-field="status"><option ${t.status==='warten'?'selected':''}>warten</option><option ${t.status==='in Arbeit'?'selected':''}>in Arbeit</option><option ${t.status==='Pause'?'selected':''}>Pause</option><option ${t.status==='fertig'?'selected':''}>fertig</option></select></td>`;
    if(isStoer){
      tr.innerHTML = `<td>${startCell}</td>${pinCell}
        <td><input class="task-inline" data-task-id="${t.id}" data-task-field="orderNr" value="${escapeHtml(t.orderNr||"")}"></td>
        ${statusCell}
        <td class="num">${t.datum ? fmtDateDE(t.datum) : "–"}</td>
        <td class="num">${minToTime(dauer)}</td>
        <td><input class="task-inline" type="number" data-task-id="${t.id}" data-task-field="manualDurationOffsetMinutes" value="${Number(t.manualDurationOffsetMinutes)||0}"></td>
        <td>${t.status!=="fertig"?`<button class="secondary" data-act="fertig" data-id="${t.id}">ausblenden</button>`:""}</td>`;
      tbody.appendChild(tr); return;
    }
    tr.innerHTML = `
      <td>${canStart?`<button data-act="start" data-id="${t.id}" ${anyActive&&t.status!=="Pause"?"":""}>▶</button>`:`<button data-act="stop" data-id="${t.id}">⏸</button>`}</td>
      <td style="text-align:center"><button class="secondary pin-task ${t.pinned?"is-pinned":""}" data-act="pin" data-id="${t.id}" title="${t.pinned?"Anheftung lösen":"Auftrag anheften"}">${t.pinned?"📌":"📍"}</button></td>
      <td><input class="task-inline" data-task-id="${t.id}" data-task-field="orderNr" value="${escapeHtml(t.orderNr||"")}"></td>
      <td><input class="task-inline" data-task-id="${t.id}" data-task-field="modul" value="${escapeHtml(t.modul||"")}"></td>
      <td><input class="task-inline" data-task-id="${t.id}" data-task-field="station" value="${escapeHtml(t.station||"")}"></td>
      <td><input class="task-inline" data-task-id="${t.id}" data-task-field="aenderung" value="${escapeHtml(t.aenderung||"")}"></td>
      <td><select class="task-inline" data-task-id="${t.id}" data-task-field="status"><option ${t.status==='warten'?'selected':''}>warten</option><option ${t.status==='in Arbeit'?'selected':''}>in Arbeit</option><option ${t.status==='Pause'?'selected':''}>Pause</option><option ${t.status==='fertig'?'selected':''}>fertig</option></select></td>
      <td class="num">${t.datum ? fmtDateDE(t.datum) : "–"}</td>
      <td class="num">${minToTime(dauer)}</td>
      <td><input class="task-inline" type="number" data-task-id="${t.id}" data-task-field="manualDurationOffsetMinutes" value="${Number(t.manualDurationOffsetMinutes)||0}"></td>
      <td>${t.status!=="fertig"?`<button class="secondary fertig-btn" data-act="fertig" data-id="${t.id}">fertig</button>`:""}</td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      if(act==="start") taskStart(id);
      else if(act==="stop"){
        const tk=state.tasks.find(t=>t.id===id);
        if(tk && tk.kind==="stoerung"){ endStoerung(id); return; }
        taskPause(id);
      }
      else if(act==="fertig"){
        const task=state.tasks.find(t=>t.id===id);
        const label=(task&&task.orderNr)||"(ohne Nr.)";
        if(!(task && task.kind==="stoerung") && !confirm(`Auftrag „${label}" als fertig markieren?\nEr wird danach aus der offenen Liste ausgeblendet.`)) return;
        taskFinish(id);
      }
      else if(act==="pin"){ const task=state.tasks.find(t=>t.id===id); task.pinned=!task.pinned; }
      markDirty(); renderAuftraege(); renderHeuteAuftrag();
    });
  });
  tbody.querySelectorAll("[data-task-field]").forEach(el=>el.addEventListener("change", e=>{
    const task=state.tasks.find(t=>t.id===Number(e.target.dataset.taskId));
    const field=e.target.dataset.taskField;
    task[field]=field==="manualDurationOffsetMinutes" ? (Number(e.target.value)||0) : e.target.value;
    markDirty(); renderAuftraege();
  }));
  thead.querySelectorAll("th.sortable").forEach(th=>{
    th.addEventListener("click", ()=>{
      const c = th.dataset.col;
      if(!c) return;
      if(taskSortState.col===c) taskSortState.dir *= -1;
      else taskSortState = {col:c, dir:1};
      renderAuftraege();
    });
  });
  installColumnResizers(document.getElementById("taskTable"), widths);
  const searchEl = document.getElementById("taskSearch");
  if(searchEl && searchEl.value !== taskSearchTerm) searchEl.value = taskSearchTerm;
  if(searchEl && !searchEl.dataset.wired){
    searchEl.dataset.wired = "1";
    searchEl.addEventListener("input", (e)=>{ taskSearchTerm = e.target.value; renderAuftraege(); });
  }

  const statusFilterEl=document.getElementById("taskStatusFilter");
  statusFilterEl.value=state.ui.taskStatusFilter;
  if(!statusFilterEl.dataset.wired){ statusFilterEl.dataset.wired="1"; statusFilterEl.addEventListener("change",e=>{state.ui.taskStatusFilter=e.target.value; markDirty(); renderAuftraege();}); }

  const lthead=document.querySelector("#logTable thead");
  const ltbody=document.querySelector("#logTable tbody");
  lthead.innerHTML=`<tr>${LOG_COLS.map(c=>`<th class="sortable" data-log-col="${c.key}" style="cursor:pointer;">${c.label}${logSortState.col===c.key?(logSortState.dir===1?" ▲":" ▼"):""}</th>`).join("")}</tr>`;
  applyTableColumnWidths(document.getElementById("logTable"), state.ui.logTableColumnWidths);
  ltbody.innerHTML="";
  const logSearch=document.getElementById("logSearch"), logTypeFilter=document.getElementById("logTypeFilter");
  if(!logSearch.dataset.wired){ logSearch.dataset.wired="1"; logSearch.oninput=()=>renderAuftraege(); logTypeFilter.onchange=()=>renderAuftraege(); }
  StundenzettelTaskManagement.visibleLogEntries(state,{search:logSearch.value,type:logTypeFilter.value,sort:logSortState}).forEach(l=>{
    const tr=document.createElement("tr");
    const durMin = Math.round((new Date(l.stop)-new Date(l.start))/60000);
    if(l.kind==="pause"){
      tr.innerHTML = `<td>Pause</td><td>–</td><td>${escapeHtml(l.aenderung||"")}</td><td><input type="datetime-local" step="1" data-pause-date="${l.date}" data-pause-index="${l.pauseIndex}" data-pause-field="start" value="${localDateTimeInputFromIso(l.start)}"></td><td><input type="datetime-local" step="1" data-pause-date="${l.date}" data-pause-index="${l.pauseIndex}" data-pause-field="end" value="${localDateTimeInputFromIso(l.stop)}"></td><td class="num">${minToTime(durMin)}</td>`;
    } else {
      const index=Number(l.id.slice(4));
      tr.innerHTML = `<td>${l.art==="stoerung"?"Störung":"Auftrag"}</td><td>${escapeHtml(l.orderNr||"")}</td><td><input data-log-index="${index}" data-log-field="aenderung" value="${escapeHtml(l.aenderung||"")}"></td>
        <td><input type="datetime-local" step="1" data-log-index="${index}" data-log-field="start" value="${localDateTimeInputFromIso(l.start)}"></td><td><input type="datetime-local" step="1" data-log-index="${index}" data-log-field="stop" value="${localDateTimeInputFromIso(l.stop)}"></td><td class="num">${minToTime(durMin)}</td>`;
    }
    ltbody.appendChild(tr);
  });
  ltbody.querySelectorAll("[data-log-field]").forEach(el=>el.addEventListener("change", event=>{
    const record=state.log[Number(event.target.dataset.logIndex)];
    const field=event.target.dataset.logField;
    const value=(field==="start"||field==="stop") ? new Date(event.target.value).toISOString() : event.target.value;
    if(!record || !StundenzettelTaskManagement.applyLogEdit(record, field, value)){
      toast("Stop darf nicht vor Start liegen.", "warn"); renderAuftraege(); return;
    }
    markDirty(); renderAuftraege();
  }));
  ltbody.querySelectorAll("[data-pause-field]").forEach(el=>el.addEventListener("change", event=>{
    const target=event.target, day=state.days[target.dataset.pauseDate], pause=day?.dayPauses?.[Number(target.dataset.pauseIndex)];
    const value=new Date(target.value).toISOString();
    const next=Object.assign({},pause,{[target.dataset.pauseField]:value});
    if(!pause || !target.value || new Date(next.end)<=new Date(next.start)){
      toast("Pausenende muss nach dem Pausenstart liegen.", "warn"); renderAuftraege(); return;
    }
    pause[target.dataset.pauseField]=value;
    markDirty(); renderAuftraege();
  }));
  lthead.querySelectorAll("[data-log-col]").forEach(th=>th.addEventListener("click", ()=>{
    const col=th.dataset.logCol;
    logSortState = logSortState.col===col ? {col,dir:-logSortState.dir} : {col,dir:1};
    renderAuftraege();
  }));
  installColumnResizers(document.getElementById("logTable"), state.ui.logTableColumnWidths);
}
function totalTaskMinutes(taskId){
  const task=state.tasks.find(t=>t.id===taskId);
  return task ? StundenzettelTaskManagement.totalTaskMinutes(task,state.log) : 0;
}
function nextTaskId(){ return state.tasks.reduce((m,t)=>Math.max(m,t.id),0)+1; }
function setNewTaskOpen(open){
  const dlg=document.getElementById("newTaskPanel");
  if(open){ if(!dlg.open) dlg.showModal(); document.getElementById("taskOrderNr").focus(); }
  else if(dlg.open) dlg.close();
}
document.getElementById("btnNewTaskToggle").addEventListener("click",()=>{
  if(state.ui.taskKindTab==="stoerung"){ const d=document.getElementById("newStoerPanel"); d.showModal(); document.getElementById("stoerName").focus(); }
  else setNewTaskOpen(true);
});
function addStoerungFromForm(startNow){
  const name=document.getElementById("stoerName").value.trim();
  if(!name){ toast("Bitte eine Bezeichnung eingeben.","warn"); return; }
  const t={ id:nextTaskId(), kind:"stoerung", orderNr:name, modul:"", station:"", datum:todayKey(), aenderung:"", status:"warten", pinned:false, activeSince:null, manualDurationOffsetMinutes:0 };
  state.tasks.push(t);
  document.getElementById("stoerName").value="";
  document.getElementById("newStoerPanel").close();
  if(startNow) taskStart(t.id);
  markDirty(); renderAuftraege(); renderHeuteAuftrag(); renderHeute(); renderMiniPlayer();
  toast(startNow?"Störung gestempelt.":"Störungsart angelegt.");
}
document.getElementById("btnStoerAdd").addEventListener("click",()=>addStoerungFromForm(false));
document.getElementById("btnStoerAddStart").addEventListener("click",()=>addStoerungFromForm(true));
document.getElementById("btnStoerCancel").addEventListener("click",()=>document.getElementById("newStoerPanel").close());
document.getElementById("btnTaskCancel").addEventListener("click",()=>setNewTaskOpen(false));
function addTaskFromForm(startNow){
  const t = {
    id: nextTaskId(),
    orderNr: document.getElementById("taskOrderNr").value,
    modul: document.getElementById("taskModul").value,
    station: document.getElementById("taskStation").value,
    datum: document.getElementById("taskDatum").value,
    aenderung: document.getElementById("taskAenderung").value,
    kind: "auftrag",
    status: "warten",
    pinned: false,
    activeSince: null,
    manualDurationOffsetMinutes: 0,
  };
  state.tasks.push(t);
  ["taskOrderNr","taskModul","taskStation","taskAenderung"].forEach(id=>document.getElementById(id).value="");
  if(startNow) taskStart(t.id);
  setNewTaskOpen(false);
  markDirty(); renderAuftraege(); renderHeuteAuftrag();
  toast(startNow?"Auftrag angelegt und gestartet.":"Auftrag angelegt.");
}
document.getElementById("btnTaskAdd").addEventListener("click",()=>addTaskFromForm(false));
document.getElementById("btnTaskAddStart").addEventListener("click",()=>addTaskFromForm(true));
function logCloseActive(t){
  if(t.activeSince){
    state.log.push({taskId:t.id, art:t.kind||"auftrag", orderNr:t.orderNr, modul:t.modul, station:t.station, aenderung:t.aenderung, start:t.activeSince, stop:new Date().toISOString()});
    t.activeSince=null;
  }
}
function taskStart(id){
  const t = state.tasks.find(x=>x.id===id);
  state.tasks.forEach(o=>{
    if(o.status==="in Arbeit" && o.id!==id){
      logCloseActive(o);
      const label = o.orderNr||"(ohne Nr.)";
      if(t.kind==="stoerung" && o.kind!=="stoerung"){
        // Störung unterbricht den laufenden Auftrag; er wird für „Zurück zum Auftrag“ gemerkt.
        o.status="Pause"; state.ui.interruptedTaskId=o.id;
        toast(`Auftrag „${label}" durch Störung unterbrochen.`);
      } else {
        o.status="warten";
        if(t.kind!=="stoerung") state.ui.interruptedTaskId=null;
        toast(`${o.kind==="stoerung"?"Störung":"Auftrag"} „${label}" wurde beendet/pausiert.`);
      }
    }
  });
  t.status="in Arbeit";
  t.activeSince = new Date().toISOString();
}
function taskPause(id){
  const t = state.tasks.find(x=>x.id===id);
  logCloseActive(t);
  t.status = t.kind==="stoerung" ? "warten" : "Pause";
}
/* Störung beenden: Beschreibung (optional) je Stempelung + Rückkehr zum unterbrochenen Auftrag. */
let stoerEndCtx = null;
function endStoerung(id){
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  taskPause(id);
  let logIndex=-1; for(let i=state.log.length-1;i>=0;i--){ if(state.log[i].taskId===id){ logIndex=i; break; } }
  const back = state.tasks.find(x=>x.id===state.ui.interruptedTaskId && x.status!=="fertig");
  stoerEndCtx = {logIndex, backId: back?back.id:null};
  document.getElementById("stoerEndTitle").textContent = "Störung beendet: "+(t.orderNr||"");
  document.getElementById("stoerEndNote").value = "";
  const notes = [...new Set(state.log.filter(l=>l.art==="stoerung" && l.aenderung).map(l=>l.aenderung))].slice(-30);
  document.getElementById("stoerNoteList").innerHTML = notes.map(n=>`<option value="${escapeHtml(n)}">`).join("");
  const backBtn = document.getElementById("stoerEndBack");
  backBtn.hidden = !back;
  if(back) backBtn.textContent = "▶ Zurück zu Auftrag "+(back.orderNr||"(ohne Nr.)");
  markDirty(); renderAuftraege(); renderHeuteAuftrag(); renderHeute(); renderMiniPlayer();
  document.getElementById("stoerEndDlg").showModal();
  document.getElementById("stoerEndNote").focus();
}
document.getElementById("stoerEndBack").addEventListener("click",()=>document.getElementById("stoerEndDlg").close("back"));
document.getElementById("stoerEndOnly").addEventListener("click",()=>document.getElementById("stoerEndDlg").close("only"));
document.getElementById("stoerEndDlg").addEventListener("close",()=>{
  const ctx=stoerEndCtx; stoerEndCtx=null; if(!ctx) return;
  const note=document.getElementById("stoerEndNote").value.trim();
  if(note && ctx.logIndex>=0 && state.log[ctx.logIndex]) state.log[ctx.logIndex].aenderung=note;
  if(document.getElementById("stoerEndDlg").returnValue==="back" && ctx.backId) taskStart(ctx.backId);
  state.ui.interruptedTaskId=null;
  markDirty(); renderAuftraege(); renderHeuteAuftrag(); renderHeute(); renderMiniPlayer();
});
function activeTaskPause(){
  const t = state.tasks.find(x=>x.status==="in Arbeit");
  if(!t){ toast("Kein Auftrag aktiv."); return; }
  taskPause(t.id);
}
function activeTaskResume(){
  const t = state.tasks.find(x=>x.status==="Pause");
  if(!t){ toast("Kein Auftrag in Pause."); return; }
  taskStart(t.id);
}
function resumeLatestTaskOnOpen(){
  if(!state.settings.stempelnAktiv) return false;
  const active = state.tasks.find(t=>t.status==="in Arbeit");
  if(active){
    setTimeout(()=>alert("Es läuft bereits ein Auftrag. Bitte Zeiten prüfen"), 0);
    return false;
  }
  const latest = recentTasksList(20).find(x=>x.kind!=="stoerung");
  if(!latest) return false;
  taskStart(latest.id);
  markDirty();
  toast("Auftragsstempelung gestartet: "+(latest.orderNr||"(ohne Nr.)"));
  return true;
}
function taskFinish(id){
  const t = state.tasks.find(x=>x.id===id);
  logCloseActive(t);
  t.status="fertig";
}

/* ---------------- URLAUB ---------------- */
function renderUrlaub(){
  const vac = vacationUsed();
  const s = state.settings.vacation;
  document.getElementById("uAnspruch").value = s.entitlement;
  document.getElementById("uUebertrag").value = s.carryOver;
  const vi = vacationInfo(); const avail = vi.avail;
  document.getElementById("urlaubHint").textContent =
    `Genommen: ${vac.used} Tage · Vorab-Urlaub genommen: ${vac.vu} Tage · verplanbar verbleibend: ${avail} Tage.`
    + (vi.carry>0 ? ` Resturlaub aus dem Vorjahr (${vi.carry} Tage) verfällt am ${fmtDateDE(vi.expiry)}${vi.lapsed>0?` – bis dahin nicht genommen: ${vi.lapsed} Tage verfallen`:" – bis dahin vollständig genommen"}.` : "");
  document.getElementById("uVerfall").value = vi.expiry;
  if(allYears().includes(state.settings.year-1) && !s.carryOverManual){
    document.getElementById("urlaubHint").textContent += ` Übertrag berechnet aus ${state.settings.year-1}: ${s.carryOver} Tage.`;
  }

  const g = state.settings.glz;
  document.getElementById("glzUebertrag").value = round2(g.carryOverHours);
  document.getElementById("glzPuffer").value = round2(g.bufferHours);
  document.getElementById("glzTagSoll").value = round2(g.dayHours);

  const kpis=document.getElementById("urlaubKpis"); kpis.innerHTML="";
  const bal = yearBalanceSeries().slice(-1)[0]?.bal ?? g.carryOverHours;
  const items=[
    ["Aktueller Gleitzeitsaldo", hoursToHM(bal), bal>=0?"pos":"neg"],
    ["GLZ-Tage verfügbar", glzTageVerfuegbar()+"", null],
    ["Urlaub verfügbar", avail+" Tage", avail>=0?"pos":"neg"],
  ];
  for(const [l,v,cls] of items){
    const d=document.createElement("div"); d.className="kpi";
    d.innerHTML=`<div class="l">${l}</div><div class="v ${cls||""}">${v}</div>`;
    kpis.appendChild(d);
  }

  document.getElementById("uVerfall").onchange=(e)=>{ state.settings.vacation.carryExpiry=e.target.value||(state.settings.year+"-03-31"); markDirty(); renderUrlaub(); };
  const hasPrev = allYears().includes(state.settings.year-1);
  [["uUebertragAuto","vacation","uUebertrag"],["glzUebertragAuto","glz","glzUebertrag"]].forEach(([cbId,grp,inputId])=>{
    const cb=document.getElementById(cbId), input=document.getElementById(inputId);
    cb.parentElement.style.display = hasPrev ? "" : "none";
    cb.checked = hasPrev && !state.settings[grp].carryOverManual;
    input.disabled = cb.checked;
    cb.onchange=()=>{ state.settings[grp].carryOverManual=!cb.checked; markDirty(); recomputeCarryovers(); renderUrlaub(); };
  });
  ["uAnspruch","uUebertrag"].forEach(id=>{
    document.getElementById(id).onchange=(e)=>{
      const map={uAnspruch:"entitlement", uUebertrag:"carryOver"};
      state.settings.vacation[map[id]] = Number(e.target.value)||0;
      if(id==="uUebertrag") state.settings.vacation.carryOverManual=true;
      markDirty(); renderUrlaub();
    };
  });
  document.getElementById("glzUebertrag").onchange=(e)=>{ state.settings.glz.carryOverHours=Number(e.target.value)||0; state.settings.glz.carryOverManual=true; markDirty(); renderUrlaub(); };
  document.getElementById("glzPuffer").onchange=(e)=>{ state.settings.glz.bufferHours=Number(e.target.value)||0; markDirty(); renderUrlaub(); };
  document.getElementById("glzTagSoll").onchange=(e)=>{ state.settings.glz.dayHours=Number(e.target.value)||0; markDirty(); renderUrlaub(); };
}

/* ---------------- FAHRTKOSTEN ---------------- */
function renderFahrtkosten(){
  const f = state.settings.travel;
  document.getElementById("fkDistanz").value=round2(f.distanceKm);
  document.getElementById("fkProKm").value=round2(f.pricePerKm);
  document.getElementById("fkFix").value=round2(f.fixedPerYear);
  document.getElementById("fkVerbrauch").value=round2(f.consumptionPer100);
  document.getElementById("fkPreis").value=round2(f.pricePerLiter);

  ["fkDistanz","fkProKm","fkFix","fkVerbrauch","fkPreis"].forEach(id=>{
    document.getElementById(id).onchange=(e)=>{
      const map={fkDistanz:"distanceKm",fkProKm:"pricePerKm",fkFix:"fixedPerYear",fkVerbrauch:"consumptionPer100",fkPreis:"pricePerLiter"};
      state.settings.travel[map[id]] = Number(e.target.value)||0;
      markDirty(); renderFahrtkosten();
    };
  });

  let fahrten=0;
  for(const k in state.days){ if((state.days[k].stamps||[]).length>0) fahrten++; }
  const kmMonat = fahrten*f.distanceKm*2;
  const euroMonat = f.distanceKm*f.pricePerKm;
  const eigeneKostenJahr = (kmMonat*12/100)*f.consumptionPer100*f.pricePerLiter/12*12; // simplified yearly estimate
  const kpis=document.getElementById("fkKpis"); kpis.innerHTML="";
  const items=[
    ["Fahrten bisher (Jahr)", fahrten+"", null],
    ["km gesamt (bisher, hin+zurück)", round2(fahrten*f.distanceKm*2)+" km", null],
    ["Kilometergeld pro Fahrtag", round2(f.distanceKm*2*f.pricePerKm)+" €", null],
    ["Geschätzte Fahrtkosten/Jahr", round2((fahrten*f.distanceKm*2/100)*f.consumptionPer100*f.pricePerLiter + f.fixedPerYear)+" €", null],
  ];
  for(const [l,v,cls] of items){
    const d=document.createElement("div"); d.className="kpi";
    d.innerHTML=`<div class="l">${l}</div><div class="v ${cls||""}">${v}</div>`;
    kpis.appendChild(d);
  }
  if(window.StundenzettelExcelViews){
    StundenzettelExcelViews.renderTravel({state}, fahrten);
  }
}

/* ---------------- EINSTELLUNGEN ---------------- */
let settingsSection = "allgemein";
function applySettingsSection(){
  document.querySelectorAll("#setTabs .sheet-tab").forEach(t=>{
    t.classList.toggle("active", t.dataset.sec===settingsSection);
    t.onclick=()=>{ settingsSection=t.dataset.sec; applySettingsSection(); };
  });
  document.querySelectorAll("#view-einstellungen .set-section").forEach(s=>s.classList.toggle("active", s.dataset.sec===settingsSection));
}
const GROUP_LABEL={moDo:"Montag–Donnerstag", fr:"Freitag", sa:"Samstag/Sonntag"};
function renderRulesEditor(){
  const r=rulesOf(), groups=["moDo","fr","sa"];
  const tbl=document.getElementById("rulesTable");
  tbl.innerHTML=`<thead><tr><th></th>${groups.map(g=>`<th>${GROUP_LABEL[g]}</th>`).join("")}</tr></thead><tbody>
    <tr><td>Pause (Min.)</td>${groups.map(g=>`<td><input type="number" step="1" data-r="pause" data-g="${g}" value="${r.pause[g]}"></td>`).join("")}</tr>
    <tr><td>Kernzeit</td>${groups.map(g=>`<td><input type="time" data-r="kernzeit" data-g="${g}" value="${r.kernzeit[g]||""}"></td>`).join("")}</tr></tbody>`;
  tbl.querySelectorAll("input").forEach(el=>el.onchange=()=>{ const g=el.dataset.g;
    if(el.dataset.r==="pause") r.pause[g]=Number(el.value)||0; else r.kernzeit[g]=el.value; markDirty(); });
  const bind=(id,fn,val)=>{ const el=document.getElementById(id); el.value=val; el.onchange=()=>{ fn(el.value); markDirty(); }; };
  bind("rPauseHoliday",v=>r.pause.holiday=Number(v)||0,r.pause.holiday);
  bind("rLongHours",v=>r.longThresholdHours=Number(v)||0,r.longThresholdHours);
  bind("rLongPause",v=>r.longPauseMin=Number(v)||0,r.longPauseMin);
  bind("rLatestEnd",v=>r.latestEnd=v||"18:30",r.latestEnd);
  const box=document.getElementById("rBreaksEditor");
  box.innerHTML=groups.map(g=>`<div class="breaks-group"><h4>${GROUP_LABEL[g]}</h4>${(r.breaks[g]||[]).map((b,i)=>`<div class="break-row"><input type="time" data-g="${g}" data-i="${i}" data-f="start" value="${b.start}"><span>–</span><input type="time" data-g="${g}" data-i="${i}" data-f="end" value="${b.end}"><input data-g="${g}" data-i="${i}" data-f="label" value="${escapeHtml(b.label||"")}" placeholder="Bezeichnung"><button type="button" class="secondary" data-del-g="${g}" data-del-i="${i}">✕</button></div>`).join("")||'<div class="hint">Keine festen Pausen.</div>'}<button type="button" class="secondary" data-add-g="${g}">+ Pause</button></div>`).join("");
  box.querySelectorAll("input").forEach(el=>el.onchange=()=>{ r.breaks[el.dataset.g][Number(el.dataset.i)][el.dataset.f]=el.value; markDirty(); });
  box.querySelectorAll("[data-del-g]").forEach(b=>b.onclick=()=>{ r.breaks[b.dataset.delG].splice(Number(b.dataset.delI),1); markDirty(); renderRulesEditor(); });
  box.querySelectorAll("[data-add-g]").forEach(b=>b.onclick=()=>{ (r.breaks[b.dataset.addG]=r.breaks[b.dataset.addG]||[]).push({start:"12:00",end:"12:30",label:"Pause"}); markDirty(); renderRulesEditor(); });
}
function renderEinstellungen(){
  applySettingsSection();
  updateInstallUI();
  renderSettingsYearSwitcher();
  document.getElementById("sName").value = state.settings.name;
  document.getElementById("sPersNr").value = state.settings.personalNr;
  document.getElementById("sStempeln").value = state.settings.stempelnAktiv ? "ja":"nein";
  document.getElementById("sMiniAuto").value = state.settings.miniPlayerAutoOpen ? "ja":"nein";
  document.getElementById("sOffsetKommen").value = state.settings.stempelOffsetKommenMin;
  document.getElementById("sOffsetGehen").value = state.settings.stempelOffsetGehenMin;

  document.getElementById("sName").onchange=(e)=>{ state.settings.name=e.target.value; markDirty(); };
  document.getElementById("sPersNr").onchange=(e)=>{ state.settings.personalNr=e.target.value; markDirty(); };
  document.getElementById("sStempeln").onchange=(e)=>{ state.settings.stempelnAktiv = e.target.value==="ja"; markDirty(); };
  document.getElementById("sMiniAuto").onchange=(e)=>{ state.settings.miniPlayerAutoOpen = e.target.value==="ja"; markDirty(); };
  document.getElementById("sOffsetGehen").onchange=(e)=>{ state.settings.stempelOffsetGehenMin = Number(e.target.value)||0; markDirty(); };
  document.getElementById("sOffsetKommen").onchange=(e)=>{ state.settings.stempelOffsetKommenMin = Number(e.target.value)||0; markDirty(); };

  const notifStatusEl = document.getElementById("notifStatus");
  const isFile = location.protocol==="file:";
  function updateNotifStatus(afterRequest){
    const test=document.getElementById("btnNotifTest");
    const set=(cls,text)=>{ notifStatusEl.innerHTML=`<span class="status-pill ${cls}">${text}</span>`; };
    if(!notificationsSupported()){ set("bad","Nicht unterstützt"); test.hidden=true; return; }
    const perm=Notification.permission;
    test.hidden = !(perm==="granted" || (isFile && perm!=="denied"));
    if(perm==="granted") set("ok","✓ Erlaubt – Meldungen werden angezeigt");
    else if(perm==="denied") set("bad","✕ Blockiert – im Browser unter dem Symbol neben der Adresse änderbar");
    else if(isFile) set("wait","Status bei lokaler Datei nicht ermittelbar");
    else set("wait", afterRequest ? "Keine Freigabe erhalten" : "Noch nicht erlaubt");
    if(perm!=="granted" && perm!=="denied" && isFile){
      notifStatusEl.innerHTML += `<br><span class="hint">Chrome meldet für lokal geöffnete Dateien (file://) keinen verlässlichen Status – auch wenn in der Adressleiste „Zugelassen“ steht. Prüfe es mit „Testmeldung senden“: erscheint eine Meldung, funktioniert alles.</span>`;
    }
  }
  updateNotifStatus();
  try{ navigator.permissions.query({name:"notifications"}).then(s=>{ s.onchange=()=>updateNotifStatus(); }); }catch(e){}
  document.getElementById("btnNotifPermission").onclick = async ()=>{
    if(!notificationsSupported()){ toast("Browser-Benachrichtigungen werden von diesem Browser nicht unterstützt.", "warn"); return; }
    await Notification.requestPermission();
    updateNotifStatus(true);
  };
  document.getElementById("btnNotifTest").onclick = ()=>{
    try{ const n=new Notification("Stundenzettel", {body:"Testmeldung – Benachrichtigungen funktionieren."}); n.onshow=()=>{ notifStatusEl.innerHTML='<span class="status-pill ok">✓ Testmeldung wurde angezeigt – Meldungen funktionieren</span>'; }; toast("Testmeldung gesendet – erscheint sie nicht, ist die Freigabe nicht wirksam."); }
    catch(e){ toast("Testmeldung fehlgeschlagen: "+e.message,"warn"); }
  };

  renderRulesEditor();
  const wk=document.getElementById("sWeekly"); wk.innerHTML="";
  WEEKDAY_KEYS.forEach(key=>{
    const d=document.createElement("div");
    d.innerHTML=`<label>${WEEKDAY_LABELS[key]}</label><input type="number" step="0.1" data-wk="${key}" value="${round2(state.settings.weekly[key])}">`;
    wk.appendChild(d);
  });
  wk.querySelectorAll("input").forEach(el=>{
    el.onchange=(e)=>{ state.settings.weekly[e.target.dataset.wk]=Number(e.target.value)||0; markDirty(); };
  });

  const cb=document.getElementById("sCodes"); cb.innerHTML="";
  state.settings.absenceCodes.forEach((c,idx)=>{
    const row=document.createElement("div"); row.className="codebox";
    row.innerHTML = `
      <input data-f="code" data-idx="${idx}" value="${c.code}">
      <input data-f="label" data-idx="${idx}" value="${c.label}">
      <input data-f="factor" data-idx="${idx}" type="number" step="0.1" value="${c.factor}">
      <input data-f="color" data-idx="${idx}" type="color" value="${c.color||'#ffffff'}" title="Farbe in Monatstabelle/Jahresübersicht">
      <button class="secondary" data-del="${idx}">✕</button>`;
    cb.appendChild(row);
  });
  cb.querySelectorAll("input").forEach(el=>{
    el.onchange=(e)=>{
      const idx=Number(e.target.dataset.idx), f=e.target.dataset.f;
      let v=e.target.value;
      if(f==="factor") v=Number(v)||0;
      if(f==="code") v=v.toUpperCase();
      state.settings.absenceCodes[idx][f]=v;
      markDirty();
      if(f==="color" && currentView==="monat") renderMonat();
    };
  });
  cb.querySelectorAll("[data-del]").forEach(el=>{
    el.onclick=()=>{
      state.settings.absenceCodes.splice(Number(el.dataset.del),1);
      markDirty(); renderEinstellungen();
    };
  });

  document.getElementById("feiertageJahr").textContent = "("+state.settings.year+")";
  if(window.StundenzettelExcelViews){
    StundenzettelExcelViews.renderHolidayEditor({state, markDirty, renderSettings: renderEinstellungen, toast});
  }
  renderSicherung();
}
document.getElementById("btnCodeAdd").addEventListener("click",()=>{
  state.settings.absenceCodes.push({code:"NEU", label:"Neuer Code", factor:0, color:"#e9e6f0"});
  markDirty(); renderEinstellungen();
});

/* ---------------- SICHERUNG ---------------- */
function renderSicherung(){
  const fs=document.getElementById("fsPanel"); if(!fs) return;
  const status = !dataLoaded ? "Keine Datei geöffnet."
    : fileHandle && fileNeedsReconnect ? "Die Datei braucht eine erneute Browser-Berechtigung – bis dahin wird NICHT gespeichert."
    : fileHandle ? "Diese Datei wird bei jeder Änderung automatisch aktualisiert."
    : FS_SUPPORTED ? "Keine Datei verbunden – Änderungen sind NICHT gespeichert. „Speichern unter…“ wählen."
    : "Dieser Browser kann nicht automatisch speichern. Bitte regelmäßig eine Kopie speichern.";
  const actions = [
    FS_SUPPORTED ? `<button id="btnChooseFile">${fileHandle?"Speichern unter… (andere Datei)":"Speichern unter…"}</button>` : "",
    fileHandle && fileNeedsReconnect ? '<button class="secondary" id="btnReconnectFile">Datei-Speicherung reaktivieren</button>' : "",
    fileHandle ? '<button class="secondary" id="btnSaveFile">Jetzt speichern</button>' : "",
    '<button class="secondary" id="btnOpenOther">Andere Datei öffnen…</button>'
  ].join("");
  fs.innerHTML=`<div class="set-row"><div class="set-label"><strong>${fileHandle?escapeHtml(fileHandle.name||"gewählte Datei"):"Keine Datei verbunden"}</strong><small>${status}</small></div><div class="set-ctl files-actions">${actions}</div></div>
    <div class="set-row"><div class="set-label"><strong>Sicherungskopie</strong><small>Speichert eine zusätzliche Kopie mit Datum im Namen. Die Arbeitsdatei bleibt unverändert.</small></div><div class="set-ctl files-actions"><button id="btnExport">Sicherungskopie speichern…</button></div></div>`;
  const on=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  on("btnChooseFile",connectAutosaveFile); on("btnReconnectFile",reconnectAutosaveFile);
  on("btnSaveFile",async()=>{ if(await writeToFile()) toast("Gespeichert."); else toast("Speichern nicht möglich – bitte reaktivieren.","warn"); });
  on("btnOpenOther",()=>{ if(dataLoaded && dirty && (!fileHandle||fileNeedsReconnect) && !confirm("Es gibt Änderungen, die nicht in einer Datei gespeichert sind. Trotzdem eine andere Datei öffnen?")) return; openStartDialog(null); });
  on("btnExport",saveBackupCopy);
}
async function saveBackupCopy(){
  const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,"-");
  const name=`Stundenzettel-${state.settings.year}-Sicherung-${stamp}.json`;
  const text=JSON.stringify(state,null,2);
  if(FS_SUPPORTED){
    try{
      const h=await window.showSaveFilePicker({id:"stundenzettel-sicherung", startIn:"documents", suggestedName:name, types:PICKER_TYPES});
      const w=await h.createWritable(); await w.write(text); await w.close();
      toast("Sicherungskopie gespeichert: "+h.name);
    }catch(err){ if(!(err&&err.name==="AbortError")) toast("Sicherungskopie fehlgeschlagen: "+err.message,"warn"); }
    return;
  }
  const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
  const el=document.createElement("a"); el.href=url; el.download=name; document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
  toast("Sicherungskopie heruntergeladen.");
}

/* ---------------- Auto-Stempeln beim Öffnen (wie Workbook_Open im Original) ---------------- */
function autoStampKommenOnOpen(){
  if(!state.settings.stempelnAktiv) return false;
  if(!ensureTodayYear(true)) return false;
  const now = new Date();
  const wd = jsWeekdayKey(now);
  if(wd==="sa"||wd==="so") return false;
  const k = dateKey(now);
  const d = ensureDay(k);
  if(d.stamps.length>0) return false; // heute schon irgendeine Stempelung vorhanden
  const t = addMinutesToTimeStr(nowTimeStr(), -(state.settings.stempelOffsetKommenMin||0));
  d.stamps.push(t);
  markAutoStamp(d, d.stamps.length-1);
  markDirty();
  toast("Automatisch gestempelt (Kommt): "+t);
  return true;
}

/* ---------------- Auto-Stempeln & Pausenerinnerung ---------------- */
let firedBreaks = new Set();
let lastCyclicWarnAt = {}; // Tag-Key -> Timestamp der letzten zyklischen 9h/10h-Warnung
const CYCLIC_WARN_INTERVAL_MS = 15*60*1000; // alle 15 Min. erneut warnen, solange noch offen gestempelt
function shiftLimitTime(hoursAfterKommtNetto){
  const k = todayKey();
  const kommt = state.days[k]?.stamps?.[0];
  if(!kommt) return null;
  // Ab 9h Netto greift laut Pausenregel immer die 45-Min-Pause (unabhängig vom Wochentag) —
  // die kürzere 30-Min-Pause (Fr/Sa/So/Feiertag) gilt nur UNTER 9h Netto. Da 9h und 10h
  // Zielmarken selbst schon bei/über 9h liegen, ist hier immer mit 45 Min zu rechnen.
  const rl = rulesOf();
  const t = addMinutesToTimeStr(kommt, rl.longPauseMin + Math.round(hoursAfterKommtNetto*60));
  return (timeToMin(t) > timeToMin(rl.latestEnd)) ? rl.latestEnd : t;
}
function tenHourLimitTime(){ return shiftLimitTime(10); }
function nineHourLimitTime(){ return shiftLimitTime(9); }
function checkTenHourLimit(){
  if(!dataLoaded) return;
  const k = todayKey();
  const d = state.days[k];
  if(!d || !isDayOpen(d)) return; // nur relevant, solange heute noch offen gestempelt ist
  const nineT = nineHourLimitTime();
  if(!nineT) return;
  const nowStr = nowTimeStr();
  if(nowStr < nineT) return; // noch keine 9h erreicht
  const nowMs = Date.now();
  if(lastCyclicWarnAt[k] && (nowMs - lastCyclicWarnAt[k]) < CYCLIC_WARN_INTERVAL_MS) return;
  lastCyclicWarnAt[k] = nowMs;
  const tenT = tenHourLimitTime();
  const overTen = tenT && nowStr >= tenT;
  const msg = overTen
    ? "10-Stunden-Grenze erreicht/überschritten (seit "+tenT+")! Bitte Feierabend einplanen."
    : "Schon über 9 Stunden gearbeitet — 10h-Grenze um "+tenT+".";
  fireBigAlert(msg, overTen ? "danger" : "warn");
}
function checkAutoStamps(){
  if(!dataLoaded) return;
  checkTenHourLimit();
  const now = new Date();
  const k = dateKey(now);
  const wd = jsWeekdayKey(now);
  if(wd==="sa"||wd==="so") return;

  const nowStr = pad2(now.getHours())+":"+pad2(now.getMinutes());
  const schedule = (rulesOf().breaks[dayGroup(now)]||[]).filter(b=>b.start&&b.end).map(b=>[b.start,b.end,b.label||"Pause"]);

  for(const [start,end,tag] of schedule){
    const startKey = k+"_"+tag+"_start";
    const endKey = k+"_"+tag+"_end";
    if(nowStr===start && !firedBreaks.has(startKey)){
      firedBreaks.add(startKey);
      const activeTask = state.tasks.find(t=>t.status==="in Arbeit");
      if(activeTask && state.settings.stempelnAktiv){ taskPause(activeTask.id); markDirty(); renderHeute(); renderMiniPlayer(); if(currentView==="auftraege") renderAuftraege(); }
      fireBigAlert("☕ Pause: "+tag+" beginnt jetzt ("+start+")."+(activeTask&&state.settings.stempelnAktiv?" Auftrag „"+(activeTask.orderNr||"ohne Nr.")+"“ automatisch pausiert.":""), "warn");
    }
    if(nowStr===end && !firedBreaks.has(endKey)){
      firedBreaks.add(endKey);
      const pausedTask = state.tasks.find(t=>t.status==="Pause");
      if(pausedTask && state.settings.stempelnAktiv){ taskStart(pausedTask.id); markDirty(); renderHeute(); renderMiniPlayer(); if(currentView==="auftraege") renderAuftraege(); }
      fireBigAlert("☕ Pause: "+tag+" endet jetzt ("+end+")."+(pausedTask&&state.settings.stempelnAktiv?" Auftrag „"+(pausedTask.orderNr||"ohne Nr.")+"“ automatisch fortgesetzt.":""), "warn");
    }
  }
}
/* no automatic stamping V3 */

/* ---------------- Clock ---------------- */
setInterval(()=>{
  const el=document.getElementById("railClock");
  if(el) el.textContent = new Date().toLocaleTimeString("de-DE");
}, 1000);

// Live-Aktualisierung von "IST heute" & Co., solange man noch gestempelt ist — nur die Kennzahlen-Kacheln,
// damit ein offenes Zeitfeld beim Tippen nicht durch ein Neu-Rendern gestört wird.
setInterval(()=>{
  if(currentView==="heute") renderHeuteKpis(todayKey());
}, 30000);

// Live-Aktualisierung der "Heute"-Zeile in der Monatsansicht (Kommt/Geht-Vorschlag, IST/Saldo), solange der
// vorgeschlagene Code bereits in der Vergangenheit liegt — pausiert, falls gerade irgendwo in der Tabelle getippt wird.
setInterval(()=>{
  if(currentView!=="monat" || currentMonthIdx!==new Date().getMonth()) return;
  const table = document.getElementById("monatTable");
  if(table && table.contains(document.activeElement)) return;
  renderMonat();
}, 60000);

/* ---------------- Helpers ---------------- */
function escapeHtml(s){ return String(s==null?"":s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderAll(){ renderCurrentView(); }

/* ---------------- Boot ---------------- */
async function boot(){
  // Leerer Platzhalterstand: wird nie gespeichert (dataLoaded=false) und dient nur dazu, dass die Oberfläche hinter dem Startbildschirm intakt ist.
  state = normalizeState(freshYearState(new Date().getFullYear()));
  currentMonthIdx = new Date().getMonth();
  switchView("heute");
  updateSaveStatusUI();
  let stored = null, message = "";
  if(FS_SUPPORTED){
    stored = await idbGet("backupFile");
    if(stored){
      try{
        // Nur lesen – beim Start wird nie in die Datei geschrieben.
        if(await stored.queryPermission({mode:"readwrite"})==="granted" && await openFromHandle(stored)) return;
      }catch(err){ message = "Die zuletzt verwendete Datei konnte nicht gelesen werden: "+err.message; }
    }
  }
  openStartDialog(stored, message);
}
boot();
