import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./network-radar.js', import.meta.url), 'utf8');
const run = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
async function check(env = {}, family = 'systemLarge', mode = 'normal') {
  const calls = [];
  const ctx = { env, widgetFamily: family,
    device: { wifi: { ssid: 'PrivateSSID' }, dnsServers: ['192.168.1.1'] },
    http: { async get(url, options) {
      calls.push({ url, options });
      if (mode === 'offline') throw new Error('offline');
      let status = url.includes('generate_204') ? 204 : 200;
      if (url.includes('claude.ai')) status = 403;
      if (url.includes('gemini.google')) status = 429;
      if (url.includes('perplexity.ai')) status = 503;
      return { status, async text() {
        return mode === 'ipv6' ? 'ip=2001:db8::1234\nloc=US\n'
          : `ip=${options.policy === 'DIRECT' ? '1.2.3.4' : '5.6.7.8'}\nloc=US\n`;
      } };
    } }
  };
  const widget = await run(ctx);
  assert.equal(widget.type, 'widget');
  assert.ok(widget.children.every(item => item.type === 'text'));
  return { calls, widget, text: widget.children.map(item => item.text).join('\n') };
}
let result = await check();
assert.equal(result.calls.length, 10);
assert.match(result.text, /1\.2\.\*\.\*/);
assert.doesNotMatch(result.text, /PrivateSSID|192\.168\.1\.1|1\.2\.3\.4/);
assert.match(result.text, /受限 403/);
assert.match(result.text, /限流 429/);
assert.match(result.text, /HTTP 503/);
for (const call of result.calls) {
  assert.equal(call.options.credentials, 'omit');
  assert.ok(call.url.startsWith('https://'));
}
result = await check({ POLICY: '代理', LMT: '影音', AI: '智能', TIMEOUT: '99999' });
assert.ok(result.calls.every(call => ['DIRECT', '代理'].includes(call.options.policy)));
assert.ok(result.calls.every(call => call.options.timeout === 10000));
result = await check({ LMT: '影音', AI: '智能', YS: '0' });
assert.match(result.text, /PrivateSSID/);
assert.match(result.text, /1\.2\.3\.4/);
assert.equal(result.calls.find(call => call.url.includes('netflix')).options.policy, '影音');
assert.equal(result.calls.find(call => call.url.includes('chatgpt')).options.policy, '智能');
assert.equal(result.calls.find(call => call.url.includes('generate_204')).options.policy, undefined);
result = await check({ POLICY: 'DIRECT', SERVICES: 'netflix,netflix,unknown' });
assert.equal(result.calls.length, 4);
result = await check({ SERVICES: 'toString,__proto__,bad' });
assert.equal(result.calls.length, 4);
assert.match(result.text, /没有有效服务名/);
result = await check({}, 'systemLarge', 'ipv6');
assert.match(result.text, /IPv6 已隐藏/);
assert.doesNotMatch(result.text, /2001:db8/);
result = await check({}, 'systemLarge', 'offline');
assert.match(result.text, /检测失败/);
assert.match(result.text, /请求失败/);
for (const family of ['systemSmall', 'systemMedium', 'accessoryInline', 'accessoryCircular', 'accessoryRectangular']) {
  await check({}, family);
}
result = await check({ SERVICES: 'netflix,youtube,disney,spotify,tiktok,prime,chatgpt,claude,gemini' });
assert.equal(result.calls.length, 12);
console.log('PASS: mock checks for routing, privacy, status, failures, service filtering, deduplication and widget families');
