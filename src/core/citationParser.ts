import {
  TargetConfig,
  EngineResponse,
  AeoCheckResult,
  EngineName,
  DEFAULT_ENGINE,
} from "./types.js";
import { urlMatchesDomain, dedupeUrls, mentionsBrand } from "./urlMatch.js";

export function parseAeoResponse(
  config: TargetConfig,
  response: EngineResponse,
  engine: EngineName = DEFAULT_ENGINE,
): AeoCheckResult {
  const { targetDomain, query } = config;
  const { citations, answerText } = response;

  const citationIndex = citations.findIndex((url) =>
    urlMatchesDomain(url, targetDomain),
  );

  const citedInLinks = citationIndex !== -1;

  const citedInText = config.brandName
    ? mentionsBrand(answerText, config.brandName)
    : false;

  const cited = citedInLinks || citedInText;
  const position = citedInLinks ? citationIndex : null;

  return {
    query,
    targetDomain,
    engine,
    cited,
    position,
    competitorUrls: dedupeUrls(
      citations.filter((url) => !urlMatchesDomain(url, targetDomain)),
    ),
    timestamp: new Date().toISOString(),
    // A single response is one sample.
    sampleCount: 1,
    citedCount: cited ? 1 : 0,
    citationRate: cited ? 1 : 0,
    positions: position !== null ? [position] : [],
  };
}
