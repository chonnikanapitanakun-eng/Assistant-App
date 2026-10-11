// mcp — Deno Edge Function (Supabase). Remote MCP server for Claude (claude.ai / Claude app "Custom connector").
//
// Lets Claude read and edit the synced data (tasks, routines, notes, money) on the owner's Claude
// subscription instead of the Anthropic API: Claude calls these tools, nothing here calls Claude.
// Single-user (phase 1): one secret key in the URL, rows scoped to one auth user id.
//
// Transport: MCP Streamable HTTP, stateless — every POST is one JSON-RPC message answered with plain JSON.
//
// Deploy:
//   supabase secrets set MCP_KEY=<long random string> MCP_USER_ID=<auth.users id>   (MCP_TZ optional, default Asia/Bangkok)
//   supabase functions deploy mcp --no-verify-jwt
// Connector URL: https://<project>.supabase.co/functions/v1/mcp?key=<MCP_KEY>
import { callTool, TOOLS } from './tools.ts';

const MCP_KEY = Deno.env.get('MCP_KEY') ?? '';
const USER_ID = Deno.env.get('MCP_USER_ID') ?? '';
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });

type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };
const result = (id: RpcRequest['id'], value: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result: value });
const rpcError = (id: RpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Constant-time compare so the key can't be guessed byte by byte from response timing. */
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req: Request): boolean {
  const fromQuery = new URL(req.url).searchParams.get('key') ?? '';
  const fromHeader = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return sameKey(fromQuery, MCP_KEY) || sameKey(fromHeader, MCP_KEY);
}

async function handle(msg: RpcRequest): Promise<unknown | null> {
  // Notifications (no id) get no reply.
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return result(msg.id, {
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'proud-assistant', version: '0.1.0' },
        instructions:
          'Personal assistant data (tasks, routines, notes, money) of the app owner. ' +
          'Start with get_overview for "today" questions. Dates are YYYY-MM-DD in the owner\'s timezone, times HH:mm. ' +
          'Amounts are positive numbers; type says income / expense / transfer. Use list_* tools to find ids before updating. ' +
          'Calendar events are not here — use the Google Calendar connector for those.',
      });
    }
    case 'ping':
      return result(msg.id, {});
    case 'tools/list':
      return result(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await callTool(name, args, USER_ID);
        return result(msg.id, { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] });
      } catch (err) {
        // Tool errors go back to Claude as a result so it can correct its arguments.
        return result(msg.id, { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true });
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!MCP_KEY || !USER_ID) return json({ error: 'MCP_KEY / MCP_USER_ID not set' }, 500);
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  // Stateless server: no server-initiated stream.
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST, OPTIONS', ...CORS } });

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return json(rpcError(null, -32700, 'Parse error'), 400);

  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handle(m as RpcRequest)))).filter((r) => r !== null);
    return replies.length ? json(replies) : new Response(null, { status: 202, headers: CORS });
  }
  const reply = await handle(body as RpcRequest);
  return reply === null ? new Response(null, { status: 202, headers: CORS }) : json(reply);
});
