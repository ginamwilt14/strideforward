// Page helpers for the IndexNow plugin (index.js). Kept in their own file
// because Netlify treats every name index.js exports as a build event.

'use strict';

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function pageInfo(html) {
  let canonical = null;
  let noindex = false;
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if ((attr(tag, 'rel') || '').toLowerCase() === 'canonical') {
      canonical = attr(tag, 'href');
      break;
    }
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if ((attr(tag, 'name') || '').toLowerCase() === 'robots' && /noindex/i.test(attr(tag, 'content') || '')) {
      noindex = true;
    }
  }
  return { canonical, noindex };
}

// The site's clean URL rules: no .html, a trailing slash only for folder index pages.
function cleanUrl(origin, file) {
  if (file === 'index.html') return `${origin}/`;
  if (file.endsWith('/index.html')) return `${origin}/${file.slice(0, -'index.html'.length)}`;
  return `${origin}/${file.slice(0, -'.html'.length)}`;
}

module.exports = { pageInfo, cleanUrl };
