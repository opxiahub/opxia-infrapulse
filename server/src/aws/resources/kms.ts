import { ListKeysCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import type { KMSClient } from '@aws-sdk/client-kms';
import type { InfraNode } from '../types.js';

export async function discoverKms(client: KMSClient): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListKeysCommand({}));
    const nodes: InfraNode[] = [];
    for (const key of (res.Keys || []).slice(0, 50)) { // limit to avoid rate limiting
      try {
        const desc = await client.send(new DescribeKeyCommand({ KeyId: key.KeyId }));
        const m = desc.KeyMetadata;
        if (!m || m.KeyManager === 'AWS') continue; // skip AWS-managed keys
        nodes.push({
          id: `kms-${m.KeyId}`,
          type: 'kms' as const,
          label: m.Description || m.KeyId || 'Unknown Key',
          status: m.KeyState || 'unknown',
          isManual: m.Origin === 'AWS_KMS', // Customer-managed by default
          metadata: { keyId: m.KeyId, arn: m.Arn, keyUsage: m.KeyUsage, keySpec: m.KeySpec, keyManager: m.KeyManager, subtitle: m.KeyUsage },
        });
      } catch { /* skip keys we can't describe */ }
    }
    return nodes;
  } catch (e: any) { console.error('KMS discovery error:', e.message); return []; }
}
