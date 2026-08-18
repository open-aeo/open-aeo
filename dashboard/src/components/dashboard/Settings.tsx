import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { apiFetch, apiPost, type KeyStatus } from "@/lib/api";
import { engineMeta } from "@/lib/engines";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Provider keys map to the engine that consumes them, so a row can carry the
// engine's brand mark rather than a generic key icon.
const PROVIDERS: {
  provider: keyof KeyStatus;
  engine: string;
  label: string;
  description: string;
}[] = [
  {
    provider: "perplexity",
    engine: "perplexity",
    label: "Perplexity",
    description: "Runs sonar checks against the Perplexity API.",
  },
  {
    provider: "openai",
    engine: "chatgpt",
    label: "OpenAI",
    description: "Powers ChatGPT web-search checks.",
  },
];

function KeyRow({
  provider,
  engine,
  label,
  description,
  isSet,
  onSaved,
}: {
  provider: keyof KeyStatus;
  engine: string;
  label: string;
  description: string;
  isSet: boolean;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { Icon } = engineMeta(engine);

  async function save() {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/keys", { provider, apiKey: value });
      setValue("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
          <div>
            <div className="text-sm font-medium">{label}</div>
            <p className="text-muted-foreground text-xs">{description}</p>
          </div>
        </div>
        <Badge variant={isSet ? "success" : "muted"}>
          {isSet && <Check />}
          {isSet ? "Key set" : "Not set"}
        </Badge>
      </div>

      <div className="flex gap-2">
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isSet ? "Replace key…" : "Paste API key…"}
          autoComplete="off"
        />
        <Button size="sm" className="h-9" onClick={save} disabled={saving || !value}>
          {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Save
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function Settings() {
  const [status, setStatus] = useState<KeyStatus | null>(null);

  function refresh() {
    apiFetch<KeyStatus>("/api/keys").then(setStatus).catch(() => {});
  }

  useEffect(refresh, []);

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground size-3.5" />
              Provider keys
            </CardTitle>
            <p className="text-muted-foreground mt-1.5 text-xs">
              Checks run against your own key, not a shared one. Keys are encrypted at
              rest and never shown again once saved.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {PROVIDERS.map((p, i) => (
            <div key={p.provider}>
              {i > 0 && <Separator />}
              <KeyRow
                provider={p.provider}
                engine={p.engine}
                label={p.label}
                description={p.description}
                isSet={status?.[p.provider] ?? false}
                onSaved={refresh}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
