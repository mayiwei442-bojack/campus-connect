# Supabase 与 Vercel 接入清单

本文只记录需要项目所有者授权或在控制台完成的步骤。不要把 Supabase secret key、service-role key、数据库密码或个人访问令牌提交到仓库。

## 1. 创建 Supabase 项目

1. 在 Supabase Dashboard 创建一个项目。
2. 在项目的 Connect/API 信息中复制：
   - Project URL
   - Publishable key（`sb_publishable_...`）
3. 在仓库根目录创建 `.env.local`：

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

这三个变量允许进入浏览器；不要加入 secret key 或 service-role key。

## 2. 应用数据库迁移

在自己的终端中完成 Supabase CLI 登录。访问令牌只输入 CLI，不要粘贴到聊天或提交到 Git。

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

首个迁移会创建 `public.profiles`、用户注册触发器和 RLS 策略。不要直接在 Dashboard 修改同一结构，否则迁移历史可能漂移。

如果本机没有 IPv6，Supabase CLI 应使用 Dashboard 的 Session Pooler（IPv4）。重新 `link` 时通过
`SUPABASE_DB_PASSWORD` 临时环境变量提供数据库密码；不要把密码写入仓库、命令历史或聊天。项目的
Session Pooler 连接信息可在 Dashboard 顶部的 Connect 对话框查看。

### CLI 数据库连接不可用时

如果 Dashboard 能通过 HTTPS 打开，但 CLI 的 PostgreSQL 连接持续出现 DNS 错误或
`Connection terminated unexpectedly`，可以保留正常的代理设置，临时通过 Dashboard 的
SQL Editor 应用迁移：

```powershell
Get-Content ".\supabase\migrations\20260812150000_create_profiles.sql" -Raw -Encoding utf8 | Set-Clipboard
```

在项目的 SQL Editor 新建查询，粘贴并运行剪贴板内容。该迁移支持安全重跑，所以网页请求中断后可以
再次执行。SQL Editor 不会写入 Supabase CLI 的迁移历史；等 CLI 数据库连接恢复后，再运行
`pnpm exec supabase db push --dry-run` 和 `pnpm exec supabase db push`，CLI 会安全重放该迁移并记录历史。
不要手动修改 `supabase_migrations` 表。

## 3. 配置邮箱确认

在 Authentication 的 URL Configuration 中设置：

- 本地开发 Site URL：`http://localhost:3000`
- Redirect URL：`http://localhost:3000/auth/confirm`
- Vercel 部署后，再加入：`https://<your-vercel-domain>/auth/confirm`

在 Confirm signup 邮件模板中，把确认链接改为：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">确认邮箱</a>
```

本地 Supabase 已通过 `supabase/templates/confirmation.html` 使用同一流程。

Supabase 的默认试用邮件服务只适合开发验证；公开发布前应配置自有 SMTP，并在邮件服务中关闭链接跟踪。

## 4. 本地 Supabase（可选）

需要先安装并启动 Docker Desktop，然后运行：

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:lint
```

本地 Studio 默认地址是 `http://127.0.0.1:54323`，测试邮件默认在 `http://127.0.0.1:54324` 查看。

## 5. Vercel 部署

1. 在 Vercel 导入 GitHub 仓库。
2. Framework Preset 选择 Next.js，包管理器会从 `pnpm-lock.yaml` 自动识别。
3. 配置以下环境变量：
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. `NEXT_PUBLIC_SITE_URL` 使用实际 Vercel 域名，例如 `https://campus-connect.vercel.app`。
5. 部署完成后，把实际 `/auth/confirm` 地址加入 Supabase Redirect URLs，并更新 Supabase Site URL。
6. 重新部署，再验证注册、邮箱确认、登录、受保护路由与退出登录。

当前认证流程不需要 Supabase secret key 或 service-role key。以后确需服务端管理操作时，只能把服务端密钥放入 Vercel 的非 `NEXT_PUBLIC_` 环境变量，并单独审查权限边界。
