# dsh-whale-rider

DSH host 插件：把 agent 生命周期上报回 [cetridr](../..)，让它能在
header tab 上显示 working / idle / blocked 徽标（以及「需要你注意」高亮）。

与 dsh-system-notify 同构：纯 Node、单面 host 插件，观察 host 事件，不抢占决策。

## 状态映射

| 上报 | DSH 信号（host 事件） |
| --- | --- |
| working | agent/status 任一 session running |
| idle | agent/status 全部 session idle |
| blocked | approval/request（waterfall，await next() 不抢占） |

## 安装

1. 装进 profile（发布后）：`dsh plugin --profile <name> add dsh-whale-rider`；
   本地源码装：`dsh plugin --profile <name> add ./packages/whale-rider`
2. 在 profile 的 cordis.patch.yml 加一行：

```yaml
- insert:
    - id: whale-rider
      name: 'dsh-whale-rider'
```

## 激活条件（守卫）

只在 cetridr 派生子进程注入这些环境变量时生效，否则 no-op：

- CETRIDR_URL —— cetridr 的 URL（http://127.0.0.1:<port>）
- CETRIDR_ID —— 本 profile 的 id
- CETRIDR_TOKEN —— cetridr 的 token（作为 x-cetridr-token 带上）

上报目标：POST CETRIDR_URL/api/report，body = { id, state, detail }。

## 构建

```bash
npm install     # cordis + typescript + tsdown + @types/node
npm run build   # tsc（声明 -> lib/types/）+ tsdown（打包 -> lib/index.js）
npm run typecheck
```
