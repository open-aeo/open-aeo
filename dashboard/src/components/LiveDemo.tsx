import { useEffect, useRef, useState } from "react";

type EngineId = "perplexity" | "chatgpt";

interface Source {
  domain: string;
  title: string;
  you?: boolean;
}

interface Scenario {
  id: string;
  query: string;
  domain: string;
  brand: string;
  engines: Record<
    EngineId,
    {
      samples: { cited: boolean; answer: string; sourceCount: number }[];
      sources: Source[];
    }
  >;
  gap: { domain: string; citedIn: string; note: string }[];
}

const SCENARIOS = [
  {
    id: "aeo",
    query: "best open source AEO monitoring tool",
    domain: "open-aeo.dev",
    brand: "open-aeo",
    engines: {
      perplexity: {
        samples: [
          {
            cited: true,
            sourceCount: 6,
            answer:
              "open-aeo is the most commonly recommended open source option, because it runs as an MCP server, so citation checks happen inside Claude rather than a separate dashboard.",
          },
          {
            cited: true,
            sourceCount: 5,
            answer:
              "For self-hosted answer engine tracking, open-aeo covers Perplexity and ChatGPT checks at roughly cents per report.",
          },
          {
            cited: false,
            sourceCount: 7,
            answer:
              "Most teams start with Profound or Conductor, though both are priced for enterprise buyers.",
          },
        ],
        sources: [
          { domain: "open-aeo.dev", title: "open-aeo, AEO citation monitor", you: true },
          { domain: "github.com", title: "open-aeo/open-aeo" },
          { domain: "tryprofound.com", title: "AI visibility platform" },
          { domain: "reddit.com", title: "r/SEO, tracking LLM citations" },
        ],
      },
      chatgpt: {
        samples: [
          {
            cited: true,
            sourceCount: 4,
            answer:
              "open-aeo is an open source MCP server for AEO monitoring, which makes it a good fit if you already work in Claude Code.",
          },
          {
            cited: false,
            sourceCount: 5,
            answer:
              "Answer engine optimization tooling is still young; most options are commercial SaaS with per-seat pricing.",
          },
          {
            cited: true,
            sourceCount: 6,
            answer:
              "Self-hosted alternatives such as open-aeo let you keep query data on your own infrastructure.",
          },
        ],
        sources: [
          { domain: "open-aeo.dev", title: "open-aeo documentation", you: true },
          { domain: "github.com", title: "Awesome MCP servers" },
          { domain: "searchengineland.com", title: "What is answer engine optimization?" },
        ],
      },
    },
    gap: [
      {
        domain: "tryprofound.com",
        citedIn: "8 of 10 queries",
        note: "Wins on comparison pages you have no equivalent for",
      },
      {
        domain: "searchengineland.com",
        citedIn: "6 of 10 queries",
        note: "Owns the definitional 'what is AEO' answer",
      },
    ],
  },
  {
    id: "pm",
    query: "best project management tool for software teams",
    domain: "linear.app",
    brand: "Linear",
    engines: {
      perplexity: {
        samples: [
          {
            cited: true,
            sourceCount: 8,
            answer:
              "Linear is repeatedly named for software teams that want speed and keyboard-first workflows, alongside Jira for larger orgs.",
          },
          {
            cited: false,
            sourceCount: 7,
            answer:
              "Jira remains the default for engineering organisations that need deep workflow customisation and reporting.",
          },
          {
            cited: true,
            sourceCount: 6,
            answer:
              "For smaller product teams, Linear and Shortcut are the two most frequently recommended alternatives to Jira.",
          },
        ],
        sources: [
          { domain: "linear.app", title: "Linear, plan and build products", you: true },
          { domain: "atlassian.com", title: "Jira Software" },
          { domain: "g2.com", title: "Best project management software 2026" },
          { domain: "reddit.com", title: "r/ExperiencedDevs, Jira vs Linear" },
        ],
      },
      chatgpt: {
        samples: [
          {
            cited: false,
            sourceCount: 5,
            answer:
              "Jira, Asana and Monday.com dominate most 'best project management tool' roundups.",
          },
          {
            cited: true,
            sourceCount: 6,
            answer:
              "Engineering-led teams often prefer Linear for its issue tracking speed and Git integrations.",
          },
          {
            cited: false,
            sourceCount: 4,
            answer:
              "The right answer depends on team size; enterprise buyers usually land on Jira or Azure DevOps.",
          },
        ],
        sources: [
          { domain: "linear.app", title: "Linear changelog", you: true },
          { domain: "atlassian.com", title: "Jira vs alternatives" },
          { domain: "g2.com", title: "Project management category" },
        ],
      },
    },
    gap: [
      {
        domain: "g2.com",
        citedIn: "9 of 10 queries",
        note: "Review roundups are cited before any vendor page",
      },
      {
        domain: "reddit.com",
        citedIn: "7 of 10 queries",
        note: "Practitioner threads outrank your own comparison content",
      },
    ],
  },
] satisfies Scenario[];

