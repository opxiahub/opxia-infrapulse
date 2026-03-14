import { ListSecretsCommand } from '@aws-sdk/client-secrets-manager';
import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { InfraNode } from '../types.js';

export async function discoverSecretsManager(client: SecretsManagerClient): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListSecretsCommand({}));
    return (res.SecretList || []).map(s => {
      const tags = s.Tags || [];
      const hasManagedTag = tags.some(t =>
        t.Key?.toLowerCase().includes('terraform') ||
        t.Key?.toLowerCase().includes('cloudformation') ||
        t.Key?.toLowerCase() === 'aws:cloudformation:stack-name'
      );
      return {
        id: `secret-${s.Name}`,
        type: 'secrets-manager' as const,
        label: s.Name || 'Unknown Secret',
        status: s.DeletedDate ? 'deleted' : 'active',
        isManual: !hasManagedTag,
        metadata: { name: s.Name, arn: s.ARN, lastRotated: s.LastRotatedDate?.toISOString(), subtitle: s.Description || s.Name },
      };
    });
  } catch (e: any) { console.error('Secrets Manager discovery error:', e.message); return []; }
}
