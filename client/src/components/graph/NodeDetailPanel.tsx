import { X, Server } from 'lucide-react';
import { getResourceConfig } from '../../config/aws-resources';

interface Props {
  node: {
    id?: string;
    type: string;
    label: string;
    status: string;
    isManual: boolean;
    metadata: Record<string, any>;
    metrics?: Record<string, number>;
  };
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: Props) {
  const config = getResourceConfig(node.type);
  const Icon = config?.icon || Server;
  const iconColor = config?.iconColor || 'text-neon-blue';
  const activeStatuses = config?.activeStatuses || [];
  const isActive = activeStatuses.includes(node.status);

  return (
    <div className="w-80 bg-surface-900 border-l border-surface-600 h-full overflow-auto">
      <div className="p-4 border-b border-surface-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="font-bold text-sm text-gray-200">
            {config?.label || (node.type ?? 'Resource').toUpperCase()}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Name</div>
          <div className="text-sm text-gray-200">{node.label}</div>
        </div>

        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Status</div>
          <span className={`text-xs px-2 py-0.5 rounded ${
            isActive
              ? 'bg-neon-green/10 text-neon-green'
              : 'bg-gray-600/30 text-gray-400'
          }`}>
            {node.status}
          </span>
        </div>

        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Provisioning</div>
          <span className={`text-xs px-2 py-0.5 rounded ${
            node.isManual
              ? 'bg-neon-red/10 text-neon-red'
              : 'bg-neon-green/10 text-neon-green'
          }`}>
            {node.isManual ? 'Manual / Unmanaged' : 'IaC Managed'}
          </span>
        </div>

        {node.metrics && Object.keys(node.metrics).length > 0 && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Metrics</div>
            <div className="space-y-2">
              {Object.entries(node.metrics).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-gray-400">{key}</span>
                  <span className="text-neon-blue">{typeof val === 'number' ? val.toFixed(2) : val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Metadata</div>
          <div className="space-y-1">
            {Object.entries(node.metadata)
              .filter(([key]) => key !== 'subtitle')
              .map(([key, val]) => {
                if (val === null || val === undefined) return null;
                if (typeof val === 'object') return null;
                return (
                  <div key={key} className="flex justify-between text-xs gap-2">
                    <span className="text-gray-500 shrink-0">{key}</span>
                    <span className="text-gray-300 truncate text-right">{String(val)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
