// Minimal ambient types so editors don't complain. Cloudflare Pages bundles
// functions itself; these are never shipped to the browser.
declare type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (p: Promise<unknown>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  data: Record<string, unknown>;
}) => Response | Promise<Response>;
