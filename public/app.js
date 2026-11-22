import { api, button, dateLabel, el, esc, field, form, notice, phases, roleOptions, roles, serialize, tag } from './ui.js';
import { renderWorkspace } from './workspace.js';

const route = el('#route');
const landing = el('#landing');
const path = location.pathname.replace(/\/$/, '') || '/';
const query = new URLSearchParams(location.search);
let role = ['builder', 'finder', 'evaluator'].includes(query.get('role')) ? query.get('role') : 'builder';
let eventStatus = {};
const nav = el('#main-nav');
const menu = el('.menu-toggle');
menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  }
});

function shell(title, lead, body, label = 'SWAP HACK') {
  document.title = title + ' | Swap Hack';
  route.innerHTML = `<div class="narrow"><p class="eyebrow">${label}</p><h1>${title}</h1><p class="lede">${lead}</p>${body}</div>`;
}
async function openDemo(role, start = '') {
  await api('demo', { role, start });
  location.href = '/workspace';
}
function demo() {
  const cards = [
    ['builder', 'Open your anonymous brief, check milestones and see the final submission.'],
    ['finder', 'Try the sample project and rate how well it solves your problem.'],
    ['judge', 'Open the queue and score an anonymous entry.'],
    ['organizer', 'Inspect the entries, phase controls, assignments and standings.'],
    ['evaluator', 'Give feedback on assigned solutions with the peer rubric.'],
    ['new', 'Try the full registration form using fictional details.'],
  ];
  shell('Take it for a spin.', 'Choose a role to explore the same fictional event. You can switch roles and see how your changes carry across the workspace.', `
    <div class="demo-grid">${cards.map(([key, desc]) => `<form class="panel demo-option" data-demo="${key}"><h3>${roles[key]}</h3><p>${desc}</p><div class="actions">${button('Open ' + (key === 'new' ? 'registration' : roles[key].toLowerCase() + ' view'))}</div><p class="notice" role="status"></p></form>`).join('')}</div>`, 'INTERACTIVE DEMO');
  for (const form of route.querySelectorAll('[data-demo]')) form.addEventListener('submit', async (event) => {
    event.preventDefault();
    form.querySelector('button').disabled = true;
    try { await openDemo(form.dataset.demo, form.dataset.demo === 'new' ? 'registration' : ''); }
    catch (error) { notice(form, error.message, true); form.querySelector('button').disabled = false; }
  });
}
function signIn() {
  if (query.has('organizer')) {
    shell('Organizer access', 'Enter the key configured for this deployment.', '<div class="panel">' +
      form('admin-login', field('key', 'Organizer key', 'password', '', { max: 500, attributes: 'autocomplete="current-password"' }), 'Open organizer workspace') + '</div>');
    bindSignIn();
    return;
  }
  shell('Event workspace', 'Sign in with the email you used to enter or the one your organizer invited.', `
    <div class="panel">
      ${form('email-request', field('email', 'Email address', 'email', '', { max: 254, attributes: 'autocomplete="email"' }), 'Send sign-in code')}
      <div id="code-step" hidden></div>
    </div>
    <div class="actions spaced"><a class="text-link" href="/demo">Explore the demo</a><a class="text-link" href="/workspace?organizer=1">Organizer sign-in</a></div>`);
  bindSignIn();
}
function bindSignIn() {
  const request = el('[data-action=email-request]', route);
  const admin = el('[data-action=admin-login]', route);
  if (admin) onSubmit(admin, async (data) => {
    await api('admin/sign-in', data);
    location.href = '/workspace';
  });
  if (request) onSubmit(request, async (data) => {
    const response = await api('sign-in/request', data);
    const codeStep = el('#code-step', route);
    codeStep.hidden = false;
    codeStep.classList.add('spaced');
    codeStep.innerHTML = form('email-confirm', field('code', 'Eight-digit code', 'text', '', {
      max: 8, attributes: 'inputmode="numeric" pattern="[0-9]{8}" autocomplete="one-time-code"',
    }), 'Confirm and continue', { email: data.email });
    notice(request, response.code ? 'Local development code ' + response.code : 'Code sent. Check your inbox.');
    const confirm = el('form', codeStep);
    el('input[name=code]', confirm).focus();
    onSubmit(confirm, async (payload) => {
      await api('sign-in/confirm', payload);
      location.href = path === '/join' ? '/workspace?role=' + encodeURIComponent(role) : '/workspace';
    });
  });
}
function join() {
  const open = eventStatus.phase === 'registration';
  shell('Join the swap.', 'Bring a real problem from your corner of Gujarat. Choose how you want to take part.', `
    <div class="panel">
      <div class="meta">${tag(phases[eventStatus.phase] ?? 'Registration status unavailable')}${eventStatus.start ? `<span>${dateLabel(eventStatus.start)}</span>` : ''}</div>
      ${roleOptions(role)}
      ${open ? form('email-request', field('email', 'Email address', 'email', '', { max: 254, attributes: 'autocomplete="email"' }), 'Send verification code') + '<div id="code-step" hidden></div>' : `
        <p>Live registration is currently closed. Use the demo to try the same form with sample details.</p>
        <form class="form" data-demo-join><div class="actions">${button('Try registration')}</div><p class="notice" role="status"></p></form>
      `}
    </div><p class="spaced"><a class="text-link" href="/workspace">Already entered? Open your workspace</a></p>`, 'REGISTRATION');
  for (const input of route.querySelectorAll('[name=role]')) input.addEventListener('change', () => { role = input.value; });
  const demoForm = el('[data-demo-join]', route);
  if (demoForm) onSubmit(demoForm, async () => {
    await api('demo', { role: 'new', start: 'registration' });
    location.href = '/workspace?role=' + encodeURIComponent(role);
  });
  bindSignIn();
}
function onSubmit(formElement, callback) {
  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = formElement.querySelector('button');
    button.disabled = true;
    notice(formElement, '');
    try { await callback(serialize(formElement)); }
    catch (error) { notice(formElement, error.message, true); }
    finally { button.disabled = false; }
  });
}
function verify() {
  const id = query.get('id')?.toUpperCase() || '';
  shell('Verify a certificate.', 'Enter the ID printed on a Swap Hack certificate to check who earned it and what they completed.', `
    <div class="panel">${form('verify', field('id', 'Certificate ID', 'text', id, { max: 40, attributes: 'placeholder="SWAP-…" autocapitalize="characters" autocomplete="off"' }), 'Verify certificate')}
    <div class="actions"><a class="text-link" href="/verify?id=DEMO-SWAP-26">Try a sample certificate</a></div></div>
    <div id="certificate-result"></div>`, 'CERTIFICATE CHECK');
  const formElement = el('form', route);
  const output = el('#certificate-result', route);
  async function checkCertificate(data) {
    output.replaceChildren();
    const value = data.id.trim().toUpperCase();
    const result = await api('certificates/' + encodeURIComponent(value));
    history.replaceState({}, '', '/verify?id=' + encodeURIComponent(value));
    output.innerHTML = `<article class="panel certificate" role="status">
      ${tag(result.demo ? 'Sample certificate' : 'Verified certificate')}
      <h2>${esc(result.name)}</h2><p>${esc(result.kind)}${result.date ? ' · ' + dateLabel(result.date) : ''}</p>
      <p class="mono">${esc(result.id)}</p></article>`;
  }
  onSubmit(formElement, checkCertificate);
  if (id) formElement.requestSubmit();
}
function legal(name) {
  const privacy = name === 'privacy';
  const text = eventStatus[name];
  const fallback = privacy
    ? 'Registration collects an email address, name, town and role, plus college details for students. Phone is optional. Organizers use these details to run the event. Builders and reviewers see anonymous briefs. The demo uses fictional sample data. Use fictional details while trying its forms.'
    : 'Swap Hack is open to adults aged 18 and older. Builders and wildcard evaluators must be current students. Each builder may enter once, solo or with one teammate. Creators keep ownership of their own work. Live registration requires the organizer’s published terms.';
  shell(privacy ? 'Privacy notice' : 'Event terms', text ? esc(eventStatus.organizer) : 'Event details for the public preview.', `
    <article class="panel"><p class="brief-copy">${esc(text || fallback)}</p>
      ${privacy && eventStatus.contact ? `<p>Contact <a href="mailto:${esc(eventStatus.contact)}">${esc(eventStatus.contact)}</a>.</p>` : ''}
    </article>`);
}
async function results() {
  const data = await api(query.has('demo') ? 'results?demo=1' : 'results');
  shell('The results.', 'The top projects and their anonymous matches are revealed at the finale with participants’ permission.', data ? `
    ${data.demo ? '<p class="notice">Demo results from your fictional event.</p>' : ''}
    <ol class="result-list">${data.top.map((entry) => `<li class="panel"><div class="meta">${tag('Place ' + entry.rank)}${tag(entry.score + ' / 100')}</div>
      <h2>${esc(entry.title)}</h2>${entry.builder ? `<p>Built by ${esc(entry.builder)}</p>` : ''}
      ${entry.authors.length ? `<p>Brief by ${esc(entry.authors.join(', '))}</p>` : ''}</li>`).join('')}</ol>
    ${data.bestProblem ? `<article class="panel panel-tint"><div class="meta">${tag('Best problem')}</div><h2>${esc(data.bestProblem.title)}</h2>
      ${data.bestProblem.authors.length ? `<p>Brief by ${esc(data.bestProblem.authors.join(', '))}</p>` : ''}</article>` : ''}` : `
    <div class="panel"><h2>Results are pending</h2><p>Check back after the finale. You can see the scoring workflow from the organizer view in the demo.</p><div class="actions"><a class="button button-ink" href="/demo">Try the demo</a></div></div>`, 'THE FINALE');
}
async function start() {
  if (path === '/demo') { demo(); return; }
  if (path === '/verify') { verify(); return; }
  if (path === '/workspace') {
    if (query.has('organizer')) { signIn(); return; }
    try {
      await renderWorkspace(route, role);
    } catch (error) {
      if (error.status !== 401) throw error;
      signIn();
    }
    return;
  }
  if (['/', '/join', '/terms', '/privacy'].includes(path)) {
    eventStatus = await api('status').catch(() => ({}));
    if (path === '/') {
      const facts = [eventStatus.start && 'Starts ' + dateLabel(eventStatus.start), eventStatus.finale && 'Finale ' + dateLabel(eventStatus.finale), eventStatus.venue].filter(Boolean);
      if (facts.length) el('#date-note').textContent = facts.join(' · ');
      if (eventStatus.updates) {
        const update = document.createElement('p');
        update.className = 'notice';
        update.textContent = eventStatus.updates;
        el('#date-note').after(update);
      }
      return;
    }
    if (path === '/join') join();
    else legal(path.slice(1));
    return;
  }
  if (path === '/results') { await results(); return; }
  shell('Page unavailable.', 'The requested page could not be found.', '<a class="button button-ink" href="/">Back to Swap Hack</a>');
}
if (path !== '/') {
  landing.hidden = true;
  route.hidden = false;
  route.innerHTML = '<p class="lede" role="status">Loading…</p>';
}
start().catch((error) => shell('Try again shortly.', 'The event service could not load this page.', `<div class="notice error">${esc(error.message)}</div><p class="spaced"><a class="text-link" href="/">Back to Swap Hack</a></p>`));
