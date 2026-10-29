#!/usr/bin/env node
// Portable, dependency-free project skill links. Requires Node.js >=22.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Built-in fallback only; a user choice is saved in the config file and always wins over it.
export const DEFAULT_LIBRARY = path.join(os.homedir(), '.agents', 'code-skills-library');
export const CONFIG_FILE = process.env.CODE_SKILLS_CONFIG
  ? path.resolve(process.env.CODE_SKILLS_CONFIG)
  : path.join(os.homedir(), '.code-skills', 'config.json');

export function readConfig(file = CONFIG_FILE) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected a JSON object');
    return parsed;
  } catch (error) {
    throw new Error(`Invalid code-skills config ${file}: ${error.message}`);
  }
}

export function writeConfig(library, file = CONFIG_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = { ...readConfig(file), library: path.resolve(library) };
  atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`);
  return { config: file, library: data.library };
}

// Precedence: --library flag, CODE_SKILLS_LIBRARY env var, saved config, built-in fallback.
export function resolveLibrary({ library, file = CONFIG_FILE } = {}) {
  if (library) return { library: path.resolve(library), source: 'flag', config: file };
  if (process.env.CODE_SKILLS_LIBRARY) return { library: path.resolve(process.env.CODE_SKILLS_LIBRARY), source: 'env', config: file };
  const configured = readConfig(file).library;
  if (configured !== undefined && (typeof configured !== 'string' || !configured.trim())) {
    throw new Error(`Invalid library in config ${file}: expected a non-empty string. Use config --library DIR to repair it.`);
  }
  if (typeof configured === 'string' && configured.trim()) return { library: path.resolve(configured), source: 'config', config: file };
  return { library: path.resolve(DEFAULT_LIBRARY), source: 'default', config: file };
}

// Creates an explicitly chosen library directory and saves the choice.
// The built-in fallback is never created implicitly: without --library, an env var or a saved
// config there is no user decision yet, so init stops instead of guessing.
export function initLibrary({ library, file = CONFIG_FILE } = {}) {
  const resolved = resolveLibrary({ library, file });
  if (resolved.source === 'default') {
    throw new Error(`No library path given and none configured. Nothing was created. Ask the user to confirm a library location. Recommended default: ${DEFAULT_LIBRARY}. Then run init --library DIR.`);
  }
  readConfig(file); // Validate before creating a directory, including with an explicit flag.
  fs.mkdirSync(resolved.library, { recursive: true });
  const saved = writeConfig(resolved.library, file);
  return { ...saved, exists: fs.existsSync(resolved.library) };
}
const own = (object, key) => Object.hasOwn(object, key);
const exists = p => { try { return fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const canonical = p => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && canonical(a) === canonical(b);
export function validateName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) || name.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw new Error(`Invalid skill name: ${JSON.stringify(name)}`);
  }
  return name;
}
const currentLibrary = () => resolveLibrary().library;
export function listSkills(library = currentLibrary()) {
  if (!fs.existsSync(library)) {
    throw new Error(`Library not found: ${path.resolve(library)}. Run init --library DIR to create it, or pass --library / set CODE_SKILLS_LIBRARY.`);
  }
  return fs.readdirSync(library, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && exists(path.join(library, entry.name, 'SKILL.md'))?.isFile())
    .map(entry => {
      try { return validateName(entry.name); } catch (error) {
        throw new Error(`${error.message} (in ${path.join(library, entry.name)})`);
      }
    }).sort();
}

function unquote(value) {
  const match = /^(["'])([\s\S]*)\1$/.exec(value);
  return match ? match[2] : value;
}

// Minimal YAML frontmatter reader: plain, quoted, folded (>) and literal (|) scalars.
function frontmatterValue(block, key) {
  const lines = block.split(/\r?\n/);
  const pattern = new RegExp(`^${key}\\s*:\\s*(.*)$`);
  let value = null;
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match) { value = match[1].trim(); break; }
  }
  if (value === null) return '';
  if (!/^[|>][-+]?$/.test(value)) return unquote(value).trim();
  const style = value[0];
  const collected = [];
  let reading = false;
  for (const line of lines) {
    if (!reading) { if (pattern.test(line)) reading = true; continue; }
    if (/^\s*$/.test(line)) { collected.push(''); continue; }
    if (!/^\s/.test(line)) break;
    collected.push(line.replace(/^\s+/, ''));
  }
  while (collected.length && collected[collected.length - 1] === '') collected.pop();
  return style === '|' ? collected.join('\n') : collected.join(' ').replace(/\s+/g, ' ').trim();
}

export function readSkillMeta(directory) {
  const file = path.join(directory, 'SKILL.md');
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const head = block ? block[1] : '';
  const name = frontmatterValue(head, 'name');
  return { name: name || path.basename(directory), description: frontmatterValue(head, 'description') };
}

// Returns every skill in the library with the metadata an agent needs to choose.
export function describeSkills(library = currentLibrary()) {
  return listSkills(library).map(name => {
    const directory = path.join(path.resolve(library), name);
    const meta = readSkillMeta(directory);
    return { id: name, name: meta.name, description: meta.description, path: directory };
  });
}

export function libraryInfo(library) {
  const resolved = path.resolve(library);
  return { library: resolved, exists: fs.existsSync(resolved) };
}
export function resolveProject(project, warn = () => {}) {
  if (typeof project !== 'string' || !path.isAbsolute(project)) throw new Error('--project must be an explicit existing absolute directory');
  if (!fs.statSync(project).isDirectory()) throw new Error('--project must name a directory');
  const explicit = fs.realpathSync(project);
  let current = explicit;
  while (true) {
    const git = exists(path.join(current, '.git'));
    if (git?.isDirectory() || git?.isFile()) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  warn(`No .git directory/file found; using explicit project path: ${explicit}`);
  return explicit;
}
function safeDirectory(directory) {
  const stat = exists(directory);
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`Refusing non-directory or linked control path: ${directory}`);
}
function context(project, warn) {
  const root = resolveProject(project, warn);
  const agents = path.join(root, '.agents');
  const skills = path.join(agents, 'skills');
  const metadata = path.join(agents, 'code-skills.json');
  safeDirectory(agents);
  safeDirectory(skills);
  if (exists(metadata) && (!exists(metadata).isFile() || exists(metadata).isSymbolicLink())) throw new Error(`Unsafe metadata path: ${metadata}`);
  let state = { version: 1, links: Object.create(null) };
  if (exists(metadata)) {
    state = JSON.parse(fs.readFileSync(metadata, 'utf8'));
    if (state.version !== 1 || !state.links || typeof state.links !== 'object' || Array.isArray(state.links)) throw new Error('Invalid code-skills metadata');
    for (const [name, entry] of Object.entries(state.links)) {
      validateName(name);
      if (!entry || typeof entry.target !== 'string' || !path.isAbsolute(entry.target)) throw new Error(`Invalid metadata target: ${name}`);
    }
  }
  return { root, agents, skills, metadata, state };
}
function atomicWrite(destination, content) {
  const temporary = `${destination}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx' });
    fs.renameSync(temporary, destination);
  } finally {
    if (exists(temporary)) fs.unlinkSync(temporary);
  }
}
function save(ctx) {
  fs.mkdirSync(ctx.agents, { recursive: true });
  atomicWrite(ctx.metadata, `${JSON.stringify(ctx.state, null, 2)}\n`);
}
export function linkTarget(link) {
  if (!exists(link)?.isSymbolicLink()) return null;
  // readlink, not realpath: owned dangling links must remain safely removable.
  return path.resolve(path.dirname(link), fs.readlinkSync(link));
}
function owned(ctx, name, target) {
  return own(ctx.state.links, name) && same(target, ctx.state.links[name].target);
}
function source(library, name) {
  validateName(name);
  const directory = path.resolve(library, name);
  if (!fs.statSync(directory).isDirectory() || !fs.statSync(path.join(directory, 'SKILL.md')).isFile()) throw new Error(`Missing bundled skill: ${name}`);
  return fs.realpathSync(directory);
}
function legacy(target, name, library) {
  if (!target || path.basename(target) !== name || path.basename(path.dirname(target)) !== 'skills-vault') return false;
  try {
    const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return hash(path.join(target, 'SKILL.md')) === hash(path.join(source(library, name), 'SKILL.md'));
  } catch { return false; }
}
function select(skills, all, available) {
  if (all && skills !== undefined) throw new Error('Use either --skills or --all, not both');
  if (all) return available;
  const names = typeof skills === 'string' ? skills.split(',').map(name => name.trim()) : skills;
  if (!Array.isArray(names) || !names.length) throw new Error('Specify --skills a,b or --all');
  return [...new Set(names.map(validateName))];
}
function gitExclude(ctx, warn) {
  if (!exists(path.join(ctx.root, '.git'))) return;
  let exclude;
  try {
    exclude = execFileSync('git', ['-C', ctx.root, 'rev-parse', '--git-path', 'info/exclude'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) { throw new Error(`Cannot resolve Git exclude: ${error.message}`); }
  exclude = path.resolve(ctx.root, exclude);
  // Git owns this location (including linked-worktree shared git directories).
  if (exists(exclude)?.isSymbolicLink()) throw new Error(`Refusing linked Git exclude file: ${exclude}`);
  const text = exists(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  const lines = text.split(/\r?\n/);
  const missing = ['.agents/skills/', '.agents/code-skills.json'].filter(line => !lines.includes(line));
  if (missing.length) {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    atomicWrite(exclude, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`);
  }
}
export function mount({ project, skills, all = false, relink = false, library = currentLibrary(), warn = () => {} }) {
  const ctx = context(project, warn);
  const names = select(skills, all, all ? listSkills(library) : []);
  // Preflight every selected name before modifying any links.
  const plans = names.map(name => {
    const target = source(library, name);
    const link = path.join(ctx.skills, name);
    const stat = exists(link);
    const previous = linkTarget(link);
    if (stat && (!stat.isSymbolicLink() || !owned(ctx, name, previous))) {
      if (!(relink && stat.isSymbolicLink() && legacy(previous, name, library))) throw new Error(`Collision: refusing unowned path ${link}`);
    }
    if (stat && !same(previous, target) && !relink) throw new Error(`Skill ${name} points elsewhere; use --relink`);
    return { name, target, link, previous, stat };
  });
  gitExclude(ctx, warn);
  fs.mkdirSync(ctx.skills, { recursive: true });
  for (const plan of plans) {
    if (!plan.stat || !same(plan.previous, plan.target)) {
      if (plan.stat) fs.unlinkSync(plan.link);
      fs.symlinkSync(plan.target, plan.link, process.platform === 'win32' ? 'junction' : 'dir');
    }
    // Persist after each successful link, so a later filesystem failure does not lose ownership.
    Object.defineProperty(ctx.state.links, plan.name, { value: { target: plan.target }, enumerable: true, writable: true, configurable: true });
    save(ctx);
  }
  return { project: ctx.root, mounted: names };
}
export function unmount({ project, skills, all = false, library = currentLibrary(), warn = () => {} }) {
  const ctx = context(project, warn);
  const installed = exists(ctx.skills) ? fs.readdirSync(ctx.skills) : [];
  // --all includes only owned and content-verified legacy links, not arbitrary local skills.
  const available = [...new Set([...Object.keys(ctx.state.links), ...installed.filter(name => {
    try { validateName(name); return legacy(linkTarget(path.join(ctx.skills, name)), name, library); } catch { return false; }
  })])].sort();
  const names = select(skills, all, available);
  const plans = names.map(name => {
    const link = path.join(ctx.skills, name);
    const stat = exists(link);
    const target = linkTarget(link);
    if (stat && (!stat.isSymbolicLink() || !(owned(ctx, name, target) || legacy(target, name, library)))) throw new Error(`Refusing to unmount unowned path: ${link}`);
    return { name, link, stat };
  });
  for (const { name, link, stat } of plans) {
    if (stat) fs.unlinkSync(link); // Never recursive; never follow the link.
    delete ctx.state.links[name];
    save(ctx);
  }
  return { project: ctx.root, unmounted: names };
}
export function status({ project, library = currentLibrary(), warn = () => {} }) {
  const ctx = context(project, warn);
  let librarySkills = [];
  if (fs.existsSync(library)) {
    librarySkills = listSkills(library);
  } else {
    warn(`Library not found: ${path.resolve(library)}; reporting project links only`);
  }
  const names = [...new Set([...librarySkills, ...Object.keys(ctx.state.links), ...(exists(ctx.skills) ? fs.readdirSync(ctx.skills) : [])])].sort();
  return { project: ctx.root, skills: names.map(name => {
    validateName(name);
    const link = path.join(ctx.skills, name);
    const stat = exists(link);
    const target = linkTarget(link);
    let state = 'absent';
    if (stat) {
      state = 'collision';
      if (stat.isSymbolicLink()) {
        if (owned(ctx, name, target)) {
          let expected;
          try { expected = source(library, name); } catch { /* bundle may have removed a skill */ }
          state = !exists(target) ? 'dangling' : same(target, expected) ? 'mounted' : 'relink-needed';
        } else if (legacy(target, name, library)) state = 'legacy';
        else state = 'unowned';
      }
    }
    return { name, state, ...(target ? { target } : {}) };
  }) };
}
const COMMANDS = {
  init: { usage: 'init [--library DIR]', description: 'Create a chosen library directory and save its path.', flags: ['--library'] },
  config: { usage: 'config [--library DIR]', description: 'Read configuration, or save a library path without creating the library directory.', flags: ['--library'] },
  path: { usage: 'path', description: 'Show the effective library path, existence, config file and source.', flags: ['--library'] },
  list: { usage: 'list', description: 'List skill ids, frontmatter names, descriptions and absolute paths.', flags: ['--library'] },
  status: { usage: 'status --project ABS', description: 'Inspect library skills, local entries and recorded links without modifying them.', flags: ['--project', '--library'] },
  mount: { usage: 'mount --project ABS (--skills ID[,ID] | --all) [--relink]', description: 'Link selected library skills into a project; refuse foreign paths.', flags: ['--project', '--skills', '--all', '--relink', '--library'] },
  unmount: { usage: 'unmount --project ABS (--skills ID[,ID] | --all)', description: 'Remove managed links while preserving library source files.', flags: ['--project', '--skills', '--all', '--library'] },
};

export function helpText(command) {
  const details = command ? COMMANDS[command] : null;
  if (command && !details) throw new Error(`Unknown command: ${command}`);
  const lines = ['code-skills — project-scoped skill links (Node.js >=22)', '',
    `Usage: node scripts/code-skills.mjs ${details ? details.usage : '<command> [options]'}`, ''];
  if (details) {
    lines.push(details.description, '', `Options: ${details.flags.join(', ')}, --help, -h`);
  } else {
    for (const [title, names] of [['Configuration (one-time)', ['init', 'config', 'path']], ['Daily workflow', ['list', 'status', 'mount']], ['Maintenance', ['unmount']]]) {
      lines.push(`${title}:`);
      for (const name of names) lines.push(`  ${COMMANDS[name].usage}`, `    ${COMMANDS[name].description}`);
      lines.push('');
    }
  }
  lines.push('', 'All commands accept --library DIR. --project requires an existing absolute directory.',
    'Use list.skills[].id with --skills; name is the frontmatter display name.',
    'Library precedence: --library > CODE_SKILLS_LIBRARY > config > built-in fallback.',
    'Config: ~/.code-skills/config.json; override with CODE_SKILLS_CONFIG.',
    `Recommended library: ${DEFAULT_LIBRARY}. On first use, ask the user to confirm this or another path.`,
    'Output: JSON on stdout; warnings/errors on stderr. Exit codes: 0 success, 1 error.',
    'Help is plain text. Use <command> --help for command details.');
  if (command === 'mount') lines.push('--relink repairs owned links after library relocation; it does not overwrite foreign paths.');
  if (command === 'init') lines.push('Without a flag, environment value or saved path, init refuses to create the fallback.');
  return lines.join('\n');
}

export function runCli(argv, { out = console.log, err = console.error, library, config = CONFIG_FILE } = {}) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js >=22 is required');
    if (!argv.length || (argv.length === 1 && ['--help', '-h'].includes(argv[0]))) {
      out(helpText());
      return argv.length ? 0 : 1;
    }
    const [command, ...args] = argv;
    if (!own(COMMANDS, command)) throw new Error(`Unknown command: ${command}. Use --help for available commands.`);
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
      out(helpText(command));
      return 0;
    }
    const options = { library, config, warn: message => err(`Warning: ${message}`) };
    const seen = new Set();
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
      seen.add(flag);
      if (['--project', '--skills', '--library'].includes(flag)) {
        if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`);
        options[flag.slice(2)] = args[++i];
      } else if (['--all', '--relink'].includes(flag)) options[flag.slice(2)] = true;
      else throw new Error(`Unknown option: ${flag}`);
    }
    const allowed = COMMANDS[command].flags;
    for (const flag of seen) if (!allowed.includes(flag)) throw new Error(`${flag} is not valid for ${command}`);
    if (command === 'init') {
      out(JSON.stringify(initLibrary({ library: options.library, file: options.config }), null, 2));
      return 0;
    }
    if (command === 'config') {
      const result = options.library
        ? writeConfig(options.library, options.config)
        : (({ library: lib, source, config: file }) => ({ library: lib, source, config: file }))(resolveLibrary({ file: options.config }));
      out(JSON.stringify(result, null, 2));
      return 0;
    }
    const resolved = resolveLibrary({ library: options.library, file: options.config });
    const result = command === 'list'
      ? { ...libraryInfo(resolved.library), source: resolved.source, config: resolved.config, skills: describeSkills(resolved.library) }
      : command === 'path'
        ? { ...libraryInfo(resolved.library), source: resolved.source, config: resolved.config,
          recommendedLibrary: DEFAULT_LIBRARY,
          needsInit: resolved.source === 'default' || !fs.statSync(resolved.library, { throwIfNoEntry: false })?.isDirectory() }
        : ({ mount, unmount, status }[command])({ ...options, library: resolved.library });
    out(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) { err(`Error: ${error.message}`); return 1; }
}
if (process.argv[1] && same(fileURLToPath(import.meta.url), process.argv[1])) process.exitCode = runCli(process.argv.slice(2));
