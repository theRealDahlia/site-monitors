import net from "node:net";
import { domainToASCII } from "node:url";

export class CheckError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
  }
}

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * Accepts "example.com", "https://example.com/path", "example.com:443", "Bücher.de" etc.
 * Returns a lowercase ASCII (punycode) hostname. A port is rejected unless it is 443,
 * or ignored entirely when `ignorePort` is set.
 */
export function parseHostname(input: string, { ignorePort = false } = {}): string {
  let value = input.trim().toLowerCase();
  if (!value) throw new CheckError("Enter a domain name, like example.com.");

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split(/[/?#]/)[0];
  if (value.includes("@")) value = value.split("@").pop() ?? "";

  const portMatch = value.match(/:(\d+)$/);
  if (portMatch) {
    if (!ignorePort && portMatch[1] !== "443") {
      throw new CheckError("Only port 443 can be checked.");
    }
    value = value.slice(0, -portMatch[0].length);
  }
  value = value.replace(/\.$/, "");

  if (net.isIP(value) || value.startsWith("[")) {
    throw new CheckError("Enter a domain name, not an IP address.");
  }
  value = domainToASCII(value) || value;
  if (!HOSTNAME_RE.test(value)) {
    throw new CheckError("That doesn't look like a valid domain name.");
  }
  return value;
}
