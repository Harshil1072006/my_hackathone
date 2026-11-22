import { api, briefFields, button, check, choose, el, esc, external, field, form, notice, phases, registrationForm, roles, row, serialize, tag, textarea } from './ui.js';

const tabs = {
  organizer: [['overview', 'Event settings'], ['intake', 'Entries and briefs'], ['swap', 'Match builders'], ['grading', 'Review and results'], ['certificates', 'Certificates']],
  participant: [['overview', 'Overview'], ['assignment', 'My build'], ['reviews', 'Review queue'], ['certificates', 'Certificates']],
};
const judging = ['Reliability', 'Fit to the problem', 'Build quality', 'Originality', 'Clarity'];
const testing = ['Solves my actual problem', 'Easy to use on my own', 'I would keep using this'];
const canEditPair = (phase) => ['screening', 'build'].includes(phase);
const canScreen = (phase) => ['registration', 'screening', 'build'].includes(phase);
const showBrief = (brief) => `<dl class="data-list">${row('Problem', brief.description)}${row('Who it affects', brief.affected)}${row('Testable outcome', brief.outcome)}${row('Current workaround', brief.workaround)}</dl>`;
const linkGroup = (...links) => `<div class="actions">${links.join('')}</div>`;
const panel = (title, body, extra = '') => `<section class="panel ${extra}"><h2>${title}</h2>${body}</section>`;
const empty = (message) => `<div class="panel panel-tint"><p>${message}</p></div>`;
const home = () => '<a href="/" class="text-link">Event home</a>';
const choiceRows = (list, label) => list.map((item) => [item.id, label(item)]);
const statusLabel = (label) => label ? label.slice(0, 1).toUpperCase() + label.slice(1) : '';

