'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';

interface Setting {
  value: string;
  description: string;
  updatedAt: string;
}

interface GroupedSettings {
  [category: string]: {
    [key: string]: Setting;
  };
}

export default function AdminSettingsPage() {
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<GroupedSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {});
        
        // Initialize form data
        const initialFormData: Record<string, string> = {};
        Object.entries(data.settings || {}).forEach(([category, categorySettings]) => {
          Object.entries(categorySettings).forEach(([key, setting]) => {
            const fullKey = key === 'value' ? category : `${category}_${key}`;
            initialFormData[fullKey] = (setting as Setting).value || '';
          });
        });
        setFormData(initialFormData);
      } else {
        toast.error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const initializeSettings = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      const response = await fetch('/api/admin/settings/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Default settings initialized');
        loadSettings();
      } else {
        toast.error('Failed to initialize settings');
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
      toast.error('Error initializing settings');
    } finally {
      setSaving(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (response.ok) {
        toast.success('Setting saved');
        loadSettings();
      } else {
        toast.error('Failed to save setting');
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Error saving setting');
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Save all changed settings
      const promises = Object.entries(formData).map(([key, value]) => {
        return saveSetting(key, value);
      });

      await Promise.all(promises);
      toast.success('All settings saved');
    } catch (error) {
      toast.error('Some settings failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure platform settings and credentials
            </p>
          </div>

          <div className="p-6">
            {Object.keys(settings).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No settings found. Initialize default settings first.</p>
                <button
                  onClick={initializeSettings}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Initializing...' : 'Initialize Default Settings'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Hetzner Configuration */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Hetzner Configuration</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        API Token
                      </label>
                      <input
                        type="password"
                        value={formData.hetzner_token || ''}
                        onChange={(e) => handleInputChange('hetzner_token', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter Hetzner Cloud API Token"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Storage Box Host
                      </label>
                      <input
                        type="text"
                        value={formData.hetzner_storage_box_host || ''}
                        onChange={(e) => handleInputChange('hetzner_storage_box_host', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., u123456.your-storagebox.de"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Storage Box Username
                      </label>
                      <input
                        type="text"
                        value={formData.hetzner_storage_box_user || ''}
                        onChange={(e) => handleInputChange('hetzner_storage_box_user', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter storage box username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Storage Box Password
                      </label>
                      <input
                        type="password"
                        value={formData.hetzner_storage_box_pass || ''}
                        onChange={(e) => handleInputChange('hetzner_storage_box_pass', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter storage box password"
                      />
                    </div>
                  </div>
                </div>

                {/* Platform Configuration */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Platform Configuration</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Platform Name
                      </label>
                      <input
                        type="text"
                        value={formData.platform_name || ''}
                        onChange={(e) => handleInputChange('platform_name', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Media Platform"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        value={formData.admin_email || ''}
                        onChange={(e) => handleInputChange('admin_email', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="admin@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Default Storage Quota (GB)
                      </label>
                      <input
                        type="number"
                        value={formData.default_storage_quota || ''}
                        onChange={(e) => handleInputChange('default_storage_quota', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="2048"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Max Containers Per User
                      </label>
                      <input
                        type="number"
                        value={formData.max_containers_per_user || ''}
                        onChange={(e) => handleInputChange('max_containers_per_user', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={loadSettings}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Reload
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}