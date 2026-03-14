import { DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache';
import type { ElastiCacheClient } from '@aws-sdk/client-elasticache';
import type { InfraNode } from '../types.js';

export async function discoverElasticache(client: ElastiCacheClient): Promise<InfraNode[]> {
  try {
    const res = await client.send(new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true }));
    return (res.CacheClusters || []).map(c => ({
      id: `elasticache-${c.CacheClusterId}`,
      type: 'elasticache' as const,
      label: c.CacheClusterId || 'Unknown Cache',
      status: c.CacheClusterStatus || 'unknown',
      isManual: true, // Tags not included in DescribeCacheClusters
      metadata: { cacheClusterId: c.CacheClusterId, engine: c.Engine, engineVersion: c.EngineVersion, nodeType: c.CacheNodeType, numNodes: c.NumCacheNodes, subtitle: `${c.Engine} ${c.EngineVersion}` },
    }));
  } catch (e: any) { console.error('ElastiCache discovery error:', e.message); return []; }
}