function adminSettings(state) {
  const s = state.settings;
  return panel('Event settings', `<p class="lede">Advance phases when each stage is ready. Publish the standings from Review and results.</p>
    ${form('settings', `
      <div class="grid-2">${choose('phase', 'Current phase', Object.entries(phases).filter(([key]) => key !== 'results' || s.phase === 'results'), s.phase)}
        ${field('venue', 'Finale venue', 'text', s.venue, { optional: true, max: 180 })}</div>
      <div class="grid-3">${field('start', 'Start date', 'date', s.start, { optional: true })}${field('finale', 'Finale date', 'date', s.finale, { optional: true })}
        ${field('retention', 'Personal data deletion date', 'date', s.retention, { optional: true })}</div>
      <div class="grid-2">${field('organizer', 'Organizer name', 'text', s.organizer, { optional: true, max: 140 })}${field('contact', 'Contact email', 'email', s.contact, { optional: true, max: 254 })}</div>
      <div class="grid-3">${choose('finderLimit', 'Problems per pain finder', [1, 2, 3, 4, 5], s.finderLimit)}
        ${choose('peerCount', 'Reviews per peer', [0, 1, 2, 3, 4, 5], s.peerCount)}
        ${choose('groupLimit', 'Authors per merged group', [2, 3, 4, 5, 6, 7, 8, 9, 10], s.groupLimit)}</div>
      <fieldset><legend>Judge rubric out of 50</legend>
      <p class="subtle">Weights lock when testing and judging opens.</p><div class="grid-3">
      ${(s.judgePoints ?? [20, 10, 10, 5, 5]).map((points, index) =>
        field('judgePoint' + index, judging[index], 'number', points, { attributes: state.rubricLocked ? 'readonly' : 'min="1" max="46"' })).join('')}</div></fieldset>
      ${textarea('updates', 'Public update', s.updates, { optional: true, max: 1000 })}
      ${textarea('terms', 'Published terms', s.terms, { optional: true, max: 8000 })}
      ${textarea('privacy', 'Published privacy notice', s.privacy, { optional: true, max: 5500 })}
    `, 'Save event settings')}`);
}
function intake(state) {
  const phase = state.settings.phase;
  const people = state.people.map((person) => `<article class="panel record" id="${esc(person.id)}"><details>
    <summary>${esc(person.name || person.id)} ${tag(roles[person.role])} ${tag(person.verified ? 'Verified' : 'Verification pending')}</summary>
    <dl class="data-list">${row('Entry ID', person.id)}${row('Email', person.email)}${person.phone ? row('Phone', person.phone) : ''}
      ${row('Location', person.location)}${person.college ? row('Enrollment', person.college + ' · ' + person.course + ' · ' + person.year) : ''}
      ${person.teammateName ? row('Teammate', person.teammateName + ' · ' + person.teammateEmail) : ''}
      ${row('Opt-ins', [person.publicName && 'Public credit', person.internship && 'Internships', person.future && 'Future events'].filter(Boolean).join(', ') || 'None')}</dl>
    ${canScreen(phase) || phase === 'review' ? `<div class="spaced">${form('verify-person', `
      ${check('verified', 'Eligibility verified. For a team, verify both builders.', { checked: person.verified })}
      ${field('note', 'Verification note (optional)', 'text', person.verificationNote, { max: 450, optional: true, help: 'Record the outcome only. Keep verification documents and sensitive numbers out of this workspace.' })}
    `, 'Save verification', { id: person.id })}</div>` : ''}
  </details></article>`).join('');
  const problems = state.problems.map((problem) => `<article class="panel record" id="${esc(problem.id)}"><details>
    <summary>${esc(problem.brief.title)} ${tag(statusLabel(problem.status))}</summary>
    <div class="meta">${tag(problem.id)}${tag(state.people.find((person) => person.id === problem.owner)?.name ?? problem.owner)}</div>
    ${canScreen(phase) ? form('screen-problem', `
      <div class="grid-2">${choose('status', 'Screening status', ['new', 'accepted', 'reserve', 'rejected', 'merged'].map((item) => [item, statusLabel(item)]), problem.status)}
      ${choose('group', 'Merge into (if merged)', choiceRows(state.problems.filter((other) => other.id !== problem.id && ['accepted', 'reserve'].includes(other.status)), (item) => item.id + ' · ' + item.brief.title), problem.group, { optional: true })}</div>
      <p class="subtle">Check that the problem is real, testable, feasible in seven days and safe to share. Edit the brief to remove identifying details.</p>
      ${briefFields(problem.brief)}
      ${check('screened', 'I screened this brief and removed identifying details.', { checked: ['accepted', 'reserve'].includes(problem.status) })}
      ${field('note', 'Private screening note (optional)', 'text', problem.note, { max: 440, optional: true })}
    `, 'Save screening', { id: problem.id }) : showBrief(problem.brief)}
  </details></article>`).join('');
  return `<div class="workspace-grid"><div><h2>Entries (${state.people.length})</h2>${people || empty('No registrations yet.')}</div>
    <div><h2>Problem briefs (${state.problems.length})</h2>${problems || empty('No problems submitted yet.')}</div></div>`;
}
function swaps(state) {
  const phase = state.settings.phase;
  const active = state.matches.filter((match) => !match.abandoned);
  const missing = state.people.filter((item) => item.role === 'builder' && item.verified && !active.some((match) => match.builder === item.id));
  const usable = state.problems.filter((item) => ['accepted', 'reserve'].includes(item.status) && !active.some((match) => match.problem === item.id));
  const controls = canEditPair(phase) ? panel('Make the swap', `
    <p class="lede">Assign the approved briefs in one pass, or hand-pick a match from the approved and reserve pools. Builders never receive a problem from their own team.</p>
    ${form('shuffle', '', 'Shuffle approved briefs')}
    <div class="spaced">${form('assign', `<div class="grid-2">
      ${choose('person', 'Unassigned builder', choiceRows(missing, (item) => item.name))}
      ${choose('problem', 'Available brief', choiceRows(usable, (item) => item.brief.title + ' · ' + statusLabel(item.status)))}</div>`, 'Assign this brief')}</div>`) :
    empty('Matching opens during screening and remains available during build week.');
  const assignments = state.matches.map((match) => {
    const person = state.people.find((item) => item.id === match.builder);
    const item = state.problems.find((problem) => problem.id === match.problem);
    const questions = match.questions.map((question) => `<article class="subpanel">
      <p><strong>Original question</strong> ${esc(question.text)}</p>
      ${question.suggested ? `<p><strong>Author’s suggested answer</strong> ${esc(question.suggested)}</p>` : ''}
      ${form('forward', field('text', 'Question to share anonymously', 'text', question.forwarded || question.text, { max: 700 }), 'Send to problem author', { id: match.id, question: question.id })}
      ${form('answer', textarea('answer', 'Answer to publish anonymously', question.answer || question.suggested), 'Send to builder', { id: match.id, question: question.id })}
    </article>`).join('');
    return `<article class="panel record" id="${esc(match.id)}"><details>
      <summary>${esc(person?.name || person?.id)} · ${esc(item?.brief.title)}${tag(match.abandoned ? 'Withdrawn' : match.id)}</summary>
      <dl class="data-list">${row('Problem ID', item?.id)}${row('Build plan', match.plan)}${row('Prototype', match.prototype)}</dl>
      ${match.submission && !state.demo ? linkGroup(external(match.submission.website, 'Live website'), external(match.submission.repo, 'Source repository'), external(match.submission.video, 'YouTube demo')) : ''}
      ${canEditPair(phase) && !match.abandoned ? `<div class="spaced">${form('withdraw', '', 'Withdraw assignment', { id: match.id })}</div>` : ''}
      ${phase === 'build' && !match.abandoned ? questions : ''}
    </details></article>`;
  }).join('');
  return controls + `<h2 class="spaced">Assignments (${active.length})</h2>` + (assignments || empty('No assignments yet.'));
}
function grading(state) {
  const entries = state.matches.filter((item) => item.submission && !item.abandoned);
  const review = state.settings.phase === 'review';
  const result = state.standings.map((item) => `<tr><th scope="row">${esc(item.title)}</th><td>${item.judges}</td><td>${item.finders}</td>
    <td>${item.judge?.toFixed(1) ?? 'Pending'}</td><td>${item.finder?.toFixed(1) ?? 'Judge-only'}</td><td>${item.total?.toFixed(1) ?? 'Pending'}</td></tr>`).join('');
  const header = panel('Judging panel', `
    <p>Invite judges by the email they will use to sign in. Queue reviews after checking the project links, demo length, commit dates, disclosed tools and anonymity.</p>
    <ul class="list">${state.judges.map((judge) => `<li>${esc(judge.name || judge.id)} ${judge.email ? ' · ' + esc(judge.email) : ''}</li>`).join('') || '<li>No judges invited</li>'}</ul>
    ${state.settings.phase !== 'results' ? form('judge', `<div class="grid-2">${field('name', 'Judge name', 'text', '', { max: 100 })}${field('email', 'Judge email', 'email', '', { max: 254 })}</div>`, 'Add judge') : ''}
    ${review ? '<div class="spaced">' + form('panels', '', 'Assign review queues') + '</div>' : ''}
  `);
  const records = entries.map((match) => {
    const problem = state.problems.find((item) => item.id === match.problem);
    return `<article class="panel record" id="${esc(match.id)}"><details>
      <summary>${esc(problem?.brief.title)} ${tag(statusLabel(match.precheck))}</summary>
      <div class="meta">${tag(match.id)}</div>
      ${state.demo ? '<p class="subtle">Fictional sample project</p>' : linkGroup(external(match.submission.website, 'Live website'), external(match.submission.repo, 'Source repository'), external(match.submission.video, 'YouTube demo'))}
      <p class="brief-copy spaced">${esc(match.submission.disclosure)}</p>
      ${review ? `<div class="subpanel">${form('precheck', `<div class="grid-2">${choose('state', 'Precheck decision', [['pending', 'Pending'], ['passed', 'Pass'], ['failed', 'Fail']], match.precheck)}
      ${field('note', 'Organizer note (optional)', 'text', match.precheckNote, { optional: true, max: 500 })}</div>`, 'Save precheck', { id: match.id })}</div>
      ${match.precheck === 'passed' ? `<div class="subpanel">${form('extra-judge',
        choose('judge', 'Add a judge or replace a conflict', choiceRows(state.judges.filter((judge) => !match.reviewers.includes('judge:' + judge.id)), (judge) => judge.name)),
        'Assign judge', { id: match.id })}</div>
        <div class="subpanel">${form('tiebreak', field('votes', 'Judges’ tiebreak votes', 'number', match.scoreOverride, { attributes: 'min="0" max="20"' }), 'Record votes', { id: match.id })}</div>` : ''}` : ''}
      <div class="spaced"><strong>Submitted reviews</strong><ul class="list">${Object.values(match.reviews).map((entry) => `<li>${esc(statusLabel(entry.kind))}
        ${entry.conflict ? ' · Conflict declared' : ' · ' + entry.total + ' / 50'}${entry.notes?.some(Boolean) ? `<p>${esc(entry.notes.filter(Boolean).join(' / '))}</p>` : ''}</li>`).join('') || '<li>No reviews yet</li>'}</ul></div>
    </details></article>`;
  }).join('');
  return header + panel('Standings', `
    <p>At least three judge scores qualify a project. With five scores, we drop the highest and lowest. If no author reviewed an entry, its judge score is scaled to 100. Author points break a tie first, then judges vote.</p>
    ${result ? `<div class="table-scroll"><table class="rank-table"><thead><tr><th>Brief</th><th>Judges</th><th>Authors</th><th>Judge / 50</th><th>Author / 50</th><th>Total / 100</th></tr></thead><tbody>${result}</tbody></table></div>` : '<p>No scores yet.</p>'}
    ${state.published ? `<p class="notice">Results are published. <a class="text-link" href="/results${state.demo ? '?demo=1' : ''}">View results</a></p>` : (review ? `<div class="spaced">${form('publish', '', 'Publish top results')}</div>` : '')}
  `) + `<h2 class="spaced">Final submissions (${entries.length})</h2>` + (records || empty('No final submissions yet.'));
}
function adminCertificates(state) {
  const list = state.certificates.map((cert) => `<article class="panel record"><div class="meta">${tag(cert.kind)}</div><h3>${esc(cert.name)}</h3>
    <a class="mono text-link" href="/verify?id=${encodeURIComponent(cert.id)}">${esc(cert.id)}</a>
    <div class="spaced">${form('revoke-cert', '', 'Revoke certificate', { id: cert.id })}</div></article>`).join('');
  return panel('Issue completion certificates', state.settings.phase === 'results' ? form('issue-cert', `
    <div class="grid-2">${choose('kind', 'Certificate type', ['Builder', 'Winner', 'Pain finder', 'Wildcard evaluator', 'Judge'])}
    ${choose('person', 'Recipient entry', choiceRows([...state.people, ...state.judges], (person) => person.name + ' · ' + person.id))}</div>
    ${check('teammate', 'Issue to the teammate on this entry.')}
    ${check('approved', 'The recipient agreed to have their name shown to anyone with this certificate ID.', { required: true })}
  `, 'Issue certificate') : '<p>Issue certificates after publishing results. The workspace checks that each recipient completed their role.</p>') +
    `<h2 class="spaced">Issued (${state.certificates.length})</h2>` + (list || empty('No certificates have been issued.'));
}
function overview(state, selected) {
  if (state.role === 'new') {
    if (state.settings.phase === 'registration') return panel('Tell us your problem', registrationForm(state, selected));
    return empty('Registration is closed. Your email is signed in.');
  }
  if (state.role === 'judge') return panel('Your judging workspace', '<p>Review the anonymous project links and score each criterion independently. Declare any conflicts before scoring an entry.</p>');
  const problems = state.problems.map((item) => `<article class="panel record"><div class="meta">${tag(item.id)}${tag(statusLabel(item.status))}</div><h3>${esc(item.brief.title)}</h3>${showBrief(item.brief)}</article>`).join('');
  const limit = state.settings.finderLimit;
  return panel('Your entry', `<p>Email ${esc(state.email)}. ${state.verified ? 'Eligibility verified.' : 'Eligibility checks pending.'}</p>
    ${state.role === 'builder' ? '<p>Use My build to open your assigned brief when the build phase starts.</p>' : '<p>If your brief is selected, its solution will appear under Review queue after precheck.</p>'}`) +
    `<h2 class="spaced">Your briefs (${state.problems.length})</h2>${problems || empty('No briefs are linked to this entry.')}` +
    (state.role === 'finder' && state.settings.phase === 'registration' && state.problems.length < limit ? panel('Share another problem', registrationForm(state, 'finder')) : '');
}
function build(state) {
  const project = state.assignment;
  const editable = state.settings.phase === 'build';
  if (!project) return empty('Your anonymous assignment will appear here once the build phase begins.');
  const { problem, submission } = project;
  return panel(esc(problem.title), `<div class="meta">${tag(problem.id)}${tag(problem.area)}${tag(problem.language)}</div>${showBrief(problem)}`, 'panel-tint') +
    panel('Build checkpoints', editable ? `
      <div class="workspace-grid">
        ${form('plan', textarea('plan', 'Day 11 · Five-line plan', project.plan), 'Save build plan', { id: project.id })}
        ${form('prototype', field('prototype', 'Day 13 · Prototype or progress video', 'url', project.prototype, { max: 500 }), 'Save prototype', { id: project.id })}
      </div>` : `<dl class="data-list">${row('Day 11 plan', project.plan)}${row('Day 13 prototype', project.prototype)}</dl>`) +
    panel('Final submission', editable ? form('submit', `
      <p>Due day 16. Use a working HTTPS website, a public repository and a three to four minute YouTube demo.</p>
      <div class="grid-2">${field('website', 'Working website', 'url', submission?.website, { max: 500 })}${field('repo', 'Public repository', 'url', submission?.repo, { max: 500 })}</div>
      ${field('video', 'YouTube demo', 'url', submission?.video, { max: 500 })}
      ${textarea('disclosure', 'Tools, templates, libraries and licences', submission?.disclosure, { max: 1800 })}
      ${check('anonymous', 'The website and video keep our names private and use safe demo data.', { required: true })}`,
    submission ? 'Update submission' : 'Submit final project', { id: project.id }) : (submission ? `
      <div class="meta">${tag(project.precheck === 'passed' ? 'Precheck passed' : (project.precheck === 'failed' ? 'Precheck failed' : 'Precheck pending'))}</div>
      ${state.demo ? '<p>Fictional sample submission. Open the project from the pain finder’s review view to try it.</p>' :
        linkGroup(external(submission.website, 'Live website'), external(submission.repo, 'Repository'), external(submission.video, 'YouTube demo'))}
      <p class="brief-copy spaced">${esc(submission.disclosure)}</p>` : '<p>No final submission.</p>')) +
    (project.feedback?.length ? panel('Peer feedback', `<ol class="list">${project.feedback.map((comments) =>
      `<li><ul class="list">${comments.map((text, index) => `<li><strong>${judging[index]}</strong> ${esc(text)}</li>`).join('')}</ul></li>`).join('')}</ol>`) : '') +
    panel('Questions for the organizer', `
      <p>Use the organizer to relay up to three questions anonymously. ${project.questions.length} of 3 used.</p>
      ${project.questions.map(({ text, answer }) => `<dl class="data-list">${row('Question', text)}${row('Answer', answer)}</dl>`).join('')}
      ${editable && project.questions.length < 3 ? `<div class="spaced">${form('question', textarea('text', 'Your question', '', { max: 700 }), 'Send question', { id: project.id })}</div>` : ''}`);
}
function marketBoard() {
  return `<details class="sample-project"><summary>Open sample project: Market board</summary>
    <div class="subpanel"><p class="eyebrow">FICTIONAL PROJECT</p><h3>Today’s produce requests</h3>
    ${choose('produce', 'Filter by produce', [['all', 'All produce'], ['tomato', 'Tomatoes'], ['okra', 'Okra'], ['millet', 'Millet']], 'all')}
    <ul class="list" data-market><li data-produce="tomato"><strong>Tomatoes</strong> · 20 kg · 8:30 am</li><li data-produce="okra"><strong>Okra</strong> · 12 kg · 10:00 am</li><li data-produce="millet"><strong>Millet</strong> · 35 kg · 11:30 am</li></ul></div>
  </details>`;
}
function reviewCard(state, item) {
  const type = { judge: 'Judge review', peer: 'Peer review', finder: 'Problem author review' }[item.kind];
  const instructions = {
    judge: 'Use 1 for poor, 3 for adequate and 5 for excellent. Give a short reason for each 1 or 5.',
    peer: 'Rate each criterion from 1 to 5 and leave a short comment for the builder. Peer marks are for learning.',
    finder: 'Try the solution against the testable outcome. Use 1 for poor, 3 for adequate and 5 for excellent.',
  }[item.kind];
  const rubric = item.kind === 'finder' ? testing : judging;
  const weights = item.kind === 'finder' ? [25, 15, 10] : state.settings.judgePoints;
  const saved = item.saved;
  const reviewFields = rubric.map((text, index) => `<div class="grid-2">${choose('rating' + index, text + ' (' + weights[index] + ' points)', [1, 2, 3, 4, 5], saved?.ratings?.[index])}
    ${field('comment' + index, 'Reason or feedback' + (item.kind === 'finder' ? ' (optional)' : ''), 'text', saved?.notes?.[index], { optional: item.kind !== 'peer', max: 450 })}</div>`).join('');
  const mark = saved?.conflict ? 'Conflict declared' : (saved ? saved.total + ' / 50 saved' : 'Awaiting review');
  return `<article class="panel record" id="${esc(item.id)}-${item.kind}"><details>
    <summary>${esc(item.problem.title)} ${tag(type)} ${tag(mark)}</summary>
    ${showBrief(item.problem)}
    ${state.demo ? (item.problem.title === 'Market day without the guesswork' ? marketBoard() : '<p class="subtle spaced">This fictional entry is available for scoring practice.</p>') : linkGroup(external(item.website, 'Open live website'), external(item.video, 'Watch demo video'))}
    ${state.settings.phase === 'review' ? `<div class="spaced">${form('review', `
      ${item.kind === 'judge' ? check('conflict', 'Declare a conflict and skip scoring this entry.', { checked: saved?.conflict }) : ''}
      <fieldset data-rubric ${saved?.conflict ? 'hidden disabled' : ''}>
        <p class="subtle">${instructions}</p>
        <div class="rubric-fields">${reviewFields}
          ${item.kind === 'judge' ? check('declaration', 'I have no conflict of interest and am scoring independently.', { required: true, checked: Boolean(saved && !saved.conflict) }) : ''}
        </div>
      </fieldset>`, 'Save review', { id: item.id, kind: item.kind })}</div>` : ''}
  </details></article>`;
}
function reviews(state) {
  const inbox = state.inbox.map(({ id, problem, question }) => panel(esc(problem), `
    <p>${esc(question.text)}</p>
    ${form('suggest-answer', textarea('answer', 'Answer for the organizer to relay', question.suggested), 'Send to organizer', { id, question: question.id })}
  `)).join('');
  return inbox + `<h2 class="spaced">Review queue (${state.assigned.length})</h2>` +
    (state.assigned.map((item) => reviewCard(state, item)).join('') || empty('Assigned reviews appear here after the organizer clears the submissions.'));
}
function certificates(state) {
  return panel('Your certificates', state.certificates.length ? `<ul class="list">${state.certificates.map((item) => `<li>
    <a class="text-link" href="/verify?id=${encodeURIComponent(item.id)}">${esc(item.kind)} · ${esc(item.id)}</a></li>`).join('')}</ul>` :
    '<p>When the organizer issues your certificate, its verification link will appear here.</p>');
}

