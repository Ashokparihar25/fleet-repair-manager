"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gauge } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type Usage = {
  day: string;
  used: number;
  remaining: number | null;
  limit_rpd: number | null;
  limit_rpm: number;
  model: string;
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
        model: "gemini-2.5-flash",
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
  const low = remaining != null && remaining <= 30;
  const empty = remaining != null && remaining <= 0;
  const pages = estimatedPages && estimatedPages > 0 ? estimatedPages : null;
  const mayExceed = pages != null && remaining != null && pages > remaining;

  return (
    <Alert variant={empty ? "destructive" : low ? "warning" : "default"}>
      <Gauge className="h-4 w-4" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Gemini OCR quota
        <Badge variant="secondary">{usage.model}</Badge>
        {usage.rate_limit_hits > 0 && <Badge variant="warning">{usage.rate_limit_hits} rate-limit hits today</Badge>}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {usage.limit_rpd == null ? (
            <>
              Used <strong>{usage.used}</strong> requests today ({usage.day} Pacific). No daily cap configured.
            </>
          ) : (
            <>
              Used <strong>{usage.used}</strong> / {usage.limit_rpd} requests today ({usage.day} Pacific) —{" "}
              <strong>{remaining}</strong> left. Resets midnight Pacific.
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Free-tier Flash is commonly ~{usage.limit_rpm} requests/minute and ~{usage.limit_rpd ?? 250}/day (confirm in{" "}
          <a
            className="underline"
            href="https://aistudio.google.com/rate-limit"
            target="_blank"
            rel="noreferrer"
          >
            Google AI Studio → Rate limits
          </a>
          ). Each PDF page uses about 1 API call (retries use more). A 46-page PDF needs ~46+ calls and several minutes.
        </p>
        {mayExceed && (
          <p className="text-sm">
            This upload looks like ~{pages} pages, which may exceed the <strong>{remaining}</strong> requests left today.
            Split the PDF or wait until the daily reset.
          </p>
        )}
        {empty && (
          <p className="text-sm">
            Daily quota exhausted. Wait for midnight Pacific, raise <code>OCR_GEMINI_RPD_LIMIT</code> to match a paid
            tier, or enable billing in Google AI Studio.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
