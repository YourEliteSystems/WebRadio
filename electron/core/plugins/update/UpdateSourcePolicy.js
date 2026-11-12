"use strict";

/**
 * UpdateSourcePolicy
 *
 * Zentrale URL- und Hostprüfung für Plugin-Update-Quellen. Die Policy ist
 * bewusst streng und unabhängig von Electron, damit sie in Tests und im
 * Main-Prozess identisch arbeitet.
 *
 * Regeln:
 *  - ausschließlich HTTPS
 *  - keine Zugangsdaten in der URL
 *  - kein Wildcard-/Unterstrich-Host
 *  - keine IP-Literale, kein localhost, keine privaten/link-lokalen Netze
 *  - Port nur 443
 *  - Hostnamen werden zusätzlich per DNS aufgelöst und ALLE Adressen geprüft
 *    (Schutz vor DNS-Rebinding auf interne Ziele)
 */

const dns = require("dns");
const net = require("net");

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "0.0.0.0"
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".home.arpa"];

function ipv4ToNumber(address) {
  return address.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIPv4(address) {
  const value = ipv4ToNumber(address);
  const inRange = (base, bits) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToNumber(base) & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.0.0.0", 24) ||
    inRange("192.0.2.0", 24) ||
    inRange("192.168.0.0", 16) ||
    inRange("198.18.0.0", 15) ||
    inRange("198.51.100.0", 24) ||
    inRange("203.0.113.0", 24) ||
    inRange("224.0.0.0", 4) ||
    inRange("240.0.0.0", 4)
  );
}

function isPrivateIPv6(address) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true; // fe80::/10
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return net.isIPv4(mapped) ? isPrivateIPv4(mapped) : true;
  }
  return false;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) return isPrivateIPv4(address);
  if (net.isIPv6(address)) return isPrivateIPv6(address);
  return true;
}

function result(ok, code, message, extra = {}) {
  return { ok, code: ok ? null : code, message: ok ? null : message, ...extra };
}

/**
 * Prüft eine URL rein syntaktisch (ohne DNS).
 *
 * @param {string} url
 * @param {{allowInsecure?:boolean, allowedProtocols?:string[]}} [options]
 */
function validateUrl(url, options = {}) {
  const allowInsecure = options.allowInsecure === true;
  if (typeof url !== "string" || url.length === 0 || url.length > 2048) {
    return result(false, "invalid_url", "URL ist leer oder zu lang.");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return result(false, "invalid_url", "URL ist nicht parsbar.");
  }

  const protocols = allowInsecure ? ["https:", "http:"] : ["https:"];
  if (!protocols.includes(parsed.protocol)) {
    return result(false, "insecure_protocol", "Nur HTTPS ist als Update-Quelle erlaubt.");
  }
  if (parsed.username || parsed.password) {
    return result(false, "credentials_in_url", "URLs mit Zugangsdaten sind nicht erlaubt.");
  }
  if (parsed.hash) {
    return result(false, "fragment_in_url", "URLs mit Fragment sind nicht erlaubt.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname.length > 253) {
    return result(false, "invalid_host", "Hostname ist ungültig.");
  }
  if (hostname.includes("*") || hostname.includes("_")) {
    return result(false, "invalid_host", "Wildcard- und Unterstrich-Hosts sind nicht erlaubt.");
  }
  // `allowInsecure` ist ausschließlich für Tests gedacht (lokaler HTTP-Server).
  // Im Produktivpfad wird die Option nie gesetzt.
  const loopbackAllowed = allowInsecure && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1");
  if (!loopbackAllowed && (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix)))) {
    return result(false, "blocked_host", "Lokale oder interne Hosts sind nicht erlaubt.");
  }
  if (net.isIP(hostname) && !loopbackAllowed) {
    return result(false, "ip_literal", "IP-Adressen sind als Update-Quelle nicht erlaubt.");
  }

  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  // Im Testpfad (`allowInsecure`) sind beliebige Ports nötig, weil der lokale
  // HTTP-Server einen freien Port belegt. Produktiv ist ausschließlich 443
  // erlaubt.
  if (!allowInsecure && port !== "443") {
    return result(false, "invalid_port", "Nur Port 443 ist erlaubt.");
  }

  return result(true, null, null, { url: parsed, hostname, port });
}

/**
 * Löst den Hostnamen auf und prüft jede Adresse gegen private Netze.
 * @param {string} hostname
 * @param {{lookup?:Function}} [options]
 */
async function assertPublicHost(hostname, options = {}) {
  const lookup = options.lookup || dns.promises.lookup;
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return result(false, "dns_failed", "Hostname konnte nicht aufgelöst werden.");
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return result(false, "dns_failed", "Hostname lieferte keine Adresse.");
  }
  for (const entry of addresses) {
    const address = typeof entry === "string" ? entry : entry?.address;
    if (!address || isPrivateAddress(address)) {
      return result(false, "private_address", "Hostname verweist auf ein internes Netz.");
    }
  }
  return result(true);
}

/**
 * Vollständige Prüfung inkl. DNS.
 */
async function validateSource(url, options = {}) {
  const syntax = validateUrl(url, options);
  if (!syntax.ok) return syntax;
  if (options.allowInsecure === true) return syntax;
  const dnsCheck = await assertPublicHost(syntax.hostname, options);
  if (!dnsCheck.ok) return dnsCheck;
  return syntax;
}

module.exports = {
  validateUrl,
  assertPublicHost,
  validateSource,
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6
};
