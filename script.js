const menu = document.querySelector('.menu-button');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.textContent = 'Menu';
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
  menu.textContent = open ? 'Close' : 'Menu';
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    closeMenu();
    menu.focus();
  }
});
const theme = document.querySelector('.theme-button');
function updateThemeLabel() {
  const dark = document.documentElement.dataset.theme === 'dark';
  theme.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  theme.title = dark ? 'Back to daylight.' : 'Late night? Switch to dark mode.';
  const label = theme.querySelector('.theme-text');
  if (label) label.textContent = dark ? 'Light' : 'Dark';
}
theme.addEventListener('click', () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  updateThemeLabel();
});
updateThemeLabel();
const interest = document.querySelector('#interest');
const selectedInterest = new URLSearchParams(location.search).get('interest') || (location.hash === '#professional-learning' ? 'Professional Learning' : '');
if (interest && selectedInterest) interest.value = selectedInterest;
// Form submissions go to two places: Netlify (keeps the record, notifies Gina) and MailerLite (sends the email).
// Both requests finish before the visitor moves to the thank-you page. A request started during a page change
// is often dropped, which is why earlier submissions reached Netlify but never MailerLite.
const productionHost = /(^|\.)strideforward\.world$|(^|\.)gmwgroupllc\.com$|\.netlify\.app$/.test(location.hostname);
// Netlify form name -> MailerLite form (GMW Group LLC account). Each MailerLite form adds the person to a group,
// and an automation on that group sends the email right away.
const ML_ACCOUNT = '2622985';
const ML_FORMS = {
  'deck-request': '199603862488745364',             // Capabilities overview: 3 emails
  'problem-clarity-download': '199603719231243992', // Problem Clarity Worksheet: 3 emails
  'cx-blueprint-download': '201049592917133168',    // CX Blueprint kit: 3 emails
  'pl-planner-download': '201049757183903301',      // PL Session Planner: 1 email
  'pilot-plan-download': '201454295709648266',      // Pilot Plan: 3 emails
  'situation-map-download': '201454296833721896',   // Situation Map: 3 emails
  'learner-card-download': '201454297837209358',    // Build for the LEARNER card: 3 emails
  'contact': '201049857072301553',                  // Write first: receipt email
  'field-notes-signup': '201530866575344865'         // Field notes (/blog and the end of each field note): group "StrideForward — Field notes"
};
function sfTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}
function sfMailerLite(form) {
  const id = ML_FORMS[form.getAttribute('name')];
  const email = form.querySelector('input[type=email]');
  const trap = form.querySelector('[name="bot-field"]');
  if (!id || !email || !email.value || (trap && trap.value)) return Promise.resolve();
  const body = new URLSearchParams({'fields[email]': email.value.trim(), 'ml-submit': '1', 'anticsrf': 'true'});
  const name = form.querySelector('input[name="name"]');
  if (name && name.value.trim()) body.set('fields[name]', name.value.trim());
  return fetch('https://assets.mailerlite.com/jsonp/' + ML_ACCOUNT + '/forms/' + id + '/subscribe', {method: 'POST', mode: 'no-cors', body});
}
function sfNetlify(form) {
  const body = new URLSearchParams(new FormData(form)).toString();
  return fetch('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body})
    .then(response => { if (!response.ok) throw new Error('Netlify form ' + response.status); });
}
// A friendlier message when an email address is mistyped.
document.querySelectorAll('form input[type="email"]').forEach(input => {
  input.addEventListener('invalid', () => { if (input.validity.typeMismatch) input.setCustomValidity('That email looks like it is missing a piece. Mind checking it?'); });
  input.addEventListener('input', () => input.setCustomValidity(''));
});
document.querySelectorAll('form[data-netlify]').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const status = form.querySelector('.form-status');
    if (!productionHost) {
      status.hidden = false;
      status.textContent = 'Preview only: nothing was sent. This form will submit after the site is deployed to Netlify with form detection enabled.';
      return;
    }
    if (form.dataset.sending) return;
    form.dataset.sending = '1';
    // Count one sf_form_submit per real send (not preview clicks, repeat clicks, or filled honeypots).
    const trap = form.querySelector('[name="bot-field"]');
    if (!(trap && trap.value)) sfga('sf_form_submit', {form_name: form.getAttribute('name')});
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    const sending = {'contact': 'Sending your note to Gina...', 'field-notes-signup': 'Adding you to the list...'};
    if (status) { status.hidden = false; status.textContent = sending[form.getAttribute('name')] || 'Pulling your copy off the shelf...'; }
    const mailerLite = sfTimeout(sfMailerLite(form), 5000).catch(() => {});
    const netlify = sfTimeout(sfNetlify(form), 10000);
    Promise.all([netlify, mailerLite])
      .then(() => { location.assign(form.action); })
      // If the background send fails, fall back to a normal form post so the note still reaches Netlify.
      .catch(() => { HTMLFormElement.prototype.submit.call(form); });
  });
});
// Preserve the existing, separate K–12 MailerLite subscription.
if (document.querySelector('.ml-embedded')) {
  (function(w,d,e,u,f,l,n) {
    w[f]=w[f]||function(){(w[f].q=w[f].q||[]).push(arguments)};
    l=d.createElement(e);l.async=1;l.src=u;
    n=d.getElementsByTagName(e)[0];n.parentNode.insertBefore(l,n);
  })(window,document,'script','https://assets.mailerlite.com/js/universal.js','ml');
  window.ml('account','2622985');
}
// Google Analytics lead events (sf_ prefix). sfga does nothing when the Google tag is not loaded (previews, local copies).
function sfga(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); }
function sfSection(el) { const s = el.closest('section[id], section[aria-labelledby], header, footer'); return s ? (s.id || s.getAttribute('aria-labelledby') || s.tagName.toLowerCase()) : ''; }
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  const text = link.textContent.replace(/\s+/g, ' ').replace(/[↗↓]/g, '').trim().slice(0, 80);
  if (/#book$|^\/book$|calendly\.com/.test(href)) sfga('sf_book_click', {cta_text: text, cta_section: sfSection(link)});
  else if (/#deck$|^\/deck$/.test(href)) sfga('sf_deck_click', {cta_text: text, cta_section: sfSection(link)});
  else if (/^mailto:/.test(href)) sfga('sf_email_click', {cta_section: sfSection(link)});
  else if (/^tel:/.test(href)) sfga('sf_phone_click', {cta_section: sfSection(link)});
});
// sf_form_submit is sent from the form submit handler above, once per real send.
// sf_call_booked, two ways, counted once per booking:
// 1. Calendly's inline widget on /contact posts a message to this page when a call is booked.
// 2. Calendly then sends the visitor to /thanks/booked with the booking details in the address. That page also
//    counts the booking when the widget message did not (a booking made on calendly.com directly, or a lost message).
function sfSession(key, value) { try { if (value === undefined) return sessionStorage.getItem(key); if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch (e) {} return null; }
window.addEventListener('message', event => {
  if (event.origin !== 'https://calendly.com' || !event.data || event.data.event !== 'calendly.event_scheduled') return;
  sfga('sf_call_booked', {page: location.pathname, booked_via: 'widget'});
  sfSession('sf_call_booked', '1');
});
(function sfBookedPage() {
  if (!/^\/thanks\/booked(\.html)?$/.test(location.pathname)) return;
  const q = new URLSearchParams(location.search);
  const start = q.get('event_start_time');
  if (!start && !q.get('invitee_email') && !q.get('assigned_to')) return; // opened directly, not from a booking
  const key = 'sf_call_booked:' + (start || q.get('invitee_email') || 'booked');
  if (sfSession('sf_call_booked') === '1') { sfSession('sf_call_booked', null); sfSession(key, '1'); return; } // counted by the widget
  if (sfSession(key) === '1') return; // page reload
  sfga('sf_call_booked', {page: location.pathname, booked_via: 'redirect', source: (q.get('utm_source') || '').slice(0, 40)});
  sfSession(key, '1');
})();
// Field note notes (October 2026). "Your turn" answers and checklist ticks save in this browser, per page,
// and collect in the "Your notes" panel, where readers can email, text, copy, or download them.
// Nothing leaves the browser unless the reader sends it. "Send my notes" posts to two MailerLite forms
// (GMW Group LLC account): the notes form saves the notes in custom fields and an automation emails them
// right away; the check-in form (only when the box is ticked) starts a 14-day check-in email.
// MailerLite text fields hold at most 1,024 characters, so notes are split across two fields and capped.
const ML_NOTES_FORM = '201330261104788995';   // StrideForward — Email my notes
const ML_CHECKIN_FORM = '201330262115616153'; // StrideForward — Field note check-in (14 days)
(function sfNotes() {
  const panel = document.querySelector('[data-fn-notes]');
  const turns = Array.from(document.querySelectorAll('.fn-turn textarea'));
  const tries = Array.from(document.querySelectorAll('.gv-try[data-fn-check]'));
  if (!panel && !turns.length && !tries.length) return;
  const path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  const KEY = 'sf_notes:' + path;
  let state = {answers: {}, checks: {}};
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); state.answers = s.answers || {}; state.checks = s.checks || {}; } } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } };
  const h1 = document.querySelector('h1');
  const title = h1 ? h1.textContent.trim() : document.title;
  const pageUrl = 'https://www.strideforward.world' + path;
  const prompts = {};
  // Tell readers up front that answers are kept and can be emailed (first Your turn box only).
  let canSave = true;
  try { localStorage.setItem('sf_notes_test', '1'); localStorage.removeItem('sf_notes_test'); } catch (e) { canSave = false; }
  if (turns.length && panel) {
    const first = turns[0];
    const hint = document.createElement('p');
    hint.className = 'fn-hint';
    hint.id = first.id + '-hint';
    const link = document.createElement('a');
    link.href = '#your-notes';
    link.textContent = 'email your notes to yourself';
    hint.append(canSave ? 'Your answers save in this browser as you type. At the end, you can ' : 'This browser is not saving answers, so before you leave, ', link, '.');
    first.before(hint);
    first.setAttribute('aria-describedby', hint.id);
  }
  turns.forEach(ta => {
    const label = document.querySelector('label[for="' + ta.id + '"]');
    const lead = label && label.querySelector('span');
    prompts[ta.id] = label ? label.textContent.replace(lead ? lead.textContent : '', '').trim() : ta.id;
    if (state.answers[ta.id]) ta.value = state.answers[ta.id];
    const status = ta.parentElement.querySelector('.fn-saved');
    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const v = ta.value.trim();
        if (v) state.answers[ta.id] = ta.value; else delete state.answers[ta.id];
        const ok = save();
        if (status) status.textContent = !ok ? 'This browser is not saving notes. Copy your answer before you leave.' : (v ? 'Saved to your notes at the end of this page.' : '');
        render();
      }, 400);
    });
  });
  const steps = [];
  tries.forEach((box, b) => {
    const items = Array.from(box.querySelectorAll('ul > li'));
    const progress = box.querySelector('.fn-progress');
    box.classList.add('fn-checkable');
    items.forEach((li, i) => {
      const id = 'c' + b + '-' + i;
      const text = li.textContent.trim();
      steps.push({id, text});
      li.innerHTML = '';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = !!state.checks[id];
      const span = document.createElement('span'); span.textContent = text;
      label.append(input, span); li.append(label);
      input.addEventListener('change', () => {
        if (input.checked) state.checks[id] = true; else delete state.checks[id];
        save(); update(true); render();
      });
    });
    function update(fromClick) {
      const done = items.filter((li, i) => state.checks['c' + b + '-' + i]).length;
      if (!progress) return;
      if (done === 0) progress.textContent = '';
      else if (done < items.length) progress.textContent = done + ' of ' + items.length + ' done.';
      else {
        progress.textContent = 'All ' + items.length + ' done. Future you says thanks.';
        if (fromClick) sfga('sf_checklist_complete', {page: path});
      }
    }
    update(false);
  });
  function compose() {
    const lines = ['My notes from "' + title + '"', pageUrl, ''];
    turns.forEach(ta => { const v = (state.answers[ta.id] || '').trim(); if (v) lines.push(prompts[ta.id], v, ''); });
    const checked = steps.filter(s => state.checks[s.id]);
    if (checked.length) { lines.push('Steps I checked off:'); checked.forEach(s => lines.push('- ' + s.text)); lines.push(''); }
    lines.push('From StrideForward field notes: https://www.strideforward.world/blog/');
    return lines.join('\n');
  }
  const hasNotes = () => turns.some(ta => (state.answers[ta.id] || '').trim()) || steps.some(s => state.checks[s.id]);
  function render() {
    if (!panel) return;
    const list = panel.querySelector('[data-fn-list]');
    const buttons = panel.querySelectorAll('[data-fn-send]');
    buttons.forEach(btn => { btn.disabled = !hasNotes(); });
    if (!list) return;
    list.innerHTML = '';
    if (!hasNotes()) {
      const p = document.createElement('p'); p.className = 'fn-notes-empty';
      p.textContent = 'Nothing here yet. Answer a Your turn prompt or check off a step above, and it will show up here.';
      list.append(p); return;
    }
    const ul = document.createElement('ul'); ul.className = 'fn-notes-list';
    turns.forEach(ta => {
      const v = (state.answers[ta.id] || '').trim(); if (!v) return;
      const li = document.createElement('li');
      const q = document.createElement('span'); q.className = 'q'; q.textContent = prompts[ta.id];
      const a = document.createElement('span'); a.className = 'a'; a.textContent = v;
      li.append(q, a); ul.append(li);
    });
    const checked = steps.filter(s => state.checks[s.id]);
    if (checked.length) {
      const li = document.createElement('li');
      const q = document.createElement('span'); q.className = 'q'; q.textContent = 'Steps you checked off';
      const a = document.createElement('span'); a.className = 'a'; a.textContent = checked.map(s => '• ' + s.text).join('\n');
      li.append(q, a); ul.append(li);
    }
    list.append(ul);
  }
  if (panel) {
    const actions = panel.querySelector('.fn-actions');
    if (actions) actions.hidden = false;
    const status = panel.querySelector('.fn-status');
    const say = msg => { if (status) status.textContent = msg; };
    panel.querySelectorAll('[data-fn-send]').forEach(btn => btn.addEventListener('click', () => {
      const how = btn.getAttribute('data-fn-send');
      const text = compose();
      sfga('sf_notes_send', {method: how, page: path});
      if (how === 'email') {
        location.href = 'mailto:?subject=' + encodeURIComponent('My notes: ' + title) + '&body=' + encodeURIComponent(text);
        say('Your email app should open with your notes. Add your own address and send.');
      } else if (how === 'text') {
        location.href = 'sms:?&body=' + encodeURIComponent(text);
        say('Your messages app should open with your notes. Pick yourself as the recipient and send.');
      } else if (how === 'copy') {
        const done = () => say('Copied. Paste them anywhere you keep notes.');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => say('Copy did not work here. Try Download instead.'));
        else say('Copy is not available in this browser. Try Download instead.');
      } else if (how === 'download') {
        const blob = new Blob([text], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'strideforward-notes-' + (path.split('/').filter(Boolean).pop() || 'field-note') + '.txt';
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        say('Downloaded. Look for a .txt file in your downloads.');
      }
    }));
    const clear = panel.querySelector('[data-fn-clear]');
    if (clear) clear.addEventListener('click', () => {
      if (clear.dataset.armed !== '1') { clear.dataset.armed = '1'; clear.textContent = 'Click again to clear everything'; setTimeout(() => { clear.dataset.armed = ''; clear.textContent = 'Clear my notes'; }, 4000); return; }
      state = {answers: {}, checks: {}}; save();
      turns.forEach(ta => { ta.value = ''; const s = ta.parentElement.querySelector('.fn-saved'); if (s) s.textContent = ''; });
      tries.forEach(box => box.querySelectorAll('input[type=checkbox]').forEach(i => { i.checked = false; }));
      tries.forEach(box => { const p = box.querySelector('.fn-progress'); if (p) p.textContent = ''; });
      clear.dataset.armed = ''; clear.textContent = 'Clear my notes';
      say('Cleared. A fresh page.'); render();
    });
    const share = panel.querySelector('[data-fn-share]');
    if (share) share.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent('I thought this might be useful: ' + pageUrl);
    const mail = panel.querySelector('[data-fn-mail]');
    if (mail) mail.addEventListener('submit', event => {
      event.preventDefault();
      if (mail.dataset.sending) return;
      if (!hasNotes()) { say('Write an answer or check off a step first, then send.'); return; }
      const email = mail.querySelector('input[type=email]').value.trim();
      const checkin = !!(mail.querySelector('input[name="checkin"]') || {}).checked;
      if (!productionHost) { say('Preview only: nothing was sent. On the live site, your notes would go to ' + email + '.'); return; }
      const button = mail.querySelector('button[type="submit"]');
      mail.dataset.sending = '1';
      if (button) button.disabled = true;
      say('Sending your notes...');
      const BLANK = '​'; // invisible; replaces an earlier field note's value without showing anything
      const cap = (s, n) => s.length > n ? s.slice(0, n - 12) + '\n(trimmed)' : s;
      const answers = turns.map(ta => [prompts[ta.id], (state.answers[ta.id] || '').trim()]).filter(p => p[1]).map(p => p[0] + '\n' + p[1]).join('\n\n');
      const notes = cap(answers, 2000);
      const checked = steps.filter(s => state.checks[s.id]);
      const stepText = checked.length ? cap('Steps you checked off:\n' + checked.map(s => '- ' + s.text).join('\n'), 1000) : '';
      const body = new URLSearchParams({
        'fields[email]': email,
        'fields[field_note_title]': title.slice(0, 1000),
        'fields[field_note_link]': pageUrl,
        'fields[field_note_notes]': notes.slice(0, 1000) || BLANK,
        'fields[field_note_notes_more]': notes.slice(1000) || BLANK,
        'fields[field_note_steps]': stepText || BLANK,
        'ml-submit': '1', 'anticsrf': 'true'
      });
      const post = (id, data) => sfTimeout(fetch('https://assets.mailerlite.com/jsonp/' + ML_ACCOUNT + '/forms/' + id + '/subscribe', {method: 'POST', mode: 'no-cors', body: data}), 8000);
      const posts = [post(ML_NOTES_FORM, body)];
      if (checkin) posts.push(post(ML_CHECKIN_FORM, new URLSearchParams({'fields[email]': email, 'ml-submit': '1', 'anticsrf': 'true'})));
      Promise.all(posts).then(() => {
        say('Sent. Your notes should reach ' + email + ' in a few minutes. If they do not, check your spam folder.' + (checkin ? ' Your check-in arrives in two weeks.' : ''));
        sfga('sf_notes_send', {method: 'mailerlite', page: path, checkin: checkin ? 'yes' : 'no'});
      }).catch(() => {
        say('That did not go through. Try again in a minute, or use Copy or Download below.');
      }).finally(() => {
        delete mail.dataset.sending;
        if (button) button.disabled = false;
      });
    });
  }
  render();
})();
