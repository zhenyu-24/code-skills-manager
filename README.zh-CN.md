# code-skills

**面向 Codex 的项目级代码技能管理器：一个全局入口，按项目选择技能。**

把代码技能保存在全局技能根之外，通过本机目录链接挂载到需要的项目。使用 Node.js 内置模块，无需 npm 安装、联网或运行后台服务。

[English](README.md) · **简体中文** · [智能体指引](SKILL.md)

## 为什么使用

技能名称和描述会进入智能体的发现清单，完整指引则按需读取。把整个库放进全局技能根，会让无关项目也看到这些技能。code-skills 将库与入口分开，用项目链接控制技能可见范围。具体发现范围与刷新时机取决于 Codex 版本。

- **按任务选择**：`list` 返回元数据，结合项目证据选择技能。
- **单份源文件**：项目链接指向库，源文件修改通过链接反映到项目。
- **状态可核对**：检查挂载、失效、迁移和冲突。
- **保护已有文件**：拒绝覆盖实体目录和外部链接，卸载保留源文件。
- **跨平台**：Windows Junction，macOS/Linux 目录符号链接。

## 环境要求

- Node.js **22+**。
- Git 项目需要可执行的 Git，用于定位仓库本地 exclude 文件；支持 worktree。
- Codex 支持发现项目 `.agents/skills/`；CLI 不负责刷新 Codex 技能清单。

## 首次调用与推荐路径

推荐技能库为 `~/.agents/code-skills-library`，Windows 通常对应 `C:/Users/<用户名>/.agents/code-skills-library`。该默认位置固定在用户目录下，不随工具下载位置变化，且与全局 `skills/` 目录分开。

下载安装后，只需调用 code-skills。Agent 会先运行只读的 `path` 检查：

1. `needsInit: true` 时，主动询问初始化路径，并将 `recommendedLibrary` 的绝对路径作为推荐选项。默认目录已存在但未配置时也会询问。
2. 用户确认默认路径或指定其他位置后，Agent 执行 `init --library` 并核对结果，然后继续项目技能选择。没有回复时不创建。
3. 已有有效配置或环境路径时直接复用，不重复询问。已选目录丢失时先询问恢复原位置还是换位置。
4. 初始化后的空库只提示添加技能，不再次触发初始化。用户已明确提供初始化路径时不重复询问。

这由 Agent 遵循 SKILL.md 实现，CLI 不弹交互提示。也可以按下面的命令手动初始化。

## 安装与快速开始

将本目录安装到 `~/.agents/skills/code-skills`。已有安装时更新原文件，避免复制成 `code-skills/code-skills`。首次复制示例，在待安装目录的父目录执行：

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

将技能目录放入库中，每个目录包含 `SKILL.md`，然后：

```text
node "$CS" list
node "$CS" status --project "<PROJECT>"
node "$CS" mount --project "<PROJECT>" --skills "<id>"
node "$CS" status --project "<PROJECT>"
```

`CS` 是脚本绝对路径，`<PROJECT>` 是已存在的项目绝对路径，`<id>` 取自 `list.skills[].id`。替换占位符后执行。确认状态为 `mounted`，再刷新 Codex 清单或新开项目会话；完整指引仍需按任务加载。

## 按需加载参考文档

`SKILL.md` 保持精简；仅在操作命中条件时读取对应文档，不默认加载整个目录。

| Document | Contents |
| --- | --- |
| [references/setup.md](references/setup.md) | 初始化与配置 |
| [references/commands.md](references/commands.md) | 命令与目录 |
| [references/selection.md](references/selection.md) | 技能选择 |
| [references/interaction.md](references/interaction.md) | 交互提问 |
| [references/operations.md](references/operations.md) | 状态、迁移与排错 |
| [references/output.md](references/output.md) | JSON 输出约定 |

## 目录结构

