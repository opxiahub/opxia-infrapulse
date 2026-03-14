import { useState } from 'react';
import { X, Clock, Key } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

export function AddProviderModal({ onClose, onAdded }: Props) {
  const [label, setLabel] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTemporary = sessionToken.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/providers', {
        label,
        provider: 'aws',
        region,
        accessKeyId,
        secretAccessKey,
        ...(isTemporary ? { sessionToken: sessionToken.trim() } : {}),
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
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-neon-blue">Connect AWS Account</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Credential type indicator */}
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded mb-4 border transition-all duration-200 ${
          isTemporary
            ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue'
            : 'bg-surface-700 border-surface-600 text-gray-400'
        }`}>
          {isTemporary ? <Clock className="w-3 h-3" /> : <Key className="w-3 h-3" />}
          {isTemporary
            ? 'Temporary credentials (session token detected)'
            : 'Long-lived credentials (no session token)'}
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
              placeholder="My AWS Account"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Access Key ID</label>
            <input
              type="text"
              value={accessKeyId}
              onChange={e => setAccessKeyId(e.target.value)}
              className="input-field"
              placeholder="AKIA... or ASIA... (temporary)"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Secret Access Key</label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={e => setSecretAccessKey(e.target.value)}
              className="input-field"
              placeholder="Your secret access key"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">
              Session Token
              <span className="ml-2 text-[10px] text-gray-600 normal-case tracking-normal">
                optional — required for ASIA... keys
              </span>
            </label>
            <textarea
              value={sessionToken}
              onChange={e => setSessionToken(e.target.value)}
              className="input-field resize-none font-mono text-[11px]"
              placeholder="Paste your AWS_SESSION_TOKEN here (leave blank for permanent credentials)"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Region</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="input-field"
              required
            >
              <option value="" disabled>Select a region</option>
              {AWS_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-500 p-2 bg-surface-900 rounded border border-surface-600 space-y-1">
            <div>Validated via STS GetCallerIdentity &middot; stored encrypted (AES-256-GCM)</div>
            {isTemporary && (
              <div className="text-neon-blue/70">
                Note: temporary credentials expire. Reconnect when they expire.
              </div>
            )}
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
