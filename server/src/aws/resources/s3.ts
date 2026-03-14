import { ListBucketsCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import type { InfraNode } from '../types.js';

export async function discoverS3(client: S3Client): Promise<InfraNode[]> {
  const nodes: InfraNode[] = [];

  try {
    const response = await client.send(new ListBucketsCommand({}));
    for (const bucket of response.Buckets || []) {
      nodes.push({
        id: `s3-${bucket.Name}`,
        type: 's3',
        label: bucket.Name || 'Unknown Bucket',
        status: 'active',
        isManual: true, // S3 ListBuckets doesn't return tags; default to manual
        metadata: {
          bucketName: bucket.Name,
          creationDate: bucket.CreationDate?.toISOString(),
        },
      });
    }
  } catch (err: any) {
    console.error('S3 discovery error:', err.message);
  }

  return nodes;
}
