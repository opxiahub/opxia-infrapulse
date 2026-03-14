import { ListHostedZonesCommand } from '@aws-sdk/client-route-53';
import type { Route53Client } from '@aws-sdk/client-route-53';
import type { InfraNode } from '../types.js';

export async function discoverRoute53(client: Route53Client): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListHostedZonesCommand({}));
    return (res.HostedZones || []).map(z => ({
      id: `r53-${z.Id?.split('/').pop()}`,
      type: 'route53' as const,
      label: z.Name || 'Unknown Zone',
      status: z.Config?.PrivateZone ? 'private' : 'public',
      isManual: true,
      metadata: { hostedZoneId: z.Id, name: z.Name, recordCount: z.ResourceRecordSetCount, isPrivate: z.Config?.PrivateZone, subtitle: z.Config?.PrivateZone ? 'Private Zone' : 'Public Zone' },
    }));
  } catch (e: any) { console.error('Route 53 discovery error:', e.message); return []; }
}
