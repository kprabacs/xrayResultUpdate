'use client';

import React, { useState, useEffect } from 'react';
import XrayUploadForm from '@/components/XrayUploadForm';
import { TestTube2, UploadCloud, History, Trash2, RefreshCcw } from 'lucide-react';

const NavItem = ({
    icon,
    label,
    active,
    onClick
}: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}) => (
    <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 text-left rounded-lg transition-all duration-200 ${
        active 
        ? 'bg-indigo-600 text-white shadow-lg' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
    >
    {icon}
    <span className="ml-4 text-sm font-medium">{label}</span>
    </button>
);

interface RunSummary {
    id: number;
    releaseName: string;
    module: string;
    channel: string;
    device: string;
    passCount: number;
    failCount: number;
    createdAt: string;
}

const HistoryView = () => {
    const [runs, setRuns] = useState<RunSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/runs');
            if (!response.ok) throw new Error('Failed to fetch history');
            const data = await response.json();
            setRuns(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const deleteRun = async (id: number) => {
        if (!confirm('Are you sure you want to delete this run? This will remove all associated test case results and flakiness data for this specific run.')) {
            return;
        }

        try {
            const response = await fetch(`/api/runs/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            setRuns(runs.filter(run => run.id !== id));
        } catch (err) {
            alert('Failed to delete: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    if (loading) return <div className="flex justify-center p-10"><RefreshCcw className="animate-spin text-indigo-600" /></div>;
    if (error) return <div className="text-red-500 p-10 text-center">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Recent Uploads</h3>
                <button onClick={fetchHistory} className="p-2 hover:bg-gray-100 rounded-full text-indigo-600 transition-colors">
                    <RefreshCcw size={20} />
                </button>
            </div>

            {runs.length === 0 ? (
                <div className="text-center py-20 text-gray-400 border-2 border-dashed rounded-xl">
                    No history found. Upload a report to get started.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Release</th>
                                <th className="px-4 py-3 font-semibold">Module</th>
                                <th className="px-4 py-3 font-semibold">Metadata</th>
                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {runs.map((run) => (
                                <tr key={run.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                                    <td className="px-4 py-4 text-gray-500">
                                        {new Date(run.createdAt).toLocaleDateString()}<br/>
                                        <span className="text-xs">{new Date(run.createdAt).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="px-4 py-4 font-semibold text-gray-900">{run.releaseName}</td>
                                    <td className="px-4 py-4">
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium uppercase">
                                            {run.module}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-gray-500">
                                        <div className="flex space-x-2">
                                            <span title="Channel" className="bg-gray-100 px-2 py-0.5 rounded text-[10px] uppercase">{run.channel}</span>
                                            <span title="Device" className="bg-gray-100 px-2 py-0.5 rounded text-[10px] uppercase">{run.device}</span>
                                        </div>
                                        <div className="mt-1 text-[10px]">
                                            Pass: <span className="text-green-600">{run.passCount}</span> / Fail: <span className="text-red-600">{run.failCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button 
                                            onClick={() => deleteRun(run.id)}
                                            className="text-gray-300 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                            title="Invalidate / Delete Run"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white p-6 shadow-xl flex flex-col justify-between border-r border-gray-100">
        <div>
          <div className="flex items-center mb-12">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-200 shadow-lg">
                <TestTube2 size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 ml-3">ResultHub</h1>
          </div>
          <nav className="space-y-4">
            <NavItem
              icon={<UploadCloud size={20} />}
              label="Process Report"
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
            />
            <NavItem
              icon={<History size={20} />}
              label="History Management"
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
            />
          </nav>
        </div>
        <div className="text-center text-xs text-gray-400 border-t pt-4">
          <p>&copy; {new Date().getFullYear()} Execution Results</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
            <div className="mb-10">
                <h2 className="text-4xl font-bold text-gray-900">
                    {activeTab === 'upload' ? 'Test Report Processor' : 'History & Overrides'}
                </h2>
                <p className="text-gray-500 mt-2 text-lg">
                    {activeTab === 'upload' 
                        ? 'Process Cucumber results and sync with Jira Xray effortlessly.' 
                        : 'Review past uploads and invalidate incorrect data entries.'}
                </p>
            </div>
            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
                {activeTab === 'upload' ? <XrayUploadForm /> : <HistoryView />}
            </div>
        </div>
      </main>
    </div>
  );
}
