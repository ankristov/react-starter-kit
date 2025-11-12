import React from 'react';

export default function ForceFieldPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">Force Field Particle Animator</h1>
        <p className="text-xl text-purple-300">Coming Soon...</p>
        <div className="mt-8">
          <canvas 
            width="400" 
            height="300" 
            className="border border-purple-500 rounded-lg bg-black"
            style={{ maxWidth: '100%' }}
          />
        </div>
      </div>
    </div>
  );
} 