```text
~/.agents/
├── skills/                             # 全局技能根
│   └── code-skills/                     # 工具安装目录（<BASE>）
│       ├── SKILL.md                     # 智能体入口与操作约束
│       ├── README.md                    # 英文使用手册
│       ├── README.zh-CN.md               # 中文使用手册
│       ├── references/                  # 按需加载文档，见上方索引
│       └── scripts/
│           ├── code-skills.mjs          # CLI 与可导入函数
│           └── code-skills.test.mjs     # Node.js 内置测试
└── code-skills-library/                 # 默认库路径，可改为其他位置
    ├── example-api/                     # 目录名即挂载 id
    │   ├── SKILL.md                     # 技能定义
    │   └── scripts/                     # 技能辅助资源（可选）
    └── example-ui/
        └── SKILL.md

~/.code-skills/
└── config.json                         # 用户配置，记录 library

<PROJECT>/
├── .agents/
│   ├── skills/
│   │   └── example-api/                # 指向 <LIB>/example-api 的目录链接
│   └── code-skills.json                 # 链接归属记录，非技能内容
└── .git/
    └── info/exclude                     # 本地排除规则；worktree 由 Git 定位
```

`example-api`、`example-ui` 是结构示例，并非内置技能。库应放在所有全局技能根之外；内容不会自动复制到项目，也不自动安装依赖。

## 命令参考

以下命令用于设置好 `CS` 的 PowerShell、Bash 或 Zsh。`[]` 表示可选项，不应原样输入。所有命令支持 `--library "<LIB>"`。

### 配置（一次性）

| 命令 | 作用 |
| --- | --- |
| `node "$CS" init --library "<LIB>"` | 创建库目录并保存配置 |
| `node "$CS" config [--library "<LIB>"]` | 无参数查看配置；带参数只保存路径，不创建库目录 |
| `node "$CS" path` | 查看当前有效库路径、存在性、来源和配置文件位置 |

`init` 也能使用环境或已保存路径；只有兜底值时拒绝创建。`config` 写入的是用户配置文件，必要时会创建配置文件的父目录。

### 日常

| 命令 | 作用 |
| --- | --- |
| `node "$CS" list` | 列出库中全部技能及元数据，智能体据此选择 |
| `node "$CS" status --project "<PROJECT>"` | 查看库内技能、项目条目和记录链接的状态 |
| `node "$CS" mount --project "<PROJECT>" --skills "<id>[,<id>]"` | 挂载选定技能，支持逗号分隔、空格修剪和去重 |

### 维护

| 命令 | 作用 |
| --- | --- |
| `node "$CS" unmount --project "<PROJECT>" --skills "<id>[,<id>]"` | 卸载指定链接 |
| `node "$CS" unmount --project "<PROJECT>" --all` | 卸载全部受管链接及符合迁移条件的旧版链接 |
| `node "$CS" mount --project "<PROJECT>" --skills "<id>" --relink` | 库迁移后重建受管链接 |
| `node "$CS" mount --project "<PROJECT>" --all` | 显式挂载整个库，不建议作为日常默认 |
| `node "$CS" --help` / `node "$CS" mount --help` | 分组帮助 / 子命令帮助 |

`--all` 与 `--skills` 互斥；`--relink` 只用于 `mount`。重复、未知或缺值的参数会报错。

## 配置规则

| 优先级 | 来源 | 行为 |
| --- | --- | --- |
| 1 | `--library <LIB>` | 本次调用覆盖；`init` / `config` 保存选择 |
| 2 | `CODE_SKILLS_LIBRARY` | 当前进程继承的环境值 |
| 3 | `~/.code-skills/config.json` 的 `library` | 持久配置 |
| 4 | `~/.agents/code-skills-library` | 内置兜底，已存在时可读取，不由裸 `init` 创建 |

用 `CODE_SKILLS_CONFIG` 覆盖配置文件位置。库参数可用相对路径，保存时转为绝对路径；建议使用绝对路径。配置 JSON 损坏会报错，不静默退回默认库。

