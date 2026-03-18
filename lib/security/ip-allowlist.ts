// ================================================================
// IP Allowlist — Validate IPs against CIDR ranges
// ================================================================
// Enterprise feature: restrict access to specific IP ranges.
// Stored at: orgs/{orgId}/settings/security.ipAllowlist

export interface IpAllowlistConfig {
  enabled: boolean;
  ranges: string[]; // CIDR notation: "192.168.1.0/24", "10.0.0.0/8", or single IP "1.2.3.4"
}

/**
 * Check if an IP address is allowed by the allowlist.
 * Returns true if allowlist is disabled or IP matches any range.
 */
export function isIpAllowed(ip: string, config: IpAllowlistConfig): boolean {
  if (!config.enabled) return true;
  if (config.ranges.length === 0) return true;

  for (const range of config.ranges) {
    if (ipMatchesCidr(ip, range)) return true;
  }

  return false;
}

/**
 * Check if an IP matches a CIDR range (e.g., "192.168.1.0/24").
 * Also supports single IPs without mask (treated as /32).
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  try {
    // Handle IPv4-mapped IPv6 addresses
    const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    const cleanCidr = cidr.startsWith('::ffff:') ? cidr.slice(7) : cidr;

    const [rangeIp, maskBits] = cleanCidr.split('/');
    const mask = maskBits !== undefined ? parseInt(maskBits, 10) : 32;

    if (mask < 0 || mask > 32) return false;

    const ipNum = ipToNumber(cleanIp);
    const rangeNum = ipToNumber(rangeIp);

    if (ipNum === null || rangeNum === null) return false;

    // Create bitmask
    const bitmask = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;

    return (ipNum & bitmask) === (rangeNum & bitmask);
  } catch {
    return false;
  }
}

/**
 * Convert an IPv4 address string to a 32-bit number.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }

  return num >>> 0; // Ensure unsigned
}

/**
 * Validate a CIDR range string.
 * Returns true if the format is valid.
 */
export function isValidCidr(cidr: string): boolean {
  const [ip, maskStr] = cidr.split('/');
  const ipNum = ipToNumber(ip);
  if (ipNum === null) return false;

  if (maskStr !== undefined) {
    const mask = parseInt(maskStr, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) return false;
  }

  return true;
}

/**
 * Format an IP range for display.
 */
export function formatIpRange(cidr: string): string {
  const [ip, mask] = cidr.split('/');
  if (!mask || mask === '32') return ip;
  return `${ip}/${mask}`;
}
