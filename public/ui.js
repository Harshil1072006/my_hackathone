export const roles = { builder: 'Builder', finder: 'Pain finder', evaluator: 'Wildcard evaluator', judge: 'Judge', organizer: 'Organizer', new: 'New participant' };
export const phases = { draft: 'Dates to be announced', registration: 'Registration open', screening: 'Screening and matching', build: 'Build week', review: 'Testing and judging', results: 'Results announced' };
export const rolesCopy = { builder: 'Build for someone else’s brief', finder: 'Share a real problem', evaluator: 'Share and review solutions' };
export const areas = ['Agriculture', 'Education', 'Health', 'Trade and exports', 'Local business', 'Finance', 'Public services', 'Everyday life', 'Other'];
export const languages = ['English', 'Gujarati', 'Hindi'];
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
export const el = (selector, parent = document) => parent.querySelector(selector);
export async function api(path, data) {
  const response = await fetch('/api/' + path, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.error || 'Something went wrong. Try again.');
    error.status = response.status;
    throw error;
  }
  return result;
}
export function dateLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(date + 'T00:00:00+05:30'));
}
export const button = (text, kind = 'ink') => `<button type="submit" class="button button-${kind}">${esc(text)}</button>`;
export const field = (name, label, type = 'text', current = '', { optional = false, max = 240, help = '', attributes = '' } = {}) =>
  `<label class="field">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}<input type="${type}" name="${name}" value="${esc(current)}" ${optional ? '' : 'required'} maxlength="${max}" ${attributes}></label>`;
export const textarea = (name, label, current = '', { optional = false, max = 1000, help = '' } = {}) =>
  `<label class="field">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}<textarea name="${name}" maxlength="${max}" ${optional ? '' : 'required'}>${esc(current)}</textarea></label>`;
export const choose = (name, label, choices, current = '', { optional = false } = {}) =>
  `<label class="field">${esc(label)}<select name="${name}" ${optional ? '' : 'required'}><option value="">Choose</option>${choices.map((choice) => {
    const [id, title] = Array.isArray(choice) ? choice : [choice, choice];
    return `<option value="${esc(id)}" ${String(id) === String(current) ? 'selected' : ''}>${esc(title)}</option>`;
  }).join('')}</select></label>`;
export const check = (name, content, { required = false, checked = false } = {}) =>
  `<label class="check"><input type="checkbox" name="${name}" ${required ? 'required' : ''} ${checked ? 'checked' : ''}><span>${content}</span></label>`;
