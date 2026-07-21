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

  return {
    query,
    targetDomain,
    engine,
    cited: citedInLinks || citedInText,
    position: citedInLinks ? citationIndex : null,
    competitorUrls: dedupeUrls(
      citations.filter((url) => !urlMatchesDomain(url, targetDomain)),
    ),
    timestamp: new Date().toISOString(),
  };
}
