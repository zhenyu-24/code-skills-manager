## 首次调用：先检查初始化

加载本技能后，先运行 `node "$CS" path`，此检查不依赖项目路径。默认推荐库为 `~/.agents/code-skills-library`，展示给用户时将 `~` 展开为当前用户的绝对路径；不随本技能的下载或安装目录改变。

- `needsInit: true`：在执行 `list`、项目选择或挂载前，主动询问用户库路径。即使默认目录已存在，只要尚无显式配置，也需要确认。使用 `recommendedLibrary` 推荐路径，例如：“code-skills 尚未完成初始化。推荐将技能库放在 `<推荐绝对路径>`，与全局技能根分开。使用此路径，还是指定其他位置？”
- 用户明确确认默认位置或给出其他路径后，执行 `init --library "<确认的路径>"`，再 `path` 验证。不因用户暂未回复而自动创建。用户在当前请求中已经明确初始化路径时，直接使用，不重复询问。
- `needsInit: false`：已选路径存在，直接继续，不要求用户重复执行 `init`。现有配置或环境变量提供的有效库兼容此流程。
- 配置路径已选但目录丢失时，优先展示该路径并询问恢复原位置还是改用新位置，同时给出默认位置作为备选。`path` 报错时先处理错误，不将损坏配置当作首次安装。
- 初始化后若 `list` 为空，说明库为空，提示添加技能；不重复询问初始化，也不自动下载技能。

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

## 配置与异常处理

- 路径优先级：`--library` → `CODE_SKILLS_LIBRARY` → `~/.code-skills/config.json` 的 `library` → `~/.agents/code-skills-library`。以 `path` 输出为准；用 `CODE_SKILLS_CONFIG` 可覆盖配置文件位置。
- `init` 需要参数、环境值或已保存路径；只有兜底值时拒绝创建。`config --library` 只保存路径，需要时再 `init`。
- 库不存在时先 `path`，再按选定位置 `init`。新增技能放到 `<LIB>/<id>/SKILL.md`，不放进全局技能根。id 匹配 `[A-Za-z0-9][A-Za-z0-9._-]*`，不能以点结尾或使用 Windows 保留名。
- `collision` / `unowned`：检查归属，不覆盖；`dangling` / `relink-needed`：确认新库后对已有链接使用 `--relink`。完整状态见 [中文手册](operations.md#状态与迁移)。
