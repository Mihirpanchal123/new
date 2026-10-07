import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "wd_admin";

function tokenMatches(candidate: string | undefined, token: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function login(formData: FormData) {
  "use server";
  const { config, logger } = getContainer();
  const candidate = String(formData.get("token") ?? "");
  if (!config.adminToken || !tokenMatches(candidate, config.adminToken)) {
    logger.suspect("admin", "failed admin login");
    redirect("/admin?error=1");
  }
  (await cookies()).set(ADMIN_COOKIE, candidate, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.isProduction,
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });
  redirect("/admin");
}

async function logout() {
  "use server";
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display text-3xl font-bold tabular">{value}</p>
    </Card>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const c = getContainer();
  const { config } = c;

  if (!config.adminToken) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">Admin is disabled</h1>
        <p className="mt-2 text-muted">Set ADMIN_TOKEN in the server environment to enable it.</p>
      </div>
    );
  }

  const authed = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value, config.adminToken);
  if (!authed) {
    const { error } = await searchParams;
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-6 text-center font-display text-3xl font-semibold">Admin</h1>
        <form action={login} className="flex flex-col gap-3">
          <label htmlFor="token" className="text-sm font-bold text-muted">Admin token</label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-4 font-semibold focus:border-brand focus:outline-none"
          />
          {error && <p role="alert" className="text-sm font-semibold text-danger">That token didn&apos;t match.</p>}
          <button className="h-12 rounded-2xl bg-brand font-display font-semibold text-brand-ink">Sign in</button>
        </form>
      </div>
    );
  }

  const stats = c.rooms.stats();
  const counts = c.profiles.counts();
  const rooms = c.rooms.allRooms().sort((a, b) => b.updatedAt - a.updatedAt);
  const showSecrets = config.adminShowSecrets;
  // Server Component rendered per request: reading the clock here is intended.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const uptimeMin = Math.round((now - c.startedAt) / 60_000);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Admin</h1>
          <p className="text-sm text-muted">
            Uptime {uptimeMin}m · persistence: {config.persistence} · secrets {showSecrets ? "VISIBLE (dev)" : "hidden"}
          </p>
        </div>
        <form action={logout}>
          <button className="h-10 rounded-xl border-2 border-border px-4 text-sm font-bold">Sign out</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Rooms" value={stats.rooms} />
        <Stat label="Active games" value={stats.activeGames} />
        <Stat label="Lobbies" value={stats.lobbies} />
        <Stat label="Players online" value={c.presence.onlinePlayers()} />
        <Stat label="Profiles" value={counts.profiles} />
        <Stat label="Completed" value={counts.matches} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Game inspector</h2>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs font-extrabold uppercase tracking-wider text-muted">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Phase</th>
              <th className="p-3">Players</th>
              <th className="p-3">Turn</th>
              <th className="p-3">Word</th>
              <th className="p-3">Score</th>
              <th className="p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">No live rooms.</td>
              </tr>
            )}
            {rooms.map((r) => {
              const turn = r.match?.turn;
              const guesser = r.players.find((p) => p.id === turn?.guesserId);
              return (
                <tr key={r.code} className="border-b border-border/60 align-top last:border-0">
                  <td className="p-3 font-mono font-bold">{r.code}</td>
                  <td className="p-3"><Badge tone={r.phase === "PLAYING" ? "success" : "neutral"}>{r.phase}</Badge></td>
                  <td className="p-3">
                    {r.players.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", p.connected ? "bg-success" : "bg-muted")} />
                        <span className="font-semibold">{p.displayName}</span>
                        <span className="font-mono text-xs text-muted">{p.id.slice(0, 8)}</span>
                        {showSecrets && p.chain && <span className="text-xs text-muted">[{p.chain.join(", ")}]</span>}
                      </div>
                    ))}
                  </td>
                  <td className="p-3">{turn ? `#${turn.id} ${guesser?.displayName ?? "?"} (${turn.phase})` : "—"}</td>
                  <td className="p-3">{turn ? `${turn.position + 1} / round ${turn.round}` : "—"}</td>
                  <td className="p-3 font-mono">
                    {r.match ? r.match.order.map((id) => r.match!.scores[id] ?? 0).join(" – ") : "—"}
                  </td>
                  <td className="p-3 text-muted">{Math.round((now - r.updatedAt) / 1000)}s ago</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[
          { title: "Recent errors", entries: c.logger.recentErrors },
          { title: "Suspicious activity", entries: c.logger.suspicious },
        ].map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 font-display text-xl font-semibold">{section.title}</h2>
            <Card className="max-h-96 overflow-auto p-3 font-mono text-xs">
              {section.entries.length === 0 ? (
                <p className="p-3 text-center font-sans text-sm text-muted">Nothing here. 🎉</p>
              ) : (
                section.entries.slice(0, 50).map((e, i) => (
                  <div key={i} className="border-b border-border/60 py-1.5 last:border-0">
                    <span className="text-muted">{new Date(e.at).toLocaleTimeString()}</span> [{e.scope}] {e.message}
                    {e.meta && <span className="text-muted"> {JSON.stringify(e.meta).slice(0, 200)}</span>}
                  </div>
                ))
              )}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
