import type { AwsResourceType } from './resource-registry.js';

export interface InfraNode {
  id: string;
  type: AwsResourceType;
  label: string;
  status: string;
  isManual: boolean;
  metadata: Record<string, any>;
  metrics?: MetricData;
}

export interface InfraEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface MetricData {
  cpuUtilization?: number;
  connections?: number;
  invocations?: number;
  objectCount?: number;
  timestamp?: string;
}

export interface MetricPulse {
  nodeId: string;
  metrics: MetricData;
  timestamp: string;
}

export interface GraphData {
  nodes: InfraNode[];
  edges: InfraEdge[];
}
