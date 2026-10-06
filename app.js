const state = { data: null, service: null, variant: null };

const $ = (id) => document.getElementById(id);
const serviceSelect = $('serviceSelect');
const variantWrap = $('variantWrap');
const variantSelect = $('variantSelect');
const variantLabel = $('variantLabel');
const dateWrap = $('dateWrap');
const submittedDate = $('submittedDate');
const submittedDateLabel = $('submittedDateLabel');
const dateHelper = $('dateHelper');
const checkButton = $('checkButton');
const result = $('result');
const formError = $('formError');

function parseLocalDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function niceDate(date) {
  return new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}
function shortDate(date) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(date);
}
function easterSunday(year) {
  const f = Math.floor, G = year % 19, C = f(year / 100), H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J, month = 3 + f((L + 40) / 44), day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day, 12);
}
function nthWeekday(year, month, weekday, n) {
  const d = new Date(year, month, 1, 12);
  const offset = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + offset + (n - 1) * 7);
  return d;
}
function lastWeekday(year, month, weekday) {
  const d = new Date(year, month + 1, 0, 12);
  d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
  return d;
}
function observedFixedHoliday(year, month, day) {
  const d = new Date(year, month, day, 12);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}
function observedHolidayPair(year, month, firstDay, secondDay) {
  const used = new Set();
  const out = [];
  for (const day of [firstDay, secondDay]) {
    const d = new Date(year, month, day, 12);
    while (d.getDay() === 0 || d.getDay() === 6 || used.has(isoDate(d))) d.setDate(d.getDate() + 1);
    used.add(isoDate(d));
    out.push(d);
  }
  return out;
}
function federalHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const victoria = new Date(year, 4, 24, 12); while (victoria.getDay() !== 1) victoria.setDate(victoria.getDate() - 1);
  const labour = nthWeekday(year, 8, 1, 1);
  const thanksgiving = nthWeekday(year, 9, 1, 2);
  const [christmas, boxing] = observedHolidayPair(year, 11, 25, 26);
  const holidays = [
    observedFixedHoliday(year, 0, 1),
    goodFriday,
    victoria,
    observedFixedHoliday(year, 6, 1),
    labour,
    observedFixedHoliday(year, 8, 30),
    thanksgiving,
    observedFixedHoliday(year, 10, 11),
    christmas,
    boxing
  ];
  return new Set(holidays.map(isoDate));
}
function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !federalHolidays(date.getFullYear()).has(isoDate(date));
}
function addBusinessDays(start, amount) {
  const d = new Date(start);
  let added = 0;
  while (added < amount) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}
