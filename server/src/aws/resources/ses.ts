import { ListEmailIdentitiesCommand } from '@aws-sdk/client-sesv2';
import type { SESv2Client } from '@aws-sdk/client-sesv2';
import type { InfraNode } from '../types.js';

export async function discoverSes(client: SESv2Client): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListEmailIdentitiesCommand({}));
    return (res.EmailIdentities || []).map(e => ({
      id: `ses-${e.IdentityName}`,
      type: 'ses' as const,
      label: e.IdentityName || 'Unknown Identity',
      status: e.SendingEnabled ? 'enabled' : 'disabled',
      isManual: true,
      metadata: { identityName: e.IdentityName, identityType: e.IdentityType, sendingEnabled: e.SendingEnabled, subtitle: e.IdentityType },
    }));
  } catch (e: any) { console.error('SES discovery error:', e.message); return []; }
}
