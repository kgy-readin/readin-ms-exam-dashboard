export const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || "";
export const GAS_WEBAPP_URL = import.meta.env.VITE_GAS_WEBAPP_URL || "";
export const APP_VERSION = "Logos 3.2.0";

export const PUBLIC_SALT = "readin_public_secure_salt_2026_q2v3";
export const ADMIN_SALT = "readin_admin_secure_salt_2026_x8r1";

export async function generateHash(name: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(name + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex.substring(0, 16);
}

