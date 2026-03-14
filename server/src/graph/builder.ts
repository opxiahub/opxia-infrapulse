import type { InfraNode, InfraEdge, GraphData } from '../aws/types.js';

export function buildGraph(nodes: InfraNode[]): GraphData {
  const edges: InfraEdge[] = [];

  const ec2Nodes = nodes.filter(n => n.type === 'ec2');
  const rdsNodes = nodes.filter(n => n.type === 'rds');
  const s3Nodes = nodes.filter(n => n.type === 's3');
  const lambdaNodes = nodes.filter(n => n.type === 'lambda');

  // EC2 <-> RDS edges: same VPC or shared security groups
  for (const ec2 of ec2Nodes) {
    for (const rds of rdsNodes) {
      if (ec2.metadata.vpcId && ec2.metadata.vpcId === rds.metadata.vpcId) {
        const ec2SgIds = (ec2.metadata.securityGroups || []).map((sg: any) => sg.id);
        const rdsSgIds = (rds.metadata.securityGroups || []).map((sg: any) => sg.id);
        const sharedSg = ec2SgIds.some((id: string) => rdsSgIds.includes(id));

        edges.push({
          id: `edge-${ec2.id}-${rds.id}`,
          source: ec2.id,
          target: rds.id,
          label: sharedSg ? 'SG Link' : 'Same VPC',
          animated: true,
        });
      }
    }
  }

  // Lambda -> S3 edges: env var references
  for (const lambda of lambdaNodes) {
    const bucketRefs = lambda.metadata.referencedBuckets || [];
    for (const s3 of s3Nodes) {
      const bucketName = s3.metadata.bucketName;
      if (bucketRefs.some((ref: string) => ref.includes(bucketName))) {
        edges.push({
          id: `edge-${lambda.id}-${s3.id}`,
          source: lambda.id,
          target: s3.id,
          label: 'Reads/Writes',
          animated: true,
        });
      }
    }
  }

  // Lambda -> RDS edges: env var endpoint references
  for (const lambda of lambdaNodes) {
    const endpointRefs = lambda.metadata.referencedEndpoints || [];
    for (const rds of rdsNodes) {
      const endpoint = rds.metadata.endpoint;
      if (endpoint && endpointRefs.some((ref: string) => ref.includes(endpoint))) {
        edges.push({
          id: `edge-${lambda.id}-${rds.id}`,
          source: lambda.id,
          target: rds.id,
          label: 'DB Connection',
          animated: true,
        });
      }
    }
  }

  // Lambda in same VPC as EC2
  for (const lambda of lambdaNodes) {
    if (!lambda.metadata.vpcId) continue;
    for (const ec2 of ec2Nodes) {
      if (ec2.metadata.vpcId === lambda.metadata.vpcId) {
        edges.push({
          id: `edge-${lambda.id}-${ec2.id}`,
          source: lambda.id,
          target: ec2.id,
          label: 'Same VPC',
          animated: false,
        });
      }
    }
  }

  return { nodes, edges };
}
