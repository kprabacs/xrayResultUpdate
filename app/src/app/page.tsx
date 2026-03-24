'use client';

import React, { useState, useEffect } from 'react';
import XrayUploadForm from '@/components/XrayUploadForm';
import { 
    TestTube2, 
    UploadCloud, 
    History, 
    Trash2, 
    RefreshCcw, 
    BarChart3, 
    PieChart as PieIcon, 
    TrendingUp,
    Layers,
    Filter
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    AreaChart, 
    Area
} from 'recharts';

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
        : 'text-gray-700 hover:bg-gray-100'
    }`}
    >
    {icon}
    <span className="ml-4 text-sm font-semibold">{label}</span>
    </button>
);

interface AnalyticsSummary {
    app: string;
    release: string;
    testCount: number;
    passCount: number;
    failCount: number;
    passPct: number;
}

interface AnalyticsDevice {
    app: string;
    release: string;
    device: string;
    testCount: number;
    passCount: number;
    failCount: number;
    passPct: number;
    failPct: number;
}

interface AnalyticsModule {
    app: string;
    release: string;
    device: string;
    module: string;
    testCount: number;
    passCount: number;
    failCount: number;
    passPct: number;
}

interface AnalyticsTrend {
    release: string;
    app: string;
    pass: number;
    fail: number;
}

interface AnalyticsData {
    summary: AnalyticsSummary[];
    deviceStats: AnalyticsDevice[];
    moduleStats: AnalyticsModule[];
    trend: AnalyticsTrend[];
}

const AnalyticsView = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Global Filter
    const [selectedApp, setSelectedApp] = useState<string>('');
    
    // Device Filter
    const [selectedDevice, setSelectedDevice] = useState<string>('all');
    
    // Module Filters
    const [selectedModuleDevice, setSelectedModuleDevice] = useState<string>('all');
    const [selectedModuleRelease, setSelectedModuleRelease] = useState<string>('all');

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/analytics/summary');
            if (!response.ok) throw new Error('Failed to fetch analytics');
            const result: AnalyticsData = await response.json();
            setData(result);
            
            if (result.trend && result.trend.length > 0) {
                const apps = Array.from(new Set(result.trend.map(t => t.app)));
                if (apps.length > 0) setSelectedApp(apps[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-20"><RefreshCcw className="animate-spin text-indigo-600" size={40} /></div>;
    if (error) return <div className="text-red-500 p-10 text-center bg-red-50 rounded-xl border border-red-100">{error}</div>;
    if (!data) return null;

    const apps = Array.from(new Set(data.trend.map(t => t.app)));
    
    // Filtered Data based on Global App Selection
    const filteredTrend = data.trend.filter(t => t.app === selectedApp);
    const filteredSummary = data.summary.filter(s => s.app === selectedApp);
    
    // Device Analytics Logic
    const devices = ['all', ...Array.from(new Set(data.deviceStats.filter(d => d.app === selectedApp).map(d => d.device)))];
    
    const deviceTrendData = Array.from(new Set(data.deviceStats.filter(d => d.app === selectedApp).map(d => d.release)))
        .map(rel => {
            const stats = data.deviceStats.filter(d => d.app === selectedApp && d.release === rel && (selectedDevice === 'all' || d.device === selectedDevice));
            const total = stats.reduce((acc, curr) => acc + curr.testCount, 0);
            const pass = stats.reduce((acc, curr) => acc + curr.passCount, 0);
            const fail = stats.reduce((acc, curr) => acc + curr.failCount, 0);
            return {
                release: rel,
                total,
                pass,
                fail,
                passPct: total > 0 ? (pass / total) * 100 : 0,
                failPct: total > 0 ? (fail / total) * 100 : 0
            };
        }).sort((a, b) => a.release.localeCompare(b.release));

    const grandTotalDevice = deviceTrendData.reduce((acc, curr) => ({
        total: acc.total + curr.total,
        pass: acc.pass + curr.pass,
        fail: acc.fail + curr.fail
    }), { total: 0, pass: 0, fail: 0 });

    // Module Filter Logic
    const moduleDevices = ['all', ...Array.from(new Set(data.moduleStats.filter(m => m.app === selectedApp).map(m => m.device)))];
    const moduleReleases = ['all', ...Array.from(new Set(data.moduleStats.filter(m => m.app === selectedApp).map(m => m.release)))];

    const filteredModules = data.moduleStats.filter(m => 
        m.app === selectedApp &&
        (selectedModuleDevice === 'all' || m.device === selectedModuleDevice) &&
        (selectedModuleRelease === 'all' || m.release === selectedModuleRelease)
    );

    return (
        <div className="space-y-12">
            {/* Global App Selector */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Project Selection</h3>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    {apps.map(app => (
                        <button
                            key={app}
                            onClick={() => {
                                setSelectedApp(app);
                                setSelectedDevice('all');
                                setSelectedModuleDevice('all');
                                setSelectedModuleRelease('all');
                            }}
                            className={`px-6 py-2 rounded-lg text-sm font-extrabold transition-all uppercase ${
                                selectedApp === app 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {app}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Overall Trend */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center space-x-2 mb-6">
                        <TrendingUp className="text-indigo-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-900 capitalize">{selectedApp} Execution Trend</h3>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredTrend}>
                                <defs>
                                    <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="release" axisLine={false} tickLine={false} tick={{fill: '#111827', fontSize: 12, fontWeight: 600}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#111827', fontSize: 12, fontWeight: 600}} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                <Legend verticalAlign="top" align="right" height={36} />
                                <Area type="monotone" dataKey="pass" stroke="#4f46e5" fillOpacity={1} fill="url(#colorPass)" strokeWidth={3} name="Pass" />
                                <Area type="monotone" dataKey="fail" stroke="#ef4444" fillOpacity={0} strokeWidth={3} name="Fail" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right: Summary Table */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center space-x-2 mb-6">
                        <Layers className="text-indigo-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-900">Release Summary</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[320px]">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white text-xs text-gray-900 uppercase font-bold border-b-2 border-gray-100">
                                <tr>
                                    <th className="pb-3 px-2">Release</th>
                                    <th className="pb-3 px-2">Total</th>
                                    <th className="pb-3 px-2">Pass %</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredSummary.map((s, i) => (
                                    <tr key={i} className="border-t border-gray-50">
                                        <td className="py-3 px-2 font-bold text-gray-900">{s.release}</td>
                                        <td className="py-3 px-2 font-bold text-gray-900">{s.testCount}</td>
                                        <td className="py-3 px-2 font-extrabold text-indigo-600">{s.passPct.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Enhanced Device Wise Analytics */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-100 p-2 rounded-xl">
                            <Layers className="text-indigo-600" size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900">Device Performance Analytics</h3>
                            <p className="text-sm text-gray-500 font-medium">Release-on-release comparison by device type</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Filter Device:</span>
                        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                            {devices.map(dev => (
                                <button
                                    key={dev}
                                    onClick={() => setSelectedDevice(dev)}
                                    className={`px-5 py-2 rounded-lg text-xs font-black transition-all uppercase ${
                                        selectedDevice === dev 
                                        ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                                        : 'text-gray-500 hover:text-indigo-600'
                                    }`}
                                >
                                    {dev}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
                    {/* Device Trend Chart */}
                    <div className="xl:col-span-3 h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deviceTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="release" axisLine={false} tickLine={false} tick={{fill: '#111827', fontSize: 11, fontWeight: 700}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#111827', fontSize: 11, fontWeight: 700}} />
                                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                                <Legend verticalAlign="top" align="right" iconType="circle" height={40}/>
                                <Bar dataKey="pass" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Passed Count" barSize={30} />
                                <Bar dataKey="fail" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed Count" barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Device Metrics Table */}
                    <div className="xl:col-span-2">
                        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-900 text-[10px] text-white uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="py-4 px-4">Release</th>
                                        <th className="py-4 px-4 text-center">Total</th>
                                        <th className="py-4 px-4 text-center">Pass %</th>
                                        <th className="py-4 px-4 text-center text-red-400">Fail %</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm bg-white">
                                    {deviceTrendData.map((d, i) => (
                                        <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                                            <td className="py-4 px-4 font-black text-gray-900">{d.release}</td>
                                            <td className="py-4 px-4 text-center font-bold text-gray-700">{d.total}</td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="text-green-700 font-black">{d.passPct.toFixed(1)}%</span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="text-red-700 font-black">{d.failPct.toFixed(1)}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-black text-gray-900">
                                        <td className="py-5 px-4 uppercase tracking-tighter italic">Sum of Total</td>
                                        <td className="py-5 px-4 text-center text-lg">{grandTotalDevice.total}</td>
                                        <td className="py-5 px-4 text-center text-green-700">
                                            {grandTotalDevice.total > 0 ? ((grandTotalDevice.pass / grandTotalDevice.total) * 100).toFixed(1) : 0}%
                                        </td>
                                        <td className="py-5 px-4 text-center text-red-700">
                                            {grandTotalDevice.total > 0 ? ((grandTotalDevice.fail / grandTotalDevice.total) * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Module Analysis with Searchable Release */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="flex flex-col space-y-8 mb-10 pb-10 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-2 rounded-xl">
                            <PieIcon className="text-white" size={24} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900">Detailed Module Analysis</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center px-1">
                                <RefreshCcw size={14} className="mr-2" /> Select Release
                            </span>
                            <div className="relative group">
                                <input 
                                    list="release-options"
                                    type="text"
                                    placeholder="Start typing to search releases..."
                                    value={selectedModuleRelease === 'all' ? '' : selectedModuleRelease}
                                    onChange={(e) => setSelectedModuleRelease(e.target.value === '' ? 'all' : e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-inner"
                                />
                                <datalist id="release-options">
                                    <option value="all" />
                                    {moduleReleases.filter(r => r !== 'all').map(rel => (
                                        <option key={rel} value={rel} />
                                    ))}
                                </datalist>
                                {selectedModuleRelease !== 'all' && (
                                    <button 
                                        onClick={() => setSelectedModuleRelease('all')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white text-indigo-600 px-3 py-1.5 rounded-lg border-2 border-indigo-50 shadow-sm font-black text-[10px] hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                        CLEAR
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center px-1">
                                <Layers size={14} className="mr-2" /> Device Type
                            </span>
                            <div className="flex flex-wrap bg-gray-50 p-1.5 rounded-2xl border-2 border-gray-100 shadow-inner">
                                {moduleDevices.map(dev => (
                                    <button
                                        key={dev}
                                        onClick={() => setSelectedModuleDevice(dev)}
                                        className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[10px] font-black transition-all uppercase ${
                                            selectedModuleDevice === dev 
                                            ? 'bg-white text-indigo-600 shadow-md border border-gray-100' 
                                            : 'text-gray-500 hover:text-indigo-500'
                                        }`}
                                    >
                                        {dev}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900 text-[10px] text-white uppercase font-black tracking-widest">
                            <tr>
                                <th className="py-4 px-6 rounded-l-2xl">Release</th>
                                <th className="py-4 px-6">Device</th>
                                <th className="py-4 px-6">Module</th>
                                <th className="py-4 px-6 text-center">Total</th>
                                <th className="py-4 px-6 text-center">Pass</th>
                                <th className="py-4 px-6 text-center text-red-400">Fail</th>
                                <th className="py-4 px-6 text-right rounded-r-2xl">Pass Rate</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {filteredModules.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-gray-500 font-bold italic bg-gray-50 rounded-b-2xl">
                                        No modules found for current filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredModules.map((m, i) => (
                                    <tr key={i} className="hover:bg-indigo-50/50 transition-colors group">
                                        <td className="py-5 px-6 font-bold text-indigo-600">{m.release}</td>
                                        <td className="py-5 px-6 uppercase text-[10px] font-black text-gray-500 tracking-tighter">{m.device}</td>
                                        <td className="py-5 px-6 font-black text-gray-900 capitalize text-base">{m.module}</td>
                                        <td className="py-5 px-6 text-center font-mono font-bold text-gray-900">{m.testCount}</td>
                                        <td className="py-5 px-6 text-center text-green-700 font-black">{m.passCount}</td>
                                        <td className="py-5 px-6 text-center text-red-700 font-black">{m.failCount}</td>
                                        <td className="py-5 px-6 text-right">
                                            <span className={`px-3 py-1.5 rounded-xl font-black text-xs ${m.passPct > 90 ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                                                {m.passPct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

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
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

    const toggleSelectAll = () => {
        if (selectedIds.size === runs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(runs.map(r => r.id)));
        }
    };

    const toggleSelect = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const rebuildFlakyMetrics = async () => {
        try {
            await fetch('/api/admin/rebuild-flaky', { method: 'POST' });
        } catch (err) {
            console.error('Failed to auto-rebuild metrics:', err);
        }
    };

    const deleteSelected = async () => {
        const count = selectedIds.size;
        if (!confirm(`Are you sure you want to delete ${count} selected run(s)? This will irreversibly remove all associated test results.`)) {
            return;
        }

        try {
            const response = await fetch('/api/runs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });
            if (!response.ok) throw new Error('Bulk delete failed');
            
            setRuns(runs.filter(run => !selectedIds.has(run.id)));
            setSelectedIds(new Set());
            await rebuildFlakyMetrics();
        } catch (err) {
            alert('Failed to delete selected: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const deleteRun = async (id: number) => {
        if (!confirm('Are you sure you want to delete this run? This will remove all associated test case results and flakiness data for this specific run.')) {
            return;
        }

        try {
            const response = await fetch(`/api/runs/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            setRuns(runs.filter(run => run.id !== id));
            const next = new Set(selectedIds);
            next.delete(id);
            setSelectedIds(next);
            await rebuildFlakyMetrics();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    if (loading) return <div className="flex justify-center p-10"><RefreshCcw className="animate-spin text-indigo-600" /></div>;
    if (error) return <div className="text-red-500 p-10 text-center">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                    <h3 className="text-xl font-bold text-gray-900">Recent Uploads</h3>
                    {selectedIds.size > 0 && (
                        <button 
                            onClick={deleteSelected}
                            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all animate-in fade-in zoom-in duration-200"
                        >
                            <Trash2 size={14} />
                            <span>Delete Selected ({selectedIds.size})</span>
                        </button>
                    )}
                </div>
                <button onClick={fetchHistory} className="p-2 hover:bg-gray-100 rounded-full text-indigo-600 transition-colors">
                    <RefreshCcw size={20} />
                </button>
            </div>

            {runs.length === 0 ? (
                <div className="text-center py-20 text-gray-900 font-medium border-2 border-dashed border-gray-300 rounded-xl">
                    No history found. Upload a report to get started.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-200 text-gray-900 text-xs uppercase font-bold tracking-wider">
                                <th className="px-4 py-3 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                        checked={selectedIds.size === runs.length && runs.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Release</th>
                                <th className="px-4 py-3">Module</th>
                                <th className="px-4 py-3">Metadata</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {runs.map((run) => (
                                <tr key={run.id} className={`border-b border-gray-100 transition-colors group ${selectedIds.has(run.id) ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-4 py-4">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                            checked={selectedIds.has(run.id)}
                                            onChange={() => toggleSelect(run.id)}
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-gray-900 font-medium">
                                        {new Date(run.createdAt).toLocaleDateString()}<br/>
                                        <span className="text-xs font-bold text-indigo-600">{new Date(run.createdAt).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="px-4 py-4 font-bold text-gray-900">{run.releaseName}</td>
                                    <td className="px-4 py-4">
                                        <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-bold uppercase">
                                            {run.module}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-gray-900">
                                        <div className="flex space-x-2">
                                            <span title="Channel" className="bg-gray-200 text-gray-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{run.channel}</span>
                                            <span title="Device" className="bg-gray-200 text-gray-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{run.device}</span>
                                        </div>
                                        <div className="mt-1 text-[10px] font-bold">
                                            Pass: <span className="text-green-700">{run.passCount}</span> / Fail: <span className="text-red-700">{run.failCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button 
                                            onClick={() => deleteRun(run.id)}
                                            className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
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
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'analytics'>('upload');

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <aside className="w-72 bg-white p-6 shadow-xl flex flex-col justify-between border-r border-gray-200">
        <div>
          <div className="flex items-center mb-12">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-200 shadow-lg">
                <TestTube2 size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 ml-3">ResultHub</h1>
          </div>
          <nav className="space-y-4">
            <NavItem
              icon={<UploadCloud size={20} />}
              label="Process Report"
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
            />
            <NavItem
              icon={<BarChart3 size={20} />}
              label="Analytics Dashboard"
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
            />
            <NavItem
              icon={<History size={20} />}
              label="History Management"
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
            />
          </nav>
        </div>
        <div className="text-center text-xs text-gray-900 font-bold border-t border-gray-200 pt-4">
          <p>&copy; {new Date().getFullYear()} Execution Results</p>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto">
        <div className="max-w-[95%] mx-auto">
            <div className="mb-10 text-center lg:text-left">
                <h2 className="text-4xl font-extrabold text-gray-900">
                    {activeTab === 'upload' ? 'Test Report Processor' : 
                     activeTab === 'analytics' ? 'Execution Analytics' :
                     'History & Overrides'}
                </h2>
                <p className="text-gray-700 mt-2 text-lg font-medium">
                    {activeTab === 'upload' ? 'Process Cucumber results and sync with Jira Xray effortlessly.' : 
                     activeTab === 'analytics' ? 'Visualize test health, trends, and quality metrics.' :
                     'Review past uploads and invalidate incorrect data entries.'}
                </p>
            </div>
            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
                {activeTab === 'upload' ? <XrayUploadForm /> : 
                 activeTab === 'analytics' ? <AnalyticsView /> :
                 <HistoryView />}
            </div>
        </div>
      </main>
    </div>
  );
}
