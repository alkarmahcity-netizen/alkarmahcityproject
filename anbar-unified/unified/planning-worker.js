'use strict';
/* عامل خلفي لقراءة ملف التخطيط وتصديره، حتى لا تتوقف واجهة البرنامج (القراءة نحو 4 ثوان للملف الكامل) */
const { parentPort } = require('worker_threads');
const P = require('./planning');
parentPort.on('message', m => {
  try {
    if (m.op === 'parse') parentPort.postMessage({ ok: true, model: P.parse(Buffer.from(m.buf), m.label) });
    else if (m.op === 'clean') { const r = require('./planning-clean').build(m.model, m.opts || {}); parentPort.postMessage({ ok: true, buf: r.buf, stats: r.stats }); }
    else if (m.op === 'cmp') { const r = require('./planmerge').compare(Buffer.from(m.gen), m.genLabel, Buffer.from(m.mod), m.modLabel, m.projects || []); parentPort.postMessage({ ok: true, res: r }); }
    else if (m.op === 'cmpBuild') { const r = require('./planmerge').build(Buffer.from(m.gen), m.res, m.opts || {}, m.mod ? Buffer.from(m.mod) : null); parentPort.postMessage({ ok: true, buf: r.buf, cells: r.cells, audit: r.audit }); }
    else if (m.op === 'ppParse') { const PP = require('./planprogress'); const model = PP.parse(Buffer.from(m.buf), m.label); parentPort.postMessage({ ok: true, model, items: PP.match(model, m.projects || [], m.links || {}) }); }
    else if (m.op === 'ppExport') { const r = require('./planprogress').exportBook(Buffer.from(m.buf), m.model, m.updates, m.opts || {}); parentPort.postMessage({ ok: true, buf: r.buf, changes: r.changes }); }
    else if (m.op === 'export') { const r = P.exportBook(Buffer.from(m.buf), m.model, m.updates, m.opts || {}); parentPort.postMessage({ ok: true, buf: r.buf, changes: r.changes, dash: r.dash, diffs: r.diffs || [] }); }
  } catch (e) { parentPort.postMessage({ ok: false, error: String(e && e.message || e) }); }
});
