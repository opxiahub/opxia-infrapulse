import { useState, useEffect } from 'react';
import { X, Terminal, Box, Cpu, Network, Globe, Key } from 'lucide-react';
import { api } from '../../lib/api';
import { LogViewer } from '../kubernetes/LogViewer';

interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: string;
}

interface Props {
  node: {
    type: string;
    label: string;
    status: string;
    metadata: Record<string, any>;
  };
  onClose: () => void;
}

const TYPE_ICONS: Record<string, any> = {
  'k8s-deployment': Box,
  'k8s-pod': Cpu,
  'k8s-service': Network,
  'k8s-ingress': Globe,
  'k8s-secret': Key,
};

const TYPE_COLORS: Record<string, string> = {
  'k8s-deployment': 'text-neon-purple',
  'k8s-pod': 'text-neon-green',
  'k8s-service': 'text-neon-blue',
  'k8s-ingress': 'text-amber-400',
  'k8s-secret': 'text-rose-400',
};

const TYPE_LABELS: Record<string, string> = {
  'k8s-deployment': 'Deployment',
  'k8s-pod': 'Pod',
  'k8s-service': 'Service',
  'k8s-ingress': 'Ingress',
  'k8s-secret': 'Secret',
};

export function K8sNodeDetailPanel({ node, onClose }: Props) {
  const Icon = TYPE_ICONS[node.type] || Box;
  const iconColor = TYPE_COLORS[node.type] || 'text-gray-400';
  const typeLabel = TYPE_LABELS[node.type] || node.type;
  const { clusterId, namespace } = node.metadata;

  const [envVars, setEnvVars] = useState<EnvVar[] | null>(null);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  // For deployments, fetch env vars automatically
  useEffect(() => {
    if (node.type !== 'k8s-deployment') return;
    setEnvLoading(true);
    setEnvError('');
    api.get<{ envVars: EnvVar[] }>(
      `/kubernetes/clusters/${clusterId}/deployments/${encodeURIComponent(node.label)}/envvars?namespace=${namespace}`
    )
      .then(d => setEnvVars(d.envVars))
      .catch(e => setEnvError(e.message))
      .finally(() => setEnvLoading(false));
  }, [node.type, node.label, clusterId, namespace]);

  const formatAge = (ts: string) => {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  return (
    <>
      <div className="w-80 bg-surface-900 border-l border-surface-600 h-full overflow-auto">
        <div className="p-4 border-b border-surface-600 flex items-center justify-between sticky top-0 bg-surface-900 z-10">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            <span className="font-bold text-sm text-gray-200">{typeLabel}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Name</div>
            <div className="text-sm text-gray-200 break-all font-mono">{node.label}</div>
          </div>

          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Namespace</div>
            <div className="text-sm text-gray-400">{namespace}</div>
          </div>

          {node.metadata.createdAt && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Age</div>
              <div className="text-sm text-gray-400">{formatAge(node.metadata.createdAt)}</div>
            </div>
          )}

          {/* Deployment-specific */}
          {node.type === 'k8s-deployment' && (
            <>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Replicas</div>
                <div className="text-sm">
                  <span className={node.metadata.readyReplicas === node.metadata.replicas ? 'text-neon-green' : 'text-yellow-400'}>
                    {node.metadata.readyReplicas}/{node.metadata.replicas} ready
                  </span>
                </div>
              </div>
              {node.metadata.image && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Image</div>
                  <div className="text-xs text-gray-400 break-all font-mono">{node.metadata.image}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                  Environment Variables
                  {!envLoading && envVars && <span className="ml-1 text-gray-600">({envVars.length})</span>}
                </div>
                {envLoading && <div className="text-xs text-gray-500 animate-pulse">Loading...</div>}
                {envError && <div className="text-xs text-neon-red">{envError}</div>}
                {envVars && !envLoading && (
                  envVars.length === 0 ? (
                    <div className="text-xs text-gray-600 italic">None</div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {envVars.map((ev, i) => (
                        <div key={i} className="text-xs border-b border-surface-700/50 pb-1">
                          <span className="font-mono text-neon-green/80">{ev.name}</span>
                          <div className="font-mono text-gray-500 break-all ml-2">
                            {ev.valueFrom ? (
                              <span className="text-neon-blue/70">{ev.valueFrom}</span>
                            ) : (
                              ev.value || <span className="text-gray-600 italic">empty</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* Pod-specific */}
          {node.type === 'k8s-pod' && (
            <>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Phase</div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  node.status === 'Running' ? 'bg-neon-green/10 text-neon-green' : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {node.status}
                </span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Restarts</div>
                <div className="text-sm text-gray-400">{node.metadata.restarts ?? 0}</div>
              </div>
              {node.metadata.nodeName && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Node</div>
                  <div className="text-xs text-gray-400 font-mono truncate">{node.metadata.nodeName}</div>
                </div>
              )}
              {node.metadata.containers?.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Containers</div>
                  <div className="space-y-1">
                    {(node.metadata.containers as string[]).map((c, i) => (
                      <div key={i} className="text-xs font-mono text-gray-400">{c}</div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowLogs(true)}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                <Terminal className="w-4 h-4" /> View Logs
              </button>
            </>
          )}

          {/* Service-specific */}
          {node.type === 'k8s-service' && (
            <>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Type</div>
                <div className="text-sm text-gray-400">{node.metadata.svcType}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cluster IP</div>
                <div className="text-sm text-gray-400 font-mono">{node.metadata.clusterIP}</div>
              </div>
              {node.metadata.ports?.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ports</div>
                  <div className="space-y-1">
                    {(node.metadata.ports as any[]).map((p, i) => (
                      <div key={i} className="text-xs text-gray-400">
                        {p.port}/{p.protocol}
                        {p.nodePort ? ` → NodePort ${p.nodePort}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ingress-specific */}
          {node.type === 'k8s-ingress' && (
            <>
              {node.metadata.hosts?.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Hosts</div>
                  <div className="space-y-1">
                    {(node.metadata.hosts as string[]).map((h, i) => (
                      <div key={i} className="text-xs text-gray-400 font-mono">{h}</div>
                    ))}
                  </div>
                </div>
              )}
              {node.metadata.rules?.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rules</div>
                  <div className="space-y-2">
                    {(node.metadata.rules as any[]).map((r, i) => (
                      <div key={i} className="text-xs">
                        <div className="text-gray-400 font-mono">{r.host || '*'}</div>
                        {(r.paths || []).map((p: any, j: number) => (
                          <div key={j} className="ml-2 text-gray-600">
                            {p.path} → {p.backend}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Secret-specific */}
          {node.type === 'k8s-secret' && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Type</div>
              <div className="text-sm text-gray-400">{node.metadata.secretType || 'Opaque'}</div>
            </div>
          )}
        </div>
      </div>

      {showLogs && node.type === 'k8s-pod' && (
        <LogViewer
          clusterId={clusterId}
          namespace={namespace}
          podName={node.label}
          containerName={(node.metadata.containers as string[])?.[0]}
          onClose={() => setShowLogs(false)}
        />
      )}
    </>
  );
}
