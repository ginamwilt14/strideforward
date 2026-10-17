// Site version for GA4 on strideforward.world
//
// Every page's Google tag sends site_version with each GA4 event, so reports can
// be split by deploy (for example, before and after a page change). The tag holds
// the placeholder __SF_SITE_VERSION__; before each Netlify build this plugin
// replaces it in every HTML file with the first 7 characters of the commit being
// deployed (Netlify's COMMIT_REF). The repo keeps the placeholder, and the tag
// sends "unknown" if a page is ever served without the swap.
//
// page_variant needs no build step: the tag reads it from <html data-variant="...">
// and sends "default" when a page has none. An A/B test sets that attribute.
//
// It never fails a build. The count of pages it stamped shows in the deploy log.

'use strict';

const fs = require('fs');
const path = require('path');

const TOKEN = '__SF_SITE_VERSION__';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'netlify', '.netlify']);

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) htmlFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.html')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

module.exports = {
  onPreBuild({ constants }) {
    try {
      const sha = (process.env.COMMIT_REF || '').trim();
      const version = /^[0-9a-f]{7,40}$/.test(sha) ? sha.slice(0, 7) : 'unknown';
      const dir = constants.PUBLISH_DIR || '.';
      let stamped = 0;
      for (const file of htmlFiles(dir)) {
        const html = fs.readFileSync(file, 'utf8');
        if (!html.includes(TOKEN)) continue;
        fs.writeFileSync(file, html.split(TOKEN).join(version));
        stamped += 1;
      }
      console.log(`Site version ${version} written into ${stamped} pages.`);
    } catch (error) {
      console.log(`Site version skipped: ${error.message}`);
    }
  },
};
