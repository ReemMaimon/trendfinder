import { getAIProvider, extractJson } from "@/services/openai/OpenAIService";
import { researchCandidateSchema, type ResearchCandidate } from "@/services/types";
import {
  trendResearchSystemPrompt,
  trendCandidatePrompt,
  type PreviousProductContext,
} from "@/config/prompts";
import type { Settings } from "@/config/defaults";
import { logger } from "@/lib/logger";

export interface ResearchAttemptResult {
  candidate: ResearchCandidate | null;
  parseError: string | null;
  webSources: { url: string; title?: string }[];
  rawText: string;
}

export const TrendResearchService = {
  /**
   * Ask the AI for ONE emerging trend + matching AliExpress product.
   * TREND FIRST, PRODUCT SECOND is enforced by the prompt; here we just run the
   * call and validate the structure.
   */
  async researchOne(params: {
    settings: Settings;
    targetDate: string;
    previous: PreviousProductContext[];
    attemptsRemaining: number;
    alreadyAcceptedCategories: string[];
    avoidTrendTitles: string[];
    runId?: string;
  }): Promise<ResearchAttemptResult> {
    const ai = await getAIProvider();
    const system = trendResearchSystemPrompt(params.settings);
    const user = trendCandidatePrompt(params);

    const res = await ai.generate({
      system,
      user,
      webSearch: true,
      operation: "trend.research.candidate",
      runId: params.runId,
      maxOutputTokens: 5000,
    });

    try {
      const json = extractJson(res.text);
      const candidate = researchCandidateSchema.parse(json);
      return {
        candidate,
        parseError: null,
        webSources: res.webSources,
        rawText: res.text,
      };
    } catch (err) {
      logger.warn({ err, sample: res.text.slice(0, 400) }, "research candidate failed validation");
      return {
        candidate: null,
        parseError: err instanceof Error ? err.message : String(err),
        webSources: res.webSources,
        rawText: res.text,
      };
    }
  },
};
