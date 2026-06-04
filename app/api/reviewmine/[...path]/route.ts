import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const SITE_TARGET = 'https://reviewmine.app';
const API_TARGET = 'https://api.reviewmine.dev';
const TOKEN_FILE = path.join(process.cwd(), 'data', 'reviewmine-token.txt');

function getToken(): string {
  try { return fs.readFileSync(TOKEN_FILE, 'utf-8').trim(); } catch { return ''; }
}

const STRIP_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
];

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const resolvedParams = await Promise.resolve(params);
  const targetPath = '/' + resolvedParams.path.join('/');
  const url = new URL(request.url);

  const isApiCall = targetPath.startsWith('/api/');
  const base = isApiCall ? API_TARGET : SITE_TARGET;
  const targetUrl = base + targetPath + url.search;

  const token = getToken();

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': request.headers.get('accept') || '*/*',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `auth_token=${token}`;
  }

  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  if (!isApiCall) headers['Referer'] = SITE_TARGET + '/';

  let body: ArrayBuffer | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
    });

    const respHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (!STRIP_HEADERS.includes(key.toLowerCase())) {
        respHeaders.set(key, value);
      }
    });
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.delete('content-encoding');

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      let html = await res.text();
      html = rewriteHtml(html, token);
      return new Response(html, { status: res.status, headers: respHeaders });
    }

    return new Response(await res.arrayBuffer(), {
      status: res.status,
      headers: respHeaders,
    });
  } catch (err) {
    console.error('[ReviewMine Proxy]', err);
    return Response.json(
      { error: `Proxy error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}

function rewriteHtml(html: string, token: string): string {
  const proxyBase = '/api/reviewmine';

  html = html.replace(/https:\/\/api\.reviewmine\.dev/g, proxyBase);

  const initScript = `<script>
    (function() {
      var PROXY = '${proxyBase}';

      // Strip proxy prefix so SPA router matches correct route
      if (window.location.pathname.startsWith(PROXY)) {
        var realPath = window.location.pathname.slice(PROXY.length) || '/';
        history.replaceState(null, '', realPath + window.location.search);
      }

      ${token ? `
      localStorage.setItem("auth_token", ${JSON.stringify(token)});
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("API_BASE_URL", PROXY + "/api");
      try {
        var stored = localStorage.getItem("user");
        if (!stored || stored === "null") {
          localStorage.setItem("user", JSON.stringify({userId:0,name:"GrowthBox User"}));
        }
      } catch(e) {}
      ` : ''}

      // Intercept pushState/replaceState to keep iframe navigation working
      var _origPush = history.pushState;
      var _origReplace = history.replaceState;
      history.pushState = function(state, title, url) {
        return _origPush.call(this, state, title, url);
      };
      history.replaceState = function(state, title, url) {
        return _origReplace.call(this, state, title, url);
      };

      // Intercept fetch to route API calls through proxy
      var _origFetch = window.fetch;
      window.fetch = function(url, opts) {
        if (typeof url === 'string') {
          if (url.includes('api.reviewmine.dev')) {
            url = url.replace('https://api.reviewmine.dev', PROXY);
          }
          opts = opts || {};
          opts.headers = opts.headers || {};
          if (typeof opts.headers === 'object' && !Array.isArray(opts.headers) && !(opts.headers instanceof Headers)) {
            opts.headers['Authorization'] = 'Bearer ' + (localStorage.getItem('auth_token') || '');
          }
        }
        return _origFetch.call(this, url, opts);
      };

      // Intercept XMLHttpRequest for API calls
      var _origXHROpen = XMLHttpRequest.prototype.open;
      var _origXHRSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes('api.reviewmine.dev')) {
          arguments[1] = url.replace('https://api.reviewmine.dev', PROXY);
        }
        return _origXHROpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function() {
        var tk = localStorage.getItem('auth_token');
        if (tk) this.setRequestHeader('Authorization', 'Bearer ' + tk);
        return _origXHRSend.apply(this, arguments);
      };
    })();
  </script>`;

  html = html.replace('<head>', '<head>' + initScript);

  return html;
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyRequest(req, ctx.params);
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyRequest(req, ctx.params);
}
export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyRequest(req, ctx.params);
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyRequest(req, ctx.params);
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyRequest(req, ctx.params);
}
