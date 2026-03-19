"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { MessageBar } from "@/components/message-bar";
import { useSSE, type SSEMessage } from "@/hooks/use-sse";
import { getCachedAgent } from "@/lib/agent-cache";
import type { AgentMeta, AgentRun } from "@/lib/types";

export default function AgentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const cachedAgent = getCachedAgent(slug);
  const [agent, setAgent] = useState<AgentMeta | null>(cachedAgent || null);
  const [allRuns, setAllRuns] = useState<AgentRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { messages, isConnected, connect, disconnect, reset, loadHistory } = useSSE();

  // Conversation state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationRuns, setConversationRuns] = useState<AgentRun[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [completedRunEvents, setCompletedRunEvents] = useState<Record<string, SSEMessage[]>>({});

  // Prompt suggestions for empty chat
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Track current run ID for approval POSTs
  const currentRunIdRef = useRef<string | null>(null);

  // Track whether title has been generated for this session
  const titleGeneratedRef = useRef<Set<string>>(new Set());

  // Guard: skip session-param effect when URL was just updated by handleSend
  const justSentRef = useRef<string | null>(null);

  // Track which session we're currently viewing to avoid redundant loads
  const activeSessionRef = useRef<string | null>(null);

  // True while loadSession is fetching data
  const [sessionLoading, setSessionLoading] = useState(false);

  // Track if initial session load has been triggered (prevents double-fire)
  const initialLoadRef = useRef(false);

  // Mark notifications as read for the currently viewed session
  const markSessionNotificationsRead = useCallback((sid: string) => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    }).catch(() => {});
  }, []);

  // --- Data loading ---

  useEffect(() => {
    if (!agent) {
      fetch("/api/agents")
        .then((r) => r.json())
        .then((agents: AgentMeta[]) => {
          setAgent(agents.find((a) => a.slug === slug) || null);
        });
    }

    // Background fetch for sidebar context — does NOT block session loading
    fetch(`/api/runs?agent_slug=${slug}&limit=50`)
      .then((r) => r.json())
      .then((runs) => {
        setAllRuns(runs);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // --- Fetch prompt suggestions when agent is known ---

  useEffect(() => {
    if (!agent) return;

    // Static fallbacks so empty state always has suggestions, even if the API is down
    const fallbacks = [
      `What can you help me with?`,
      `Summarize your capabilities`,
      `What should I know before we start?`,
    ];

    const fetchSuggestions = () => {
      const p = new URLSearchParams({
        slug: agent.slug,
        name: agent.name,
        description: agent.description,
      });
      fetch(`/api/ai/suggestions?${p}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.suggestions) setSuggestions(d.suggestions);
        })
        .catch(() => {});
    };

    // Set fallbacks immediately, then try to fetch better ones
    setSuggestions(fallbacks);
    fetchSuggestions();

    // Retry once after 10s in case the API was temporarily unavailable (e.g. credit propagation delay)
    const retryTimer = setTimeout(() => {
      // Only retry if we still have fallbacks (AI suggestions didn't arrive)
      setSuggestions((prev) => {
        if (prev === fallbacks || prev.length === 0) {
          fetchSuggestions();
        }
        return prev;
      });
    }, 10_000);

    return () => clearTimeout(retryTimer);
  }, [agent?.slug, agent?.name, agent?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // loadSession — the ONE function that handles all session navigation.
  // Renders progressively: shows conversation structure first, then loads events.
  // ---------------------------------------------------------------------------

  const loadSession = useCallback(
    async (newSessionId: string | null) => {
      // 1. Immediately clear previous state and show loading
      disconnect();
      reset();
      setIsRunning(false);
      setCurrentPrompt(null);
      setConversationRuns([]);
      setCompletedRunEvents({});
      currentRunIdRef.current = null;
      activeSessionRef.current = newSessionId;

      if (!newSessionId) {
        setSessionId(null);
        setSessionLoading(false);
        return;
      }

      setSessionId(newSessionId);
      setSessionLoading(true);

      // Dismiss any notifications for this session since user is viewing it
      markSessionNotificationsRead(newSessionId);

      try {
        // 2. Fetch runs — single fetch, no duplication
        let freshRuns: AgentRun[];
        try {
          const res = await fetch(`/api/runs?agent_slug=${slug}&limit=50`);
          freshRuns = await res.json();
          setAllRuns(freshRuns);
        } catch {
          return;
        }

        if (activeSessionRef.current !== newSessionId) return;

        const sessionRuns = freshRuns
          .filter((r) => r.session_id === newSessionId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (sessionRuns.length === 0) {
          setConversationRuns([]);
          return;
        }

        const latestRun = sessionRuns[sessionRuns.length - 1];

        // 3. IMMEDIATELY show conversation structure (prompts + outputs visible)
        //    Events load in background to fill in tool/thinking detail.
        if (
          latestRun.status === "completed" ||
          latestRun.status === "failed" ||
          latestRun.status === "stopped"
        ) {
          setConversationRuns(sessionRuns);
          setSessionLoading(false); // ← Render NOW, don't wait for events

          // 4. Load events in background (enriches the display with tool details)
          const completedRuns = sessionRuns.filter(
            (r) => r.status === "completed" || r.status === "failed" || r.status === "stopped"
          );
          if (completedRuns.length > 0) {
            const eventsMap: Record<string, SSEMessage[]> = {};
            await Promise.all(
              completedRuns.map(async (run) => {
                try {
                  const res = await fetch(`/api/runs/${run.id}/events`);
                  if (!res.ok) return;
                  const rawEvents = (await res.json()) as Record<string, unknown>[];
                  if (rawEvents.length > 0) {
                    eventsMap[run.id] = rawEvents.map((evt) => ({
                      type: evt.event_type as string,
                      seq: evt.seq as number,
                      ...(evt.payload as Record<string, unknown>),
                    }));
                  }
                } catch { /* skip */ }
              })
            );
            if (activeSessionRef.current !== newSessionId) return;
            setCompletedRunEvents(eventsMap);
          }
          return;
        }

        // 5. Latest run is running/queued → show prior turns, reconnect to live
        const priorRuns = sessionRuns.slice(0, -1);
        setConversationRuns(priorRuns);
        setCurrentPrompt(latestRun.prompt);
        setIsRunning(true);
        currentRunIdRef.current = latestRun.id;
        setSessionLoading(false); // ← Render prior turns NOW

        // Load historical events from DB
        const { maxSeq, events } = await loadHistory(latestRun.id);

        if (activeSessionRef.current !== newSessionId) return;

        const alreadyDone = events.some(
          (e) => e.type === "done" || e.type === "stopped" || (e.type === "error" && !events.some((d) => d.type === "done" || d.type === "stopped"))
        );

        if (alreadyDone) {
          setIsRunning(false);
          return;
        }

        connect(`/api/runs/${latestRun.id}/stream`, maxSeq > 0 ? maxSeq : undefined);

        // Load events for prior completed runs in background
        if (priorRuns.length > 0) {
          const eventsMap: Record<string, SSEMessage[]> = {};
          await Promise.all(
            priorRuns.map(async (run) => {
              try {
                const res = await fetch(`/api/runs/${run.id}/events`);
                if (!res.ok) return;
                const rawEvents = (await res.json()) as Record<string, unknown>[];
                if (rawEvents.length > 0) {
                  eventsMap[run.id] = rawEvents.map((evt) => ({
                    type: evt.event_type as string,
                    seq: evt.seq as number,
                    ...(evt.payload as Record<string, unknown>),
                  }));
                }
              } catch { /* skip */ }
            })
          );
          if (activeSessionRef.current !== newSessionId) return;
          setCompletedRunEvents(eventsMap);
        }
      } finally {
        setSessionLoading(false);
      }
    },
    [slug, disconnect, reset, loadHistory, connect, markSessionNotificationsRead]
  );

  // ---------------------------------------------------------------------------
  // Session navigation: when ?session=X changes, load immediately.
  // No longer waits for runsLoaded — loadSession fetches its own data.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const sessionParam = searchParams.get("session");

    // Guard: skip if handleSend just set this URL
    if (sessionParam && justSentRef.current === sessionParam) {
      justSentRef.current = null;
      return;
    }

    // Don't reload if already viewing this session
    if (sessionParam === sessionId) return;

    // Prevent double-fire on initial mount
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
    }

    loadSession(sessionParam || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---------------------------------------------------------------------------
  // Stream completion: when the live stream finishes, update sidebar + metadata
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const doneMsg = messages.find(
      (m) => m.type === "done" || m.type === "stopped"
    );
    const statusMsg = messages.find(
      (m) =>
        m.type === "status" &&
        (m.status === "completed" || m.status === "failed" || m.status === "stopped")
    );
    const errorMsg = messages.find(
      (m) =>
        m.type === "error" &&
        !messages.some((d) => d.type === "done" || d.type === "stopped")
    );
    const finished = doneMsg || statusMsg || errorMsg;

    if (finished && !isConnected) {
      setIsRunning(false);

      if (sessionId) {
        // User is watching this chat live — dismiss any notifications for it
        markSessionNotificationsRead(sessionId);

        fetch(`/api/runs?agent_slug=${slug}&limit=50`)
          .then((r) => r.json())
          .then((fetchedRuns: AgentRun[]) => {
            setAllRuns(fetchedRuns);
            window.dispatchEvent(new Event("agent-session-updated"));
          });

        if (!titleGeneratedRef.current.has(sessionId) && currentPrompt) {
          titleGeneratedRef.current.add(sessionId);
          fetch("/api/ai/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, message: currentPrompt }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.title) {
                window.dispatchEvent(
                  new CustomEvent("session-title-ready", {
                    detail: { session_id: sessionId, title: d.title },
                  })
                );
              }
            })
            .catch((err) => console.error("[title] generation failed:", err));
        }
      }

      // Save tool details to run metadata
      const runId = currentRunIdRef.current;
      const toolCalls = messages.filter(
        (m) => m.type === "tool_call" && m.status === "start"
      );
      if (runId && toolCalls.length > 0) {
        const toolNames = toolCalls.map((m) => m.name as string);
        fetch(`/api/runs/${runId}/metadata`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_count: toolCalls.length,
            tools_used: toolNames,
          }),
        }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isConnected]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    async (prompt: string, files?: File[]) => {
      if (!agent) return;

      // Before clearing live state, snapshot previous turns into conversationRuns
      if (sessionId && allRuns.length > 0) {
        const convRuns = allRuns
          .filter((r) => r.session_id === sessionId)
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        setConversationRuns(convRuns);
      }

      // Generate session ID for new conversations so sidebar shows immediately
      const isNewSession = !sessionId;
      const sid = sessionId || crypto.randomUUID();
      if (isNewSession) {
        justSentRef.current = sid;
        setSessionId(sid);
        activeSessionRef.current = sid;
        router.replace(`/agents/${slug}/chat?session=${sid}`, { scroll: false });
        window.dispatchEvent(
          new CustomEvent("agent-session-started", {
            detail: { session_id: sid },
          })
        );

        // Fire-and-forget title generation immediately
        titleGeneratedRef.current.add(sid);
        fetch("/api/ai/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, message: prompt }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.title) {
              window.dispatchEvent(
                new CustomEvent("session-title-ready", {
                  detail: { session_id: sid, title: d.title },
                })
              );
            }
          })
          .catch((err) => console.error("[title] generation failed:", err));
      }

      disconnect();
      reset();
      setIsRunning(true);
      setCurrentPrompt(prompt);

      // 1. Create run record
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_slug: agent.slug,
          agent_name: agent.name,
          prompt,
          session_id: sid,
        }),
      });

      if (!res.ok) {
        setIsRunning(false);
        setCurrentPrompt(null);
        return;
      }

      const run = await res.json();
      currentRunIdRef.current = run.id;

      // 2. Upload attached files if any
      let filePaths: string[] = [];
      if (files && files.length > 0) {
        const form = new FormData();
        form.append("run_id", run.id);
        for (const f of files) form.append("files", f);
        try {
          const uploadRes = await fetch("/api/uploads", {
            method: "POST",
            body: form,
          });
          if (uploadRes.ok) {
            const { files: saved } = await uploadRes.json();
            filePaths = saved.map((f: { path: string }) => f.path);
          }
        } catch {
          // Continue without files if upload fails
        }
      }

      // 3. Start detached execution
      await fetch(`/api/runs/${run.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filePaths.length > 0 ? { files: filePaths } : {}),
      });

      // 4. Observe via SSE
      connect(`/api/runs/${run.id}/stream`);
    },
    [agent, sessionId, allRuns, slug, connect, disconnect, reset, router]
  );

  const handleStop = useCallback(async () => {
    const runId = currentRunIdRef.current;
    if (runId) {
      fetch(`/api/runs/${runId}/stop`, { method: "POST" }).catch(() => {});
    }
    disconnect();
    setIsRunning(false);
  }, [disconnect]);

  const handleApprove = useCallback(
    async (toolUseId: string, approved: boolean) => {
      const runId = currentRunIdRef.current;
      if (!runId) return;

      await fetch(`/api/runs/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_use_id: toolUseId, approved }),
      });
    },
    []
  );

  const agentReady = !!agent;
  const inConversation =
    sessionId !== null ||
    conversationRuns.length > 0 ||
    isRunning ||
    (currentPrompt !== null && messages.length > 0);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] -m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {!agentReady ? (
            <div className="animate-pulse flex items-center gap-2.5">
              <div className="h-5 w-5 rounded bg-[var(--bg-elevated)]" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-40 rounded bg-[var(--bg-elevated)]" />
                <div className="h-3 w-64 rounded bg-[var(--bg-raised)]" />
              </div>
            </div>
          ) : (
            <>
              {agent.emoji && <span className="text-lg">{agent.emoji}</span>}
              <div className="min-w-0">
                <h1 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                  {agent.name}
                </h1>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {agent.description}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <span className="flex items-center gap-1.5 text-[11px] text-green-500/70">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500/70 animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Chat area */}
      <ChatView
        conversationRuns={conversationRuns}
        completedRunEvents={completedRunEvents}
        messages={messages}
        isConnected={isConnected}
        isRunning={isRunning}
        currentPrompt={currentPrompt}
        onApprove={handleApprove}
        loading={sessionLoading}
        suggestions={suggestions}
        onSuggestionClick={(text) => handleSend(text)}
        agentName={agent?.name}
        agentEmoji={agent?.emoji}
      />

      {/* Message bar */}
      <MessageBar
        key={sessionId || "new"}
        onSend={handleSend}
        onStop={handleStop}
        disabled={isRunning || !agentReady}
        isRunning={isRunning && isConnected}
        placeholder={
          !agentReady
            ? "Loading..."
            : inConversation
              ? "Follow up..."
              : `Message ${agent.name}...`
        }
      />
    </div>
  );
}
