import type { ComponentType } from "react";
import { Globe } from "lucide-react";
import {
  ClaudeIcon,
  GeminiIcon,
  OpenAIIcon,
  PerplexityIcon,
  type IconProps,
} from "@/components/icons/engines";

export interface EngineMeta {
  key: string;
  label: string;
  Icon: ComponentType<IconProps>;
  /* Series colour for charts keyed by engine. */
  color: string;
}

// Keyed by the EngineName values the core emits (src/core/types.ts). Claude is
// listed so answers attributed to it render with a mark, even though the
// dashboard cannot run it yet.
export const ENGINES: Record<string, EngineMeta> = {
  perplexity: {
    key: "perplexity",
    label: "Perplexity",
    Icon: PerplexityIcon,
    color: "var(--chart-2)",
  },
  chatgpt: {
    key: "chatgpt",
    label: "ChatGPT",
    Icon: OpenAIIcon,
    color: "var(--chart-1)",
  },
  "google-ai-overviews": {
    key: "google-ai-overviews",
    label: "AI Overviews",
    Icon: GeminiIcon,
    color: "var(--chart-4)",
  },
  claude: {
    key: "claude",
    label: "Claude",
    Icon: ClaudeIcon,
    color: "var(--chart-5)",
  },
};

const FALLBACK: EngineMeta = {
  key: "unknown",
  label: "Unknown engine",
  Icon: Globe as ComponentType<IconProps>,
  color: "var(--chart-6)",
};

export function engineMeta(engine: string): EngineMeta {
  return ENGINES[engine] ?? { ...FALLBACK, key: engine, label: engine };
}

export function engineLabel(engine: string): string {
  return engineMeta(engine).label;
}

/** The engines a check can actually be run against from the dashboard. */
export const RUNNABLE_ENGINES = [
  "perplexity",
  "chatgpt",
  "google-ai-overviews",
] as const;
