# CookingApp 手机端本地验证

这份说明用于在**不发布 Sites 新版本**的情况下，让手机直接打开电脑上运行的 Vite 网页并登录 DEV 环境。

## 1. 启动局域网开发网页

1. 电脑和手机连接同一个可信 Wi-Fi；不要在机场、商场等公共网络开放开发服务器。
2. 在 CookingApp 项目目录运行：

   ```bash
   npm run dev:mobile
   ```

3. Vite 会显示 `Network` 地址，例如 `http://192.168.1.23:5173/`。在手机浏览器输入这个完整地址。
4. 如果只显示端口，可在 Windows 运行 `ipconfig`，找到当前 Wi-Fi 的 IPv4 地址，再拼上 Vite 显示的端口。
5. Windows 防火墙弹窗只允许 **Node.js 的专用网络**访问，不要开放公用网络。

Vite 官方说明：开发服务器默认只监听 `localhost`；绑定 `0.0.0.0` 后才会监听局域网地址。CookingApp 使用 Vinext 的 Vite 开发服务器，`dev:mobile` 已封装等价的 `--hostname 0.0.0.0` 参数：<https://vite.dev/config/server-options>。

## 2. 手机能否登录

可以。手机打开的是电脑上的前端页面，但邮箱密码仍直接交给当前 `.env.local` 所配置的 Supabase Auth；菜谱等数据也来自该 Supabase 项目。推荐本地验证只连接 DEV，不使用 PROD 做试验。

- 已有账号的“邮箱 + 密码”登录不依赖邮件跳转，最适合局域网验证。
- 手机与电脑会分别保存自己的浏览器会话；电脑已经登录不代表手机自动登录。
- CookingApp 会把 `192.168.*`、`10.*`、`172.16～31.*`、`localhost` 等私有地址识别为开发环境，并跳过网页端 Turnstile。
- DEV Supabase 若仍强制 CAPTCHA，Auth 仍会拒绝没有 token 的请求；本地测试时应在 DEV 的 Auth → Bot and Abuse Protection 关闭 CAPTCHA，正式环境继续开启。

## 3. 注册、验证邮件和找回密码

注册确认、Magic Link 或找回密码会跳回网页地址，因此 Supabase 只接受 Auth → URL Configuration → Redirect URLs 白名单中的地址。官方说明见：<https://supabase.com/docs/guides/auth/redirect-urls>。

最稳妥的分工是：

- 局域网：用已有账号检查登录、导航、保存和移动布局；
- Sites HTTPS：检查注册、验证邮件、找回密码和正式 Turnstile；
- 如果必须从局域网测试邮件跳转，再临时把当前完整地址（例如 `http://192.168.1.23:5173/**`）加入 DEV Redirect URLs；IP 变化后要更新，不要加入 PROD。

Cloudflare 说明 Turnstile 在手机浏览器中本身不需要额外配置；正式域名必须在 Hostname Management 中获准。生产 sitekey 不建议为局域网 IP 放宽限制，本地可使用测试 key：<https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/>、<https://developers.cloudflare.com/turnstile/troubleshooting/testing/>。

## 4. 本轮手机验收清单

先在浏览器设备模拟器检查 `360 / 390 / 430 / 768px`，再至少用一台真实手机验证：

- 登录后顶部账号入口能看到邮箱、语言和设置；
- 底部五个主入口和“更多”不被系统手势条遮挡；
- “更多”面板可滚动，打开时背景不跟随滚动；
- 导入平台保持两列等高，表单、文件选择和长文字不横向越界；
- 待处理来源可横向切换，打开视频、原页面和手工录入按钮可点击；
- 键盘弹出后仍能看到当前输入框，输入时页面不会因为字体过小自动放大；
- 手工录入顶部能快速跳到“核验与保存”，草稿返回后仍存在；
- 旋转横屏再返回竖屏后，底部导航、浮动视频和保存区不重叠；
- 新建/编辑菜谱保存后没有整页白屏刷新。

手机无法打开时，依次检查：两台设备是否同一 Wi-Fi、地址/端口是否正确、Windows 网络是否为“专用”、Node.js 是否已获防火墙专用网络权限，以及路由器是否开启了 AP/客户端隔离。
