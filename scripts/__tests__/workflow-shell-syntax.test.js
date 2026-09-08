/**
 * Every `run:` block in every workflow must be valid bash (#108).
 *
 * WHY THIS EXISTS. `smoke.yml`'s "Mail policy result" step ended with a stray quote:
 *
 *     echo "mail policy matches the declared intent.""
 *
 * An unterminated string, so the step exited 2. It sat on the SUCCESS path — the
 * failure branch above it exits 1 first — which means the step reported `failure`
 * exactly when the thing it monitors was HEALTHY. Verified on the live run:
 * `check-mail-policy.mjs` printed "published policy matches the intent declared in
 * this repo" and exited 0, and its own aggregate failed anyway.
 *
 * Nothing in this repo could have caught it. A workflow's `run:` body is an opaque
 * string to YAML, to prettier, to eslint and to tsc; the first thing that parses it
 * as shell is GitHub, at run time, in production. So this parses it here instead.
 *
 * It checks SYNTAX only — `bash -n` — because that is the part that can be checked
 * without running anything, and it is the part that failed.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, '.github', 'workflows');

/**
 * `${{ … }}` is GitHub's, not bash's, and `${{` is a syntax error to a shell. It is
 * substituted before the shell ever sees it, so for a syntax check it stands in as a
 * single bare token — which is what it becomes in every position we use it.
 */
const deExpression = (s) => s.replace(/\$\{\{[\s\S]*?\}\}/g, 'GH_EXPR');

/**
 * Pull every `run:` body out of a workflow, block scalars and one-liners alike.
 *
 * Hand-parsed: no YAML library is installed, and adding one to check 18 files is a
 * worse trade than 30 lines here. The count assertion in the test below is what keeps
 * a parser that quietly stops matching from turning this green.
 */
function runBlocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)-?\s*run:\s*(\S.*)?$/);
    if (!m) continue;
    const indent = m[1].length;
    const rest = (m[2] || '').trim();

    if (
      rest &&
      rest !== '|' &&
      rest !== '>' &&
      rest !== '|-' &&
      rest !== '>-'
    ) {
      out.push({ line: i + 1, body: rest });
      continue;
    }
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '') {
        body.push('');
        continue;
      }
      const ind = lines[j].match(/^\s*/)[0].length;
      if (ind <= indent) break;
      body.push(lines[j]);
    }
    // Dedent by the smallest indentation present, so the block stands alone.
    const widths = body
      .filter((l) => l.trim())
      .map((l) => l.match(/^\s*/)[0].length);
    const cut = widths.length ? Math.min(...widths) : 0;
    out.push({ line: i + 1, body: body.map((l) => l.slice(cut)).join('\n') });
    i += body.length;
  }
  return out;
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map((f) => path.join(DIR, f));

describe('workflow run: blocks are valid bash', () => {
  it('finds workflows and blocks to check — a silent zero is not a pass', () => {
    // The floor, in the spirit of #396: if the parser stops matching, this fails
    // rather than reporting that every one of nothing is fine. Raise it freely;
    // never lower it to make a run green.
    assert.ok(files.length >= 15, `only ${files.length} workflow files found`);
    const total = files.reduce((n, f) => n + runBlocks(f).length, 0);
    assert.ok(
      total >= 50,
      `only ${total} run: blocks found across ${files.length} files`
    );
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wfsyntax-'));

  for (const file of files) {
    const name = path.basename(file);
    it(`${name}`, () => {
      const bad = [];
      for (const { line, body } of runBlocks(file)) {
        const f = path.join(tmp, `${name}-${line}.sh`);
        fs.writeFileSync(f, deExpression(body));
        const r = spawnSync('bash', ['-n', f], { encoding: 'utf8' });
        if (r.status !== 0) {
          bad.push(
            `${name}:${line} — ${(r.stderr || '').trim().split('\n')[0]}`
          );
        }
      }
      assert.deepStrictEqual(
        bad,
        [],
        `shell syntax errors in ${name}. GitHub is otherwise the first thing that ` +
          `parses these, at run time, in production:\n  ${bad.join('\n  ')}`
      );
    });
  }
});
