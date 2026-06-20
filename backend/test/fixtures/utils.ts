export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const API_ENDPOINT = "https://api.example.com";
