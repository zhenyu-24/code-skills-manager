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