export async function renderWorkspace(route, initialRole) {
  let state = await api('workspace');
  let tab = 'overview';
  let selected = initialRole;
  let feedback = '';
  const pages = {
    organizer: { overview: adminSettings, intake, swap: swaps, grading, certificates: adminCertificates },
    participant: { overview, assignment: build, reviews, certificates },
  };
  function render(open = []) {
    const kind = state.role === 'organizer' ? 'organizer' : 'participant';
    const options = tabs[kind].filter(([key]) => (key !== 'assignment' || state.role === 'builder') &&
      (key !== 'reviews' || state.role !== 'new') && (key !== 'certificates' || state.role !== 'new'));
    if (!options.some(([key]) => key === tab)) tab = 'overview';
    const heading = state.role === 'organizer' ? 'Organizer workspace' : (state.name ? 'Hi, ' + state.name.split(/\s/u)[0] + '.' : 'Event workspace');
    document.title = roles[state.role] + ' workspace | Swap Hack';
    route.innerHTML = `
      ${state.demo ? `<div class="demo-strip"><span><strong>Demo event</strong> · Use fictional details</span><a href="/demo">Switch demo role</a></div>` : ''}
      <div class="workspace-head"><div><p class="eyebrow">${esc(roles[state.role])} WORKSPACE</p><h1>${esc(heading)}</h1><div class="meta">${tag(phases[state.settings.phase])}</div></div>
        <button type="button" class="button button-outline" data-sign-out>Sign out</button></div>
      <nav class="tab-nav" aria-label="Workspace sections">${options.map(([key, name]) => `<button type="button" class="button button-${key === tab ? 'ink' : 'outline'}" data-tab="${key}" ${key === tab ? 'aria-current="page"' : ''}>${name}</button>`).join('')}</nav>
      <p class="notice" id="workspace-feedback" role="status" tabindex="-1">${esc(feedback)}</p>
      ${pages[kind][tab](state, selected)}
      <div class="spaced">${home()}</div>`;
    for (const id of open) {
      const details = document.getElementById(id)?.querySelector('details');
      if (details) details.open = true;
    }
  }

  route.onclick = async (event) => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      tab = tabButton.dataset.tab;
      feedback = '';
      render();
      route.querySelector('[data-tab="' + tab + '"]')?.focus();
    }
    const signOut = event.target.closest('[data-sign-out]');
    if (signOut) {
      signOut.disabled = true;
      try {
        await api('sign-out', {});
        location.href = state.demo ? '/demo' : '/workspace';
      } catch (error) {
        el('#workspace-feedback', route).textContent = error.message;
        signOut.disabled = false;
      }
    }
  };
  route.onchange = (event) => {
    const { name, value, checked, form: context } = event.target;
    if (name === 'produce') {
      for (const item of event.target.closest('.subpanel').querySelectorAll('[data-produce]')) item.hidden = value !== 'all' && item.dataset.produce !== value;
      return;
    }
    if (!context) return;
    if (name === 'role' && state.role === 'new') {
      const values = serialize(context);
      selected = value;
      render();
      const current = el('[data-action=register]', route);
      for (const input of current.elements) {
        if (['role', 'occupation', 'consent'].includes(input.name) || input.type === 'hidden') continue;
        const previous = values[input.name];
        if (input.type === 'checkbox' && typeof previous === 'boolean') input.checked = previous;
        if (typeof previous === 'string') input.value = previous;
      }
      current.querySelector('[name="role"]:checked')?.focus();
    }
    if (['occupation', 'team', 'conflict'].includes(name)) {
      const target = name === 'occupation' ? '#student-fields' : (name === 'team' ? '#team-fields' : '[data-rubric]');
      const group = el(target, context);
      if (group) {
        group.hidden = name === 'conflict' ? checked : value !== (name === 'occupation' ? 'student' : 'pair');
        group.disabled = group.hidden;
      }
    }
  };
  route.onsubmit = async (event) => {
    const current = event.target;
    const action = current.dataset.action;
    if (!action) return;
    event.preventDefault();
    const irreversible = { publish: 'Publish the ranked results now?', withdraw: 'Withdraw this assignment?', 'revoke-cert': 'Revoke this certificate?' };
    if (irreversible[action] && !window.confirm(irreversible[action])) return;
    const submit = el('button[type=submit]', current);
    submit.disabled = true;
    notice(current, '');
    try {
      const open = [...route.querySelectorAll('.record > details[open]')].map((details) => details.parentElement.id);
      const response = await api('action', { action, payload: serialize(current) });
      state = await api('workspace');
      feedback = action === 'register' ? 'Problem received. Your reference is ' + response.id + '.' :
        action === 'shuffle' ? response.count + ' assigned, ' + response.unmatched + ' still unmatched.' :
        action === 'panels' ? 'Queued reviews for ' + response.count + ' passed projects.' :
        action === 'issue-cert' ? 'Certificate issued. ID ' + response.id + '.' :
        action === 'publish' ? 'Results published.' : 'Saved.';
      render(open);
      el('#workspace-feedback', route).focus({ preventScroll: true });
    } catch (error) {
      notice(current, error.message, true);
      submit.disabled = false;
    }
  };
  render();
}
