import { useState, useEffect, useCallback } from 'react';
import { InfraGraph } from '../components/graph/InfraGraph';
import { useGraph } from '../hooks/useGraph';
import { useMetrics } from '../hooks/useMetrics';
import { api } from '../lib/api';
import { RefreshCw, Loader2, AlertTriangle, Clock } from 'lucide-react';

interface Provider {
  id: number;
  label: string;
  provider: string;
  region: string;
  verified: number;
}

const RESOURCE_TYPES = [
  { key: 'ec2', label: 'EC2 Instances' },
  { key: 'rds', label: 'RDS Databases' },
  { key: 's3', label: 'S3 Buckets' },
  { key: 'lambda', label: 'Lambda Functions' },
];

export function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ec2', 'rds', 's3', 'lambda']);
  const { graphData, loading, error, scannedAt, activeTypes, fetchGraph, loadCached, setGraphData } = useGraph();

  useMetrics(selectedProvider, setGraphData);

  // Load providers once on mount
  useEffect(() => {
    api.get<{ providers: Provider[] }>('/providers').then(data => {
      setProviders(data.providers);
      if (data.providers.length > 0) {
        setSelectedProvider(data.providers[0].id);
      }
    }).catch(() => {});
  }, []);

  // When provider changes, load its cached scan (if any)
  useEffect(() => {
    if (!selectedProvider) return;
    loadCached(selectedProvider);
  }, [selectedProvider, loadCached]);

  // Restore checkbox state from the cached scan's resource types
  useEffect(() => {
    if (activeTypes.length > 0) {
      setSelectedTypes(activeTypes);
    }
  }, [activeTypes]);

  const handleScan = useCallback(() => {
    if (selectedProvider) {
      fetchGraph(selectedProvider, selectedTypes);
    }
  }, [selectedProvider, selectedTypes, fetchGraph]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleProviderChange = (id: number) => {
    setSelectedProvider(id);
    // Reset checkboxes to default until cached data restores them
    setSelectedTypes(['ec2', 'rds', 's3', 'lambda']);
  };

  if (providers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No providers connected.</p>
          <p className="text-sm mt-1">Go to Providers to connect your AWS account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Controls bar */}
      <div className="p-3 border-b border-surface-600 bg-surface-900 flex items-center gap-4 flex-wrap">
        <select
          value={selectedProvider || ''}
          onChange={e => handleProviderChange(Number(e.target.value))}
          className="input-field w-auto"
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.label} ({p.region})</option>
          ))}
        </select>

        <div className="flex items-center gap-3 flex-wrap">
          {RESOURCE_TYPES.map(rt => (
            <label key={rt.key} className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedTypes.includes(rt.key)}
                onChange={() => toggleType(rt.key)}
                className="accent-neon-green"
              />
              {rt.label}
            </label>
          ))}
        </div>

        <button
          onClick={handleScan}
          disabled={loading || !selectedProvider || selectedTypes.length === 0}
          className="btn-primary flex items-center gap-2 ml-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Scanning...' : 'Scan Resources'}
        </button>
      </div>

      {/* Last scanned timestamp */}
      {scannedAt && (
        <div className="px-3 py-1.5 bg-surface-900 border-b border-surface-600 flex items-center gap-1.5 text-[10px] text-gray-500">
          <Clock className="w-3 h-3" />
          Last scanned: {new Date(scannedAt).toLocaleString()}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mx-3 mt-3 p-3 bg-neon-red/10 border border-neon-red/30 rounded text-neon-red text-sm">
          {error}
        </div>
      )}

      {/* Graph area */}
      <div className="flex-1 overflow-hidden">
        {graphData ? (
          graphData.nodes.length > 0 ? (
            <InfraGraph graphData={graphData} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p>No resources found for the selected types.</p>
                <p className="text-sm mt-1">Try selecting different resource types or check your region.</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full border-2 border-neon-green/20 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-neon-green/30" />
              </div>
              <p className="text-sm">Select the resource types above and click <span className="text-gray-300 font-medium">Scan Resources</span>.</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {graphData && (
        <div className="p-2 border-t border-surface-600 bg-surface-900 flex items-center gap-6 text-[10px] text-gray-500">
          <span>Nodes: <span className="text-gray-300">{graphData.nodes.length}</span></span>
          <span>Edges: <span className="text-gray-300">{graphData.edges.length}</span></span>
          <span>Manual: <span className="text-neon-red">{graphData.nodes.filter(n => n.isManual).length}</span></span>
          <span>Managed: <span className="text-neon-green">{graphData.nodes.filter(n => !n.isManual).length}</span></span>
        </div>
      )}
    </div>
  );
}
