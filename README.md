# Campus Connect

Campus Connect 是一个以真实意图为入口、连接校园场景、活动、Skill 与真人协作的 Web 平台。

当前仓库处于第一阶段：项目基础骨架。产品与开发约束分别见
[`PROJECT_SPEC.md`](./PROJECT_SPEC.md) 和 [`AGENTS.md`](./AGENTS.md)。

## 本地运行

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在 [http://localhost:3000](http://localhost:3000)。

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 当前基础路由

- `/home`：登录后的统一入口
- `/map`：Campus Map 基础页
- `/connect`：AI 共创基础页
- `/messages`：消息与关系协作基础页
- `/profile/me`：个人主页基础页
- `/notifications`：站内通知基础页
- `/admin`：管理员模块基础页（后续接入真实权限）

这些页面目前只建立信息架构和视觉基线，不表示 Supabase、DeepSeek、地图渲染或实时聊天已经接通。
