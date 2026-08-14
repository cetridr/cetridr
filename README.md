# Cetridr 🐚

> **Rule the deep.** — 一个窗口，统率你所有的 DeepSeek Harness agent。

把多个 DSH profile（每个是独立 daemon）并排跑起来，顶部 header bar 的 tab 切换，
内容区用 iframe 嵌入各自的 DSH web UI。单用户、本机 loopback 定位。

## 安装

```bash
npm i -g @cetridr/cetridr   # 装完命令行是 `cetridr`（npx 用 `npx @cetridr/cetridr`）
```

零运行时依赖，Node >= 20。

## 快速开始

```bash
cetridr init                          # 生成 ~/.cetridr/config.json
cetridr add web --port 3080 --external # 嵌入已运行的 3080
cetridr add web2 --port 3081 --home web2  # spawn 到独立 DSH_HOME
cetridr start                         # 前台运行；打印带 token 的 URL（?t=…），用那个打开
cetridr start --daemon                 # 后台运行（cetridr stop 停止）
```

## 命令

| 命令 | 作用 |
| --- | --- |
| init | 生成默认配置文件 |
| start [--config <path>] [--daemon] | 运行门户（前台或后台） |
| stop | 停止后台运行的门户（pidfile） |
| list | 列出已配置的 profile |
| add <id> --port <n> [--label --emoji --home --external] | 添加 profile |
| rm <id> | 移除 profile |
| status | 查看运行中门户的状态 |
| logs <id> [--follow] | 查看（或跟踪）某 profile 日志 |

## 配置

配置在 ~/.cetridr/config.json（可用环境变量 CETRIDR_HOME 覆盖整个目录）：

```json
{
  "host": "127.0.0.1",
  "port": 4000,
  "dshBin": "dsh",
  "spawnAll": true,
  "profiles": [
    { "id": "web", "port": 3080, "external": true },
    { "id": "web2", "port": 3081, "home": "web2" }
  ]
}
```

- host / port：门户监听地址（默认 127.0.0.1:4000）。
- dshBin：dsh 可执行文件（默认 dsh）。
- spawnAll：启动时是否一次性拉起全部 profile（默认 true；false = 点 tab 才启动）。
- restart：子进程崩溃后自动重启（默认 true）；restartBackoffMs：首次重启退避毫秒（默认 1000，逐次翻倍、上限 30s）。
- 安全：所有 /api/* 需 x-cetridr-token（token 存在 ~/.cetridr/token，0600）；start 会打印带 ?t=<token> 的完整 URL。
- profiles[].port：该 profile 的固定端口；profiles[].external 为 true 时不 spawn、只嵌入已有 URL。
- profiles[].home：该 profile 的 DSH_HOME。相对路径相对于 ~/.cetridr/homes，~ 或绝对路径按原样。
  不设 home 时继承门户进程的 DSH_HOME（即共享状态）。
- profiles[].command：可选，完全替换默认命令 dsh --profile <id> --port <port>（{port}/{id} 会被替换）。

### 真隔离 vs 共享状态

DSH 用 DSH_HOME 这一个环境变量决定整个 home（profiles/sessions/storages/settings/credentials）。
要每个 tab 独立数据，给每个 profile 设独立的 home；要共享数据就不设。

### 注意力徽标（working/idle/blocked）

每个 DSH daemon 里装 [../dsh-cetridr-reporter](../dsh-cetridr-reporter) host 插件，它把
agent 生命周期上报回 cetridr 的 /api/report；cetridr 在 tab 上显示 working/idle/blocked，
blocked（待审批）且非活动 tab 会高亮。cetridr 派生子进程时已注入
CETRIDR_URL / CETRIDR_ID / CETRIDR_TOKEN，插件据此上报。

## 开发

```bash
npm install          # 安装 typescript + @types/node
npm run build        # tsc -> lib/ + 拷贝 cetridr.html
npm test             # node --test test/*.test.mjs
npm run typecheck
```

源码在 src/（TypeScript，ESM），构建产物在 lib/（已 gitignore）。

## 为什么用 iframe 可行

- DSH web 服务器不发 X-Frame-Options / Content-Security-Policy: frame-ancestors，允许被嵌入。
- DSH 的 /api 信任栅栏只看 Host 是否为 loopback（无 cookie/认证层），iframe src 直指 DSH 时同源、Host=127.0.0.1:<port> 自然通过。
- 每个 profile 用 --port 固定端口，门户健康检查轮询 http://127.0.0.1:<port>/。

## 架构

```
src/cli.ts        命令行入口（init/start/list/add/rm/status）
src/config.ts     配置 schema + 校验 + 读写 + home 解析
src/paths.ts      CETRIDR_HOME / 数据目录解析
src/supervisor.ts 进程监督：spawn/stop/restart + 健康检查 + 自动重启退避 + 日志
src/server.ts     HTTP：门户页 + /api/config + /api/status + /api/{start,stop,restart}/:id（token 门禁）
src/auth.ts       token 生成/持久化 + x-cetridr-token 校验
src/logger.ts     每 profile 的带时间戳日志文件
src/cetridr.html   header tab + iframe 切换的前端（零依赖）
```

## 路线图

- [x] M1 立骨：TS 工程化、CLI、配置/数据目录、schema 校验、单测
- [x] M2 变稳：daemon 化、自动重启退避、懒启动、日志聚合 + logs 命令、控制面 token（端口自动分配延后）
- [x] M3 变好用：UI 管理 profile（增删/改名/拖拽排序）、日志面板、working/idle/blocked 徽标（经 dsh-cetridr-reporter）
- [x] M4 分发：launchd/systemd unit 生成（`service` 命令）；npm publish 待账号

