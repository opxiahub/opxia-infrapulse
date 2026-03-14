import type { AwsClients } from './client-factory.js';
import type { InfraNode } from './types.js';
import { discoverEc2 } from './resources/ec2.js';
import { discoverRds } from './resources/rds.js';
import { discoverS3 } from './resources/s3.js';
import { discoverLambda } from './resources/lambda.js';

export type ResourceType = 'ec2' | 'rds' | 's3' | 'lambda';

export async function discoverResources(
  clients: AwsClients,
  resourceTypes: ResourceType[] = ['ec2', 'rds', 's3', 'lambda']
): Promise<InfraNode[]> {
  const promises: Promise<InfraNode[]>[] = [];

  if (resourceTypes.includes('ec2')) promises.push(discoverEc2(clients.ec2));
  if (resourceTypes.includes('rds')) promises.push(discoverRds(clients.rds));
  if (resourceTypes.includes('s3')) promises.push(discoverS3(clients.s3));
  if (resourceTypes.includes('lambda')) promises.push(discoverLambda(clients.lambda));

  const results = await Promise.allSettled(promises);
  const nodes: InfraNode[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      nodes.push(...result.value);
    }
  }

  return nodes;
}
