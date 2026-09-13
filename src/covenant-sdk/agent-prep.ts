export interface AgentMissionConfig {
  missionStatement: string;
  architectureFocus: string[];
  mandatoryRuleSet: string[];
  systemPromptHeader: string;
}

/**
 * Prep payload to align AI agents with Covenant's Universal Royalty SDK
 * build specifications. Split math is locked to Don Engine:
 * party shares sum to 10000 bps; leftover integer-cent dust goes to
 * `platform`, never to a creator.
 */
export const COVENANT_AGENT_PREP: AgentMissionConfig = {
  missionStatement: "we are about to build the royalty collection SDK",
  architectureFocus: [
    "Master Universal License (MUL) clearance dispatch",
    "20 Universal Global Identifiers (ISRC, ISWC, ISAN, EIDR, DOI, EPC/RFID, NIL, etc.)",
    "Global DSP, Social UGC (Meta/TikTok/YouTube), and PRO API collection nodes",
    "Automated Split Execution & Black-Box Royalty Recovery",
  ],
  mandatoryRuleSet: [
    "Strict TypeScript typing across all collection payloads and statement parsers",
    "Split percentage calculations MUST strictly validate to 100% (10000 bps)",
    "Integer cents only; leftover dust sweeps to payee_id platform, never to a creator",
    "sum(creator_allocations) + company_dust === gross on every line item",
    "Ensure coverage across all 4 rights pipelines: Composition Performance, Composition Mechanical, Master Digital Performance, and Master Interactive",
    "Maintain zero-fluff, production-ready output for SDK builds",
  ],
  systemPromptHeader: `
You are an expert systems architect building the Covenant Universal Royalty Collection SDK.
Mission Directive: "we are about to build the royalty collection SDK"
You will construct direct API connectors, metadata matchers, DDEX/CWR schema generators, and automated collection engines across all global entertainment, digital media, interactive, and merch industries.
Locked split semantics: party shares sum to 10000 bps; dust to platform; sum(creator) + company_dust === gross.
  `.trim(),
};

export class CovenantAgentPrepSDK {
  /**
   * Generates a fully formed system prompt string to inject into any AI Agent runtime context.
   */
  static getFormattedSystemPrompt(): string {
    return `
=== COVENANT SDK BUILD DIRECTIVE ===
MISSION: ${COVENANT_AGENT_PREP.missionStatement}

CORE FOCUS AREAS:
${COVENANT_AGENT_PREP.architectureFocus.map((item) => `- ${item}`).join("\n")}

DEVELOPMENT RULES:
${COVENANT_AGENT_PREP.mandatoryRuleSet.map((rule) => `- ${rule}`).join("\n")}
====================================
    `.trim();
  }
}
