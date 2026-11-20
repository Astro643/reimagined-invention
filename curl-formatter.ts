export interface CurlValidation {
  valid: boolean;
  formatted?: string;
  error?: string;
}

const DISCORD_API_PATTERN = /https:\/\/discord\.com\/api\/v10\//;
const REQUIRED_HEADERS = ["Authorization", "Content-Type"];

export function validateAndFormatCurl(command: string): CurlValidation {
  // Check if this is a curl command
  if (!command.trim().startsWith("curl")) {
    return { valid: true }; // Not a curl command, pass through
  }

  // Check if it's a Discord API call
  if (!DISCORD_API_PATTERN.test(command)) {
    return { valid: true }; // Not Discord API, pass through
  }

  // Validate Discord API curl format
  const hasAuth = command.includes("Authorization:") || command.includes("-H 'Authorization:") || command.includes('-H "Authorization:');
  const hasContentType = command.includes("Content-Type:") || command.includes("-H 'Content-Type:") || command.includes('-H "Content-Type:');

  if (!hasAuth) {
    return {
      valid: false,
      error: "Discord API curl requests must include Authorization header with Bot token",
    };
  }

  // For POST/PUT/PATCH requests, Content-Type is required
  const methodMatch = command.match(/-X\s+(GET|POST|PUT|PATCH|DELETE)/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : "GET";

  if (["POST", "PUT", "PATCH"].includes(method) && !hasContentType) {
    return {
      valid: false,
      error: `${method} requests to Discord API must include Content-Type: application/json header`,
    };
  }

  // Check for proper JSON body format for POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const hasJsonBody = command.includes("-d '") || command.includes('-d "') || command.includes("--data '") || command.includes('--data "');
    if (!hasJsonBody) {
      return {
        valid: false,
        error: `${method} requests to Discord API must include JSON body with -d flag`,
      };
    }
  }

  return { valid: true };
}

export function formatDiscordCurl(command: string): string {
  // If it's already valid, return as-is
  const validation = validateAndFormatCurl(command);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // For now, return the command as-is since it's already valid
  // In the future, we could auto-format headers, add missing ones, etc.
  return command;
}
