import { DescribeLoadBalancersCommand } from '@aws-sdk/client-elastic-load-balancing-v2';
import type { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2';
import type { InfraNode } from '../types.js';

export async function discoverElb(client: ElasticLoadBalancingV2Client): Promise<InfraNode[]> {
  try {
    const res = await client.send(new DescribeLoadBalancersCommand({}));
    return (res.LoadBalancers || []).map(lb => ({
      id: `elb-${lb.LoadBalancerName}`,
      type: 'elb' as const,
      label: lb.LoadBalancerName || 'Unknown LB',
      status: lb.State?.Code || 'unknown',
      isManual: true,
      metadata: { loadBalancerArn: lb.LoadBalancerArn, dnsName: lb.DNSName, type: lb.Type, scheme: lb.Scheme, vpcId: lb.VpcId, az: lb.AvailabilityZones?.map(a => a.ZoneName), subtitle: `${lb.Type} · ${lb.Scheme}` },
    }));
  } catch (e: any) { console.error('ELB discovery error:', e.message); return []; }
}
