import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { CheckError, parseHostname } from "./hostname";

export type SslStatus = "valid" | "expiring" | "expired" | "invalid";

export interface CertInfo {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  sans: string[];
  fingerprint256: string;
}

export interface SslResult {
  host: string;
  ip: string;
  status: SslStatus;
  problems: string[];
  protocol: string | null;
  chainLength: number;
  cert: CertInfo;
  checkedAt: string;
}

const TIMEOUT_MS = 8000;
const EXPIRING_DAYS = 30;

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

export function isPublicAddress(address: string, family: number): boolean {
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return !blocked.check(mapped[1], "ipv4");
    return !blocked.check(address, "ipv6");
  }
  return !blocked.check(address, "ipv4");
}

/** Every address the hostname resolves to, after refusing the lot if any is private or reserved. */
export async function resolvePublicAddresses(host: string) {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new CheckError(`Couldn't find a server for ${host}. Check the spelling.`);
  }
  const publicOnes = addresses.filter((a) => isPublicAddress(a.address, a.family));
  if (publicOnes.length === 0 || publicOnes.length !== addresses.length) {
    throw new CheckError("That domain points to a private or reserved address.");
  }
  return publicOnes;
}

export async function resolvePublicAddress(host: string) {
  return (await resolvePublicAddresses(host))[0];
}

const MAX_ADDRESSES_TRIED = 3;

function connect(host: string, address: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: address,
      port: 443,
      servername: host,
      // Inspect broken certificates instead of failing; we report authorizationError ourselves.
      rejectUnauthorized: false,
      timeout: TIMEOUT_MS,
    });
    socket.once("secureConnect", () => resolve(socket));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new CheckError(`Timed out connecting to ${host} on port 443.`, 504));
    });
    socket.once("error", (err) => {
      socket.destroy();
      reject(new CheckError(`Couldn't open a secure connection: ${err.message}`, 502));
    });
  });
}

function formatName(name: tls.Certificate | undefined): string {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return pick(name?.CN) || pick(name?.O) || "Unknown";
}

const AUTH_ERRORS: Record<string, string> = {
  CERT_HAS_EXPIRED: "The certificate has expired.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "The certificate is self-signed, so browsers won't trust it.",
  SELF_SIGNED_CERT_IN_CHAIN: "The chain contains a self-signed certificate that browsers won't trust.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    "The server isn't sending the intermediate certificate, so the chain is incomplete.",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY:
    "The issuing certificate couldn't be found, so the chain is incomplete or untrusted.",
  CERT_NOT_YET_VALID: "The certificate isn't valid yet.",
  CERT_REVOKED: "The certificate has been revoked.",
};

export async function checkSsl(input: string): Promise<SslResult> {
  const host = parseHostname(input);
  // Big sites resolve to several addresses and one of them can be slow or down, so try a few
  // before giving up. Every address was already checked to be public.
  const addresses = (await resolvePublicAddresses(host)).slice(0, MAX_ADDRESSES_TRIED);
  let socket: tls.TLSSocket | undefined;
  let address = addresses[0].address;
  let lastError: unknown;
  for (const candidate of addresses) {
    try {
      socket = await connect(host, candidate.address);
      address = candidate.address;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!socket) throw lastError;

  try {
    const leaf = socket.getPeerCertificate(true);
    if (!leaf || !leaf.valid_to) {
      throw new CheckError(`${host} didn't present a certificate.`, 502);
    }

    let chainLength = 1;
    for (
      let c = leaf;
      c.issuerCertificate && c.issuerCertificate.fingerprint256 !== c.fingerprint256;
      c = c.issuerCertificate
    ) {
      chainLength += 1;
    }

    const validTo = new Date(leaf.valid_to);
    const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
    const problems: string[] = [];

    // Hostname mismatch is reported separately below, so skip Node's duplicate for it.
    const authCode = socket.authorizationError ? String(socket.authorizationError) : null;
    if (authCode && authCode !== "ERR_TLS_CERT_ALTNAME_INVALID") {
      problems.push(AUTH_ERRORS[authCode] ?? `The certificate failed verification (${authCode}).`);
    }
    if (tls.checkServerIdentity(host, leaf)) {
      problems.push(`The certificate isn't issued for ${host}.`);
    }

    let status: SslStatus = "valid";
    if (daysRemaining < 0) status = "expired";
    else if (problems.length > 0) status = "invalid";
    else if (daysRemaining <= EXPIRING_DAYS) status = "expiring";
    if (status === "expiring") {
      problems.push(`The certificate expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`);
    }

    const sans = (leaf.subjectaltname ?? "")
      .split(", ")
      .filter((s) => s.startsWith("DNS:"))
      .map((s) => s.slice(4));

    return {
      host,
      ip: address,
      status,
      problems,
      protocol: socket.getProtocol(),
      chainLength,
      cert: {
        subject: formatName(leaf.subject),
        issuer: formatName(leaf.issuer),
        validFrom: new Date(leaf.valid_from).toISOString(),
        validTo: validTo.toISOString(),
        daysRemaining,
        sans,
        fingerprint256: leaf.fingerprint256,
      },
      checkedAt: new Date().toISOString(),
    };
  } finally {
    socket.destroy();
  }
}
