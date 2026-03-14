import { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Loader2, AlertTriangle } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: number | null;
  providerLabel: string;
  providerRegion: string;
}

export function ChatPanel({ isOpen, onClose, providerId, providerLabel, providerRegion }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Reset chat when provider changes
    if (isOpen) {
      setMessages([{
        role: 'assistant',
        content: `👋 Hello! I'm your infrastructure assistant for **${providerLabel}** (${providerRegion}).\n\nI can help you understand your infrastructure configuration and metadata. Ask me about:\n\n• Resource counts and lists\n• Configuration details (instance types, runtime, etc.)\n• Network settings (VPCs, subnets, IPs)\n• Tags and management status\n• Resource relationships\n\nWhat would you like to know?`,
        timestamp: new Date().toISOString()
      }]);
      setError(null);
    }
  }, [isOpen, providerId, providerLabel, providerRegion]);

  const handleSendMessage = async (message: string) => {
    if (!providerId) {
      setError('No provider selected');
      return;
    }

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          providerId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to send message');
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[420px] h-[600px] bg-surface-900 border border-surface-600 rounded-lg shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-600 bg-surface-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-neon-green" />
          <div>
            <h3 className="font-semibold text-sm text-gray-100">Infrastructure Assistant</h3>
            <p className="text-[10px] text-gray-500">{providerLabel} • {providerRegion}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          title="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))}
        
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-neon-red/10 border border-neon-red/30 rounded text-neon-red text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={loading || !providerId} />
    </div>
  );
}
