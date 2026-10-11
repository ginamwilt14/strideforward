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
  theme.setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} mode`);
}
theme.addEventListener('click', () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  updateThemeLabel();
});
updateThemeLabel();
const interest = document.querySelector('#interest');
const selectedInterest = new URLSearchParams(location.search).get('interest') || (location.hash === '#professional-learning' ? 'Professional Learning' : '');
if (interest && selectedInterest) interest.value = selectedInterest;
// Native POSTs are processed by Netlify, not by the static review environment.
const productionHost = /(^|\.)strideforward\.world$|(^|\.)gmwgroupllc\.com$|\.netlify\.app$/.test(location.hostname);
const ML_FORMS = {'problem-clarity-download': '199603719231243992', 'deck-request': '199603862488745364'};
document.querySelectorAll('form[data-netlify]').forEach(form => {
  form.addEventListener('submit', event => {
    const mlId = ML_FORMS[form.getAttribute('name')];
    const email = form.querySelector('input[type=email]');
    if (productionHost && mlId && email && email.value) {
      // Adds the requester to the matching MailerLite follow-up (three emails). Netlify still receives the form.
      const body = new URLSearchParams({'fields[email]': email.value, 'ml-submit': '1', 'anticsrf': 'true'});
      try { fetch('https://assets.mailerlite.com/jsonp/2622985/forms/' + mlId + '/subscribe', {method: 'POST', mode: 'no-cors', keepalive: true, body}); } catch (e) {}
    }
    if (!productionHost) {
      event.preventDefault();
      const status = form.querySelector('.form-status');
      status.hidden = false;
      status.textContent = 'Preview only: nothing was sent. This form will submit after the site is deployed to Netlify with form detection enabled.';
    }
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
