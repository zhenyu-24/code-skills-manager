import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listSkills, describeSkills, resolveProject, validateName, mount, unmount, status, linkTarget, runCli } from './code-skills.mjs';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'code-skills-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const project = path.join(base, 'project');
  const library = path.join(base, 'bundle', 'library');
  fs.mkdirSync(project, { recursive: true });
  for (const name of ['alpha', 'beta']) {
    fs.mkdirSync(path.join(library, name), { recursive: true });
    fs.writeFileSync(path.join(library, name, 'SKILL.md'), `# ${name}\n`);
    fs.writeFileSync(path.join(library, name, 'data.txt'), 'never overwrite');
  }
  return { base, project, library };
}
const link = (target, destination) => fs.symlinkSync(target, destination, process.platform === 'win32' ? 'junction' : 'dir');
const skillsDir = project => path.join(project, '.agents', 'skills');
const metadata = project => path.join(project, '.agents', 'code-skills.json');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hasGit = spawnSync('git', ['--version'], { windowsHide: true }).status === 0;

test('list is project-free and lifecycle preserves bundled file data', t => {
  const f = fixture(t);
  assert.deepEqual(listSkills(f.library), ['alpha', 'beta']);
  assert.deepEqual(mount({ ...f, skills: 'alpha' }).mounted, ['alpha']);
  assert.equal(status(f).skills.find(s => s.name === 'alpha').state, 'mounted');
  assert.equal(fs.readFileSync(path.join(skillsDir(f.project), 'alpha', 'data.txt'), 'utf8'), 'never overwrite');
  assert.equal(JSON.parse(fs.readFileSync(metadata(f.project))).version, 1);
  mount({ ...f, skills: 'alpha' });
  mount({ ...f, all: true });
  unmount({ ...f, all: true });
  assert.deepEqual(fs.readdirSync(skillsDir(f.project)), []);
  assert.equal(fs.readFileSync(path.join(f.library, 'alpha', 'SKILL.md'), 'utf8'), '# alpha\n');
  assert.equal(fs.readFileSync(path.join(f.library, 'alpha', 'data.txt'), 'utf8'), 'never overwrite');
});

test('explicit existing absolute project is mandatory; nonrepo warns and nested git root resolves', t => {
  const f = fixture(t);
  for (const project of [undefined, '.', 'relative', path.join(f.base, 'missing')]) assert.throws(() => resolveProject(project));
  const warnings = [];
  assert.equal(resolveProject(f.project, m => warnings.push(m)), fs.realpathSync(f.project));
  assert.match(warnings[0], /No .git/);
  fs.mkdirSync(path.join(f.project, '.git'));
  const nested = path.join(f.project, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(resolveProject(nested), fs.realpathSync(f.project));
  const file = path.join(f.base, 'file');
  fs.writeFileSync(file, 'x');
  assert.throws(() => resolveProject(file), /directory/);
});

test('real directory collisions cannot be mounted, relinked, or unmounted', t => {
  const f = fixture(t);
  const destination = path.join(skillsDir(f.project), 'alpha');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'SKILL.md'), 'private data');
  for (const relink of [false, true]) assert.throws(() => mount({ ...f, skills: 'alpha', relink }), /Collision/);
  assert.throws(() => unmount({ ...f, skills: 'alpha' }), /unowned/);
  assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), 'private data');
});

test('unowned links remain unowned even if already targeting bundled source', t => {
  const f = fixture(t);
  fs.mkdirSync(skillsDir(f.project), { recursive: true });
  const destination = path.join(skillsDir(f.project), 'alpha');
  link(path.join(f.library, 'alpha'), destination);
  assert.throws(() => mount({ ...f, skills: 'alpha', relink: true }), /Collision/);
  assert.throws(() => unmount({ ...f, skills: 'alpha' }), /unowned/);
  unmount({ ...f, all: true });
  assert.ok(fs.lstatSync(destination).isSymbolicLink());
});

test('unowned dangling links are preserved, including on CLI errors', t => {
  const f = fixture(t);
  fs.mkdirSync(skillsDir(f.project), { recursive: true });
  const target = path.join(f.base, 'missing-target');
  const destination = path.join(skillsDir(f.project), 'alpha');
  link(target, destination);
  assert.equal(status(f).skills.find(s => s.name === 'alpha').state, 'unowned');
  assert.throws(() => mount({ ...f, skills: 'alpha', relink: true }), /Collision/);
  assert.throws(() => unmount({ ...f, skills: 'alpha' }), /unowned/);
  const io = { library: f.library, out: () => {}, err: () => {} };
  assert.equal(runCli(['mount', '--project', f.project, '--skills', 'alpha', '--relink'], io), 1);
  assert.equal(runCli(['unmount', '--project', f.project, '--skills', 'alpha'], io), 1);
  assert.ok(fs.lstatSync(destination).isSymbolicLink());
});

