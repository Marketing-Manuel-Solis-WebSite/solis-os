import 'server-only';
// ================================================================
// URL Validator — SSRF prevention for webhook/external URLs
// ================================================================
// Validates that URLs point to public internet hosts, blocking
// private/reserved IP ranges, cloud metadata endpoints, and
// non-HTTPS protocols in production.

/**
 * Check if an IPv4 address is in a private/reserved range.
 */
function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true; // invalid = block

  const [a, b] = parts;

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;
  // Private: 10.0.0.0/8
  if (a === 10) return true;
  // Private: 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // Private: 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // Link-local: 169.254.0.0/16 (includes cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // Current network: 0.0.0.0/8
  if (a === 0) return true;
  // Alibaba cloud metadata
  if (ip === '100.100.100.200') return true;

  return false;
}

/**
 * Validate a webhook URL to prevent SSRF attacks.
 * Blocks private IPs, metadata endpoints, and non-HTTPS in production.
 */
export async function validateWebhookUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsed = new URL(url);

    // Block non-HTTP(S) schemes
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP(S) URLs are allowed' };
    }

    // Require HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed in production' };
    }

    // Check if hostname is a direct IP
    const hostname = parsed.hostname;
    const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

    if (ipv4Pattern.test(hostname)) {
      if (isPrivateIp(hostname)) {
        return { valid: false, error: 'Private/internal IP addresses are not allowed' };
      }
    } else if (hostname === 'localhost' || hostname === '[::1]') {
      return { valid: false, error: 'Localhost is not allowed' };
    } else {
      // Resolve hostname and check all resulting IPs
      try {
        const dns = await import('dns/promises');
        const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
        for (const addr of addresses) {
          if (isPrivateIp(addr)) {
            return { valid: false, error: `Hostname resolves to private IP (${addr})` };
          }
        }
      } catch {
        // DNS resolution failed — allow (might be a valid hostname not resolvable from this env)
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
