import React from 'react';
import { Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForceFieldStore } from '../store/forceFieldStore';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ForceType } from '../types/particle';

export function ForceTypeControls() {
  const { settings, updateSettings } = useForceFieldStore();

  const updateForceSettings = (forceType: ForceType, key: string, value: number | boolean) => {
    updateSettings({
      forceSettings: {
        ...settings.forceSettings,
        [forceType]: {
          ...settings.forceSettings[forceType],
          [key]: value,
        },
      },
    });
  };

  const renderForceControls = () => {
    switch (settings.forceType) {
      case 'attraction':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Strength <span title="Force magnitude for attraction. Higher pulls faster within the radius."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.attraction.strength.toFixed(1)} (1..500)</span>
              </label>
              <Slider
                value={[settings.forceSettings.attraction.strength]}
                onValueChange={([value]) => updateForceSettings('attraction', 'strength', value)}
                max={500}
                min={1}
                step={0.1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Radius (%) <span title="Effective range of the force as a percentage of the canvas size."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.attraction.radius}% (1..100)</span>
              </label>
              <Slider
                value={[settings.forceSettings.attraction.radius]}
                onValueChange={([value]) => updateForceSettings('attraction', 'radius', value)}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        );

      case 'repulsion':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Strength <span title="Force magnitude for repulsion. Higher pushes away faster within the radius."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.repulsion.strength.toFixed(1)} (1..200)</span>
              </label>
              <Slider
                value={[settings.forceSettings.repulsion.strength]}
                onValueChange={([value]) => updateForceSettings('repulsion', 'strength', value)}
                max={200}
                min={1}
                step={0.1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Radius (%) <span title="Effective range of the force as a percentage of the canvas size."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.repulsion.radius}% (1..100)</span>
              </label>
              <Slider
                value={[settings.forceSettings.repulsion.radius]}
                onValueChange={([value]) => updateForceSettings('repulsion', 'radius', value)}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        );

      case 'vortex':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Strength <span title="Spin intensity. Higher values create stronger rotational flow."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.vortex.strength.toFixed(1)} (1..1000)</span>
              </label>
              <Slider
                value={[settings.forceSettings.vortex.strength]}
                onValueChange={([value]) => updateForceSettings('vortex', 'strength', value)}
                max={1000}
                min={1}
                step={0.1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Radius (%) <span title="Effective range of the force as a percentage of the canvas size."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.vortex.radius}% (1..100)</span>
              </label>
              <Slider
                value={[settings.forceSettings.vortex.radius]}
                onValueChange={([value]) => updateForceSettings('vortex', 'radius', value)}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-2">Direction</label>
              <Select
                value={settings.forceSettings.vortex.clockwise ? 'clockwise' : 'counterclockwise'}
                onValueChange={(value) => updateForceSettings('vortex', 'clockwise', value === 'clockwise')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clockwise">Clockwise</SelectItem>
                  <SelectItem value="counterclockwise">Counter-clockwise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'collider':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Impact Force <span title="Impulse magnitude applied by the collider."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.collider.impactForce.toFixed(1)} (0.1..100)</span>
              </label>
              <Slider
                value={[settings.forceSettings.collider.impactForce]}
                onValueChange={([value]) => updateForceSettings('collider', 'impactForce', value)}
                max={100}
                min={0.1}
                step={0.1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Radius (%) <span title="Effective range of the force as a percentage of the canvas size."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.collider.radius}% (1..100)</span>
              </label>
              <Slider
                value={[settings.forceSettings.collider.radius]}
                onValueChange={([value]) => updateForceSettings('collider', 'radius', value)}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Bounce Damping <span title="Velocity reduction after collider impulse; higher = less bounce."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.collider.bounceDamping.toFixed(2)} (0..1)</span>
              </label>
              <Slider
                value={[settings.forceSettings.collider.bounceDamping]}
                onValueChange={([value]) => updateForceSettings('collider', 'bounceDamping', value)}
                max={1}
                min={0}
                step={0.01}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Hardness <span title="Additional damping simulating stiffness; higher = more rigid response."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.collider.hardness.toFixed(2)} (0..1)</span>
              </label>
              <Slider
                value={[settings.forceSettings.collider.hardness]}
                onValueChange={([value]) => updateForceSettings('collider', 'hardness', value)}
                max={1}
                min={0}
                step={0.01}
                className="w-full"
              />
            </div>
          </div>
        );

      case 'turbulence':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Strength <span title="Magnitude of random flow movement in turbulence."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.turbulence.strength.toFixed(1)} (1..500)</span>
              </label>
              <Slider
                value={[settings.forceSettings.turbulence.strength]}
                onValueChange={([value]) => updateForceSettings('turbulence', 'strength', value)}
                max={500}
                min={1}
                step={0.1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Radius (%) <span title="Effective range of the force as a percentage of the canvas size."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.turbulence.radius}% (1..100)</span>
              </label>
              <Slider
                value={[settings.forceSettings.turbulence.radius]}
                onValueChange={([value]) => updateForceSettings('turbulence', 'radius', value)}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Frequency <span title="Oscillation rate of turbulence patterns."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.turbulence.frequency.toFixed(1)} (0.1..10)</span>
              </label>
              <Slider
                value={[settings.forceSettings.turbulence.frequency]}
                onValueChange={([value]) => updateForceSettings('turbulence', 'frequency', value)}
                max={10}
                min={0.1}
                step={0.1}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">Chaos <span title="Randomness factor added to turbulence."><Info className="w-3.5 h-3.5 opacity-80" /></span></span>
                <span className="text-xs text-purple-400">{settings.forceSettings.turbulence.chaos.toFixed(2)} (0..1)</span>
              </label>
              <Slider
                value={[settings.forceSettings.turbulence.chaos]}
                onValueChange={([value]) => updateForceSettings('turbulence', 'chaos', value)}
                max={1}
                min={0}
                step={0.01}
                className="w-full"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <input
          id="combineForces"
          type="checkbox"
          checked={!!settings.combineForces}
          onChange={(e) => updateSettings({ combineForces: e.target.checked })}
        />
        <label htmlFor="combineForces" className="text-sm text-purple-200">Combine Forces</label>
      </div>
      {settings.combineForces && (
        <div className="space-y-2">
          <div className="text-xs text-purple-300">Active Forces</div>
          <div className="grid grid-cols-2 gap-2">
            {(['attraction','repulsion','vortex','collider','turbulence'] as ForceType[]).map((ft) => (
              <button
                key={ft}
                onClick={() => {
                  const setActive = new Set(settings.activeForces || []);
                  if (setActive.has(ft)) setActive.delete(ft); else setActive.add(ft);
                  updateSettings({ activeForces: Array.from(setActive) });
                }}
                className={`text-xs px-2 py-1 rounded border ${settings.activeForces?.includes(ft) ? 'border-purple-400 bg-purple-600/20 text-purple-100' : 'border-slate-600 bg-slate-700/50 text-purple-200'}`}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          id="continuousMode"
          type="checkbox"
          checked={!!settings.continuousMode}
          onChange={(e) => updateSettings({ continuousMode: e.target.checked })}
        />
        <label htmlFor="continuousMode" className="text-sm text-purple-200">Continuous Mode</label>
      </div>
      <div>
        <label className="block text-sm text-purple-200 mb-2">Force Type</label>
        <Select
          value={settings.forceType}
          onValueChange={(value: ForceType) => updateSettings({ forceType: value })}
        >
          <SelectTrigger className="w-full bg-slate-800 border-purple-500/30 text-purple-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="attraction">Attraction</SelectItem>
            <SelectItem value="repulsion">Repulsion</SelectItem>
            <SelectItem value="vortex">Vortex</SelectItem>
            <SelectItem value="collider">Collider</SelectItem>
            <SelectItem value="turbulence">Turbulence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {renderForceControls()}
    </motion.div>
  );
} 