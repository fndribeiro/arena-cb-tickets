const TOKEN_BYTES = 16;

export function newId(): string {
  return crypto.randomUUID();
}

/** Unguessable 128-bit token, base64url encoded (used for ticket codes). */
export function randomToken(bytes: number = TOKEN_BYTES): string {

  const buffer: Uint8Array = crypto.getRandomValues(new Uint8Array(bytes));

  const binary: string = String.fromCharCode(...buffer);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
