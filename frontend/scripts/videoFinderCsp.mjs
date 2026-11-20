// videos.haru2026.com 전용 Content-Security-Policy.
// - 외부 스크립트·글꼴 CDN 없이 같은 출처 자산만 허용한다.
// - Vite legacy 플러그인이 넣는 인라인 스크립트(iOS 구형 대응)는 'unsafe-inline' 대신 실제 빌드 결과의 SHA-256 해시로만 허용한다.
//   허용할 해시는 플러그인이 공개한 cspHashes 목록에 있는 것만 받는다. 모르는 인라인 스크립트가 생기면 빌드를 멈춘다.
// - frame-ancestors는 meta로 줄 수 없어 Hosting 머리글(firebase.video-finder.json)에 둔다.
import { createHash } from 'node:crypto';

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

export function scriptTags(html) {
  const out = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const attrs = m[1] || '';
    const src = /(?:^|\s)src\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? null;
    out.push({ attrs, src, content: m[2] || '' });
  }
  return out;
}

export function sha256Base64(text) {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

// type="systemjs-importmap" 같은 실행되지 않는 데이터 스크립트는 제외하고, 실행되는 인라인 스크립트만 해시한다.
export function inlineScriptHashes(html) {
  return scriptTags(html)
    .filter((s) => s.src === null && s.content.length > 0 && !/type\s*=\s*"systemjs-importmap"/i.test(s.attrs))
    .map((s) => sha256Base64(s.content));
}

export function functionsOrigin(projectId, region = 'asia-northeast3') {
  if (!/^[a-z0-9-]{4,40}$/.test(String(projectId || ''))) {
    throw new Error('VITE_FIREBASE_PROJECT_ID가 없어 독립 주소 CSP의 서버 주소를 정할 수 없습니다.');
  }
  return `https://${region}-${projectId}.cloudfunctions.net`;
}

export function buildVideoFinderCsp({ scriptHashes, connectOrigins }) {
  const unique = [...new Set(scriptHashes)];
  return [
    "default-src 'self'",
    `script-src 'self'${unique.map((h) => ` 'sha256-${h}'`).join('')}`,
    "style-src 'self'",
    "img-src 'self' data: https://i.ytimg.com",
    "font-src 'self' data:",
    `connect-src 'self' ${connectOrigins.join(' ')}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ].join('; ');
}

export function injectCspMeta(html, csp) {
  if (/http-equiv\s*=\s*"Content-Security-Policy"/i.test(html)) throw new Error('CSP meta가 이미 있습니다.');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`;
  // charset 바로 뒤, 다른 어떤 스크립트보다 앞에 둔다.
  const charset = /<meta\s+charset="[^"]*"\s*\/?>/i.exec(html);
  if (charset) return html.slice(0, charset.index + charset[0].length) + meta + html.slice(charset.index + charset[0].length);
  return html.replace(/<head>/i, `<head>${meta}`);
}

export function readCspMeta(html) {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/i.exec(html);
  return m ? m[1].replace(/&quot;/g, '"') : null;
}

function directive(csp, name) {
  const part = csp.split(';').map((p) => p.trim()).find((p) => p.split(/\s+/)[0] === name);
  return part ? part.split(/\s+/).slice(1) : null;
}

// 빌드 결과가 자기 CSP에 막히지 않는지, 외부 스크립트·글꼴 CDN이 없는지 확인한다. 문제 목록을 돌려준다.
export function verifyVideoFinderHtml(html, { allowedInlineHashes } = {}) {
  const problems = [];
  const csp = readCspMeta(html);
  if (!csp) return ['CSP meta가 없습니다.'];
  const head = html.slice(0, html.search(/<\/head>/i));
  const cspAt = head.search(/http-equiv="Content-Security-Policy"/i);
  const firstScript = head.search(/<script\b/i);
  if (firstScript >= 0 && firstScript < cspAt) problems.push('CSP meta가 첫 스크립트보다 뒤에 있습니다.');
  const scriptSrc = directive(csp, 'script-src') || [];
  if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) problems.push('script-src에 unsafe 허용이 있습니다.');
  if (scriptSrc.some((s) => /^https?:/i.test(s) || s === '*')) problems.push('script-src에 외부 출처가 있습니다.');
  for (const h of inlineScriptHashes(html)) {
    if (!scriptSrc.includes(`'sha256-${h}'`)) problems.push(`허용되지 않은 인라인 스크립트(sha256-${h})`);
    if (allowedInlineHashes && !allowedInlineHashes.includes(h)) problems.push(`legacy 플러그인이 알리지 않은 인라인 스크립트(sha256-${h})`);
  }
  for (const s of scriptTags(html)) {
    if (s.src !== null && !s.src.startsWith('/')) problems.push(`같은 출처가 아닌 스크립트: ${s.src}`);
    const dataSrc = /(?:^|\s)data-src\s*=\s*"([^"]*)"/i.exec(s.attrs)?.[1];
    if (dataSrc && !dataSrc.startsWith('/')) problems.push(`같은 출처가 아닌 legacy 스크립트: ${dataSrc}`);
  }
  for (const m of html.matchAll(/<link\b[^>]*href="([^"]*)"[^>]*>/gi)) {
    if (/^https?:|^\/\//i.test(m[1])) problems.push(`외부 연결: ${m[1]}`);
  }
  if (/jsdelivr|unpkg|cdnjs|googleapis\.com\/css/i.test(html)) problems.push('외부 CDN 주소가 있습니다.');
  if (/\sstyle\s*=\s*"/i.test(html)) problems.push("인라인 style 속성은 style-src 'self'에 막힙니다.");
  if (/<style\b/i.test(html)) problems.push("인라인 <style>은 style-src 'self'에 막힙니다.");
  return problems;
}
