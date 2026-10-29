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
│       ├── references/              # 按需加载的操作文档
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
