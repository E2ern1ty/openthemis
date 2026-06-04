部署说明（占位）

本项目分为三层，可独立部署：

- 分析执行层：Next.js 应用（`npm run dev` / `npm run build && npm start`）
- 采集层：独立进程（见 `collector/README.md`）
- 数据存储层：SQLite（运行时自动在 `data/` 下生成）

环境变量请参考 `.env.example` 与 `collector/.env.example`，
不要在代码或文档中写入真实的服务器地址、密钥或登录凭证。
