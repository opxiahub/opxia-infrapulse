import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddClusterModal({ onClose, onAdded }: Props) {
  const [label, setLabel] = useState('');
  const [apiServerUrl, setApiServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [skipTlsVerify, setSkipTlsVerify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/kubernetes/clusters', {
        label,
        cluster_type: 'rosa',
        api_server_url: apiServerUrl,
        token,
        skip_tls_verify: skipTlsVerify,
      });
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-neon-blue">Connect ROSA Cluster</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-neon-red/10 border border-neon-red/30 rounded text-neon-red text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="input-field"
              placeholder="My ROSA Cluster"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">API Server URL</label>
            <input
              type="text"
              value={apiServerUrl}
              onChange={e => setApiServerUrl(e.target.value)}
              className="input-field"
              placeholder="https://api.cluster.example.com:6443"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Bearer Token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="input-field"
              placeholder="Your service account token"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="skipTls"
              checked={skipTlsVerify}
              onChange={e => setSkipTlsVerify(e.target.checked)}
              className="w-4 h-4 accent-neon-green"
            />
            <label htmlFor="skipTls" className="text-gray-400 text-sm">
              Skip TLS Verify
              <span className="ml-2 text-[10px] text-gray-600">not recommended for production</span>
            </label>
          </div>

          <div className="text-xs text-gray-500 p-2 bg-surface-900 rounded border border-surface-600">
            Verified via namespace list call · stored encrypted (AES-256-GCM)
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Verifying...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