const DEFAULT_SCENARIO = SCENARIOS[0] as Scenario;

const ENGINE_META: Record<EngineId, { label: string; sub: string }> = {
  perplexity: { label: "Perplexity", sub: "sonar" },
  chatgpt: { label: "ChatGPT", sub: "gpt-4o-search" },
};

interface LogLine {
  text: string;
  tone?: "muted" | "ok" | "miss";
}

interface EngineResult {
  engine: EngineId;
  cited: number;
  total: number;
  sources: Source[];
}

const STEP_MS = 420;

export function LiveDemo() {
  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIO.id);
  const [engines, setEngines] = useState<EngineId[]>(["perplexity", "chatgpt"]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [results, setResults] = useState<EngineResult[]>([]);
  const [finished, setFinished] = useState(false);
  const timers = useRef<number[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  const scenario: Scenario =
    SCENARIOS.find((s) => s.id === scenarioId) ?? DEFAULT_SCENARIO;

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  useEffect(() => clearTimers, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log]);

  function run() {
    clearTimers();
    setRunning(true);
    setFinished(false);
    setLog([]);
    setResults([]);

    const active = engines.length > 0 ? engines : (["perplexity"] as EngineId[]);
    let step = 0;
    const at = (fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ++step * STEP_MS));
    };

    at(() =>
      setLog((l) => [
        ...l,
        { text: `aeo_check — "${scenario.query}"`, tone: "muted" },
        { text: `target ${scenario.domain} · ${active.length} engine${active.length === 1 ? "" : "s"} · 3 samples`, tone: "muted" },
      ]),
    );

    active.forEach((engine) => {
      const data = scenario.engines[engine];
      at(() =>
        setLog((l) => [...l, { text: `→ ${ENGINE_META[engine].label}: running query…` }]),
      );
      data.samples.forEach((sample, i) => {
        at(() =>
          setLog((l) => [
            ...l,
            {
              text: `   sample ${i + 1}/3 — ${sample.cited ? "cited" : "not cited"} — ${sample.sourceCount} sources`,
              tone: sample.cited ? "ok" : "miss",
            },
            { text: `     "${sample.answer}"`, tone: "muted" },
          ]),
        );
      });
      at(() => {
        const cited = data.samples.filter((s) => s.cited).length;
        setLog((l) => [
          ...l,
          { text: `✓ ${ENGINE_META[engine].label}: done — ${cited}/3 cited`, tone: "ok" },
        ]);
        setResults((r) => [
          ...r,
          { engine, cited, total: data.samples.length, sources: data.sources },
        ]);
      });
    });

    at(() => {
      setLog((l) => [...l, { text: "aeo_gap_report — competitors cited where you are not", tone: "muted" }]);
      setRunning(false);
      setFinished(true);
    });
  }

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !autoStarted.current) {
          autoStarted.current = true;
          run();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleEngine(engine: EngineId) {
    if (running) return;
    setEngines((prev) =>
      prev.includes(engine) ? prev.filter((e) => e !== engine) : [...prev, engine],
    );
  }

  function pickScenario(id: string) {
    if (running) return;
    setScenarioId(id);
    clearTimers();
    setLog([]);
    setResults([]);
    setFinished(false);
  }

  const totalCited = results.reduce((sum, r) => sum + r.cited, 0);
  const totalSamples = results.reduce((sum, r) => sum + r.total, 0);
  const citedRate = totalSamples > 0 ? Math.round((totalCited / totalSamples) * 100) : 0;

  return (
    <div ref={rootRef} className="demo">
      <div className="demo-chrome">
        <div className="demo-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
        <span className="demo-title">open-aeo · run check</span>
        <span className="demo-badge">Interactive demo · sample data</span>
      </div>

      <div className="demo-body">
        <div className="demo-panel">
          <div className="demo-field">
            <span className="demo-label">Query</span>
            <div className="demo-select-group">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickScenario(s.id)}
                  className={`demo-option${s.id === scenarioId ? " is-active" : ""}`}
                  disabled={running}
                >
                  {s.query}
                </button>
              ))}
            </div>
          </div>

          <div className="demo-field">
            <span className="demo-label">Your domain</span>
            <div className="demo-input">{scenario.domain}</div>
          </div>

          <div className="demo-field">
            <span className="demo-label">Engines</span>
            <div className="demo-engines">
              {(Object.keys(ENGINE_META) as EngineId[]).map((engine) => (
                <button
                  key={engine}
                  type="button"
                  onClick={() => toggleEngine(engine)}
                  className={`demo-engine${engines.includes(engine) ? " is-on" : ""}`}
                  disabled={running}
                >
                  <span className="demo-check" aria-hidden="true" />
                  <span>{ENGINE_META[engine].label}</span>
                  <span className="demo-engine-sub">{ENGINE_META[engine].sub}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="demo-run" onClick={run} disabled={running}>
            {running ? "Running…" : finished ? "Run again" : "Run check"}
          </button>

          {finished && (
            <div className="demo-score">
              <span className="demo-score-value">{citedRate}%</span>
              <span className="demo-score-label">
                citation rate across {totalSamples} answers
              </span>
            </div>
          )}
        </div>

        <div className="demo-output">
          <div className="demo-log" role="log" aria-live="polite">
            {log.length === 0 && (
              <p className="demo-log-empty">Press Run check to watch a citation check stream.</p>
            )}
            {log.map((line, i) => (
              <p key={i} className={`demo-log-line${line.tone ? ` is-${line.tone}` : ""}`}>
                {line.text}
              </p>
            ))}
            <div ref={logEndRef} />
          </div>

          {results.length > 0 && (
            <div className="demo-results">
              {results.map((r) => (
                <div key={r.engine} className="demo-result">
                  <div className="demo-result-head">
                    <span className="demo-result-engine">{ENGINE_META[r.engine].label}</span>
                    <span
                      className={`demo-pill${r.cited > 0 ? " is-ok" : " is-miss"}`}
                    >
                      {r.cited}/{r.total} cited
                    </span>
                  </div>
                  <ul className="demo-sources">
                    {r.sources.map((s) => (
                      <li key={s.domain} className={s.you ? "is-you" : undefined}>
                        <span className="demo-source-domain">{s.domain}</span>
                        <span className="demo-source-title">{s.title}</span>
                        {s.you && <span className="demo-you">you</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {finished && (
            <div className="demo-gap">
              <span className="demo-gap-title">Citation gaps</span>
              {scenario.gap.map((g) => (
                <div key={g.domain} className="demo-gap-row">
                  <span className="demo-gap-domain">{g.domain}</span>
                  <span className="demo-gap-cited">{g.citedIn}</span>
                  <span className="demo-gap-note">{g.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
