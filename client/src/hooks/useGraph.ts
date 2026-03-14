import { useState, useCallback } from 'react';
import { api } from '../lib/api';

interface InfraNode {
  id: string;
  type: string;
  label: string;
  status: string;
  isManual: boolean;
  metadata: Record<string, any>;
  metrics?: Record<string, number>;
}

interface InfraEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: InfraNode[];
  edges: InfraEdge[];
}

export function useGraph() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);

  // Load persisted result from DB (no AWS call)
  const loadCached = useCallback(async (providerId: number) => {
    try {
      const data = await api.get<{
        cached: GraphData | null;
        resourceTypes?: string[];
        scannedAt?: string;
      }>(`/graph/${providerId}/cached`);

      if (data.cached) {
        setGraphData(data.cached);
        setScannedAt(data.scannedAt || null);
        setActiveTypes(data.resourceTypes || []);
      }
    } catch {
      // No cached data is fine, silently ignore
    }
  }, []);

  // Live scan (calls AWS, then saves to DB)
  const fetchGraph = useCallback(async (providerId: number, types?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const typesParam = types ? `?types=${types.join(',')}` : '';
      const data = await api.get<GraphData>(`/graph/${providerId}${typesParam}`);
      setGraphData(data);
      setScannedAt(new Date().toISOString());
      setActiveTypes(types || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { graphData, loading, error, scannedAt, activeTypes, fetchGraph, loadCached, setGraphData };
}