```json
{
  "library": "D:/skills/code-library"
}
```

`config --library` 保留其他字段，以临时文件替换方式写入。环境变量仍优先于保存配置，修改后用 `path` 核对。

## 输出约定

正常命令在 stdout 输出一个 JSON 对象，警告及 `Error:` 写入 stderr。退出码 `0` 为成功，`1` 为失败；帮助为纯文本，无参数调用显示帮助并退出 `1`。

`list` 示例：

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

`id` 是目录名，用于挂载和卸载；`name` 来自 frontmatter，缺失时回退到目录名。描述支持普通、引号、折叠 `>` 和字面量 `|` 标量；这是轻量解析器，不是完整 YAML 实现。无 frontmatter 仍列出，但描述为空。

- `path`：库路径、`exists`、`source`、配置文件路径、推荐绝对路径 `recommendedLibrary`、是否需要确认初始化的 `needsInit`。未选择路径或所选路径不是现存目录时，`needsInit` 为 true；它不依赖历史 init 标记。
- `config`：库与配置文件路径，读取时包含 `source`。
- `init`：保存的库路径、配置位置、`exists`。
- `mount` / `unmount`：实际 `project` 与操作的 id 数组。
- `status`：`project` 与 `skills` 数组，元素含 `name`、`state`、可选 `target`；此处 `name` 使用目录 id。

## 智能体使用流程

1. 确认目标项目，读取技术栈清单、README 和相关目录。
2. 运行 `list` 并逐项评估全库。项目初始化覆盖所有适配且不冲突的前端技能，包括框架开发、界面设计和 UI/可访问性检查；单次任务按当前需要选择。不设 1–3 个硬上限，也不默认挂载整个库。
3. 运行 `status`，仅对需要的技能执行 `mount`；遵守项目确认要求。
4. 再检查 `mounted`，读取所选技能的 `SKILL.md` 后开展任务。
5. 首次项目初始化、重新配置或技术栈变化时，验证挂载后必须调用可用交互组件：问题正文列全库技能名、状态和推荐理由；选项为增加 AI 推荐组合、自定义增删、保持当前组合。工具内置自由输入时复用该入口。提交后执行明确的增删并再次验证。

链接创建、指引读取和 Codex 清单刷新分别核实。纯问答、文档和图片任务无需挂载。

### 交互组件与选择示例

优先使用当前模式允许的 `request_user_input`、`ask_user_question` 或等价组件；同步工具不可用时使用 `request_user_input_async`。必须遵守工具模式和参数限制，不通过提示词强制切换模式或虚构字段。全部组件不可用时说明限制并降级文字提问。

初始化路径也使用此协议：推荐默认绝对路径，提供自定义输入，等用户确认后初始化。标签页、Submit、键盘导航和多选能力由宿主提供；仅支持单选时将推荐增补作为组合选项。

例如 Vben 前端项目，当前库存在相应技能时，默认挂载 `vben`、`frontend-design`、`web-design-guidelines`。通用开发技能可作为增补推荐；后端专用技能不自动加入。挂载多个技能不等于立即执行所有技能的流程。

调整问题必须动态列出全库的 id/名称、状态与推荐理由，而非固定复制示例名单。示例选项为“增加 ponytail（AI 推荐）”“自定义增删”“保持当前组合”；内置自由输入时不重复增加自定义选项。原生工具的字段示例及完整规则以 [interaction.md](references/interaction.md) 为准。

## 状态与迁移

