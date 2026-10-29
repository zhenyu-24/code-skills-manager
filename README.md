# code-skills

**Project-scoped code skills for Codex: one global entry point, selected skills per project.**

Keep your skill library outside global discovery roots and link selected skills into each project. Built with Node.js standard modules: no npm dependencies, network calls, or background services.

**English** · [简体中文](README.zh-CN.md) · [Agent instructions](SKILL.md)

## Why code-skills

Skill names and descriptions enter the agent's discovery context; full instructions are loaded on demand. Placing an entire library inside a global skill root exposes it to unrelated projects. code-skills separates the library from the entry point and uses project links to select what is discoverable. Actual discovery scope and refresh behavior depend on the Codex version.

- **Task-based selection:** discover metadata with `list`, then match it to project evidence.
- **One source copy:** project links reflect changes to library files.
- **Inspectable state:** distinguish mounted, broken, relocated, and conflicting entries.
- **Ownership protection:** refuse real-directory and foreign-link collisions; preserve sources on removal.
- **Cross-platform:** directory junctions on Windows, directory symlinks on macOS/Linux.

## Requirements

- Node.js **22+**.
- Git on PATH for Git projects, including worktrees, to locate the repository-local exclude file.
- Codex, which discovers project `.agents/skills/`. The CLI does not refresh Codex's skill catalog.

## First invocation and recommended location

The recommended library is `~/.agents/code-skills-library`, typically `C:/Users/<username>/.agents/code-skills-library` on Windows. This location is outside the global skill root and does not depend on where the tool was downloaded.

After installation, invoke code-skills. The agent first runs the read-only `path` command:

1. When `needsInit` is true, ask for the library location and recommend the absolute `recommendedLibrary`. Ask even when the fallback directory already exists but no location has been configured.
2. After the user confirms the default or supplies another location, run `init --library`, verify, and continue project skill selection. Do not create a directory while awaiting a reply.
3. Reuse valid saved or environment paths without asking again. If a chosen directory is missing, ask whether to restore it or select another location.
4. An initialized empty library needs skills, not repeated initialization. An explicitly requested initialization path needs no further confirmation.

This behavior is implemented by the agent following SKILL.md; the CLI does not open an interactive prompt. Manual setup is available below.

## Install and quick start

Install this directory at `~/.agents/skills/code-skills`. For an existing installation, update its files in place to avoid nesting `code-skills/code-skills`. For a first installation, run from the source directory's parent:

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force "$HOME/.agents/skills" | Out-Null
Copy-Item -Recurse ./code-skills "$HOME/.agents/skills/code-skills"
$CS = "$HOME/.agents/skills/code-skills/scripts/code-skills.mjs"
node "$CS" init --library "$HOME/.agents/code-skills-library"
```

```bash
# macOS / Linux
mkdir -p "$HOME/.agents/skills"
cp -R ./code-skills "$HOME/.agents/skills/code-skills"
CS="$HOME/.agents/skills/code-skills/scripts/code-skills.mjs"
node "$CS" init --library "$HOME/.agents/code-skills-library"
```

Add skill directories to the library, each containing `SKILL.md`, then run:

```text
node "$CS" list
node "$CS" status --project "<PROJECT>"
node "$CS" mount --project "<PROJECT>" --skills "<id>"
node "$CS" status --project "<PROJECT>"
```

`CS` is the absolute script path, `<PROJECT>` an existing absolute project directory, and `<id>` comes from `list.skills[].id`. Replace placeholders before running. Confirm `mounted`, then refresh Codex's catalog or start a new project session. Load the selected instructions when using the skill.

## On-demand references

Keep SKILL.md compact. Read only the reference required for the current operation, not the whole directory.

| Document | Contents |
| --- | --- |
| [references/setup.md](references/setup.md) | Setup and configuration |
| [references/commands.md](references/commands.md) | Commands and layout |
| [references/selection.md](references/selection.md) | Skill selection |
| [references/interaction.md](references/interaction.md) | Question tools |
| [references/operations.md](references/operations.md) | Status, relocation and troubleshooting |
| [references/output.md](references/output.md) | JSON output contract |

## Directory layout

```text
~/.agents/
├── skills/                             # Global discovery root
│   └── code-skills/                     # Installation directory (<BASE>)
│       ├── SKILL.md                     # Agent workflow and constraints
│       ├── README.md                    # English user guide
│       ├── README.zh-CN.md               # Chinese user guide
│       ├── references/                  # On-demand references; see index above
│       └── scripts/
│           ├── code-skills.mjs          # CLI and importable functions
│           └── code-skills.test.mjs     # Node.js built-in tests
└── code-skills-library/                 # Default library; configurable
    ├── example-api/                     # Directory name is the mount id
    │   ├── SKILL.md                     # Skill definition
    │   └── scripts/                     # Optional skill resources
    └── example-ui/
        └── SKILL.md

~/.code-skills/
└── config.json                         # User configuration: library path