export const tag = (text) => `<span class="tag">${esc(text)}</span>`;
export function form(action, content, text, fields = {}) {
  return `<form class="form" data-action="${action}">${Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${name}" value="${esc(value)}">`).join('')}${content}
    <div class="actions">${button(text)}</div><p class="notice" role="status"></p></form>`;
}
export function notice(parent, text, error = false) {
  const feedback = el('.notice', parent);
  feedback.textContent = text;
  feedback.classList.toggle('error', error);
  feedback.setAttribute('role', error ? 'alert' : 'status');
}
export function serialize(formElement) {
  const data = Object.fromEntries(new FormData(formElement));
  for (const box of formElement.querySelectorAll('input[type=checkbox]')) data[box.name] = box.checked;
  if (formElement.dataset.action === 'register') data.consent = Array.from({ length: 6 }, (_, i) => data['consent' + i]);
  if (formElement.dataset.action === 'review') {
    data.ratings = [...formElement.querySelectorAll('[name^=rating]')].map((input) => Number(input.value));
    data.comments = [...formElement.querySelectorAll('[name^=comment]')].map((input) => input.value);
  }
  return data;
}
export function external(url, text) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer" class="text-link">${esc(text)}</a>`;
  } catch { /* Ignore malformed links. */ }
  return '';
}
export const row = (label, text) => `<dt>${esc(label)}</dt><dd class="brief-copy">${esc(text || 'Pending')}</dd>`;
export function briefFields(brief = {}) {
  return `${field('title', 'Problem title', 'text', brief.title, { max: 100, help: 'Use at most 10 words.' })}
    <div class="grid-2">${choose('area', 'Problem area', areas, brief.area)}${choose('language', 'Language', languages, brief.language ?? 'English')}</div>
    ${textarea('description', 'What goes wrong, and how often?', brief.description, { max: 1300, help: 'Describe a real situation in about 100 words.' })}
    ${field('affected', 'Who is affected?', 'text', brief.affected, { max: 220 })}
    ${textarea('outcome', 'What would a working solution let someone do?', brief.outcome, { max: 750, help: 'Describe one result someone can test.' })}
    ${textarea('workaround', 'How do people handle it today?', brief.workaround, { max: 650 })}`;
}
export function roleOptions(selected, onlyFinder = false) {
  return `<fieldset><legend>Choose your role</legend><div class="role-select">${Object.keys(rolesCopy).filter((role) => !onlyFinder || role === 'finder').map((role) =>
    `<label class="role-option"><input type="radio" name="role" value="${role}" ${selected === role ? 'checked' : ''}><span><strong>${roles[role]}</strong><small>${rolesCopy[role]}</small></span></label>`).join('')}</div></fieldset>`;
}
const occupations = [['student', 'Current college student'], ['employed', 'Employed'], ['business', 'Business owner'], ['farming', 'Farmer or self-employed'], ['teacher', 'Teacher or faculty'], ['other', 'Other']];
export function registrationForm(state, selected) {
  const finder = state.role === 'finder';
  if (finder) selected = 'finder';
  const finderStudent = selected === 'finder' && !finder;
  const student = selected !== 'finder' && !finder;
  const statements = [
    'My information is accurate and I am 18 or older.',
    'I keep ownership of my problem idea and allow the organizers to share an anonymous brief with builders. A submission gives me no promise of payment or a solution.',
    'The organizers may keep an anonymous copy in the problem bank for future events.',
    'The organizers may group duplicate problems and split a prize among the verified authors of a winning group.',
    'If my problem is selected, I will test the solution and give feedback on days 17–18.',
    'I accept the <a href="/terms" target="_blank" rel="noopener">event terms</a> and <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.',
  ];
  return form('register', `
    <p>${state.demo ? 'Demo email' : 'Verified email'} <strong>${esc(state.email)}</strong></p>
    ${finder ? '<input type="hidden" name="role" value="finder">' : roleOptions(selected)}
    ${check('adult', 'I am 18 or older.', { required: true })}
    ${finder ? '' : `
      <div class="grid-2">${field('name', 'Full name', 'text', '', { max: 100, attributes: 'autocomplete="name"' })}${field('location', 'Town or village and district', 'text', '', { max: 130 })}</div>
      <div class="grid-2">${field('phone', 'Phone or WhatsApp (optional)', 'tel', '', { optional: true, max: 35 })}${finderStudent ? choose('occupation', 'I am a…', occupations, 'other') : '<input type="hidden" name="occupation" value="student">'}</div>
      <fieldset class="grid-3" id="student-fields" ${student ? '' : 'hidden disabled'}>
        ${field('college', 'College', 'text', '', { max: 140 })}${field('course', 'Course and branch', 'text', '', { max: 130 })}${choose('year', 'Year', ['1', '2', '3', '4', '5', 'Diploma'])}
      </fieldset>
      ${selected === 'builder' ? `${choose('team', 'Team size', [['solo', 'Solo'], ['pair', 'Two people']], 'solo')}
        <fieldset id="team-fields" hidden disabled><div class="grid-2">${field('teammateName', 'Teammate name', 'text', '', { max: 100 })}${field('teammateEmail', 'Teammate email', 'email', '', { max: 254 })}</div>
        <div class="spaced">${check('teamAdult', 'My teammate is 18 or older, studies at college and agrees to join this entry.', { required: true })}</div></fieldset>` : ''}
    `}
    <h3>Your problem brief</h3>
    ${briefFields()}
    ${choose('experience', 'Has this happened to you or someone you know?', [['mine', 'Yes, to me'], ['known', 'Yes, to someone I know'], ['no', 'No']])}
    ${check('privateSafe', 'My brief contains no personal, financial or confidential information.', { required: true })}
    <fieldset class="checks"><legend>Required acknowledgements</legend>${statements.map((text, i) => check('consent' + i, text, { required: true })).join('')}</fieldset>
    ${finder ? '' : `<fieldset class="checks"><legend>Optional permissions</legend>
      ${check('internship', 'Contact me about possible internships.')}${check('future', 'Contact me about future events.')}${check('publicName', 'Credit me by name in the public results.')}</fieldset>`}
  `, 'Submit problem');
}