test('batch preflight leaves valid selections untouched when a collision occurs', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(skillsDir(f.project), 'beta'), { recursive: true });
  assert.throws(() => mount({ ...f, skills: 'alpha,beta' }), /Collision/);
  assert.equal(fs.existsSync(path.join(skillsDir(f.project), 'alpha')), false);
  mount({ ...f, skills: 'alpha' });
  assert.throws(() => unmount({ ...f, skills: 'alpha,beta' }), /unowned/);
  assert.ok(fs.lstatSync(path.join(skillsDir(f.project), 'alpha')).isSymbolicLink());
});

test('owned dangling links can be unmounted without touching target data', t => {
  const f = fixture(t);
  mount({ ...f, skills: 'alpha' });
  const destination = path.join(skillsDir(f.project), 'alpha');
  fs.renameSync(path.join(f.library, 'alpha'), path.join(f.library, 'moved'));
  assert.equal(status(f).skills.find(s => s.name === 'alpha').state, 'dangling');
  assert.ok(linkTarget(destination));
  unmount({ ...f, skills: 'alpha' });
  assert.throws(() => fs.lstatSync(destination), { code: 'ENOENT' });
  assert.equal(fs.readFileSync(path.join(f.library, 'moved', 'data.txt'), 'utf8'), 'never overwrite');
});

test('bundle relocation requires relink and updates recorded ownership', t => {
  const f = fixture(t);
  mount({ ...f, skills: 'alpha' });
  const relocated = path.join(f.base, 'transferred', 'library');
  fs.mkdirSync(path.dirname(relocated));
  fs.renameSync(f.library, relocated);
  assert.throws(() => mount({ ...f, library: relocated, skills: 'alpha' }), /--relink/);
  mount({ ...f, library: relocated, skills: 'alpha', relink: true });
  assert.equal(status({ ...f, library: relocated }).skills.find(s => s.name === 'alpha').state, 'mounted');
  assert.equal(JSON.parse(fs.readFileSync(metadata(f.project))).links.alpha.target, fs.realpathSync(path.join(relocated, 'alpha')));
});

test('metadata does not authorize a link swapped to another target', t => {
  const f = fixture(t);
  mount({ ...f, skills: 'alpha' });
  const destination = path.join(skillsDir(f.project), 'alpha');
  fs.unlinkSync(destination);
  link(path.join(f.library, 'beta'), destination);
  assert.throws(() => mount({ ...f, skills: 'alpha', relink: true }), /Collision/);
  assert.throws(() => unmount({ ...f, skills: 'alpha' }), /unowned/);
});

function legacyFixture(t, folder = 'skills-vault') {
  const f = fixture(t);
  const old = path.join(f.base, folder, 'alpha');
  fs.mkdirSync(old, { recursive: true });
  fs.copyFileSync(path.join(f.library, 'alpha', 'SKILL.md'), path.join(old, 'SKILL.md'));
  fs.mkdirSync(skillsDir(f.project), { recursive: true });
  link(old, path.join(skillsDir(f.project), 'alpha'));
  return { ...f, old };
}
test('same-name skills-vault legacy with matching SHA256 is relinkable and unmountable', t => {
  const f = legacyFixture(t);
  assert.equal(status(f).skills.find(s => s.name === 'alpha').state, 'legacy');
  assert.throws(() => mount({ ...f, skills: 'alpha' }), /Collision/);
  mount({ ...f, skills: 'alpha', relink: true });
  unmount({ ...f, skills: 'alpha' });
  assert.equal(fs.readFileSync(path.join(f.old, 'SKILL.md'), 'utf8'), '# alpha\n');
  link(f.old, path.join(skillsDir(f.project), 'alpha'));
  unmount({ ...f, all: true });
  assert.equal(fs.existsSync(path.join(skillsDir(f.project), 'alpha')), false);
});

