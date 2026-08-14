# Changelog

## 0.2.0 (unreleased)

### M1 立骨
- TypeScript 工程化：tsc 构建 + 类型声明 + node:test 单测。
- CLI：init / start / list / add / rm / status。
- 配置/数据目录迁到 ~/.cetridr（CETRIDR_HOME 可覆盖）。
- 配置 schema 校验。

### M2 变稳
- 控制面 token（x-cetridr-token 门禁 /api/*，token 存 ~/.cetridr/token 0600）。
- 每 profile 日志文件 + logs <id> [--follow]。
- 崩溃自动重启（指数退避，restartBackoffMs）。
- 懒启动（spawnAll: false）。
- start --daemon + stop（pidfile）。

### M3 变好用
- UI 管理 profile：添加/删除/改名/拖拽排序（动态生效，持久化到 config.json）。
- 日志查看面板。
- working/idle/blocked 注意力徽标（经 dsh-cetridr-reporter host 插件上报 /api/report）。

### M4 分发
- service 命令：生成 launchd（macOS）/ systemd（Linux）自启动 unit。
- npm 发布待办（需 npm 账号 + 网络）。
