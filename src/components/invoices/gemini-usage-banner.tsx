"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gauge } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type ModelUsage = {
  model: string;
  used: number;
  remaining: number | null;
  limit_rpd: number | null;
  exhausted: boolean;
};

type Usage = {
  day: string;
  used: number;
  remaining: number | null;
  limit_rpd: number | null;
  limit_rpm: number;
  model: string;
  models: ModelUsage[];
  pages_per_request: number;
  pages_remaining: number | null;
  rate_limit_hits: number;
  configured: boolean;
  note: string;
  error?: string;
};

export function GeminiUsageBanner({ estimatedPages }: { estimatedPages?: number | null }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/ocr/usage", { cache: "no-store" });
      const json = (await res.json()) as Usage;
      if (!res.ok) throw new Error(json.error || "Failed to load usage");
      setUsage(json);
    } catch (e) {
      setUsage({
        day: "",
        used: 0,
        remaining: null,
        limit_rpd: null,
        limit_rpm: 10,
        model: "gemini-3.7-flash",
        models: [],
        pages_per_request: 10,
        pages_remaining: null,
        rate_limit_hits: 0,
        configured: false,
        note: "",
        error: e instanceof Error ? e.message : "Failed to load usage",
      });
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, []);

  if (!usage) {
    return (
      <Alert>
        <Gauge className="h-4 w-4" />
        <AlertTitle>Gemini OCR quota</AlertTitle>
        <AlertDescription>Checking today’s usage…</AlertDescription>
      </Alert>
    );
  }

  if (usage.error) {
    return (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Gemini OCR quota</AlertTitle>
        <AlertDescription>{usage.error}</AlertDescription>
      </Alert>
    );
  }

  if (!usage.configured) {
    return (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Gemini OCR not configured</AlertTitle>
        <AlertDescription>Set GEMINI_API_KEY in Vercel env vars to enable automatic extraction.</AlertDescription>
      </Alert>
    );
  }

  const remaining = usage.remaining;
  const pagesLeft = usage.pages_remaining;
  const low = pagesLeft != null && pagesLeft <= 20;
  const empty = remaining != null && remaining <= 0;
  const pages = estimatedPages && estimatedPages > 0 ? estimatedPages : null;
  const mayExceed = pages != null && pagesLeft != null && pages > pagesLeft;

  return (
    <Alert variant={empty ? "destructive" : low ? "warning" : "default"}>
      <Gauge className="h-4 w-4" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Gemini OCR quota
        {usage.models.map((m) => (
          <Badge key={m.model} variant={m.exhausted ? "warning" : "secondary"}>
            {m.model}: {m.remaining ?? "∞"} left
          </Badge>
        ))}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {remaining == null ? (
            <>
              Used <strong>{usage.used}</strong> requests today ({usage.day} Pacific). No daily cap configured.
            </>
          ) : (
            <>
              About <strong>{pagesLeft}</strong> invoice pages left today ({usage.day} Pacific) —{" "}
              {remaining} of {usage.limit_rpd} requests remaining, at up to {usage.pages_per_request} pages per request.
              Quotas reset at midnight Pacific.
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Free-tier limits are per model ({usage.limit_rpm} requests/minute, {usage.models[0]?.limit_rpd ?? 20}
          /day each), so OCR automatically falls back to the next model when one runs out. Check exact numbers in{" "}
          <a className="underline" href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer">
            Google AI Studio → Rate limits
          </a>
          .
        </p>
        {mayExceed && (
          <p className="text-sm">
            This upload looks like ~{pages} pages, more than the ~{pagesLeft} pages left today. Pages beyond the quota
            will need a re-run after the reset.
          </p>
        )}
        {empty && (
          <p className="text-sm">
            Daily quota is used up on every configured model. Wait for midnight Pacific, add models to{" "}
            <code>OCR_GEMINI_MODELS</code>, or enable billing in Google AI Studio.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
