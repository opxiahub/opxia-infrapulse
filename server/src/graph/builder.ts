import type { InfraNode, InfraEdge, GraphData } from '../aws/types.js';

interface EdgeRule {
  sourceTypes: string[];
  targetTypes: string[];
  match: (source: InfraNode, target: InfraNode) => boolean;
  label: string;
  animated: boolean;
}

const EDGE_RULES: EdgeRule[] = [
  // Subnet belongs to VPC
  { sourceTypes: ['subnet'], targetTypes: ['vpc'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'In VPC', animated: false },

  // EC2 in Subnet
  { sourceTypes: ['ec2'], targetTypes: ['subnet'],
    match: (s, t) => !!s.metadata.subnetId && s.metadata.subnetId === t.metadata.subnetId,
    label: 'In Subnet', animated: false },

  // NAT Gateway in Subnet
  { sourceTypes: ['nat-gateway'], targetTypes: ['subnet'],
    match: (s, t) => !!s.metadata.subnetId && s.metadata.subnetId === t.metadata.subnetId,
    label: 'In Subnet', animated: false },

  // IGW attached to VPC
  { sourceTypes: ['igw'], targetTypes: ['vpc'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'Attached', animated: false },

  // Route Table in VPC
  { sourceTypes: ['route-table'], targetTypes: ['vpc'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'In VPC', animated: false },

  // VPC Endpoint in VPC
  { sourceTypes: ['vpc-endpoint'], targetTypes: ['vpc'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'In VPC', animated: false },

  // NACL in VPC
  { sourceTypes: ['nacl'], targetTypes: ['vpc'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'In VPC', animated: false },

  // EC2 <-> RDS same VPC with shared security groups
  { sourceTypes: ['ec2'], targetTypes: ['rds'],
    match: (s, t) => {
      if (!s.metadata.vpcId || s.metadata.vpcId !== t.metadata.vpcId) return false;
      const ec2Sgs = (s.metadata.securityGroups || []).map((sg: any) => sg.id);
      const rdsSgs = (t.metadata.securityGroups || []).map((sg: any) => sg.id);
      return ec2Sgs.some((id: string) => rdsSgs.includes(id));
    },
    label: 'SG Link', animated: true },

  // EC2 <-> RDS same VPC (fallback)
  { sourceTypes: ['ec2'], targetTypes: ['rds'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'Same VPC', animated: true },

  // Lambda -> S3 via env vars
  { sourceTypes: ['lambda'], targetTypes: ['s3'],
    match: (s, t) => {
      const refs = s.metadata.referencedBuckets || [];
      return refs.some((ref: string) => ref.includes(t.metadata.bucketName));
    },
    label: 'Reads/Writes', animated: true },

  // Lambda -> RDS via env vars
  { sourceTypes: ['lambda'], targetTypes: ['rds'],
    match: (s, t) => {
      const refs = s.metadata.referencedEndpoints || [];
      return !!t.metadata.endpoint && refs.some((ref: string) => ref.includes(t.metadata.endpoint));
    },
    label: 'DB Connection', animated: true },

  // ELB in VPC
  { sourceTypes: ['elb'], targetTypes: ['vpc'],
    match: (s, t) => !!s.metadata.vpcId && s.metadata.vpcId === t.metadata.vpcId,
    label: 'In VPC', animated: false },

  // CloudFront -> S3 origin
  { sourceTypes: ['cloudfront'], targetTypes: ['s3'],
    match: (s, t) => {
      const origins: string[] = s.metadata.origins || [];
      return origins.some(o => o.includes(t.metadata.bucketName));
    },
    label: 'Origin', animated: true },

  // CloudFront -> ELB origin
  { sourceTypes: ['cloudfront'], targetTypes: ['elb'],
    match: (s, t) => {
      const origins: string[] = s.metadata.origins || [];
      return !!t.metadata.dnsName && origins.some(o => o.includes(t.metadata.dnsName));
    },
    label: 'Origin', animated: true },

  // EIP associated to EC2
  { sourceTypes: ['eip'], targetTypes: ['ec2'],
    match: (s, t) => !!s.metadata.instanceId && t.metadata.instanceId === s.metadata.instanceId,
    label: 'Associated', animated: false },
];

export function buildGraph(nodes: InfraNode[]): GraphData {
  const edges: InfraEdge[] = [];
  const edgeSet = new Set<string>();

  // Index nodes by type for faster lookups
  const byType: Record<string, InfraNode[]> = {};
  for (const node of nodes) {
    if (!byType[node.type]) byType[node.type] = [];
    byType[node.type].push(node);
  }

  for (const rule of EDGE_RULES) {
    for (const srcType of rule.sourceTypes) {
      for (const tgtType of rule.targetTypes) {
        const sources = byType[srcType] || [];
        const targets = byType[tgtType] || [];
        for (const source of sources) {
          for (const target of targets) {
            if (source.id === target.id) continue;
            const edgeKey = `${source.id}->${target.id}`;
            const reverseKey = `${target.id}->${source.id}`;
            if (edgeSet.has(edgeKey) || edgeSet.has(reverseKey)) continue;

            if (rule.match(source, target)) {
              edgeSet.add(edgeKey);
              edges.push({
                id: `edge-${source.id}-${target.id}`,
                source: source.id,
                target: target.id,
                label: rule.label,
                animated: rule.animated,
              });
            }
          }
        }
      }
    }
  }

  return { nodes, edges };
}
