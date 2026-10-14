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
  'contact': '201049857072301553'                   // Write first: receipt email
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
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    if (status) { status.hidden = false; status.textContent = form.getAttribute('name') === 'contact' ? 'Sending your note to Gina...' : 'Pulling your copy off the shelf...'; }
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
});
document.querySelectorAll('form[data-netlify]').forEach(form => {
  form.addEventListener('submit', () => sfga('sf_form_submit', {form_name: form.getAttribute('name')}));
});
// Calendly's inline widget posts a message to this page when a call is booked.
window.addEventListener('message', event => {
  if (event.origin === 'https://calendly.com' && event.data && event.data.event === 'calendly.event_scheduled') sfga('sf_call_booked', {page: location.pathname});
});
