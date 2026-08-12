# Campus Connect

Campus Connect 是一个以真实意图为入口、连接校园场景、活动、Skill 与真人协作的 Web 平台。

当前仓库已完成项目基础骨架，正在进入第二阶段：Supabase Auth 与 Profile 数据基础。产品与开发约束分别见
[`PROJECT_SPEC.md`](./PROJECT_SPEC.md) 和 [`AGENTS.md`](./AGENTS.md)。

## 本地运行

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

开发服务器默认运行在 [http://localhost:3000](http://localhost:3000)。

`.env.local` 需要填写 Supabase Project URL 与 publishable key。不要把 secret key 或
service-role key 放入浏览器环境变量。缺少配置时，应用会保留登录/注册预览，并锁定平台路由。

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Supabase 本地环境需要 Docker Desktop：

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:lint
```

## 当前基础路由

- `/home`：登录后的统一入口
- `/map`：Campus Map 基础页
- `/connect`：AI 共创基础页
- `/messages`：消息与关系协作基础页
- `/profile/me`：个人主页基础页
- `/notifications`：站内通知基础页
- `/admin`：管理员模块基础页（后续接入真实权限）

Supabase 项目创建、迁移和 Vercel 配置见
[`docs/SUPABASE_AND_VERCEL_SETUP.md`](./docs/SUPABASE_AND_VERCEL_SETUP.md)。DeepSeek、地图渲染与实时聊天仍将在后续板块接入。
