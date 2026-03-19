"use client";

import { useCallback, useRef, useState } from "react";

export interface SSEMessage {
  type: string;
  seq?: number;
  [key: string]: unknown;
}

export function useSSE() {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const lastSeqRef = useRef<number>(0);

  const connect = useCallback(async (url: string, afterSeq?: number) => {
    // Close any existing connection
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    // Don't reset messages — caller may have pre-loaded historical events
    if (!afterSeq) {
      setMessages([]);
      lastSeqRef.current = 0;
    } else {
      lastSeqRef.current = afterSeq;
    }
    setIsConnected(true);

    // Append after_seq to URL for mid-run reconnection
    const streamUrl = afterSeq
      ? `${url}${url.includes("?") ? "&" : "?"}after_seq=${afterSeq}`
      : url;

    try {
      const response = await fetch(streamUrl, { signal: controller.signal });
      if (!response.ok || !response.body) {
        setIsConnected(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as SSEMessage;

              // Deduplicate by seq (skip events we've already seen)
              if (data.seq && data.seq <= lastSeqRef.current) continue;
              if (data.seq) lastSeqRef.current = data.seq;

              setMessages((prev) => [...prev, data]);
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("SSE error:", err);
      }
    } finally {
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    controllerRef.current?.abort();
    setIsConnected(false);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    lastSeqRef.current = 0;
  }, []);

  // Load historical events from /api/runs/[id]/events and populate messages.
  // Returns the events AND maxSeq so the caller can decide whether to connect SSE.
  const loadHistory = useCallback(async (runId: string): Promise<{ maxSeq: number; events: SSEMessage[] }> => {
    const res = await fetch(`/api/runs/${runId}/events`);
    if (!res.ok) return { maxSeq: 0, events: [] };

    const rawEvents = (await res.json()) as Record<string, unknown>[];
    if (rawEvents.length === 0) return { maxSeq: 0, events: [] };

    // Convert run_events DB format to SSE message format
    const sseMessages: SSEMessage[] = rawEvents.map((evt) => ({
      type: evt.event_type as string,
      seq: evt.seq as number,
      ...(evt.payload as Record<string, unknown>),
    }));

    setMessages(sseMessages);

    const maxSeq = Math.max(...sseMessages.map((m) => m.seq || 0));
    lastSeqRef.current = maxSeq;
    return { maxSeq, events: sseMessages };
  }, []);

  return { messages, isConnected, connect, disconnect, reset, loadHistory };
}
