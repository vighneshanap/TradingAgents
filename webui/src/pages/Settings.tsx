import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

import { api, auth } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";

export default function SettingsPage() {
  const provQ = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  const cfgQ = useQuery({ queryKey: ["config"], queryFn: api.config });
  const [token, setToken] = useState("");

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Local-only — no values are written to the server"
      />

      <section className="space-y-6 max-w-3xl">
        {/* Bearer token */}
        <div className="terminal-card p-5">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">
            API Bearer Token
          </div>
          <p className="text-sm text-text-muted mb-3">
            Set this if your server has <span className="ticker">TRADINGAGENTS_WEB_TOKEN</span>{" "}
            configured. Stored in <span className="ticker">localStorage</span>.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={auth.hasToken() ? "(token already set)" : "Bearer token"}
              className="ticker flex-1 bg-bg-overlay border border-border rounded-sm
                         px-3 py-2 text-text outline-none focus:border-accent-amber"
            />
            <button
              onClick={() => { if (token) auth.setToken(token); setToken(""); }}
              className="px-3 py-2 ticker uppercase text-xs bg-accent-amber text-bg rounded-sm"
            >
              Save
            </button>
            <button
              onClick={() => auth.clearToken()}
              className="px-3 py-2 text-xs border border-border rounded-sm hover:border-rating-sell hover:text-rating-sell"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Provider keys */}
        <div className="terminal-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-text-subtle">
            Provider API Keys (server env)
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-border">
              {provQ.data?.map((p) => (
                <tr key={p.name}>
                  <td className="px-5 py-2 text-sm">{p.label}</td>
                  <td className="px-5 py-2 ticker text-xs text-text-muted">
                    {p.api_key_env ?? <em className="text-text-subtle">no key required</em>}
                  </td>
                  <td className="px-5 py-2 text-right">
                    {p.api_key_configured ? (
                      <span className="inline-flex items-center gap-1 text-accent-green text-xs ticker">
                        <Check size={12} /> configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rating-sell text-xs ticker">
                        <X size={12} /> missing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Default config */}
        <div className="terminal-card p-5">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">
            Default Config (read-only)
          </div>
          <pre className="ticker text-xs text-text-muted overflow-x-auto">
            {JSON.stringify(cfgQ.data, null, 2)}
          </pre>
        </div>
      </section>
    </>
  );
}
