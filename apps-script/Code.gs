// Sprunkee online backend: leaderboard + shared jams in a Google Sheet.
// Setup: see apps-script/SETUP.md. Deploy as a Web app (Execute as: Me, Who has access: Anyone).

const MAX_JAMS = 60;      // newest shared jams returned
const MAX_ROWS = 5000;    // safety cap per tab

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}
const scores_ = () => sheet_('scores', ['pid', 'ini', 'score', 'at']);
const jams_ = () => sheet_('jams', ['pid', 'ini', 'name', 'code', 'at']);

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

const okIni = (v) => /^[A-Z]{1,3}$/.test(v || '');
const okName = (v) => /^[A-Za-z ]{3,40}$/.test(v || '');
const okCode = (v) => /^[0-9a-z]{10}$/.test(v || '');
const okPid = (v) => /^[0-9a-z]{4,16}$/.test(v || '');

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  if (action === 'top') {
    // best score per player, top 10
    const rows = scores_().getDataRange().getValues().slice(1);
    const best = {};
    rows.forEach(([pid, ini, score, at]) => {
      if (!best[pid] || score > best[pid].score) best[pid] = { ini, score, at };
    });
    const list = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 10);
    return json_({ ok: true, scores: list });
  }
  if (action === 'jams') {
    const sh = jams_();
    const n = Math.max(0, sh.getLastRow() - 1);
    const start = Math.max(2, sh.getLastRow() - MAX_JAMS + 1);
    const rows = n ? sh.getRange(start, 1, sh.getLastRow() - start + 1, 5).getValues() : [];
    const list = rows.reverse().map(([pid, ini, name, code, at]) => ({ ini, name, code, at }));
    return json_({ ok: true, jams: list });
  }
  return json_({ ok: true, hello: 'sprunkee' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (!okPid(d.pid) || !okIni(d.ini)) return json_({ ok: false, error: 'bad player' });
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    if (d.action === 'score') {
      const score = Math.round(Number(d.score));
      if (!(score > 0 && score < 1e7)) return json_({ ok: false, error: 'bad score' });
      const sh = scores_();
      if (sh.getLastRow() > MAX_ROWS) return json_({ ok: false, error: 'full' });
      sh.appendRow([d.pid, d.ini, score, new Date().toISOString()]);
      return json_({ ok: true });
    }
    if (d.action === 'jam') {
      if (!okName(d.name) || !okCode(d.code)) return json_({ ok: false, error: 'bad jam' });
      const sh = jams_();
      if (sh.getLastRow() > MAX_ROWS) return json_({ ok: false, error: 'full' });
      sh.appendRow([d.pid, d.ini, d.name, d.code, new Date().toISOString()]);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}
