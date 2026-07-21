import {
  TargetConfig,
  EngineResponse,
  AeoCheckResult,
  EngineName,
  DEFAULT_ENGINE,
} from "./types.js";

export function parseAeoResponse(
  config: TargetConfig,
  response: EngineResponse,
  engine: EngineName = DEFAULT_ENGINE,
): AeoCheckResult {
  const { targetDomain, query } = config;
  const { citations, answerText } = response;

  const citationIndex = citations.findIndex((url) =>
    url.toLowerCase().includes(targetDomain.toLowerCase()),
  );

  const citedInLinks = citationIndex !== -1;

  const citedInText = config.brandName
    ? answerText.toLowerCase().includes(config.brandName.toLowerCase())
    : false;

  return {
    query,
    targetDomain,
    engine,
    cited: citedInLinks || citedInText,
    position: citedInLinks ? citationIndex : null,
    competitorUrls: citations.filter(
      (url) => !url.toLowerCase().includes(targetDomain.toLowerCase()),
    ),
    timestamp: new Date().toISOString(),
  };
}
