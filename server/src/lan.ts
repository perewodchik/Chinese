import { networkInterfaces } from 'node:os';

/**
 * The address to type into the tablet.
 *
 * Node can list every address it is listening on, but on Windows that is
 * usually five of them — WSL, Hyper-V, VirtualBox and a VPN each add a virtual
 * adapter, and none of those is reachable from an iPad on the Wi-Fi. This
 * ranks them so the one that almost certainly is comes first.
 */

/** Adapters that exist for a virtual machine, a container or a VPN. */
const VIRTUAL = /virtual|vethernet|vmware|hyper-?v|docker|wsl|tailscale|zerotier|loopback|bluetooth/i;

export interface LanAddress {
  name: string;
  address: string;
  score: number;
}

function rank(name: string, address: string): number {
  let score = 0;
  // A home router hands out 192.168.x.x; 10.x is common on larger networks.
  if (address.startsWith('192.168.')) score += 40;
  else if (address.startsWith('10.')) score += 25;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 5;
  if (VIRTUAL.test(name)) score -= 60;
  if (/wi-?fi|wlan|wireless/i.test(name)) score += 12;
  if (/ethernet/i.test(name)) score += 8;
  return score;
}

export function lanAddresses(): LanAddress[] {
  const found: LanAddress[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      found.push({ name, address: a.address, score: rank(name, a.address) });
    }
  }
  return found.sort((a, b) => b.score - a.score);
}

/** What the server prints when it starts. */
export function banner(port: number, host: string): string {
  const lines = ['', `  Hanzi Workshop is running at http://localhost:${port}`];
  const found = host === '127.0.0.1' || host === 'localhost' ? [] : lanAddresses();

  if (!found.length) {
    lines.push('', '  (Only on this machine — no network address to offer a tablet.)');
  } else {
    const [best, ...rest] = found;
    lines.push(
      '  ─────────────────────────────────────────────────────',
      '   On your iPad or phone, open:',
      '',
      `      http://${best.address}:${port}`,
      '',
      `   (${best.name})`,
    );
    if (rest.length) {
      lines.push('', '   If that does not load, try:');
      for (const f of rest.slice(0, 3)) lines.push(`      http://${f.address}:${port}   (${f.name})`);
    }
    lines.push(
      '  ─────────────────────────────────────────────────────',
      '',
      '   Both devices have to be on the same Wi-Fi, and Windows has to be',
      '   letting Node through the firewall — it asks the first time, and if',
      '   that prompt was ever dismissed see the README.',
    );
  }
  lines.push('');
  return lines.join('\n');
}