test('legacy content mismatch, wrong parent, and wrong name are not adopted', t => {
  const f = legacyFixture(t);
  fs.writeFileSync(path.join(f.old, 'SKILL.md'), 'different');
  assert.throws(() => mount({ ...f, skills: 'alpha', relink: true }), /Collision/);
  assert.throws(() => unmount({ ...f, skills: 'alpha' }), /unowned/);
  const destination = path.join(skillsDir(f.project), 'alpha');
  fs.unlinkSync(destination);
  link(path.join(f.library, 'alpha'), destination);
  assert.throws(() => mount({ ...f, skills: 'alpha', relink: true }), /Collision/);
  fs.unlinkSync(destination);
  const wrongName = path.join(f.base, 'skills-vault', 'other');
  fs.mkdirSync(wrongName);
  fs.writeFileSync(path.join(wrongName, 'SKILL.md'), '# alpha\n');
  link(wrongName, destination);
  assert.throws(() => unmount({ ...f, skills: 'alpha' }), /unowned/);
});

test('path traversal, unsafe Windows names, and invalid selections fail', t => {
  const f = fixture(t);
  for (const name of ['', '.', '..', '../alpha', 'a/b', 'a\\b', '/absolute', 'C:alpha', 'a\0b', 'a.', 'con', 'LPT1.txt']) {
    assert.throws(() => validateName(name));
    assert.throws(() => mount({ ...f, skills: [name] }));
    assert.throws(() => unmount({ ...f, skills: [name] }));
  }
  for (const options of [{}, { skills: '' }, { skills: 'alpha,' }, { skills: 'alpha', all: true }]) assert.throws(() => mount({ ...f, ...options }));
  assert.throws(() => mount({ ...f, skills: 'missing' }));
});

test('linked control directories and invalid metadata fail closed', t => {
  const f = fixture(t);
  const other = path.join(f.base, 'other');
  fs.mkdirSync(other);
  link(other, path.join(f.project, '.agents'));
  assert.throws(() => mount({ ...f, skills: 'alpha' }), /control path/);
  fs.unlinkSync(path.join(f.project, '.agents'));
  fs.mkdirSync(path.join(f.project, '.agents'));
  fs.writeFileSync(metadata(f.project), '{"version":2,"links":{}}');
  assert.throws(() => unmount({ ...f, all: true }), /metadata/);
});

test('relative symlink targets are resolved from link parent on Unix', { skip: process.platform === 'win32' ? 'Windows uses absolute directory junctions' : false }, t => {
  const f = fixture(t);
  mount({ ...f, skills: 'alpha' });
  const destination = path.join(skillsDir(f.project), 'alpha');
  fs.unlinkSync(destination);
  fs.symlinkSync(path.relative(skillsDir(f.project), path.join(f.library, 'alpha')), destination, 'dir');
  assert.equal(status(f).skills.find(s => s.name === 'alpha').state, 'mounted');
  unmount({ ...f, skills: 'alpha' });
});

