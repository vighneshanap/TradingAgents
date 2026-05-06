import { useEffect, useState } from "react";
import type { AgentStateSnapshot, Phase, SSEChunk } from "@/types";

interface RunStreamState {
  state: AgentStateSnapshot;
  phase: Phase;
  done: boolean;
  error: string | null;
}

const TOKEN_KEY = "tradingagents-bearer";

/**
 * Subscribe to /api/runs/:id/stream via EventSource.
 *
 * Note: native EventSource doesn't support custom headers, so bearer-token
 * auth is enforced server-side via query string fallback if you've enabled
 * TRADINGAGENTS_WEB_TOKEN. For local dev (no token) this Just Works.
 */
export function useRunStream(runId: string | undefined): RunStreamState {
  const [state, setState] = useState<AgentStateSnapshot>({});
  const [phase, setPhase] = useState<Phase>("starting");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    setState({});
    setPhase("starting");
    setDone(false);
    setError(null);

    const token = localStorage.getItem(TOKEN_KEY);
    const url = token
      ? `/api/runs/${runId}/stream?token=${encodeURIComponent(token)}`
      : `/api/runs/${runId}/stream`;
    const es = new EventSource(url);

    es.addEventListener("chunk", (ev) => {
      const parsed: SSEChunk = JSON.parse((ev as MessageEvent).data);
      setState((prev) => ({ ...prev, ...parsed.data }));
      if (parsed.phase) setPhase(parsed.phase);
    });

    es.addEventListener("done", () => {
      setPhase("done");
      setDone(true);
      es.close();
    });

    es.onerror = () => {
      setError("Connection lost");
      es.close();
    };

    return () => es.close();
  }, [runId]);

  return { state, phase, done, error };
}
