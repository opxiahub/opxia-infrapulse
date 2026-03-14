import { ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import type { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import type { InfraNode } from '../types.js';

export async function discoverCloudfront(client: CloudFrontClient): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListDistributionsCommand({}));
    return (res.DistributionList?.Items || []).map(d => {
      const origins = d.Origins?.Items?.map(o => o.DomainName) || [];
      return {
        id: `cf-${d.Id}`,
        type: 'cloudfront' as const,
        label: d.Comment || d.DomainName || 'Unknown CF',
        status: d.Enabled ? 'enabled' : 'disabled',
        isManual: true,
        metadata: { distributionId: d.Id, domainName: d.DomainName, status: d.Status, origins, webAclId: d.WebACLId, subtitle: d.DomainName },
      };
    });
  } catch (e: any) { console.error('CloudFront discovery error:', e.message); return []; }
}
