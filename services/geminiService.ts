import { GoogleGenAI } from "@google/genai";
import { ReportData } from "../types";

const GEMINI_API_KEY = process.env.API_KEY;

export const generateWhatsAppReport = async (data: ReportData): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error("API Key not found.");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // STRICT PROMPT matching user's exact template requirements
  // NO EMOJIS ALLOWED
  const prompt = `
    You are a Facility Operations Manager. Generate a daily status report for WhatsApp based on the JSON data provided.
    
    **CRITICAL INSTRUCTIONS:**
    1. **NO Markdown Code Blocks**: Do not output \`\`\`json or \`\`\`. Output raw text only.
    2. **NO EMOJIS**: Do not use any emojis in the output.
    3. **STRICT BOLDING**: Follow the bolding pattern in the template exactly (Label bold, value plain).
    4. **ALERTS PRINTING**: The 'systemAlerts' array in the data is already sorted by priority (CRITICAL > ALERT > ATTENTION). **Print these strings exactly as they are at the very top of the message.** Do not reorder or summarize them.
    
    **TEMPLATE STRUCTURE TO FOLLOW:**

    Safety Status Report - ${dateStr}
    [PRINT ALL STRINGS FROM systemAlerts ARRAY HERE, EACH ON A NEW LINE]
    [EMPTY LINE]
    *   *Guard [Name]*: Patrol from [Start] to [End].
    *   *Fire Engines*: [If all 'isUp' are true: "All OK" | Else: "Engine X: Down"]. [Remarks if any].
    *   *Water Tanks*: TK13 Level: [Value] m, TK29 Level: [Value] m.
    *   *Pumps & Lines*: Hydrant Pressure: [Value] kg/m², Jockey Pump Runtime: [Value] mins.
    *   *Leakages*: [If none: "No Leakage Observed" | Else list specifics e.g., "Air Line Leak at [Loc]", "Product Leak (Type) at [Loc]"].
    *   *Power*: 33KV: [ON/OFF].
        [IF 33KV OFF, LIST USED GENERATORS]:
        *   [Gen Name]: [Start] - [End]
        *   Changeover [done/not done].
        [ALWAYS INCLUDE PIPELINE & RAKE INFO HERE UNDER POWER OR IMMEDIATELY AFTER]:
        *   *Product receipt thru PipeLine:* [Going on/Stopped]. [If Going on: Tank [No] ([Product])].
        *   *Rake:* Placed: [Yes/No][If Yes: " (at [Time])"], Unloading: [Status], Removed: [Yes/No][If Yes: " ([Time])"].
    *   *AC & Lighting:* [ON/OFF].
    *   *CCTV:* [If allCctvRunning: "All 71 Running" | Else: "[Count] down ([Remarks])"].
    *   *C-BACS:* [If cbacsRunning: "Running" | Else: "Faulty ([Remarks])"].
    *   *Watch Tower:* [Observation].
    *   *Night Vision:* [Observation].

    **DATA INPUT:**
    ${JSON.stringify(data, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text || "Error generating report text.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate report. Please check API key.";
  }
};