test('git exclude updates are idempotent and never modify tracked .gitignore', { skip: !hasGit }, t => {
  const f = fixture(t);
  git('init', f.project);
  const ignore = path.join(f.project, '.gitignore');
  fs.writeFileSync(ignore, 'keep-me\n');
  git('-C', f.project, 'add', '.gitignore');
  mount({ ...f, skills: 'alpha' });
  const exclude = path.resolve(f.project, git('-C', f.project, 'rev-parse', '--git-path', 'info/exclude'));
  const first = fs.readFileSync(exclude, 'utf8');
  mount({ ...f, skills: 'alpha' });
  assert.equal(fs.readFileSync(exclude, 'utf8'), first);
  assert.match(first, /\.agents\/skills\//);
  assert.match(first, /\.agents\/code-skills\.json/);
  assert.equal(fs.readFileSync(ignore, 'utf8'), 'keep-me\n');
  assert.equal(git('-C', f.project, 'check-ignore', '.agents/skills/alpha', '.agents/code-skills.json').split(/\r?\n/).length, 2);
});

test('worktree .git file resolves upward and uses git-provided exclude path', { skip: !hasGit }, t => {
  const f = fixture(t);
  git('init', f.project);
  git('-C', f.project, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'init');
  const worktree = path.join(f.base, 'worktree');
  git('-C', f.project, 'worktree', 'add', '-b', 'test-linked', worktree);
  const nested = path.join(worktree, 'nested');
  fs.mkdirSync(nested);
  assert.equal(resolveProject(nested), fs.realpathSync(worktree));
  mount({ project: nested, library: f.library, skills: 'alpha' });
  assert.equal(fs.existsSync(metadata(worktree)), true);
  const exclude = path.resolve(worktree, git('-C', worktree, 'rev-parse', '--git-path', 'info/exclude'));
  assert.match(fs.readFileSync(exclude, 'utf8'), /\.agents\/code-skills\.json/);
  assert.equal(git('-C', worktree, 'check-ignore', '.agents/code-skills.json'), '.agents/code-skills.json');
});

test('CLI rejects errors nonzero, supports project-free list, and emits warnings', t => {
  const f = fixture(t);
  const out = [], err = [];
  const io = { library: f.library, out: x => out.push(x), err: x => err.push(x) };
  assert.equal(runCli(['list'], io), 0);
  const listed = JSON.parse(out.pop());
  assert.deepEqual(listed.skills.map(s => s.name), ['alpha', 'beta']);
  for (const args of [[], ['wat'], ['status'], ['mount', '--project', '.','--all'], ['mount', '--project'], ['list', '--project', f.project], ['status', '--all'], ['unmount', '--relink'], ['mount', '--project', f.project], ['mount', '--project', f.project, '--all', '--skills', 'alpha'], ['status', '--project', f.project, '--project', f.project], ['list', '--unknown']]) {
    assert.equal(runCli(args, io), 1, JSON.stringify(args));
  }
  assert.equal(runCli(['status', '--project', f.project], io), 0);
  assert.ok(err.some(line => line.startsWith('Warning:')));
  const cli = fileURLToPath(new URL('./code-skills.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'mount', '--project', '.','--all'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /absolute directory/);
  assert.equal(spawnSync(process.execPath, [cli, '--help'], { windowsHide: true }).status, 0);
});

test('list reports name, description and path for folded, quoted and plain frontmatter', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.library, 'alpha', 'SKILL.md'), [
    '---', 'name: alpha-skill', 'description: >', '  Folded line one', '  folded line two', '---', '', '# body'
  ].join('\n'));
  fs.writeFileSync(path.join(f.library, 'beta', 'SKILL.md'), [
    '---', 'name: "beta-skill"', 'description: "Quoted description here"', '---'
  ].join('\n'));
  const skills = describeSkills(f.library);
  assert.deepEqual(skills.map(s => s.name), ['alpha-skill', 'beta-skill']);
  assert.equal(skills[0].description, 'Folded line one folded line two');
  assert.equal(skills[1].description, 'Quoted description here');
  assert.equal(skills[0].path, path.join(path.resolve(f.library), 'alpha'));
});

test('plain body without frontmatter falls back to the folder name', t => {
  const f = fixture(t);
  const skills = describeSkills(f.library);
  assert.deepEqual(skills.map(s => s.name), ['alpha', 'beta']);
  assert.equal(skills[0].description, '');
});

test('--library overrides the default library for list, path and mount', t => {
  const f = fixture(t);
  const out = [];
  const io = { library: path.join(f.base, 'nowhere'), out: x => out.push(x), err: () => {} };
  assert.equal(runCli(['list', '--library', f.library], io), 0);
  const listed = JSON.parse(out.pop());
  assert.equal(listed.library, path.resolve(f.library));
  assert.deepEqual(listed.skills.map(s => s.name), ['alpha', 'beta']);
  assert.equal(runCli(['path', '--library', f.library], io), 0);
  assert.equal(JSON.parse(out.pop()).library, path.resolve(f.library));
  assert.equal(runCli(['mount', '--project', f.project, '--library', f.library, '--skills', 'alpha'], io), 0);
  assert.equal(status({ project: f.project, library: f.library }).skills.find(s => s.name === 'alpha').state, 'mounted');
  unmount({ project: f.project, library: f.library, skills: 'alpha' });
});
test('missing library reports an actionable error', t => {
  const f = fixture(t);
  assert.throws(() => listSkills(path.join(f.base, 'nowhere')), /Library not found: .*--library/);
});

test('init creates the chosen library and saves it to the config file', t => {
  const f = fixture(t);
  const configPath = path.join(f.base, 'config', 'config.json');
  const target = path.join(f.base, 'chosen-library');
  const out = [];
  const io = { out: x => out.push(x), err: () => {}, config: configPath };
  assert.equal(runCli(['init', '--library', target], io), 0);
  assert.ok(fs.existsSync(target));
  assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).library, path.resolve(target));
  assert.equal(runCli(['path'], io), 0);
  const info = JSON.parse(out.pop());
  assert.equal(info.library, path.resolve(target));
  assert.equal(info.source, 'config');
  assert.equal(runCli(['config'], io), 0);
  assert.equal(JSON.parse(out.pop()).source, 'config');
});

