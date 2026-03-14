import { useState, useEffect, useCallback } from 'react';
import { InfraGraph } from '../components/graph/InfraGraph';
import { ResourceSummary } from '../components/graph/ResourceSummary';
import { ResourceTypeSelector } from '../components/ResourceTypeSelector';
import { useGraph } from '../hooks/useGraph';
import { useMetrics } from '../hooks/useMetrics';
import { api } from '../lib/api';
import { RefreshCw, Loader2, AlertTriangle, Clock, Search, X, Tag } from 'lucide-react';

interface Provider {
  id: number;
  label: string;
  provider: string;
  region: string;
  verified: number;
}

export function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ec2', 'rds', 's3', 'lambda']);
  const [searchQuery, setSearchQuery] = useState('');
  const { graphData, loading, error, scannedAt, activeTypes, fetchTags, fetchGraph, loadCached, setGraphData } = useGraph();
  const [withTags, setWithTags] = useState(false);

  useMetrics(selectedProvider, setGraphData);

  useEffect(() => {
    api.get<{ providers: Provider[] }>('/providers').then(data => {
      setProviders(data.providers);
      if (data.providers.length > 0) {
        setSelectedProvider(data.providers[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProvider) return;
    loadCached(selectedProvider);
  }, [selectedProvider, loadCached]);

  useEffect(() => {
    if (activeTypes.length > 0) {
      setSelectedTypes(activeTypes);
    }
  }, [activeTypes]);

  useEffect(() => {
    setWithTags(fetchTags);
  }, [fetchTags]);

  const handleScan = useCallback(() => {
    if (selectedProvider) {
      fetchGraph(selectedProvider, selectedTypes, withTags);
    }
  }, [selectedProvider, selectedTypes, withTags, fetchGraph]);

  const handleProviderChange = (id: number) => {
    setSelectedProvider(id);
    setSelectedTypes(['ec2', 'rds', 's3', 'lambda']);
    setSearchQuery('');
    setWithTags(false);
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

  const matchCount = searchQuery.trim()
    ? graphData?.nodes.filter(n => {
        const q = searchQuery.toLowerCase();
        const vals = [n.label, n.id, ...Object.values(n.metadata || {}).filter(v => typeof v === 'string')]
          .map(v => String(v).toLowerCase());
        return vals.some(v => v.includes(q));
      }).length ?? 0
    : null;

  const selectedProviderObj = providers.find(p => p.id === selectedProvider);

  return (
    <div className="h-full flex flex-col">
      {/* Controls bar */}
      <div className="p-3 border-b border-surface-600 bg-surface-900 flex items-center gap-3 flex-wrap">
        {/* Provider selector with provider badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500">
            {selectedProviderObj?.provider?.toUpperCase() || 'AWS'}
          </span>
          <select
            value={selectedProvider || ''}
            onChange={e => handleProviderChange(Number(e.target.value))}
            className="input-field w-auto text-xs"
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.region})
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-surface-600" />

        {/* Grouped resource type selector */}
        <ResourceTypeSelector selected={selectedTypes} onChange={setSelectedTypes} />

        <div className="w-px h-6 bg-surface-600" />

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or ID..."
            className="input-field pl-8 pr-8 w-52 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {matchCount !== null && (
          <span className="text-[10px] text-gray-500">
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </span>
        )}

        {/* Fetch Tags toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer ml-auto select-none" title="Fetch tags for all resources (makes extra API calls)">
          <input
            type="checkbox"
            checked={withTags}
            onChange={e => setWithTags(e.target.checked)}
            className="w-3.5 h-3.5 accent-neon-blue"
          />
          <Tag className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] text-gray-400">Fetch Tags</span>
        </label>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={loading || !selectedProvider || selectedTypes.length === 0}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Scanning...' : 'Scan Resources'}
        </button>
      </div>

      {/* Summary strip */}
      {graphData && graphData.nodes.length > 0 && (
        <ResourceSummary graphData={graphData} />
      )}

      {/* Last scanned timestamp */}
      {scannedAt && (
        <div className="px-3 py-1 bg-surface-950 border-b border-surface-600 flex items-center gap-1.5 text-[10px] text-gray-600">
          <Clock className="w-3 h-3" />
          Last scanned: {new Date(scannedAt).toLocaleString()}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 p-3 bg-neon-red/10 border border-neon-red/30 rounded text-neon-red text-sm">
          {error}
        </div>
      )}

      {/* Graph */}
      <div className="flex-1 overflow-hidden">
        {graphData ? (
          graphData.nodes.length > 0 ? (
            <InfraGraph graphData={graphData} searchQuery={searchQuery} />
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
                <RefreshCw className={`w-8 h-8 text-neon-green/30 ${loading ? 'animate-spin' : ''}`} />
              </div>
              {loading
                ? <p className="text-neon-green/60 animate-pulse">Scanning your infrastructure...</p>
                : <p className="text-sm">Select the resource types above and click <span className="text-gray-300 font-medium">Scan Resources</span>.</p>
              }
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {graphData && graphData.nodes.length > 0 && (
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
