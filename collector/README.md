# OpenThemis 采集层（Collector）

独立运行的**只读**采集网关。所有渠道统一通过 [OpenCLI](https://github.com/jackwener/OpenCLI) 接入，
从主应用（分析执行层）中剥离，可单独部署、单独替换。零 npm 依赖（仅需系统已安装 `opencli`）。

## 设计要点：统一所有渠道

- **统一接入**：每个渠道就是一个 OpenCLI site，全部通过 `opencli <site> search <query>` 获取，
  输出再归一化成统一的 `FetchedItem`。新增渠道 = 在 `channels.mjs` 追加一条配置。
- **统一登录**：不再在应用内扫码。OpenCLI 复用用户本机 Chrome 中已登录的会话
  （需安装 OpenCLI 浏览器扩展）。未登录时 OpenCLI 返回退出码 `77`，网关转成
  HTTP 401 + `code: AUTH_REQUIRED`，前端引导用户去 Chrome 登录。

```
分析执行层 ──HTTP──▶ 采集层网关 ──spawn──▶ opencli <site> search ──▶ 用户已登录的 Chrome
```

## HTTP 契约

| 方法   | 路径                       | 说明                                        |
| ------ | -------------------------- | ------------------------------------------- |
| `GET`  | `/health`                  | 健康检查（含 opencli 可用性 + 版本）         |
| `GET`  | `/channels`                | 列出所有可用采集渠道                         |
| `GET`  | `/channels/:id/status`     | 探测某渠道登录态（复用 Chrome 会话）         |
| `POST` | `/search`                  | `{ channel, keyword, brand?, limit? }` 搜索 |

`/search` 与渠道未登录时返回 `401 { error, code: "AUTH_REQUIRED", loginUrl }`。

## 前置条件

1. 安装 OpenCLI：`npm install -g @jackwener/opencli`（需 Node ≥ 21）
2. 安装 OpenCLI Chrome 扩展，并在 Chrome 中登录目标平台（小红书 / 微博等）
3. `opencli doctor` 确认浏览器桥接已连接

## 启动

```bash
cd collector
npm start          # 默认监听 http://localhost:4001
```

## 配置

| 变量                | 默认值        | 说明                                |
| ------------------- | ------------- | ----------------------------------- |
| `COLLECTOR_PORT`    | `4001`        | 监听端口                            |
| `COLLECTOR_TOKEN`   | —             | 可选，开启 Bearer 鉴权（与分析层一致）|
| `OPENCLI_BIN`       | `opencli`     | opencli 可执行文件路径               |
| `OPENCLI_TIMEOUT_MS`| `120000`      | 单次 search 超时                     |

## 已内置渠道

| id | 名称 | OpenCLI 命令 | 登录 |
| -- | ---- | ------------ | ---- |
| `xiaohongshu` | 小红书 | `xiaohongshu search` | 需 Chrome 登录 |
| `weibo` | 微博 | `weibo search` | 需 Chrome 登录 |
| `douyin` | 抖音 | `douyin hashtag search`（话题） | 需创作者后台登录 |
| `twitter` | X (Twitter) | `twitter search` | 需 Chrome 登录 x.com |
| `reddit` | Reddit | `reddit search` | 通常免登录 |

## 新增渠道

编辑 `channels.mjs`，追加一条。多数渠道默认走 `opencli <site> search <query>`，
只需提供 `map(row)` 把输出列归一化为 `{ content, likes, date, url }`：

```js
{
  id: 'reddit',
  name: 'Reddit',
  site: 'reddit',
  loginUrl: 'https://www.reddit.com',
  map: (row) => ({
    content: [row.title, row.selftext].filter(Boolean).join(' '),
    likes: Number(row.score) || 0,
    date: row.created_utc,   // 支持 Unix 时间戳
    url: row.url,
  }),
}
```

若某渠道命令形态不同（例如抖音用 `hashtag search --keyword`），用 `buildArgs` 自定义：

```js
{
  id: 'douyin',
  name: '抖音',
  site: 'douyin',
  loginUrl: 'https://www.douyin.com',
  buildArgs: (keyword, limit) => ['douyin', 'hashtag', 'search', '--keyword', keyword, '--limit', String(limit), '-f', 'json'],
  map: (row) => ({ content: `#${row.name}`, likes: Number(row.view_count) || 0, date: '', url: '' }),
}
```

无需改动其它任何代码。
