import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Server, Shield } from 'lucide-react';
import { getSettings, updateSettings } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../utils/cn';

export default function Settings() {
  const [settings, setSettings] = useState<any>({
    defaultScrapeFrequencyMinutes: 120,
    maxRetries: 3,
    notifyPriceDrop: true,
    notifyBackInStock: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSettings();
        if (data.success) {
          setSettings(data.data);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateSettings(settings);
      if (data.success) {
        addToast({
          type: 'success',
          title: 'Settings Saved',
          message: 'Your preferences have been updated successfully.'
        });
      }
    } catch (error) {
      console.error('Failed to save settings', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to save settings. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <SettingsIcon className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center shadow-sm border border-slate-200">
          <SettingsIcon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-outfit text-slate-900">Settings</h2>
          <p className="text-slate-500">Configure global scraper preferences and alert notifications.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Server className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">Scraper Configuration</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Default Scrape Frequency</label>
              <select 
                value={settings.defaultScrapeFrequencyMinutes} 
                onChange={(e) => handleChange('defaultScrapeFrequencyMinutes', parseInt(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-700"
              >
                <option value="30">Every 30 minutes</option>
                <option value="60">Every 1 hour</option>
                <option value="120">Every 2 hours</option>
                <option value="360">Every 6 hours</option>
                <option value="1440">Every 24 hours</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Max Retries</label>
              <input 
                type="number" 
                value={settings.maxRetries} 
                onChange={(e) => handleChange('maxRetries', parseInt(e.target.value))}
                min={1} 
                max={5}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-700" 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Shield className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-slate-800">Alert Preferences</h3>
        </div>
        <div className="p-6 space-y-4">
          <label className="flex items-start gap-4 cursor-pointer group bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-all hover:shadow-sm">
            <input 
              type="checkbox" 
              checked={settings.notifyPriceDrop} 
              onChange={(e) => handleChange('notifyPriceDrop', e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-colors" 
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">Notify on any price drop</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Create an alert immediately when the price is lower than previous.</p>
            </div>
          </label>
          <label className="flex items-start gap-4 cursor-pointer group bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-all hover:shadow-sm">
            <input 
              type="checkbox" 
              checked={settings.notifyBackInStock} 
              onChange={(e) => handleChange('notifyBackInStock', e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-colors" 
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">Notify on back in stock</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Alert me when an out of stock item becomes available again.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2",
            saving ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-0.5"
          )}
        >
          {saving ? (
            <SettingsIcon className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
