export interface CurlValidation {
  valid: boolean;
  formatted?: string;
  error?: string;
}

const DISCORD_API_PATTERN = /https:\/\/discord\.com\/api\/v10\//;

export function validateAndFormatCurl(command: string): CurlValidation {
  // Only Discord API curl commands are checked; everything else passes through.
  if (!command.trim().startsWith("curl")) return { valid: true };
  if (!DISCORD_API_PATTERN.test(command)) return { valid: true };

  const hasAuth = command.includes("Authorization:");
  const hasContentType = command.includes("Content-Type:");

  if (!hasAuth) {
    return {
      valid: false,
      error: "Discord API curl requests must include Authorization header with Bot token",
    };
  }

  const methodMatch = command.match(/-X\s+(GET|POST|PUT|PATCH|DELETE)/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : "GET";

  if (["POST", "PUT", "PATCH"].includes(method)) {
    if (!hasContentType) {
      return {
        valid: false,
        error: `${method} requests to Discord API must include Content-Type: application/json header`,
      };
    }
    const hasJsonBody = /(-d|--data)\s+['"]/.test(command);
    if (!hasJsonBody) {
      return {
        valid: false,
        error: `${method} requests to Discord API must include JSON body with -d flag`,
      };
    }
  }

  return { valid: true };
}
