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

## 操作边界

- 项目根向上寻找最近的 `.git` 目录或 worktree 文件；非 Git 项目回退到指定目录并警告，核对输出的 `project`。
- Windows 使用 Junction，macOS/Linux 使用目录符号链接。记录位于 `.agents/code-skills.json`；Git 项目更新本地 `info/exclude`，不修改 `.gitignore`。
- 拒绝覆盖实体目录、外部链接或被重定向的控制路径。卸载保留技能源文件；旧版 `skills-vault` 链接仅在同名且 `SKILL.md` 哈希一致时允许迁移。
- 不自动下载技能、安装技能依赖、启动服务或修改 API 配置。第三方技能按各自许可使用。安装与完整参考见 [README.zh-CN.md](../README.zh-CN.md)。
