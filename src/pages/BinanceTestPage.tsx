import React, { useState } from 'react';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, Key, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  detail: string;
  code?: string;
}

const BinanceTestPage: React.FC = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ apiKey: string; tests: TestResult[] } | null>(null);
  const [error, setError] = useState('');

  const runTest = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('test-binance-api', {
        body: { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
      });
      if (fnError) throw fnError;
      if (data?.error) { setError(data.error); return; }
      setResults(data);
    } catch (e: any) {
      setError(e.message || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Binance API Test</h1>
          <p className="text-xs text-muted-foreground">Test your API key before saving</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-1">
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Security Notice
          </div>
          <p className="text-xs text-muted-foreground">
            Your keys are sent to the server for testing only and are NOT stored. After testing, use the secret update tool to save them securely.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> API Key
            </label>
            <Input
              placeholder="Paste your Binance API Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> API Secret
            </label>
            <Input
              type="password"
              placeholder="Paste your Binance API Secret"
              value={apiSecret}
              onChange={e => setApiSecret(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>
        </div>

        <Button
          onClick={runTest}
          disabled={loading || !apiKey.trim() || !apiSecret.trim()}
          className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : '🔍 Run Connectivity Test'}
        </Button>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Testing key: <code className="font-mono">{results.apiKey}</code></p>
            {results.tests.map((test, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border ${
                  test.status === 'pass'
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {test.status === 'pass'
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />
                  }
                  <span className="text-sm font-semibold text-foreground">{test.name}</span>
                </div>
                <p className="text-xs text-muted-foreground break-all pl-6">{test.detail}</p>
                {test.status === 'fail' && test.code === '400004' && (
                  <div className="mt-2 pl-6 text-xs text-amber-600 space-y-1">
                    <p className="font-semibold">💡 Fix: IP Restriction / Invalid Key</p>
                    <p>• Go to Binance → API Management</p>
                    <p>• Set IP restriction to "Unrestricted"</p>
                    <p>• Or add the server IPs shown in the error</p>
                    <p>• Make sure "Enable Reading" is ON</p>
                  </div>
                )}
              </div>
            ))}

            {results.tests.every(t => t.status === 'pass') && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                <p className="text-sm font-bold text-green-600">All tests passed! ✅</p>
                <p className="text-xs text-muted-foreground">
                  Your API key is working. You can now save it as a secret.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BinanceTestPage;
