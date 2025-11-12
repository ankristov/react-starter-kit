import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ForceFieldCanvas } from './components/ForceFieldCanvas';
import { ControlPanel } from './components/ControlPanel';
import { Maximize2, Minimize2 } from 'lucide-react';

export function App() {
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);

  const toggleCanvasSize = () => {
    setIsCanvasExpanded(!isCanvasExpanded);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-b border-purple-500/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-purple-300">Force Field Animator</h1>
            <p className="text-sm text-purple-400">Interactive particle physics visualization</p>
          </div>
          <button
            onClick={toggleCanvasSize}
            className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors"
            title={isCanvasExpanded ? "Collapse Canvas" : "Expand Canvas"}
          >
            {isCanvasExpanded ? (
              <Minimize2 className="w-5 h-5 text-purple-300" />
            ) : (
              <Maximize2 className="w-5 h-5 text-purple-300" />
            )}
          </button>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Canvas Area */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`relative transition-all duration-300 ${
            isCanvasExpanded 
              ? 'w-full h-full' 
              : 'w-[calc(100vw-320px)] h-full'
          }`}
        >
          <div className="w-full h-full p-4">
            <div className="w-full h-full bg-black/20 rounded-lg overflow-hidden">
              <ForceFieldCanvas />
            </div>
          </div>
        </motion.div>

        {/* Control Panel */}
        {!isCanvasExpanded && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-80 flex-shrink-0"
          >
            <ControlPanel />
          </motion.div>
        )}
      </div>
    </div>
  );
} 