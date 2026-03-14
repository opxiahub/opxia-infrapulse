import { EC2Client } from '@aws-sdk/client-ec2';
import { RDSClient } from '@aws-sdk/client-rds';
import { S3Client } from '@aws-sdk/client-s3';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import type { AwsCredentials } from '../providers/types.js';

export interface AwsClients {
  ec2: EC2Client;
  rds: RDSClient;
  s3: S3Client;
  lambda: LambdaClient;
  cloudwatch: CloudWatchClient;
}

const clientCache = new Map<string, AwsClients>();

export function getAwsClients(providerId: number, creds: AwsCredentials, region: string): AwsClients {
  const key = `${providerId}`;
  if (clientCache.has(key)) return clientCache.get(key)!;

  const credentials = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    ...(creds.sessionToken ? { sessionToken: creds.sessionToken } : {}),
  };

  const clients: AwsClients = {
    ec2: new EC2Client({ region, credentials }),
    rds: new RDSClient({ region, credentials }),
    s3: new S3Client({ region, credentials }),
    lambda: new LambdaClient({ region, credentials }),
    cloudwatch: new CloudWatchClient({ region, credentials }),
  };

  clientCache.set(key, clients);
  return clients;
}

export function clearClientCache(providerId: number) {
  clientCache.delete(`${providerId}`);
}