<PROJECT>/
├── .agents/
│   ├── skills/
│   │   └── example-api/                # Directory link to <LIB>/example-api
│   └── code-skills.json                 # Link ownership record
└── .git/
    └── info/exclude                     # Local ignores; Git resolves worktrees
```

`example-api` and `example-ui` illustrate the layout; they are not bundled skills. Keep the library outside all global discovery roots. Mounting does not copy content or install a skill's dependencies.

## Command reference

These commands work in PowerShell, Bash, or Zsh after setting `CS`. Square brackets indicate optional syntax and should not be entered literally. Every command accepts `--library "<LIB>"`.

### Configuration (one-time)

| Command | Purpose |
| --- | --- |
| `node "$CS" init --library "<LIB>"` | Create the library directory and save its path |
| `node "$CS" config [--library "<LIB>"]` | Read configuration, or save a path without creating the library directory |
| `node "$CS" path` | Show effective library path, existence, source, and config location |

`init` also accepts an environment or saved path; it refuses to create the built-in fallback without a chosen location. Writing configuration can create the config file's parent directory.

### Daily workflow

| Command | Purpose |
| --- | --- |
| `node "$CS" list` | List all library skills and metadata for agent selection |
| `node "$CS" status --project "<PROJECT>"` | Inspect library skills, project entries, and recorded links |
| `node "$CS" mount --project "<PROJECT>" --skills "<id>[,<id>]"` | Mount selected skills; comma lists are trimmed and deduplicated |

### Maintenance

| Command | Purpose |
| --- | --- |
| `node "$CS" unmount --project "<PROJECT>" --skills "<id>[,<id>]"` | Remove selected links |
| `node "$CS" unmount --project "<PROJECT>" --all` | Remove managed links and eligible legacy links |
| `node "$CS" mount --project "<PROJECT>" --skills "<id>" --relink` | Repair managed links after library relocation |
| `node "$CS" mount --project "<PROJECT>" --all` | Explicitly mount the entire library; not a daily default |
| `node "$CS" --help` / `node "$CS" mount --help` | Grouped help / command help |

`--all` and `--skills` are mutually exclusive. `--relink` is mount-only. Duplicate, unknown, and missing-value options fail.

## Configuration

| Priority | Source | Behavior |
| --- | --- | --- |
| 1 | `--library <LIB>` | Current invocation; `init` / `config` persist the choice |
| 2 | `CODE_SKILLS_LIBRARY` | Inherited process environment |
| 3 | `library` in `~/.code-skills/config.json` | Persistent setting |
| 4 | `~/.agents/code-skills-library` | Built-in fallback, readable if present; not created by bare `init` |

Override the config location with `CODE_SKILLS_CONFIG`. Relative library paths are accepted and saved as absolute paths; prefer explicit absolute paths. Invalid config JSON fails instead of silently selecting a fallback.

```json
{
  "library": "D:/skills/code-library"
}
```

Configuration writes preserve unrelated fields and replace the file through a temporary file. Environment values still override saved configuration; verify the effective result with `path`.

## Output contract

Normal commands emit one JSON object on stdout. Warnings and `Error:` messages go to stderr. Exit codes are `0` for success and `1` for failure. Help is plain text; invoking without arguments prints help and exits `1`.

Example `list` output:

```json
{
  "library": "D:/skills/code-library",
  "exists": true,
  "source": "config",
  "config": "C:/Users/me/.code-skills/config.json",
  "skills": [
    {
      "id": "example-api",
      "name": "api-development",
      "description": "Use when implementing APIs in the example framework.",
      "path": "D:/skills/code-library/example-api"
    }
  ]
}
```

`id` is the directory name used by mount and unmount. `name` is the frontmatter name, falling back to the directory name. The lightweight metadata reader supports plain, quoted, folded `>` and literal `|` scalars, not general YAML. Skills without frontmatter are listed with an empty description.

- `path`: library, `exists`, `source`, config file path, absolute `recommendedLibrary`, and `needsInit`. The latter is true when no location has been selected or the selected location is not an existing directory; it is not a historical init marker.
- `config`: library and config path; reads also include `source`.
- `init`: saved library, config path, and `exists`.
- `mount` / `unmount`: resolved `project` and the operated id array.
- `status`: `project` and a `skills` array with `name`, `state`, and optional `target`; here `name` is the directory id.

## Agent workflow

1. Confirm the project and inspect stack manifests, README, and relevant directories.
2. Evaluate the entire library from `list`. Project setup includes all compatible frontend skills covering framework development, visual design, and UI/accessibility review. Individual tasks select what they need. There is no hard one-to-three limit and no default mount-all.
3. Run `status`, mount what is needed, and honor project confirmation requirements.
4. Verify `mounted`, then read each selected `SKILL.md` before applying its guidance.
5. After verified first setup, requested reconfiguration, or stack changes, call an available question component. Include every library id/name, state, and recommendation reason in the question. Offer the AI-recommended additions, custom changes, and keeping the current set. Apply explicit submitted changes and verify again.

Link creation, instruction loading, and Codex catalog refresh are separate states to verify. General Q&A, documents, and image work do not require mounting code skills.

### Question components and selection examples

Use a question tool permitted in the current mode: `request_user_input`, `ask_user_question`, or an equivalent. If a synchronous tool is unavailable, prefer `request_user_input_async`. Follow actual schemas and mode restrictions. If no legal component works, explain the limitation and fall back to the same choices in text.

Use this protocol for first-use path confirmation too. Tabs, Submit, keyboard navigation, multiple selection, and custom text fields are rendered by the host. Use a recommendation bundle when only single selection is supported, and reuse built-in free-text inputs instead of duplicating an Other option.

For a Vben frontend project, mount `vben`, `frontend-design`, and `web-design-guidelines` when available and compatible. Recommend general development skills as optional additions; do not include backend-specific skills without evidence. Mounting a review skill does not immediately initiate its review workflow.

Build questions from the actual full library. Example choices are adding `ponytail` (AI recommended), custom additions/removals, and keeping the current set. If the tool provides built-in custom input, use it. See [interaction.md](references/interaction.md) for the complete agent protocol.

## Status and relocation

| State | Meaning | Next step |
| --- | --- | --- |
| `absent` | No project entry; an old record may remain | Mount if needed, or unmount to clear the record |
| `mounted` | Owned link targets the current library skill | Read its instructions |
| `dangling` | Owned link target no longer exists | Restore source or mount with `--relink` against the new library |
| `relink-needed` | Owned target differs from the current library | Confirm location, then mount with `--relink` |
| `collision` | A real directory or file occupies the path | Inspect manually; the tool refuses overwrite |
| `unowned` | Link has no matching ownership record | Inspect origin; overwrite and removal are refused |
| `legacy` | Same-name `skills-vault` link with matching SKILL.md SHA-256 | Migrate with `mount --relink`, or unmount |

If the configured library directory is missing, `status` still runs: it warns and reports only the project entries, so dangling links stay visible before you pick a new location.

After moving library files, save the new path and repair each project:

```text
node "$CS" config --library "<NEW_LIB>"
node "$CS" path
node "$CS" status --project "<PROJECT>"
node "$CS" mount --project "<PROJECT>" --skills "<id>" --relink
node "$CS" status --project "<PROJECT>"
```

`--relink` does not force ownership of foreign links. Remount on another machine; absolute local links should not be committed or copied as portable assets.

## Adding skills and filesystem boundaries

- Inspect `path`, add `<LIB>/<id>/SKILL.md`, then verify with `list`. Discovery includes immediate real subdirectories, excluding linked directories.
- Ids match `[A-Za-z0-9][A-Za-z0-9._-]*`, cannot end with a dot, and cannot be Windows reserved names such as `CON`, `NUL`, or `COM1`. Prefer matching frontmatter names and ids.
- The tool does not download skills, install dependencies, start services, or change API configuration.
- Project resolution uses the nearest ancestor with a `.git` directory or worktree file; without Git, it uses the explicit directory and warns. Check the returned `project`.
- Ownership lives in `.agents/code-skills.json`. Git-local `info/exclude` receives `.agents/skills/` and `.agents/code-skills.json`; committed `.gitignore` is untouched. Already tracked files remain tracked.
- Batches preflight all selections, then persist each completed operation. Runtime filesystem failures can leave partial success; inspect `status` after recovery. Avoid concurrent mutations of one project's records.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `Library not found` | `list`/`mount` need the library; `status` still reports project links. Inspect `path`, then `init --library` |
| Saved path ignored | Check flag and `CODE_SKILLS_LIBRARY` overrides |
| `Invalid code-skills config` | Repair the reported JSON file; help remains available |
| Skill missing from `list` | Check immediate real directory, `SKILL.md`, and valid id |
| `Collision` / `unowned` | Inspect path and ownership; do not use relink as a force option |
| Mounted skill invisible | Verify status, refresh Codex, or start a new project session |
| `Cannot resolve Git exclude` | Check Git, repository integrity, and write permissions |

## Development and verification

```text
node --check "<BASE>/scripts/code-skills.mjs"
node --test "<BASE>/scripts/code-skills.test.mjs"
```

Tests use isolated system-temporary fixtures and clean them up. Coverage includes configuration, discovery, CLI behavior, link lifecycle, collisions, relocation, Git excludes, and worktrees. Platform-specific cases skip elsewhere; run on both Windows and Unix before a cross-platform release.

## Uninstall and licensing

Run `unmount --project "<PROJECT>" --all` for each project before removing the entry directory. Delete the user config and library separately only when no longer needed. **The library contains source files; removing the tool does not require deleting it.** Git-local exclude rules remain; remove the two rules manually if desired.

Third-party skills retain their own licenses. This directory has no tool LICENSE file; maintainers must confirm licensing and add it before public distribution. Third-party licenses do not establish the license of this tool.


