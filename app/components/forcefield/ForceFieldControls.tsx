import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForceFieldStore } from '../../lib/forceFieldStore';
import { useImageUpload } from '../../hooks/useImageUpload';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { 
  Settings, 
  Upload, 
  RotateCcw, 
  Camera, 
  Video, 
  Info,
  ChevronDown,
  ChevronUp,
  Palette,
  Zap,
  Target,
  Wind
} from 'lucide-react';

export function ForceFieldControls() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'main' | 'forces' | 'export'>('main');
  
  const {
    settings,
    updateSettings,
    resetParticles,
    takeScreenshot,
    startRecording,
    stopRecording,
    isRecording,
    toggleInfo,
    showInfo,
    particleSystem,
    // color filter
    colorFilter,
    setColorFilterEnabled,
    setFilterMode,
    toggleColor,
  } = useForceFieldStore();

  const particleCount = particleSystem?.getParticleCount() || 0;
  const { handleFileUpload } = useImageUpload();

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Derive a simple top-colors palette from engine, if available
  const topColors = particleSystem?.getColorHistogram(12) || [];

  return (
    <motion.div
      className="fixed right-4 top-4 w-80 max-h-[90vh] overflow-y-auto bg-black/90 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-2xl"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-500/30">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">Force Field Controls</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-purple-400 hover:text-white"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 space-y-4"
          >
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('fileInput')?.click()}
                className="flex-1 bg-purple-900/50 border-purple-500/50 text-purple-200 hover:bg-purple-800"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetParticles}
                className="bg-blue-900/50 border-blue-500/50 text-blue-200 hover:bg-blue-800"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={takeScreenshot}
                className="bg-green-900/50 border-green-500/50 text-green-200 hover:bg-green-800"
              >
                <Camera className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={isRecording ? stopRecording : startRecording}
                className={`${isRecording ? 'bg-red-900/50 border-red-500/50 text-red-200 hover:bg-red-800' : 'bg-orange-900/50 border-orange-500/50 text-orange-200 hover:bg-orange-800'}`}
              >
                <Video className="w-4 h-4" />
              </Button>
            </div>

            <input
              id="fileInput"
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Particle Count Display */}
            <div className="text-center text-sm text-purple-300 bg-purple-900/30 rounded-lg p-2">
              <span className="font-medium">{particleCount.toLocaleString()}</span> particles
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
              <Button
                variant={activeTab === 'main' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('main')}
                className={`flex-1 text-xs ${activeTab === 'main' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'}`}
              >
                <Zap className="w-3 h-3 mr-1" />
                Main
              </Button>
              <Button
                variant={activeTab === 'forces' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('forces')}
                className={`flex-1 text-xs ${activeTab === 'forces' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'}`}
              >
                <Target className="w-3 h-3 mr-1" />
                Forces
              </Button>
              <Button
                variant={activeTab === 'export' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('export')}
                className={`flex-1 text-xs ${activeTab === 'export' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'}`}
              >
                <Wind className="w-3 h-3 mr-1" />
                Export
              </Button>
            </div>

            {/* Main Settings */}
            <AnimatePresence mode="wait">
              {activeTab === 'main' && (
                <motion.div
                  key="main"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <Card className="bg-slate-800/50 border-purple-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-purple-200 flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        Particle Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Density</label>
                        <Slider
                          value={[settings.particleDensity]}
                          onValueChange={([value]: number[]) => updateSettings({ particleDensity: value })}
                          max={5000}
                          min={100}
                          step={100}
                          className="w-full"
                        />
                        <div className="text-xs text-purple-400 mt-1">{settings.particleDensity}</div>
                      </div>

                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Size</label>
                        <Slider
                          value={[settings.particleSize]}
                          onValueChange={([value]: number[]) => updateSettings({ particleSize: value })}
                          max={10}
                          min={1}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="text-xs text-purple-400 mt-1">{settings.particleSize}</div>
                      </div>

                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Shape</label>
                        <Select
                          value={settings.particleShape}
                          onValueChange={(value: 'circle' | 'square' | 'triangle') => 
                            updateSettings({ particleShape: value })
                          }
                        >
                          <SelectTrigger className="bg-slate-700/50 border-purple-500/30 text-purple-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-purple-500/30">
                            <SelectItem value="circle">Circle</SelectItem>
                            <SelectItem value="square">Square</SelectItem>
                            <SelectItem value="triangle">Triangle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-purple-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-purple-200">Force Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Effect Radius</label>
                        <Slider
                          value={[settings.effectRadius]}
                          onValueChange={([value]: number[]) => updateSettings({ effectRadius: value })}
                          max={300}
                          min={50}
                          step={10}
                          className="w-full"
                        />
                        <div className="text-xs text-purple-400 mt-1">{settings.effectRadius}px</div>
                      </div>

                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Force Strength</label>
                        <Slider
                          value={[settings.forceStrength]}
                          onValueChange={([value]: number[]) => updateSettings({ forceStrength: value })}
                          max={10}
                          min={1}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="text-xs text-purple-400 mt-1">{settings.forceStrength}</div>
                      </div>

                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Healing Factor</label>
                        <Slider
                          value={[settings.healingFactor]}
                          onValueChange={([value]: number[]) => updateSettings({ healingFactor: value })}
                          max={100}
                          min={10}
                          step={5}
                          className="w-full"
                        />
                        <div className="text-xs text-purple-400 mt-1">{settings.healingFactor}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs text-purple-300">Pulse Mode</label>
                        <Switch
                          checked={settings.pulseMode}
                          onCheckedChange={(checked: boolean) => updateSettings({ pulseMode: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Color Filter Panel */}
                  <Card className="bg-slate-800/50 border-purple-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-purple-200 flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        Color Filter
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-purple-300">Enable</span>
                        <Switch checked={colorFilter.enabled} onCheckedChange={(v: boolean) => setColorFilterEnabled(v)} />
                      </div>
                      <div>
                        <label className="text-xs text-purple-300 mb-2 block">Mode</label>
                        <Select value={colorFilter.mode} onValueChange={(v: 'show' | 'hide') => setFilterMode(v)}>
                          <SelectTrigger className="bg-slate-700/50 border-purple-500/30 text-purple-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-purple-500/30">
                            <SelectItem value="show">Show selected</SelectItem>
                            <SelectItem value="hide">Hide selected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-purple-300">Top colors</div>
                        <div className="flex flex-wrap gap-2">
                          {topColors.map(({ color }) => (
                            <button
                              key={color}
                              onClick={() => toggleColor(color)}
                              className={`w-6 h-6 rounded border ${colorFilter.selectedColors.includes(color) ? 'border-purple-400 ring-2 ring-purple-400/50' : 'border-slate-600'}`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Force Types */}
              {activeTab === 'forces' && (
                <motion.div
                  key="forces"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <Card className="bg-slate-800/50 border-purple-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-purple-200">Force Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select
                        value={settings.forceType}
                        onValueChange={(value: 'repulsion' | 'attraction' | 'vortex' | 'collider') => 
                          updateSettings({ forceType: value })
                        }
                      >
                        <SelectTrigger className="bg-slate-700/50 border-purple-500/30 text-purple-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-purple-500/30">
                          <SelectItem value="repulsion">Repulsion</SelectItem>
                          <SelectItem value="attraction">Attraction</SelectItem>
                          <SelectItem value="vortex">Vortex</SelectItem>
                          <SelectItem value="collider">Collider</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Force-specific settings would go here */}
                  <div className="text-center text-sm text-purple-400">
                    Force-specific settings coming soon...
                  </div>
                </motion.div>
              )}

              {/* Export Settings */}
              {activeTab === 'export' && (
                <motion.div
                  key="export"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <Card className="bg-slate-800/50 border-purple-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-purple-200">Export Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={takeScreenshot}
                        className="w-full bg-green-900/50 border-green-500/50 text-green-200 hover:bg-green-800"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Save Screenshot
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-full ${isRecording ? 'bg-red-900/50 border-red-500/50 text-red-200 hover:bg-red-800' : 'bg-orange-900/50 border-orange-500/50 text-orange-200 hover:bg-orange-800'}`}
                      >
                        <Video className="w-4 h-4 mr-2" />
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleInfo}
                className="text-purple-400 hover:text-white"
              >
                <Info className="w-4 h-4 mr-2" />
                {showInfo ? 'Hide Info' : 'Show Info'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
} 