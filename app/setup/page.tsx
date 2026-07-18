"use client";

import { useEffect, useState } from "react";

export default function SetupPage() {
  const [status, setStatus] = useState<string>("Fixing passwords...");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fixPasswords = async () => {
      try {
        const response = await fetch("/api/setup/fix-passwords");
        const data = await response.json();
        
        if (response.ok) {
          setStatus("Passwords fixed successfully!");
          setResult(data);
        } else {
          setError(data.error || "Unknown error");
          setStatus("Failed to fix passwords");
        }
      } catch (err) {
        setError(String(err));
        setStatus("Error occurred");
      }
    };

    fixPasswords();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-4">Database Setup</h1>
        
        <div className="mb-4">
          <p className="text-lg">{status}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded p-4 mb-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-500/10 border border-green-500 rounded p-4 mb-4">
            <p className="text-green-500 font-semibold mb-4">Success!</p>
            
            <p className="text-sm font-semibold mb-2">Credenciales de demo:</p>
            <div className="space-y-2 text-sm text-gray-300">
              <p><span className="text-purple-400">Owner:</span> owner@barmanager.com / owner123</p>
              <p><span className="text-blue-400">Admin:</span> admin@barmanager.com / admin123</p>
              <p><span className="text-green-400">Waiter:</span> waiter@barmanager.com / waiter123</p>
            </div>
            
            <p className="text-sm mt-4">Usuarios configurados: {result.users?.length || 0}</p>
          </div>
        )}

        {result && (
          <a 
            href="/" 
            className="btn btn-primary w-full text-center block"
          >
            Go to Login
          </a>
        )}
      </div>
    </div>
  );
}