test('init refuses to create the fallback library without an explicit choice', t => {
  const f = fixture(t);
  const configPath = path.join(f.base, 'config', 'config.json');
  const err = [];
  const io = { out: () => {}, err: x => err.push(x), config: configPath };
  assert.equal(runCli(['init'], io), 1);
  assert.ok(err.some(line => line.includes('No library path given')), err.join('\n'));
  assert.equal(fs.existsSync(configPath), false);
});

test('discovery provides a mountable id when frontmatter name differs', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.library, 'alpha', 'SKILL.md'), '---\nname: display-name\ndescription: Example\n---\n');
  const skill = describeSkills(f.library)[0];
  assert.equal(skill.id, 'alpha');
  assert.equal(skill.name, 'display-name');
  mount({ ...f, skills: skill.id });
  assert.equal(status(f).skills.find(s => s.name === skill.id).state, 'mounted');
});

test('help is grouped, command-specific, and independent of broken config', t => {
  const f = fixture(t);
  const config = path.join(f.base, 'broken.json');
  fs.writeFileSync(config, '{broken');
  for (const args of [['--help'], ['mount', '--help'], ['config', '-h']]) {
    const out = [];
    assert.equal(runCli(args, { config, out: text => out.push(text), err: () => {} }), 0);
    assert.match(out.join('\n'), /Usage:/);
    assert.ok(out.join('\n').split('\n').length > 5);
  }
});

test('config validates saved library type and preserves unrelated fields', t => {
  const f = fixture(t);
  const config = path.join(f.base, 'config.json');
  const io = { config, out: () => {}, err: () => {} };
  fs.writeFileSync(config, JSON.stringify({ library: 42 }));
  assert.equal(runCli(['path'], io), 1);
  assert.equal(runCli(['config', '--library', f.library], io), 0);
  fs.writeFileSync(config, JSON.stringify({ library: f.library, custom: true }));
  const chosen = path.join(f.base, 'not-created');
  assert.equal(runCli(['config', '--library', chosen], io), 0);
  assert.equal(fs.existsSync(chosen), false);
  assert.equal(JSON.parse(fs.readFileSync(config)).custom, true);
});

test('init preflights config before creating the requested library', t => {
  const f = fixture(t);
  const config = path.join(f.base, 'broken.json');
  fs.writeFileSync(config, '{broken');
  const chosen = path.join(f.base, 'not-created');
  assert.equal(runCli(['init', '--library', chosen], { config, out: () => {}, err: () => {} }), 1);
  assert.equal(fs.existsSync(chosen), false);
});

test('CLI accepts trimmed skill lists and deduplicates selections', t => {
  const f = fixture(t);
  assert.deepEqual(mount({ ...f, skills: 'alpha, beta,alpha' }).mounted, ['alpha', 'beta']);
});

test('path reports first-use setup even when fallback directory already exists', t => {
  const f = fixture(t);
  const cli = fileURLToPath(new URL('./code-skills.mjs', import.meta.url));
  const env = { ...process.env, CODE_SKILLS_CONFIG: path.join(f.base, 'config.json') };
  delete env.CODE_SKILLS_LIBRARY;
  const inspect = () => {
    const result = spawnSync(process.execPath, [cli, 'path'], { env, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const first = inspect();
  assert.equal(first.recommendedLibrary, path.join(os.homedir(), '.agents', 'code-skills-library'));
  assert.equal(first.needsInit, true);
  assert.equal(fs.existsSync(env.CODE_SKILLS_CONFIG), false);
  fs.writeFileSync(env.CODE_SKILLS_CONFIG, JSON.stringify({ library: f.library }));
  assert.equal(inspect().needsInit, false);
  fs.writeFileSync(env.CODE_SKILLS_CONFIG, JSON.stringify({ library: path.join(f.base, 'missing') }));
  assert.equal(inspect().needsInit, true);
  env.CODE_SKILLS_LIBRARY = f.library;
  assert.equal(inspect().needsInit, false);
});

test('status still reports project links after the library directory disappears', t => {
  const f = fixture(t);
  mount({ ...f, skills: 'alpha' });
  fs.rmSync(f.library, { recursive: true, force: true });
  const warnings = [];
  const result = status({ project: f.project, library: f.library, warn: message => warnings.push(message) });
  assert.equal(result.skills.find(s => s.name === 'alpha').state, 'dangling');
  assert.ok(warnings.some(message => /Library not found/.test(message)), warnings.join('\n'));
});

test('an invalid folder name reports the offending path', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.library, 'bad name'), { recursive: true });
  fs.writeFileSync(path.join(f.library, 'bad name', 'SKILL.md'), '# bad\n');
  assert.throws(() => listSkills(f.library), /Invalid skill name.*bad name/);
});
