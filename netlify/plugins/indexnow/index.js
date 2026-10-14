// IndexNow for strideforward.world
//
// After each production deploy, this plugin tells Bing (and the other search
// engines that use IndexNow) which pages were added, changed, or removed, so
// they can recrawl them soon instead of waiting to find the change themselves.
//
// How it works
// 1. Before the build (production only), it reads indexnow-commit.txt from the
//    live site: the commit that is live right now. It then writes this build's
//    commit into that file, so the next deploy can compare against it.
// 2. After the deploy succeeds, it lists the HTML files that changed between the
//    live commit and this one, keeps indexable pages (it skips 404.html, noindex
//    pages, and the thank-you folders), reads each page's canonical URL, and
//    sends the list to api.indexnow.org in one request.
// 3. If the live commit is unknown (the first run, or a commit missing from git
//    history), it compares against this commit's first parent, which covers a
//    merged pull request.
//
// Style or script changes alone send nothing: page content did not change.
// It never fails a deploy. Results show in the Netlify deploy summary under
// "IndexNow". Deploy previews and branch deploys are skipped.
//
// The key is public by design: search engines check it at /<key>.txt.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const STATE_FILE = 'indexnow-commit.txt';
const LIVE_COMMIT_TMP = path.join(os.tmpdir(), 'strideforward-indexnow-live-commit');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000;
const SKIP = [/^404\.html$/, /^thanks\//, /^subscribed\//, /^netlify\//];

const isProduction = () => process.env.CONTEXT === 'production';
const isSha = (s) => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);

async function fetchText(url, timeoutMs = 10000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'cache-control': 'no-cache' },
  });
  return res.ok ? (await res.text()).trim() : null;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function hasCommit(sha, cwd) {
  try {
    git(['cat-file', '-e', `${sha}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

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

function pageUrls({ base, head, repoDir, publishDir, origin, host }) {
  const out = git(['diff', '--name-status', '--no-renames', base, head], repoDir);
  const changes = out ? out.split('\n').map((line) => {
    const [status, ...rest] = line.split('\t');
    return { status: status[0], file: rest.join('\t') };
  }) : [];

  const urls = new Set();
  const notes = [];
  for (const { status, file } of changes) {
    // Paths from git are relative to the repo; the site is served from publishDir.
    const rel = path.relative(publishDir, path.join(repoDir, file)).split(path.sep).join('/');
    if (rel.startsWith('..') || !rel.endsWith('.html') || SKIP.some((rx) => rx.test(rel))) continue;

    if (status === 'D') {
      urls.add(cleanUrl(origin, rel));
      continue;
    }
    const { canonical, noindex } = pageInfo(fs.readFileSync(path.join(publishDir, rel), 'utf8'));
    if (noindex) continue;
    let url = canonical || cleanUrl(origin, rel);
    try {
      if (new URL(url).host !== host) {
        notes.push(`Skipped ${rel}: canonical ${url} is not on ${host}`);
        continue;
      }
    } catch {
      url = cleanUrl(origin, rel);
    }
    urls.add(url);
  }
  return { urls: [...urls], filesChanged: changes.length, notes };
}

async function keyIsLive(origin, key) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if ((await fetchText(`${origin}/${key}.txt`)) === key) return true;
    } catch {
      // try again
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return false;
}

const REASONS = {
  400: 'bad request (invalid format)',
  403: 'key not valid (key file missing or does not match)',
  422: 'URLs do not belong to the host, or the key does not match',
  429: 'too many requests',
};

async function onPreBuild({ inputs, constants }) {
  if (!isProduction()) return;
  const origin = `https://${inputs.host}`;
  try {
    const live = await fetchText(`${origin}/${STATE_FILE}`);
    if (isSha(live)) fs.writeFileSync(LIVE_COMMIT_TMP, live);
  } catch (error) {
    console.log(`IndexNow: could not read the live commit (${error.message}). Will compare with the first parent.`);
  }
  if (isSha(process.env.COMMIT_REF)) {
    fs.writeFileSync(path.join(path.resolve(constants.PUBLISH_DIR), STATE_FILE), `${process.env.COMMIT_REF}\n`);
  }
}

async function onSuccess({ inputs, constants, utils }) {
  if (!isProduction()) {
    console.log('IndexNow: skipped (not a production deploy).');
    return;
  }
  const show = (summary, text) => utils.status.show({ title: 'IndexNow', summary, text });
  try {
    const { key, host } = inputs;
    const origin = `https://${host}`;
    const publishDir = path.resolve(constants.PUBLISH_DIR);
    const repoDir = git(['rev-parse', '--show-toplevel'], publishDir);
    const head = isSha(process.env.COMMIT_REF) ? process.env.COMMIT_REF : git(['rev-parse', 'HEAD'], repoDir);

    let live = null;
    try {
      live = fs.readFileSync(LIVE_COMMIT_TMP, 'utf8').trim();
    } catch {
      // no live commit recorded
    }
    let base = null;
    let compared = '';
    if (isSha(live) && hasCommit(live, repoDir)) {
      base = live;
      compared = `the commit that was live (${live.slice(0, 7)})`;
    } else if (hasCommit(`${head}^1`, repoDir)) {
      base = git(['rev-parse', `${head}^1`], repoDir);
      compared = `the previous commit (${base.slice(0, 7)})`;
    }
    if (!base) return show('Nothing sent: no earlier commit to compare with.');
    if (base === head) return show('Nothing sent: this commit was already live.');

    const { urls, filesChanged, notes } = pageUrls({ base, head, repoDir, publishDir, origin, host });
    if (urls.length === 0) {
      return show(
        `Nothing sent: no page changes since ${compared}.`,
        [`${filesChanged} file(s) changed, none of them indexable pages.`, ...notes].join('\n'),
      );
    }

    if (!(await keyIsLive(origin, key))) {
      return utils.build.failPlugin(
        `IndexNow: ${origin}/${key}.txt did not return the key, so nothing was sent. The deploy is live; Bing will still find changes through the sitemap.`,
      );
    }

    const urlList = urls.slice(0, MAX_URLS);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 200 || res.status === 202) {
      return show(
        `Sent ${urlList.length} page(s) changed since ${compared}.`,
        [...urlList, ...notes].join('\n'),
      );
    }
    return utils.build.failPlugin(
      `IndexNow: api.indexnow.org answered ${res.status} (${REASONS[res.status] || 'unexpected response'}). The deploy is live; Bing will still find changes through the sitemap.`,
    );
  } catch (error) {
    return utils.build.failPlugin(
      `IndexNow: ${error.message}. The deploy is live; Bing will still find changes through the sitemap.`,
      { error },
    );
  }
}

module.exports = { onPreBuild, onSuccess, _test: { pageInfo, cleanUrl, pageUrls } };
