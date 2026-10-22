/* DOM-Adapter für die reinen ExcelParity-Regeln; keine Speicherung im Modul. */
(function (root, factory) {
  const api = factory();
  if (root) root.StundenzettelExcelViews = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const browser = typeof globalThis !== 'undefined' ? globalThis : window;
  const n = value => Number(value) || 0;
  const hm = value => { value = Math.round(value || 0); return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0'); };
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  function ensure(state) {
    const defaults = { region: '', customHolidays: [], calculator: { arrival: '07:00', departure: '', regular: 7.6, tenHour: 10, breakMoThu: 45, breakFriday: 30 } };
    state.settings.excelParity = Object.assign({}, defaults, state.settings.excelParity || {});
    state.settings.excelParity.calculator = Object.assign({}, defaults.calculator, state.settings.excelParity.calculator || {});
    return state.settings.excelParity;
  }
  function renderHolidayEditor(ctx) {
    const box = byId('excelHolidayEditor'); if (!box || !browser.ExcelParity) return;
    const p = ensure(ctx.state), regions = browser.ExcelParity.REGIONS;
    const factorOpts=(sel)=>[[0,'frei'],[0.5,'halber Tag'],[1,'Arbeitstag']].map(([val,label])=>`<option value="${val}" ${Number(sel)===val?'selected':''}>${label}</option>`).join('');
    box.innerHTML = `<div class="set-row"><div class="set-label"><strong>Bundesland</strong><small>Bestimmt die regionalen Feiertage (z. B. Fronleichnam, Allerheiligen). Ohne Auswahl gelten nur bundesweite Feiertage.</small></div><div class="set-ctl"><select id="epRegion"><option value="">Bundesweit (nur gemeinsame Tage)</option>${Object.entries(regions).map(([k,v]) => `<option value="${k}" ${p.region===k?'selected':''}>${k} – ${v}</option>`).join('')}</select></div></div><div class="set-row stack"><div class="set-label"><strong>Eigenen Feiertag hinzufügen</strong><small>z. B. Betriebsruhe oder Brückentag</small></div><div class="set-ctl add-holiday"><input id="epCustomDate" type="date" aria-label="Datum"><input id="epCustomName" placeholder="Bezeichnung" aria-label="Bezeichnung"><select id="epCustomFactor" aria-label="Faktor">${factorOpts(0)}</select><button id="epCustomAdd" class="secondary" type="button">Hinzufügen</button></div></div><div class="tablewrap holiday-list-wrap"><table class="holiday-list"><thead><tr><th scope="col">Datum</th><th scope="col">Bezeichnung</th><th scope="col">Faktor</th><th scope="col">Quelle</th><th scope="col"><span class="sr-only">Aktion</span></th></tr></thead><tbody id="epHolidayList"></tbody></table></div>`;
    const todayIso = new Date().toISOString().slice(0,10);
    const dateLabel = iso => { const [y,m,d]=iso.split('-').map(Number); const wd=['So','Mo','Di','Mi','Do','Fr','Sa'][new Date(y,m-1,d).getDay()]; return `${wd}, ${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`; };
    const factorLabel = f => Number(f)===0 ? 'frei' : Number(f)===0.5 ? 'halber Tag' : Number(f)===1 ? 'Arbeitstag' : escapeHtml(f);
    const sourceLabel = h => h.source==='Eigene Einstellung' ? 'Eigener Feiertag' : (h.regions && !h.regions.includes('ALL') ? 'Regional (' + h.regions.join(', ') + ')' : 'Bundesweit');
    const refresh = () => { const list=browser.ExcelParity.workbookHolidays(ctx.state.settings.year,{region:p.region||null,custom:p.customHolidays}); ctx.state.holidays=list.map(h=>({date:h.date,label:h.name,factor:h.factor,source:h.source})); byId('epHolidayList').innerHTML=list.length ? list.map(h=>{const customIndex=h.source==='Eigene Einstellung'?p.customHolidays.findIndex(x=>x.date===h.date&&x.name===h.name&&x.factor===h.factor):-1;return `<tr class="${h.date<todayIso?'is-past':''}"><td class="holiday-list-date">${dateLabel(h.date)}</td><td>${escapeHtml(h.name)}</td><td class="holiday-list-factor">${factorLabel(h.factor)}</td><td>${sourceLabel(h)}</td><td>${customIndex>=0?`<button type="button" class="secondary holiday-list-remove" data-i="${customIndex}" aria-label="${escapeHtml(h.name)} entfernen">Entfernen</button>`:''}</td></tr>`;}).join(''):'<tr class="holiday-list-empty"><td colspan="5">Keine Feiertage für diese Auswahl.</td></tr>'; box.querySelectorAll('.holiday-list-remove').forEach(b=>b.onclick=()=>{p.customHolidays.splice(Number(b.dataset.i),1); ctx.markDirty(); refresh(); ctx.renderSettings();}); };
    byId('epRegion').onchange=e=>{p.region=e.target.value; ctx.markDirty(); refresh(); ctx.renderSettings();};
    byId('epCustomAdd').onclick=()=>{ const date=byId('epCustomDate').value,name=byId('epCustomName').value.trim(),factor=Number(byId('epCustomFactor').value); if(!date||!name||!Number.isFinite(factor)){ctx.toast('Datum, Bezeichnung und Faktor sind erforderlich.','warn');return;} p.customHolidays.push({date,name,factor});ctx.markDirty();refresh();ctx.renderSettings();};
    refresh();
  }
  let durationMode = 'decimal';
  const hmSigned = hours => {
    const h = Number(hours) || 0;
    if (durationMode !== 'hm') { const v = Math.round(h * 100) / 100; return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',') + ' h'; }
    const mins = Math.round(h * 60);
    const core = browser.StundenzettelTimeCore;
    const text = core ? core.formatDuration(Math.abs(mins), 'hm') : String(Math.abs(mins) / 60);
    return (mins < 0 ? '−' : '') + text + ' h';
  };
  function renderMonth(ctx, monthNumber, sums, opening) {
    const box=byId('monatAbschluss'); if(!box||!browser.ExcelParity)return;
    durationMode=(ctx.state.ui&&ctx.state.ui.durationFormat)||'decimal';
    const adj=ctx.ensureMonthAdjust(monthNumber); if(adj.special==null)adj.special=''; if(adj.additionalHours==null)adj.additionalHours=0;
    const payout=n(adj.payout), diff=Math.round((sums.ist-sums.soll)*100)/100;
    const closing=browser.ExcelParity.monthlyClosingBalance({carryOver:opening,actual:sums.ist,target:sums.soll,payout,special:adj.special});
    const special=adj.special!=='';
    box.innerHTML=`<h2>Monatsabschluss <small>so entsteht der Saldo am Monatsende</small></h2>
      <table class="calc-table"><tbody>
        <tr><td>Übertrag aus dem Vormonat</td><td class="v">${hmSigned(opening)}</td></tr>
        <tr><td>+ IST-Zeit <small>geleistete Arbeitszeit</small></td><td class="v">${hmSigned(sums.ist)}</td></tr>
        <tr><td>− SOLL-Zeit <small>Vorgabe für den Monat</small></td><td class="v">${hmSigned(sums.soll)}</td></tr>
        <tr class="sub"><td>= Differenz im Monat</td><td class="v ${diff>=0?'pos':'neg'}">${hmSigned(diff)}</td></tr>
        <tr><td><label for="mPayout">− Auszahlung <small>ausgezahlte Überstunden</small></label></td><td class="v"><input id="mPayout" type="number" step="0.1" value="${payout}"> h</td></tr>
        <tr class="total"><td>= Saldo am Monatsende${special?' <small>(mit Sonderregel)</small>':''}</td><td class="v">${hmSigned(closing)}</td></tr>
      </tbody></table>
      <details class="calc-special" ${special?'open':''}><summary>Sonderregel „Zusätzliche Überstunden“ ${special?'· aktiv':''}</summary>
        <p class="hint">Nur ausfüllen, wenn der Monat nach der Sonderregel abgeschlossen werden soll: Bei einem Plus im Monat bis 30 h werden die Mehrstunden nicht gutgeschrieben (Übertrag − Auszahlung), über 30 h werden 30 h abgezogen (Übertrag + Differenz − 30 h); bei einem Minus gilt Übertrag + Differenz. Leer = normaler Abschluss. Die Regel wirkt nur auf diese Anzeige, nicht auf den Übertrag in den Folgemonat.</p>
        <div class="set-ctl unit"><input id="epSpecial" value="${escapeHtml(String(adj.special))}" placeholder="leer = normaler Abschluss"></div>
      </details>`;
    byId('mPayout').onchange=e=>{adj.payout=n(e.target.value);ctx.markDirty();ctx.renderMonth();};
    byId('epSpecial').onchange=e=>{adj.special=e.target.value.trim();ctx.markDirty();ctx.renderMonth();};
  }
  function renderCalculator(ctx) {
    const box=byId('rechnerBox'); if(!box||!browser.ExcelParity)return;
    durationMode=(ctx.state.ui&&ctx.state.ui.durationFormat)||'decimal';
    const c=ensure(ctx.state).calculator; if(c.friday==null) c.friday=false;
    const rl=ctx.state.settings.rules; if(rl){ c.breakMoThu=rl.pause.moDo; c.breakFriday=rl.pause.fr; }
    box.innerHTML=`<div class="set-row"><div class="set-label"><strong>Kommt</strong><small>Arbeitsbeginn</small></div><div class="set-ctl calc-inline"><input id="epArrival" type="time" value="${c.arrival}"><button type="button" class="secondary" id="epArrivalToday">Heutiges Kommt</button></div></div>
      <div class="set-row"><div class="set-label"><strong>Geht</strong><small>optional – für den Vergleich mit dem SOLL</small></div><div class="set-ctl"><input id="epDeparture" type="time" value="${c.departure}"></div></div>
      <div class="set-row"><div class="set-label"><strong>SOLL pro Tag</strong></div><div class="set-ctl unit"><input id="epRegular" type="number" step=".1" value="${c.regular}"><span>h</span></div></div>
      <div class="set-row"><div class="set-label"><strong>Obergrenze pro Tag</strong><small>Spätestes Ende nach dieser Netto-Arbeitszeit</small></div><div class="set-ctl unit"><input id="epTen" type="number" step=".1" value="${c.tenHour}"><span>h</span></div></div>
      <div class="set-row"><div class="set-label"><strong>Freitag</strong><small>Es gilt dann die kürzere Pause (${c.breakFriday} statt ${c.breakMoThu} Min.).</small></div><div class="set-ctl"><label class="chk"><input type="checkbox" id="epFriday" ${c.friday?'checked':''}> Rechnung für einen Freitag</label></div></div>
      <div class="kpis" id="epCalcResult" style="margin-top:18px;"></div>`;
    const update=()=>{
      const arr=c.arrival.split(':').map(Number), dep=c.departure?c.departure.split(':').map(Number):null;
      const r=browser.ExcelParity.calculateWorktimeCalculator({arrivalMinutes:arr[0]*60+arr[1],departureMinutes:dep?dep[0]*60+dep[1]:null,regularTargetHours:c.regular,tenHourTargetHours:c.tenHour,breakMoThuMinutes:c.breakMoThu,breakFridayMinutes:c.breakFriday,isFriday:c.friday});
      const kpi=(l,val,cls)=>`<div class="kpi"><div class="l">${l}</div><div class="v ${cls||''}">${val}</div></div>`;
      let html=kpi('SOLL erreicht um',hm(r.regularEndMinutes))+kpi('Spätestes Ende',hm(r.tenHourEndMinutes));
      if(r.actualHours!=null) html+=kpi('IST bis Geht',hmSigned(r.actualHours))+kpi('Abweichung vom SOLL',hmSigned(r.deviationHours),r.deviationHours>=0?'pos':'neg');
      byId('epCalcResult').innerHTML=html;
    };
    const bind=(id,fn)=>{ byId(id).onchange=e=>{fn(e.target);ctx.markDirty();update();}; };
    bind('epArrival',el=>{c.arrival=el.value||c.arrival;}); bind('epDeparture',el=>{c.departure=el.value;});
    bind('epRegular',el=>{c.regular=n(el.value);}); bind('epTen',el=>{c.tenHour=n(el.value);});
    byId('epFriday').onchange=e=>{c.friday=e.target.checked;ctx.markDirty();ctx.renderCalculator&&0;renderCalculator(ctx);};
    byId('epArrivalToday').onclick=()=>{ const t=ctx.todayKommt(); if(!t){ctx.toast('Heute ist noch kein „Kommt“ gestempelt.','warn');return;} c.arrival=t; ctx.markDirty(); renderCalculator(ctx); };
    update();
  }
  function renderTravel(ctx, travelDays) {
    const box=byId('excelTravelCheckpoint');if(!box||!browser.ExcelParity)return; const f=ctx.state.settings.travel,month=new Date().getMonth()+1;const x=browser.ExcelParity.calculateTravelCosts({travelDays,oneWayKilometres:n(f.distanceKm),ratePerKilometre:n(f.pricePerKm),month,fixedCost:n(f.fixedPerYear),percent:n(f.consumptionPer100),multiplier:n(f.pricePerLiter)});box.innerHTML=`<h2>Fahrtkosten-Berechnung</h2><div class="kpis"><div class="kpi"><div class="l">Fahrtage im Jahr</div><div class="v">${x.annualTravelDays}</div></div><div class="kpi"><div class="l">Kilometer im Jahr (hin + zurück)</div><div class="v">${x.annualKilometres.toFixed(1)}</div></div><div class="kpi"><div class="l">Kilometergeld-Hochrechnung</div><div class="v">${x.projectedMonthlyAmount.toFixed(2)} €</div></div><div class="kpi"><div class="l">Kosten pro Monat</div><div class="v">${x.monthlyAmount.toFixed(2)} €</div></div><div class="kpi"><div class="l">Gesamtkosten</div><div class="v">${x.totalAmount.toFixed(2)} €</div></div></div><p class="hint">Grundlage sind die Eingaben oben (Entfernung, Kilometersatz, Fixkosten, Verbrauch, Spritpreis).</p>`;
  }
  return Object.freeze({ ensure, renderHolidayEditor, renderMonth, renderCalculator, renderTravel });
});
