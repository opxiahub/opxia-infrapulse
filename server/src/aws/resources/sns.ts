import { ListTopicsCommand } from '@aws-sdk/client-sns';
import type { SNSClient } from '@aws-sdk/client-sns';
import type { InfraNode } from '../types.js';

export async function discoverSns(client: SNSClient): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListTopicsCommand({}));
    return (res.Topics || []).map(t => {
      const name = t.TopicArn?.split(':').pop();
      return {
        id: `sns-${name}`,
        type: 'sns' as const,
        label: name || 'Unknown Topic',
        status: 'active',
        isManual: true,
        metadata: { topicArn: t.TopicArn, name, subtitle: 'SNS Topic' },
      };
    });
  } catch (e: any) { console.error('SNS discovery error:', e.message); return []; }
}
