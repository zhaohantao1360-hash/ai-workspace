/**
 * Egern 网络诊断 · 精简版（独立实现）
 * 功能参考：lylywayr/NetWork-Module 的「网络诊断雷达」。
 * POLICY：统一策略；LMT/AI：分类策略（POLICY 优先）；空值使用默认规则。
 * YS：默认 1，隐藏 IP；0 显示。TIMEOUT：请求超时毫秒，默认 4500。
 * SERVICES：逗号分隔服务名，最多 8 个；见 README。
 */
export default async function (ctx) {
  const env = ctx.env || {};
  const clean = value => String(value == null ? '' : value).trim();
  const policy = clean(env.POLICY);
  const mask = clean(env.YS) !== '0';
  const rawTimeout = Number(env.TIMEOUT);
  const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0
    ? Math.min(10000, Math.max(1000, rawTimeout)) : 4500;
  const catalog = {
    netflix: ['Netflix', 'https://www.netflix.com/', 'LMT'],
    youtube: ['YouTube', 'https://www.youtube.com/', 'LMT'],
    disney: ['Disney+', 'https://www.disneyplus.com/', 'LMT'],
    spotify: ['Spotify', 'https://open.spotify.com/', 'LMT'],
    tiktok: ['TikTok', 'https://www.tiktok.com/', 'LMT'],
    prime: ['Prime Video', 'https://www.primevideo.com/', 'LMT'],
    chatgpt: ['ChatGPT', 'https://chatgpt.com/', 'AI'],
    claude: ['Claude', 'https://claude.ai/', 'AI'],
    gemini: ['Gemini', 'https://gemini.google.com/', 'AI'],
    deepseek: ['DeepSeek', 'https://chat.deepseek.com/', 'AI'],
    grok: ['Grok', 'https://grok.com/', 'AI'],
    perplexity: ['Perplexity', 'https://www.perplexity.ai/', 'AI']
  };
  const defaults = ['netflix', 'youtube', 'chatgpt', 'claude', 'gemini', 'perplexity'];
  const requested = clean(env.SERVICES).toLowerCase();
  const ids = requested
    ? [...new Set(requested.split(/[,，]/).map(clean))]
        .filter(id => Object.prototype.hasOwnProperty.call(catalog, id)).slice(0, 8)
    : defaults;
  const requests = new Map();

  function request(url, route = '', body = false) {
    const key = JSON.stringify([url, route, body]);
    if (!requests.has(key)) requests.set(key, (async () => {
      const start = Date.now();
      try {
        const options = {
          timeout, redirect: 'follow', credentials: 'omit',
          headers: { 'Cache-Control': 'no-cache', Accept: '*/*' }
        };
        if (route) options.policy = route;
        const response = await ctx.http.get(url, options);
        const text = body ? await response.text() : '';
        return { status: response.status, text, ms: Math.max(1, Date.now() - start) };
      } catch (_) {
        return { status: 0, text: '', ms: 0 };
      }
    })());
    return requests.get(key);
  }

  async function exit(route) {
    const result = await request('https://www.cloudflare.com/cdn-cgi/trace', route, true);
    if (result.status < 200 || result.status >= 300) return '检测失败';
    const data = {};
    for (const line of result.text.split(/\r?\n/)) {
      const separator = line.indexOf('=');
      if (separator > 0) data[line.slice(0, separator)] = line.slice(separator + 1).trim();
    }
    const ip = data.ip || '';
    if (!ip) return '未获取';
    const hidden = ip.includes(':') ? '[IPv6 已隐藏]'
      : ip.replace(/^(\d+\.\d+)\.\d+\.\d+$/, '$1.*.*');
    const display = mask ? (hidden === ip ? '[IP 已隐藏]' : hidden) : ip;
    return `${display} · ${data.loc || '地区未知'}`;
  }

  function status(result) {
    const code = result.status;
    if (code >= 200 && code < 300) return ['可访问', '#34D399'];
    if (code === 401 || code === 403 || code === 451) return [`受限 ${code}`, '#FBBF24'];
    if (code === 429) return ['限流 429', '#FBBF24'];
    if (code === 0) return ['请求失败', '#F87171'];
    return [`HTTP ${code}`, '#FBBF24'];
  }
  const elapsed = result => result.status >= 200 && result.status < 300
    ? `${result.ms} ms` : status(result)[0];
  const serviceJobs = ids.map(async id => {
    const [name, url, category] = catalog[id];
    const route = policy || clean(env[category]);
    const result = await request(url, route);
    return { name, route, label: status(result)[0], color: status(result)[1] };
  });
  const [directIP, selectedIP, directTime, selectedTime, services] = await Promise.all([
    exit('DIRECT'), exit(policy),
    request('https://www.qq.com/favicon.ico', 'DIRECT'),
    request('https://cp.cloudflare.com/generate_204', policy),
    Promise.all(serviceJobs)
  ]);

  const device = ctx.device || {};
  const network = clean((device.wifi || {}).ssid)
    || clean((device.cellular || {}).carrier) || '网络未知';
  const text = (value, size = 12, color = '#CBD5E1') => ({
    type: 'text', text: value, font: { size, weight: 'regular' }, textColor: color
  });
  const clock = new Date();
  const time = [clock.getHours(), clock.getMinutes()]
    .map(value => String(value).padStart(2, '0')).join(':');
  const family = ctx.widgetFamily || 'systemLarge';
  const small = family === 'systemSmall';
  const accessory = family.startsWith('accessory');
  const medium = family === 'systemMedium';
  const failed = services.filter(item => item.label !== '可访问').length;
  let children;
  if (accessory) {
    children = [text(`网络 ${elapsed(selectedTime)} · ${failed}/${services.length} 项待查`, 11)];
  } else if (small) {
    children = [text('网络诊断', 16, '#FFFFFF'), text(selectedIP, 10),
      text(`HTTP ${elapsed(selectedTime)}`, 12), text(`站点 ${services.length - failed}/${services.length} 可访问`, 11)];
  } else {
    children = [text(`网络诊断 · ${time}`, 16, '#FFFFFF'),
      text(`${mask ? '本地网络' : network} · ${policy || '默认规则'}`, 11),
      text(`直连 ${directIP}  |  HTTP ${elapsed(directTime)}`, 11),
      text(`所选 ${selectedIP}  |  HTTP ${elapsed(selectedTime)}`, 11)];
    if (medium) {
      const compact = services.map(item => `${item.name} ${item.label}`);
      children.push(text(compact.slice(0, 3).join(' · ') || '未选择有效服务', 10));
      if (compact.length > 3) children.push(text(compact.slice(3).join(' · '), 10));
    } else {
      for (const item of services) children.push(text(
        `${item.name}  ${item.label} · ${item.route || '默认规则'}`, 12, item.color));
      const dns = Array.isArray(device.dnsServers) ? device.dnsServers.filter(Boolean) : [];
      children.push(text(mask ? `设备 DNS：${dns.length} 个（地址隐藏）`
        : `设备 DNS：${dns.slice(0, 2).join(' / ') || '未获取'}`, 10));
      if (!ids.length) children.push(text('SERVICES 中没有有效服务名', 11, '#FBBF24'));
    }
    children.push(text('网页可访问 ≠ 服务解锁；耗时非 Ping', 9, '#94A3B8'));
  }
  return { type: 'widget', backgroundColor: '#0F172A', padding: accessory ? 0 : 12,
    gap: medium || small ? 4 : 6, children };
}
