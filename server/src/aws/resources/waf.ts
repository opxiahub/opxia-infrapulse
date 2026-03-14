import { ListWebACLsCommand } from '@aws-sdk/client-wafv2';
import type { WAFV2Client } from '@aws-sdk/client-wafv2';
import type { InfraNode } from '../types.js';

export async function discoverWaf(client: WAFV2Client): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListWebACLsCommand({ Scope: 'REGIONAL' }));
    return (res.WebACLs || []).map(acl => ({
      id: `waf-${acl.Id}`,
      type: 'waf' as const,
      label: acl.Name || 'Unknown WAF',
      status: 'active',
      isManual: true,
      metadata: { webAclId: acl.Id, arn: acl.ARN, name: acl.Name, subtitle: 'Regional WAF' },
    }));
  } catch (e: any) { console.error('WAF discovery error:', e.message); return []; }
}
