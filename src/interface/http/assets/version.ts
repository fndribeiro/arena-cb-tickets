import { AUTH_JS, CHECKIN_JS, ORDER_STATUS_JS, SHARE_JS } from "./scripts";
import { APP_CSS } from "./styles";

const FNV_OFFSET = 0x811c9dc5;

const FNV_PRIME = 0x01000193;

/** FNV-1a hash of the bundled CSS/JS: changes on every asset change, so long browser caching is safe. */
function fingerprint(content: string): string {

  let hash: number = FNV_OFFSET;

  for (let index = 0; index < content.length; index += 1) {
    hash = Math.imul(hash ^ content.charCodeAt(index), FNV_PRIME) >>> 0;
  }

  return hash.toString(36);
}

export const ASSET_VERSION: string = fingerprint([APP_CSS, AUTH_JS, ORDER_STATUS_JS, SHARE_JS, CHECKIN_JS].join("\n"));

export function assetUrl(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}
