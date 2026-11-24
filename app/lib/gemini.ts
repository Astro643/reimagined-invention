const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const KEYS = [
  ...(process.env.GEMINI_API_KEYS ?? "").split(","),
  process.env.GEMINI_API_KEY ?? "",
  ...[1, 2, 3, 4].map((n) => process.env[`GEMINI_API_KEY_${n}`] ?? ""),
]
  .map((k) => k.trim())
  .filter(Boolean);

let cursor = 0;

export const MODELS = {
  agent: process.env.MODEL_AGENT ?? "gemini-4-hydrogen",
  decision: process.env.MODEL_DECISION ?? "gemini-decision-1",
  support: process.env.MODEL_SUPPORT ?? "gemini-flash-latest",
} as const;

const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
] as const;

const SUPPORT_FALLBACK = "gemini-flash-lite-latest";

export function keyCount() {
  return KEYS.length;
}

type GeminiError = Error & { status?: number; quota?: boolean };

export const isQuota = (e: unknown) =>
  (e as GeminiError)?.quota === true ||
  (e as GeminiError)?.status === 429 ||
  /RESOURCE_EXHAUSTED|quota|rate/i.test(String((e as Error)?.message ?? ""));

async function callModel(model: string, prompt: string, system?: string, json = false): Promise<string> {
  if (!KEYS.length) throw new Error("GEMINI_API_KEY is not configured");

  const contents = [
    ...(system ? [{ role: "user", parts: [{ text: `System: ${system}` }] }] : []),
    { role: "user", parts: [{ text: prompt }] },
  ];

  let lastError: unknown;
  for (let n = 0; n < KEYS.length; n++) {
    const key = KEYS[(cursor + n) % KEYS.length];
    cursor = (cursor + n + 1) % KEYS.length;
    try {
      const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            ...(json ? { responseMimeType: "application/json" } : {}),
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const error: GeminiError = new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`);
        error.status = res.status;
        error.quota = res.status === 429;
        throw error;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) throw new Error("Gemini returned an empty response");
      return text.trim();
    } catch (error) {
      lastError = error;
      // Quota errors move on to the next key; anything else is fatal for this model.
      if (!isQuota(error)) throw error;
    }
  }
  throw lastError;
}

async function generateWithFallback(
  primaryModel: string,
  prompt: string,
  system?: string,
  json = false,
  isSupport = false,
): Promise<string> {
  const modelsToTry = isSupport
    ? [primaryModel, SUPPORT_FALLBACK]
    : [primaryModel, ...FALLBACK_MODELS];
  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      return await callModel(model, prompt, system, json);
    } catch (error) {
      lastError = error;
      console.error(`Model ${model} failed:`, error);
      // Continue to next model
    }
  }

  throw lastError;
}

export async function generate(model: string, prompt: string, system?: string) {
  return generateWithFallback(model, prompt, system, false, model === MODELS.support);
}

export async function generateJson<T>(model: string, prompt: string, system: string): Promise<T> {
  const text = await generateWithFallback(model, prompt, system, true, model === MODELS.support);
  return JSON.parse(text) as T;
}
