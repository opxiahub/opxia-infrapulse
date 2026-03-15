import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { GraphData } from './useGraph';

interface RawResources {
  deployments: any[];
  pods: any[];
  services: any[];
  ingresses: any[];
  secrets: any[];
}

function buildGraphData(raw: RawResources, clusterId: number, namespace: string): GraphData {
  const nodes: GraphData['nodes'] = [];
  const edges: GraphData['edges'] = [];

  // Deployments
  for (const d of raw.deployments) {
    nodes.push({
      id: `kd-${d.name}`,
      type: 'k8s-deployment',
      label: d.name,
      status: `${d.readyReplicas}/${d.replicas}`,
      isManual: false,
      metadata: {
        clusterId,
        namespace,
        replicas: d.replicas,
        readyReplicas: d.readyReplicas,
        image: d.image,
        createdAt: d.createdAt,
        podLabels: d.podLabels || {},
      },
    });
  }

  // Pods
  for (const p of raw.pods) {
    nodes.push({
      id: `kp-${p.name}`,
      type: 'k8s-pod',
      label: p.name,
      status: p.phase,
      isManual: false,
      metadata: {
        clusterId,
        namespace,
        restarts: p.restarts,
        nodeName: p.nodeName,
        containers: p.containers,
        createdAt: p.createdAt,
      },
    });
  }

  // Services
  for (const s of raw.services) {
    nodes.push({
      id: `ks-${s.name}`,
      type: 'k8s-service',
      label: s.name,
      status: 'active',
      isManual: false,
      metadata: {
        clusterId,
        namespace,
        svcType: s.type,
        clusterIP: s.clusterIP,
        ports: s.ports,
        selector: s.selector || {},
        createdAt: s.createdAt,
      },
    });
  }

  // Ingresses
  for (const i of raw.ingresses) {
    nodes.push({
      id: `ki-${i.name}`,
      type: 'k8s-ingress',
      label: i.name,
      status: 'active',
      isManual: false,
      metadata: {
        clusterId,
        namespace,
        hosts: i.hosts,
        rules: i.rules,
        createdAt: i.createdAt,
      },
    });
  }

  // Secrets
  for (const s of raw.secrets) {
    nodes.push({
      id: `kse-${s.name}`,
      type: 'k8s-secret',
      label: s.name,
      status: 'active',
      isManual: false,
      metadata: {
        clusterId,
        namespace,
        secretType: s.type,
        createdAt: s.createdAt,
      },
    });
  }

  // Build edges

  // Deployment → Pod (pod name starts with deployment name + '-')
  for (const d of raw.deployments) {
    for (const p of raw.pods) {
      if (p.name.startsWith(d.name + '-')) {
        edges.push({
          id: `e-kd-${d.name}-kp-${p.name}`,
          source: `kd-${d.name}`,
          target: `kp-${p.name}`,
          label: 'owns',
          animated: true,
        });
      }
    }
  }

  // Service → Deployment (service selector matches deployment podLabels)
  for (const s of raw.services) {
    if (!s.selector || Object.keys(s.selector).length === 0) continue;
    for (const d of raw.deployments) {
      const podLabels = d.podLabels || {};
      const matches = Object.entries(s.selector).every(([k, v]) => podLabels[k] === v);
      if (matches) {
        edges.push({
          id: `e-ks-${s.name}-kd-${d.name}`,
          source: `ks-${s.name}`,
          target: `kd-${d.name}`,
          label: 'routes to',
          animated: true,
        });
      }
    }
  }

  // Ingress → Service (from ingress backend rules)
  for (const i of raw.ingresses) {
    const linkedServices = new Set<string>();
    for (const rule of (i.rules || [])) {
      for (const path of (rule.paths || [])) {
        // backend format: "service-name:port"
        const svcName = path.backend?.split(':')[0];
        if (svcName && !linkedServices.has(svcName)) {
          const svcExists = raw.services.find((s: any) => s.name === svcName);
          if (svcExists) {
            linkedServices.add(svcName);
            edges.push({
              id: `e-ki-${i.name}-ks-${svcName}`,
              source: `ki-${i.name}`,
              target: `ks-${svcName}`,
              label: 'exposes',
              animated: false,
            });
          }
        }
      }
    }
  }

  return { nodes, edges };
}

export function useKubernetesGraph() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [loading, setLoading] = useState(false);
  const [namespacesLoading, setNamespacesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNamespaces = useCallback(async (clusterId: number) => {
    setNamespacesLoading(true);
    setError(null);
    setGraphData(null);
    setSelectedNamespace('');
    try {
      const data = await api.get<{ namespaces: string[] }>(`/kubernetes/clusters/${clusterId}/namespaces`);
      setNamespaces(data.namespaces);
      const defaultNs = data.namespaces.includes('default') ? 'default' : (data.namespaces[0] || '');
      setSelectedNamespace(defaultNs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setNamespacesLoading(false);
    }
  }, []);

  const fetchResources = useCallback(async (clusterId: number, namespace: string) => {
    if (!namespace) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.get<RawResources>(`/kubernetes/clusters/${clusterId}/resources?namespace=${namespace}`);
      const built = buildGraphData(raw, clusterId, namespace);
      setGraphData(built);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    graphData,
    namespaces,
    selectedNamespace,
    setSelectedNamespace,
    loading,
    namespacesLoading,
    error,
    fetchNamespaces,
    fetchResources,
  };
}
