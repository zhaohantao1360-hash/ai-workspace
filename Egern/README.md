# Egern 网络诊断 · 精简版

面向 Egern generic 小组件的独立实现，按“网络诊断雷达”的用途简化，不复制原版实现。保留出口、HTTP 响应耗时和网站访问状态，去掉策略名猜测、IP 纯净度评分、NAT 类型猜测、UDP/QUIC 结论及复杂图标。

## 使用

1. Egern → 工具 → 脚本 → 新建，类型选择 generic，文件位置选择本地。
2. 将同目录 `network-radar.js` 的内容粘贴到脚本编辑器并保存。
3. 分析 → 小组件画廊 → 新建小组件，选择此脚本；建议使用大号尺寸。
4. 在小组件环境变量中设置下面的选项，全部可以留空。

当前仓库为私有仓库，普通匿名 raw 链接无法直接下载。优先使用本地脚本，不要把 GitHub Token 放进脚本 URL，也无需为使用脚本把整个仓库改为公开。

## 环境变量

|变量|默认|作用|
|---|---|---|
|POLICY|空|出口、所选策略耗时和所有站点统一使用此策略；直连检测始终 DIRECT|
|LMT|空|流媒体检测策略；POLICY 非空时忽略|
|AI|空|AI 检测策略；POLICY 非空时忽略|
|YS|1|隐藏 IP、Wi-Fi/运营商名称和设备 DNS 地址；0 显示。策略名称不隐藏|
|TIMEOUT|4500|单次 HTTP 请求超时毫秒；限制在 1000–10000|
|SERVICES|netflix,youtube,chatgpt,claude,gemini,perplexity|逗号分隔；去重，忽略未知名称，最多 8 个|

可选服务：netflix、youtube、disney、spotify、tiktok、prime、chatgpt、claude、gemini、deepseek、grok、perplexity。

策略名必须与 Egern 配置完全一致。空策略不传 policy，按 Egern 默认请求路由执行；“所选”不保证是代理出口。出口只表示请求 Cloudflare trace 时的路径，不代表每个网站的出口；分类策略不另查地区，避免误标国旗。YS 只遮盖显示内容，并不会匿名化实际请求。

## 如何读结果

- 可访问：最终 HTTP 状态为 2xx，仅表示首页请求成功，不证明可登录、播放、调用 API 或地区解锁。
- 受限：401/403/451；可能是认证、风控或地区限制，不能只凭状态码判断原因。
- 限流：429。
- 请求失败：超时、DNS、连接或 TLS 等请求异常；不推断具体原因。
- HTTP xxx：其他状态，保留真实状态码。
- 直连耗时：DIRECT 请求腾讯 favicon；所选耗时：指定策略或默认规则请求 Cloudflare 204。这是不同目标的 HTTP 响应耗时，包含网络与服务器处理等因素，不是 Ping、测速或公平的线路排名。
- 设备 DNS：来自 ctx.device.dnsServers，只是设备提供的 DNS 地址，不是 DNS 泄漏检测，也不是 Egern 实际使用的所有上游。

默认每轮 10 次 GET，最多 12 次；不扫描候选策略、不重试、不查询 IP 风险库。同轮相同请求共享结果。所有请求使用 HTTPS，不携带 Cookie，不关闭 TLS 校验。向检测网站发起请求时，其服务端仍可看到实际出口 IP。

小号只显示摘要，中号汇总站点，大号逐项显示。中号最多 8 项时可能拥挤；可减少 SERVICES。锁屏显示摘要。无有效 SERVICES 时不回退默认列表，并显示提示。

## 验证与限制

测试脚本使用模拟 ctx 验证策略优先级、状态码分类、IP 隐藏、异常处理、服务过滤、请求数与小组件尺寸分支，不发起真实联网请求。执行：`node Egern/network-radar.test.mjs`（在仓库根目录）。

通过模拟测试不等于已在 iPhone / Egern 中完成联网和视觉测试。刷新时机由 Egern / iOS 控制，本脚本不承诺固定刷新间隔。

## 来源

功能参考： https://github.com/lylywayr/NetWork-Module/tree/main/Egern/网络诊断雷达

接口： https://egernapp.com/zh-CN/docs/javascript-api/

小组件： https://egernapp.com/docs/configuration/widgets/

本文件为独立简化实现，不代表原作者维护或认可，也未将上游仓库声明为具有任何未核实的开源许可证。