| 状态 | 含义 | 建议操作 |
| --- | --- | --- |
| `absent` | 无对应条目，可能仍有旧记录 | 按需 `mount` 或 `unmount` 清理记录 |
| `mounted` | 受管链接指向当前库的对应技能 | 读取技能指引 |
| `dangling` | 受管链接目标已不存在 | 恢复源目录或确认新库后 `mount --relink` |
| `relink-needed` | 受管链接目标与当前库不一致 | 确认路径后 `mount --relink` |
| `collision` | 同名实体目录或文件 | 检查冲突，工具拒绝覆盖 |
| `unowned` | 链接无归属记录或与记录不匹配 | 检查来源，拒绝覆盖和删除 |
| `legacy` | 旧 `skills-vault` 同名链接且 `SKILL.md` SHA-256 一致 | `mount --relink` 迁移或 `unmount` |

配置的库目录不存在时，`status` 仍会运行：它会给出警告并只报告项目内的条目，方便在选定新位置前看到 `dangling` 链接。

移动库文件后，保存新路径并逐项目修复：

```text
node "$CS" config --library "<NEW_LIB>"
node "$CS" path
node "$CS" status --project "<PROJECT>"
node "$CS" mount --project "<PROJECT>" --skills "<id>" --relink
node "$CS" status --project "<PROJECT>"
```

`--relink` 不强制接管外部链接。换机器后重新挂载；本机绝对路径链接不适合提交或跨机器直接复制。

## 新增技能与文件边界

- `path` 确认位置，放入 `<LIB>/<id>/SKILL.md`，再 `list` 验证。只发现直接实体子目录中的技能，库内链接目录不参与 `list`。
- id 匹配 `[A-Za-z0-9][A-Za-z0-9._-]*`，不能以点结尾或使用 `CON`、`NUL`、`COM1` 等 Windows 保留名。建议 frontmatter 的 `name` 与 id 一致。
- 不自动下载技能、安装依赖、启动服务或修改 API 配置。
- 项目根取最近 `.git` 目录或 worktree 文件；无 Git 使用指定目录并警告，核对返回的 `project`。
- `.agents/code-skills.json` 记录归属；Git 本地 `info/exclude` 添加 `.agents/skills/` 和 `.agents/code-skills.json`，不修改 `.gitignore`，也不会取消已跟踪的文件。
- 批量操作先检查所有目标，再逐项执行并保存记录；运行期文件系统错误可能留下部分成功结果，修复后用 `status` 核对。避免并发修改同一项目的记录。

## 排错

| 现象 | 处理 |
| --- | --- |
| `Library not found` | `list`/`mount` 需要库存在；`status` 仍会报告项目链接。先用 `path` 核对来源，再 `init --library` 初始化选定位置 |
| 保存路径未生效 | 检查参数和 `CODE_SKILLS_LIBRARY` 是否覆盖配置 |
| `Invalid code-skills config` | 修复报错文件的 JSON；帮助仍可使用 |
| 技能不在 `list` 中 | 检查直接实体子目录、`SKILL.md` 和有效名称 |
| `Collision` / `unowned` | 检查实际路径及归属，不用 `--relink` 强行接管 |
| 挂载成功但不可见 | `status` 验证后刷新 Codex 或新开项目会话 |
| `Cannot resolve Git exclude` | 检查 Git、仓库完整性及写权限 |

## 开发与验证

```text
node --check "<BASE>/scripts/code-skills.mjs"
node --test "<BASE>/scripts/code-skills.test.mjs"
```

测试使用系统临时目录，覆盖配置、发现、CLI、链接生命周期、冲突、迁移、Git exclude 和 worktree，并清理夹具。平台专用用例在其他平台跳过；跨平台发布前分别在 Windows 与 Unix 执行。

## 卸载与许可

先逐项目执行 `unmount --project "<PROJECT>" --all`，再删除入口目录。确认不需要后单独删除用户配置和技能库；**库包含技能源文件，删除入口不要求删除库**。工具保留 Git 本地 exclude 规则，必要时手动删除上述两条规则。

第三方技能保留各自许可。本目录未附工具本身的 LICENSE；对外发布前由维护者确认授权并补齐，第三方许可不代表本工具许可。