function addCalendarDays(start, amount) {
  const d = new Date(start);
  d.setDate(d.getDate() + amount);
  return d;
}
function addMonths(start, amount) {
  const d = new Date(start);
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return d;
}
function daysBetween(a, b) {
  return Math.ceil((b - a) / 86400000);
}
function businessDaysBetween(a, b) {
  if (a >= b) return 0;
  const d = new Date(a);
  let count = 0;
  while (d < b) {
    d.setDate(d.getDate() + 1);
    if (d <= b && isBusinessDay(d)) count++;
  }
  return count;
}
function deadlineFor(start, v) {
  let deadline;
  if (v.unit === 'business_days') deadline = addBusinessDays(start, v.amount);
  else if (v.unit === 'months') deadline = addMonths(start, v.amount);
  else deadline = addCalendarDays(start, v.amount);
  if (v.rollForwardIfClosed) {
    while (!isBusinessDay(deadline)) deadline.setDate(deadline.getDate() + 1);
  }
  return deadline;
}
function remainingFor(today, deadline, v) {
  if (today >= deadline) {
    const overdue = v.unit === 'business_days' ? businessDaysBetween(deadline, today) : Math.max(0, daysBetween(deadline, today));
    return { overdue, remaining: 0 };
  }
  const remaining = v.unit === 'business_days' ? businessDaysBetween(today, deadline) : daysBetween(today, deadline);
  return { overdue: 0, remaining };
}
function categoryOptions(services) {
  const groups = new Map();
  services.forEach(s => {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(s);
  });
  return [...groups.entries()].map(([category, items]) => {
    const options = items.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    return `<optgroup label="${category}">${options}</optgroup>`;
  }).join('');
}
function selectService() {
  state.service = state.data.services.find(s => s.id === serviceSelect.value) || null;
  state.variant = null;
  result.classList.add('hidden');
  formError.textContent = '';
  if (!state.service) {
    variantWrap.classList.add('hidden'); dateWrap.classList.add('hidden'); checkButton.classList.add('hidden'); return;
  }
  variantLabel.textContent = state.service.variantLabel || 'Choose an option';
  variantSelect.innerHTML = state.service.variants.map((v, i) => `<option value="${v.id}">${v.label}</option>`).join('');
  variantWrap.classList.toggle('hidden', state.service.variants.length <= 1);
  state.variant = state.service.variants[0];
  submittedDateLabel.textContent = state.service.dateLabel || 'When was the complete request received?';
  dateHelper.textContent = state.service.dateHelper || 'Use the date the organization received the complete application or request.';
  dateWrap.classList.remove('hidden');
  checkButton.classList.remove('hidden');
}
function selectVariant() {
  if (!state.service) return;
  state.variant = state.service.variants.find(v => v.id === variantSelect.value) || state.service.variants[0];
  result.classList.add('hidden');
}
function makeICS(title, date, description) {
  const stamp = isoDate(date).replaceAll('-', '');
  const content = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//StillWaiting Canada//EN','BEGIN:VEVENT',
    `UID:${Date.now()}@stillwaiting.local`,`DTSTART;VALUE=DATE:${stamp}`,`DTEND;VALUE=DATE:${stamp}`,
    `SUMMARY:${title.replaceAll(',', '\\,')}`,
    `DESCRIPTION:${description.replaceAll('\n', '\\n').replaceAll(',', '\\,')}`,
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'stillwaiting-follow-up.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function checkOfficialSource(service, variant) {
  const box = $('sourceHealth');
  if (!box || !service || !variant) return;
  box.className = 'source-health checking';
  box.innerHTML = '<strong>Official-source check:</strong> checking the current government page…';
  try {
    const res = await fetch(`/api/source-health?service=${encodeURIComponent(service.id)}&variant=${encodeURIComponent(variant.id)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('source check failed');
    const health = await res.json();
    if (health.status === 'verified') {
      box.className = 'source-health verified';
      box.innerHTML = '<strong>Official-source check:</strong> the current government page still contains the rule markers used by this calculator.';
    } else if (health.status === 'changed') {
      box.className = 'source-health changed';
      box.innerHTML = '<strong>Review required:</strong> the official page no longer matches one or more rule markers. Do not rely on this estimate until the stored rule is reviewed. Use the official source below.';
    } else {
      box.className = 'source-health unavailable';
      box.innerHTML = '<strong>Live check unavailable:</strong> we could not verify the official page right now. The stored rule is shown with its last-reviewed date; confirm it on the official source.';
    }
  } catch (e) {
    box.className = 'source-health unavailable';
    box.innerHTML = '<strong>Live check unavailable:</strong> this environment could not reach the official page. The stored rule is shown with its last-reviewed date; confirm it on the official source.';
  }
}

function renderResult() {
  formError.textContent = '';
  if (!state.service || !state.variant || !submittedDate.value) {
    formError.textContent = 'Choose a service and enter the received date.'; return;
  }
  const start = parseLocalDate(submittedDate.value);
  const today = new Date(); today.setHours(12,0,0,0);
  if (start > today) { formError.textContent = 'The received date cannot be in the future.'; return; }
  const deadline = deadlineFor(start, state.variant);
  const { overdue, remaining } = remainingFor(today, deadline, state.variant);
  let cls, pill, headline, subline;
  if (today.getTime() === deadline.getTime()) {
    cls = 'warn'; pill = 'DUE TODAY'; headline = 'Standard date is today';
    subline = 'Today is the estimated published service-standard date.';
  } else if (overdue > 0 || today > deadline) {
    cls = 'over'; pill = 'PAST STANDARD'; headline = `${overdue || 1} ${state.variant.unit === 'business_days' ? 'business ' : ''}day${(overdue || 1) === 1 ? '' : 's'} past`;
    subline = 'The published service standard has passed.';
  } else if (remaining <= 3) {
    cls = 'warn'; pill = 'DUE SOON'; headline = `${remaining} ${state.variant.unit === 'business_days' ? 'business ' : ''}day${remaining === 1 ? '' : 's'} left`;
    subline = 'You are close to the published service-standard date.';
  } else {
    cls = 'good'; pill = 'WITHIN STANDARD'; headline = `${remaining} ${state.variant.unit === 'business_days' ? 'business ' : ''}day${remaining === 1 ? '' : 's'} left`;
    subline = 'You are still within the published service standard.';
  }
  const refund = state.variant.refundNote ? `<p class="disclaimer"><strong>Possible fee remission:</strong> ${state.variant.refundNote}</p>` : '';
  const secondary = state.service.secondaryUrl ? `<a class="action-secondary" href="${state.service.secondaryUrl}" target="_blank" rel="noopener">${state.service.secondaryLabel || 'Check current processing time'} ↗</a>` : '';
  const businessNote = state.variant.unit === 'business_days' ? 'Business-day estimates exclude weekends and major federal holidays. Individual offices or programs may calculate operating days differently.' : '';
  result.innerHTML = `
    <div class="result-top">
      <div><p class="status-kicker">YOUR ESTIMATE</p><h2 class="status-title">${headline}</h2><p>${subline}</p></div>
      <span class="status-pill ${cls}">${pill}</span>
    </div>
    <div class="result-grid">
      <div class="metric"><span>Received</span><strong>${niceDate(start)}</strong></div>
      <div class="metric"><span>Published standard</span><strong>${state.variant.standardText}</strong></div>
      <div class="metric"><span>Estimated standard date</span><strong>${niceDate(deadline)}</strong></div>
    </div>
    <div class="next-box">
      <h3>What to do next</h3>
      <p>${state.variant.nextAction}</p>
      <div class="action-row">
        <a class="action" href="${state.service.sourceUrl}" target="_blank" rel="noopener">Open official source ↗</a>
        ${secondary}
        <button class="action-secondary" id="calendarButton" type="button">Add follow-up date to calendar</button>
        <button class="action-secondary" id="resetButton" type="button">Check another</button>
      </div>
      <div id="sourceHealth" class="source-health checking"><strong>Official-source check:</strong> waiting…</div>
      ${refund}
      <p class="disclaimer"><strong>Source:</strong> ${state.service.sourceLabel}. Stored rule last reviewed ${state.data.verified}. ${businessNote} This is an informational estimate, not legal advice or a guarantee of processing time.</p>
    </div>`;
  result.classList.remove('hidden');
  checkOfficialSource(state.service, state.variant);
  $('calendarButton').addEventListener('click', () => makeICS(`Follow up: ${state.service.name}`, deadline, `Published standard: ${state.variant.standardText}. Check the official source: ${state.service.sourceUrl}`));
  $('resetButton').addEventListener('click', () => { serviceSelect.value = ''; submittedDate.value = ''; selectService(); window.scrollTo({ top: document.querySelector('.checker').offsetTop - 30, behavior: 'smooth' }); });
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function init() {
  try {
    const res = await fetch('services.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`services.json returned ${res.status}`);
    state.data = await res.json();
    serviceSelect.insertAdjacentHTML('beforeend', categoryOptions(state.data.services));
    submittedDate.max = isoDate(new Date());
    const reviewed = parseLocalDate(state.data.verified);
    const ageDays = Math.max(0, daysBetween(reviewed, new Date()));
    const stale = ageDays > (state.data.reviewAfterDays || 30);
    $('dataStamp').textContent = stale
      ? `Stored rules last reviewed ${state.data.verified} — review overdue.`
      : `Stored rules last reviewed ${state.data.verified}. Live source check runs with each result.`;
  } catch (e) {
    formError.textContent = 'The service library could not be loaded. If you opened this file directly, run it through a local web server or Vercel.';
  }
}
serviceSelect.addEventListener('change', selectService);
variantSelect.addEventListener('change', selectVariant);
checkButton.addEventListener('click', renderResult);
$('aboutButton').addEventListener('click', () => $('about').scrollIntoView({ behavior: 'smooth' }));
init();
