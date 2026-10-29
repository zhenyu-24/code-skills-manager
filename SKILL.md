---
name: code-skills
description: 项目级代码技能管理器。用于编程、修复、重构、架构设计、UI 实现或代码审查前发现并选择项目所需技能，以及配置技能库、查询挂载状态、挂载或卸载技能。支持 Windows、macOS、Linux。
---

# code-skills

将代码技能保存在全局技能根之外，按任务链接到项目的 `.agents/skills/`。本技能负责发现、选择与挂载；具体开发指引来自选中的技能。

## 入口与目录

`<BASE>` 是本文件所在目录；`<LIB>` 是技能库目录；`<PROJECT>` 是已存在的项目绝对路径。将脚本绝对路径赋给 `CS`：

```powershell
# PowerShell；安装位置不同时替换路径
$CS = "$HOME/.agents/skills/code-skills/scripts/code-skills.mjs"
```

```bash
# Bash / Zsh
CS="$HOME/.agents/skills/code-skills/scripts/code-skills.mjs"
```

```text
~/.agents/
├── skills/                         # 全局技能根
│   └── code-skills/                 # 管理入口（<BASE>）
│       ├── SKILL.md                 # 智能体操作指引
│       ├── README.md                # 英文使用手册
│       ├── README.zh-CN.md           # 中文使用手册
│       └── scripts/
│           ├── code-skills.mjs      # 零依赖 CLI（Node.js 22+）
│           └── code-skills.test.mjs # 隔离回归测试
└── code-skills-library/             # 默认库位置，可配置到其他目录
    └── <skill-id>/
        └── SKILL.md                # 技能源文件

<PROJECT>/
└── .agents/
    ├── skills/
    │   └── <skill-id>/              # 指向库中目录的 Junction / 符号链接
    └── code-skills.json             # 本工具的链接归属记录
```

## 首次调用：先检查初始化

加载本技能后，先运行 `node "$CS" path`，此检查不依赖项目路径。默认推荐库为 `~/.agents/code-skills-library`，展示给用户时将 `~` 展开为当前用户的绝对路径；不随本技能的下载或安装目录改变。

- `needsInit: true`：在执行 `list`、项目选择或挂载前，主动询问用户库路径。即使默认目录已存在，只要尚无显式配置，也需要确认。使用 `recommendedLibrary` 推荐路径，例如：“code-skills 尚未完成初始化。推荐将技能库放在 `<推荐绝对路径>`，与全局技能根分开。使用此路径，还是指定其他位置？”
- 用户明确确认默认位置或给出其他路径后，执行 `init --library "<确认的路径>"`，再 `path` 验证。不因用户暂未回复而自动创建。用户在当前请求中已经明确初始化路径时，直接使用，不重复询问。
- `needsInit: false`：已选路径存在，直接继续，不要求用户重复执行 `init`。现有配置或环境变量提供的有效库兼容此流程。
- 配置路径已选但目录丢失时，优先展示该路径并询问恢复原位置还是改用新位置，同时给出默认位置作为备选。`path` 报错时先处理错误，不将损坏配置当作首次安装。
- 初始化后若 `list` 为空，说明库为空，提示添加技能；不重复询问初始化，也不自动下载技能。

## 命令速查

### 配置（一次性）

| 命令 | 作用 |
| --- | --- |
| `node "$CS" init --library "<LIB>"` | 创建库目录并保存配置 |
| `node "$CS" config [--library "<LIB>"]` | 查看或修改配置，不创建库目录 |
| `node "$CS" path` | 查看当前库路径、是否存在及来源 |

### 日常

| 命令 | 作用 |
| --- | --- |
| `node "$CS" list` | 列出库内技能及元数据，供智能体选择 |
| `node "$CS" status --project "<PROJECT>"` | 查看项目中的挂载状态 |
| `node "$CS" mount --project "<PROJECT>" --skills "<id>[,<id>]"` | 挂载选定技能 |

### 维护

| 命令 | 作用 |
| --- | --- |
| `node "$CS" unmount --project "<PROJECT>" --skills "<id>[,<id>]"` | 卸载指定技能链接 |
| `node "$CS" unmount --project "<PROJECT>" --all` | 卸载全部受管链接 |
| `node "$CS" mount --project "<PROJECT>" --skills "<id>" --relink` | 库迁移后修复已有链接 |
| `node "$CS" <command> --help` | 查看子命令帮助 |

所有命令接受 `--library`。成功输出为 JSON；警告及错误写入 stderr；退出码 `0` 表示成功，`1` 表示失败。帮助为纯文本。方括号表示可选项，实际执行时替换占位符。

## 操作流程

1. **确认项目。** 根据用户目标和工作目录确定项目；不明确时询问路径，不把临时目录当作项目。纯问答、软件安装、文档和图片任务无需挂载。
2. **发现技能。** 执行 `list`，结合项目清单、README 和目录结构，将 `description` 与本次任务匹配。通常选择 1–3 个；无匹配项就说明情况，不凭名字推断，不默认 `--all`。
3. **核对并挂载。** 先 `status`，已为 `mounted` 的无需重复操作。使用 `list.skills[].id` 作为 `--skills` 的值；`name` 是 frontmatter 名称，可能与目录名不同。遵守项目已有的确认要求。
4. **验证与加载。** 再执行 `status`，确认目标项目及技能状态。读取选中技能的 `path/SKILL.md` 后才能声称已加载指引。目录挂载不代表 Codex 清单已刷新；未刷新时建议新开目标项目会话。
5. **报告结果。** 说明挂载项、选择证据及验证结果。首次初始化或技术栈变化时一次性给出增删建议；用户未要求调整则保持默认，不阻塞已授权工作或反复询问。

## 配置与异常处理

- 路径优先级：`--library` → `CODE_SKILLS_LIBRARY` → `~/.code-skills/config.json` 的 `library` → `~/.agents/code-skills-library`。以 `path` 输出为准；用 `CODE_SKILLS_CONFIG` 可覆盖配置文件位置。
- `init` 需要参数、环境值或已保存路径；只有兜底值时拒绝创建。`config --library` 只保存路径，需要时再 `init`。
- 库不存在时先 `path`，再按选定位置 `init`。新增技能放到 `<LIB>/<id>/SKILL.md`，不放进全局技能根。id 匹配 `[A-Za-z0-9][A-Za-z0-9._-]*`，不能以点结尾或使用 Windows 保留名。
- `collision` / `unowned`：检查归属，不覆盖；`dangling` / `relink-needed`：确认新库后对已有链接使用 `--relink`。完整状态见 [中文手册](README.zh-CN.md#状态与迁移)。

## 操作边界

- 项目根向上寻找最近的 `.git` 目录或 worktree 文件；非 Git 项目回退到指定目录并警告，核对输出的 `project`。
- Windows 使用 Junction，macOS/Linux 使用目录符号链接。记录位于 `.agents/code-skills.json`；Git 项目更新本地 `info/exclude`，不修改 `.gitignore`。
- 拒绝覆盖实体目录、外部链接或被重定向的控制路径。卸载保留技能源文件；旧版 `skills-vault` 链接仅在同名且 `SKILL.md` 哈希一致时允许迁移。
- 不自动下载技能、安装技能依赖、启动服务或修改 API 配置。第三方技能按各自许可使用。安装与完整参考见 [README.zh-CN.md](README.zh-CN.md)。
