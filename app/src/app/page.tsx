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
    TrendingDown,
    Layers,
    Filter,
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    Download,
    Bot,
    UserCheck,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Edit3,
    Save,
    MessageSquare,
    X,
    Dna,
    Activity,
    RotateCw,
    ShieldCheck,
    ExternalLink,
    Link2Off,
    Bug
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
import * as XLSX from 'xlsx';

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

interface AnalyticsModule {
    app: string;
    release: string;
    device: string;
    module: string;
    testCount: number;
    passCount: number;
    failCount: number;
    passPct: number;
    isUnstable: boolean;
    hasMultipleRuns: boolean;
    flakyCount: number;
    flipCount: number;
}

interface AnalyticsTrend {
    release: string;
    app: string;
    pass: number;
    fail: number;
}

interface AnalyticsData {
    summary: AnalyticsSummary[];
    moduleStats: AnalyticsModule[];
    trend: AnalyticsTrend[];
}

interface ComparisonData {
    baseRelease: string;
    targetRelease: string;
    overall: {
        basePct: number;
        targetPct: number;
        delta: number;
    };
    modules: {
        module: string;
        basePct: number;
        targetPct: number;
        delta: number;
    }[];
}

interface DnaStrand {
    id: string;
    name: string;
    history: string[];
    reliability: number;
}

interface DnaMatrix {
    releases: string[];
    dna: DnaStrand[];
}

const DnaMatrixModal = ({ 
    moduleData, 
    onClose 
}: { 
    moduleData: { app: string, module: string, device: string } | null, 
    onClose: () => void 
}) => {
    const [data, setData] = useState<DnaMatrix | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (moduleData) {
            const fetchDna = async () => {
                setLoading(true);
                try {
                    const response = await fetch(`/api/analytics/test-history?app=${moduleData.app}&module=${moduleData.module}&device=${moduleData.device}`);
                    const result = await response.json();
                    setData(result);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            };
            fetchDna();
        }
    }, [moduleData]);

    const downloadDnaExcel = () => {
        if (!data || !moduleData) return;
        const reportData = data.dna.map(strand => {
            const row: any = { "Test Case ID": strand.id, "Test Case Name": strand.name };
            data.releases.forEach((rel, idx) => { row[rel] = strand.history[idx].toUpperCase().replace('_', ' '); });
            row["Reliability Score"] = `${strand.reliability.toFixed(0)}%`;
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DNA Matrix");
        XLSX.writeFile(wb, `Test_DNA_${moduleData.module}_${moduleData.app}.xlsx`);
    };

    if (!moduleData) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-white w-full max-w-7xl h-full max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center space-x-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200"><Dna size={28} className="text-white" /></div>
                        <div><h2 className="text-3xl font-black text-gray-900 flex items-center">Test DNA Matrix: <span className="text-indigo-600 ml-2 capitalize">{moduleData.module}</span></h2><p className="text-gray-500 font-bold text-sm uppercase tracking-widest mt-1">App: {moduleData.app} | Device: {moduleData.device} | History</p></div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {data && <button onClick={downloadDnaExcel} className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"><Download size={16} /><span>DOWNLOAD DNA EXCEL</span></button>}
                        <button onClick={onClose} className="bg-white p-3 rounded-2xl border-2 border-gray-100 text-gray-400 hover:text-red-600 hover:border-red-50 transition-all shadow-sm"><X size={24} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-8">
                    {loading ? (<div className="h-full flex flex-col items-center justify-center space-y-4"><RefreshCcw size={48} className="animate-spin text-indigo-600" /><p className="font-black text-gray-400 uppercase tracking-tighter">Decoding Test Patterns...</p></div>) : data && data.dna.length > 0 ? (
                        <div className="space-y-8">
                            <div className="flex items-center space-x-8 bg-gray-900 text-white px-6 py-4 rounded-2xl inline-flex">
                                <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div><span className="text-[10px] font-black uppercase tracking-wider">Reliable Pass</span></div>
                                <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div><span className="text-[10px] font-black uppercase tracking-wider">Reliable Fail</span></div>
                                <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse"></div><span className="text-[10px] font-black uppercase tracking-wider">Flaky (Flipped)</span></div>
                                <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full bg-gray-700"></div><span className="text-[10px] font-black uppercase tracking-wider">No Data</span></div>
                            </div>
                            <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-gray-50 shadow-inner">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-white"><tr className="border-b-2 border-gray-100"><th className="py-6 px-6 min-w-[200px] text-[10px] font-black uppercase text-gray-400 tracking-widest bg-white">Test Case ID / Name</th>{data.releases.map((rel, idx) => (<th key={idx} className="py-6 px-4 text-center min-w-[100px] bg-white border-l border-gray-50 text-[10px] font-black uppercase text-gray-900">{rel}</th>))}<th className="py-6 px-6 text-right bg-white border-l border-gray-50 text-[10px] font-black uppercase text-indigo-600 tracking-widest">Score</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">{data.dna.map((strand, sIdx) => (<tr key={sIdx} className="hover:bg-white transition-colors group"><td className="py-5 px-6"><div className="font-black text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">{strand.id}</div><div className="text-[10px] font-bold text-gray-400 truncate uppercase">{strand.name}</div></td>{strand.history.map((status, hIdx) => (<td key={hIdx} className="py-5 px-4 text-center border-l border-gray-50/50"><div className="flex justify-center">{status === 'passed' ? <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm"></div> : status === 'failed' ? <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm"></div> : status === 'flaky' ? <div className="w-4 h-4 rounded-full bg-amber-400 animate-pulse shadow-sm"></div> : <div className="w-4 h-4 rounded-full bg-gray-200"></div>}</div></td>))}<td className="py-5 px-6 text-right border-l border-gray-50/50"><span className={`text-xs font-black px-2 py-1 rounded-lg ${strand.reliability > 90 ? 'bg-green-100 text-green-700' : strand.reliability > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{strand.reliability.toFixed(0)}%</span></td></tr>))}</tbody>
                                </table>
                            </div>
                        </div>
                    ) : (<div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold italic uppercase tracking-tighter">No historical DNA strands decoded.</div>)}
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center"><Activity size={12} className="mr-2" /> Reliability score is based on consistent passes across attempted releases.</div>
            </div>
        </div>
    );
};

const AnalyticsView = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [compData, setCompData] = useState<ComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [compLoading, setCompLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [selectedApp, setSelectedApp] = useState<string>('');

    // Comparison
    const [baseRel, setBaseRel] = useState<string>('');
    const [targetRel, setTargetRel] = useState<string>('');
    const [isCompSubmitted, setIsCompSubmitted] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/analytics/summary');
            const result: AnalyticsData = await response.json();
            setData(result);
            if (result.trend && result.trend.length > 0) {
                const apps = Array.from(new Set(result.trend.map(t => t.app)));
                if (apps.length > 0) setSelectedApp(apps[0]);
            }
        } catch (err) { setError('Failed to fetch analytics'); } finally { setLoading(false); }
    };

    const fetchComparison = async (app: string, base: string, target: string) => {
        if (!app || !base || !target) return;
        setCompLoading(true);
        try {
            const response = await fetch(`/api/analytics/compare?app=${app}&base=${encodeURIComponent(base)}&target=${encodeURIComponent(target)}`);
            const result = await response.json();
            setCompData(result);
            setIsCompSubmitted(true);
        } catch (err) { alert('Comparison failed.'); } finally { setCompLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (data && selectedApp) {
            setIsCompSubmitted(false);
            setCompData(null);
            setBaseRel('');
            setTargetRel('');
        }
    }, [selectedApp, data]);

    if (loading) return <div className="flex justify-center p-20"><RefreshCcw className="animate-spin text-indigo-600" size={40} /></div>;
    if (error) return <div className="text-red-500 p-10 text-center bg-red-50 rounded-xl">{error}</div>;
    if (!data) return null;

    const availableApps = Array.from(new Set(data.trend.map(t => t.app)));
    const filteredTrend = data.trend.filter(t => t.app === selectedApp);
    const filteredSummary = data.summary.filter(s => s.app === selectedApp);
    const allAppReleases = Array.from(new Set(data.trend.filter(t => t.app === selectedApp).map(t => t.release))).sort();

    // Derived KPI Logic
    const totalTests = filteredSummary.reduce((acc, s) => acc + s.testCount, 0);
    const avgPassPct = filteredSummary.length > 0 ? filteredSummary.reduce((acc, s) => acc + s.passPct, 0) / filteredSummary.length : 0;
    const latestRelease = filteredSummary[0];
    const trendDirection = filteredTrend.length >= 2 ? filteredTrend[filteredTrend.length - 1].pass - filteredTrend[filteredTrend.length - 2].pass : 0;

    return (
        <div className="space-y-10 relative isolate">
            {/* Header: Project Selection & KPIs */}
            <div className="flex flex-col space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-indigo-50 gap-6">
                    <div className="flex items-center space-x-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
                            <BarChart3 size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Execution Dashboard</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select project to update metrics</p>
                        </div>
                    </div>
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                        {availableApps.map(app => (
                            <button 
                                key={app} 
                                onClick={() => setSelectedApp(app)} 
                                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${selectedApp === app ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {app}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KpiCard 
                        icon={<Layers size={20}/>} 
                        label="Cumulative Tests" 
                        value={totalTests.toLocaleString()} 
                        color="indigo" 
                        tooltip="Total sum of test scenarios executed across all uploaded reports for the selected project."
                    />
                    <KpiCard 
                        icon={<Activity size={20}/>} 
                        label="Average Stability" 
                        value={`${avgPassPct.toFixed(1)}%`} 
                        color="emerald" 
                        tooltip="The arithmetic mean of pass percentages calculated across all available releases for the selected project."
                    />
                    <KpiCard 
                        icon={<CheckCircle size={20}/>} 
                        label="Latest Release" 
                        value={latestRelease ? `${latestRelease.passPct.toFixed(1)}%` : 'N/A'} 
                        subValue={latestRelease?.release} 
                        color="blue" 
                        tooltip="The pass rate percentage of the most recently uploaded execution report."
                    />
                    <KpiCard 
                        icon={trendDirection >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>} 
                        label="Overall Momentum" 
                        value={trendDirection >= 0 ? 'Improving' : 'Regression'} 
                        color={trendDirection >= 0 ? 'emerald' : 'rose'} 
                        tooltip="Calculated by comparing the absolute pass count of the latest release against the release immediately preceding it."
                    />
                </div>
            </div>

            {/* Main Visuals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><TrendingUp size={20} /></div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight font-sans">Execution Stability Trend</h3>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredTrend}>
                                <defs>
                                    <linearGradient id="dashboardPass" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="release" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}} />
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                                <Area type="monotone" dataKey="pass" stroke="#4f46e5" fillOpacity={1} fill="url(#dashboardPass)" strokeWidth={4} name="Passed Scenarios" />
                                <Area type="monotone" dataKey="fail" stroke="#ef4444" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" name="Failed Scenarios" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 h-full">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><BarChart3 size={20} /></div>
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight font-sans">Performance Snapshot</h3>
                    </div>
                    <div className="overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-gray-400 uppercase font-black border-b border-gray-100">
                                <tr><th className="pb-4">Release</th><th className="pb-4 text-right">Pass %</th></tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredSummary.slice(0, 6).map((s, i) => (
                                    <tr key={i} className="group">
                                        <td className="py-4 font-bold text-gray-700 group-hover:text-indigo-600 transition-colors uppercase text-[11px]">{s.release}</td>
                                        <td className="py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-gray-900">{s.passPct.toFixed(1)}%</span>
                                                <div className="w-16 bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                                    <div className="bg-indigo-600 h-full rounded-full" style={{width: `${s.passPct}%`}}></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Tool: Delta Analysis */}
            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-200/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-gray-100">
                    <div className="flex items-center space-x-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200 text-white">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Release-on-Release Delta Analysis</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">Manually compare health shifts between target releases.</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 shadow-inner">
                            <select value={baseRel} onChange={(e) => setBaseRel(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase text-gray-600 outline-none px-3 focus:ring-0 cursor-pointer">
                                <option value="">Base Release</option>
                                {allAppReleases.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <span className="text-gray-300"><Minus size={14} /></span>
                            <select value={targetRel} onChange={(e) => setTargetRel(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase text-indigo-600 outline-none px-3 focus:ring-0 cursor-pointer font-black">
                                <option value="">Target Release</option>
                                {allAppReleases.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <button 
                            onClick={() => fetchComparison(selectedApp, baseRel, targetRel)} 
                            disabled={!baseRel || !targetRel || baseRel === targetRel || compLoading} 
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-200 disabled:bg-gray-200 hover:bg-indigo-700 transition-all flex items-center space-x-2"
                        >
                            {compLoading ? <RefreshCcw size={14} className="animate-spin" /> : <Layers size={14} />}
                            <span>Run Comparison</span>
                        </button>
                        {isCompSubmitted && (
                            <button onClick={() => { setIsCompSubmitted(false); setCompData(null); setBaseRel(''); setTargetRel(''); }} className="bg-red-50 text-red-600 p-3 rounded-2xl hover:bg-red-100 transition-all">
                                <RefreshCcw size={18} />
                            </button>
                        )}
                    </div>
                </div>
                
                {!isCompSubmitted ? (
                    <div className="py-24 text-center">
                        <div className="bg-gray-50 inline-block p-10 rounded-[40px] mb-6">
                            <Activity size={64} className="text-gray-200" />
                        </div>
                        <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight">Comparison Pending</h4>
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2 max-w-sm mx-auto">Select two releases above to visualize delta metrics and regression markers.</p>
                    </div>
                ) : compData && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-gray-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={80} /></div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Aggregate Pass Delta</p>
                                <div className="flex items-end space-x-4">
                                    <h4 className="text-5xl font-black tracking-tighter">{compData.overall.targetPct.toFixed(1)}%</h4>
                                    <div className={`flex items-center mb-2 font-black text-base px-3 py-1 rounded-xl ${compData.overall.delta >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {compData.overall.delta >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                        <span>{Math.abs(compData.overall.delta).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 group hover:shadow-lg transition-all">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Recovered Modules</p>
                                <h4 className="text-5xl font-black text-indigo-900">{compData.modules.filter(m => m.delta > 0).length}</h4>
                                <div className="mt-4 h-1.5 w-12 bg-indigo-200 rounded-full"></div>
                            </div>
                            <div className="bg-rose-50 p-8 rounded-3xl border border-rose-100 group hover:shadow-lg transition-all">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 mb-2">Regressed Modules</p>
                                <h4 className="text-5xl font-black text-rose-900">{compData.modules.filter(m => m.delta < 0).length}</h4>
                                <div className="mt-4 h-1.5 w-12 bg-rose-200 rounded-full"></div>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-[32px] border border-gray-100 shadow-xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-[10px] text-gray-900 uppercase font-black tracking-[0.15em]">
                                    <tr>
                                        <th className="py-6 px-8">Module Name</th>
                                        <th className="py-6 px-8 text-center">Previous</th>
                                        <th className="py-6 px-8 text-center text-indigo-600">Current</th>
                                        <th className="py-6 px-8 text-center">Change (Δ)</th>
                                        <th className="py-6 px-8 text-right">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm bg-white">
                                    {compData.modules.map((m, i) => (
                                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                            <td className="py-6 px-8 font-black text-gray-900 capitalize tracking-tight">{m.module}</td>
                                            <td className="py-6 px-8 text-center font-bold text-gray-400">{m.basePct.toFixed(1)}%</td>
                                            <td className="py-6 px-8 text-center font-black text-indigo-700">{m.targetPct.toFixed(1)}%</td>
                                            <td className={`py-6 px-8 text-center font-black ${m.delta > 0 ? 'text-emerald-600' : m.delta < 0 ? 'text-rose-600' : 'text-gray-300'}`}>
                                                {m.delta > 0 ? '+' : ''}{m.delta.toFixed(1)}%
                                            </td>
                                            <td className="py-6 px-8 text-right">
                                                {m.delta > 0 ? (
                                                    <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">Improving <ArrowUpRight size={14} className="ml-1.5" /></span>
                                                ) : m.delta < 0 ? (
                                                    <span className="inline-flex items-center text-rose-600 bg-rose-50 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">Regression <ArrowDownRight size={14} className="ml-1.5" /></span>
                                                ) : (
                                                    <span className="inline-flex items-center text-gray-400 bg-gray-50 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">Stable</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const KpiCard = ({ icon, label, value, subValue, color, tooltip }: { icon: React.ReactNode, label: string, value: string, subValue?: string, color: 'indigo' | 'emerald' | 'rose' | 'blue', tooltip: string }) => {
    const colorClasses = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100'
    };

    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all group relative">
            {/* Tooltip */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-48 p-3 bg-gray-900 text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl text-center">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
            </div>

            <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]} border transition-all`}>
                    {icon}
                </div>
                {subValue && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{subValue}</span>}
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">{label}</p>
            <h4 className="text-2xl font-black text-gray-900 tracking-tighter">{value}</h4>
        </div>
    );
};

const ModuleAnalysisView = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [selectedApp, setSelectedApp] = useState<string>('');
    const [selectedModuleDevice, setSelectedModuleDevice] = useState<string>('all');
    const [selectedModuleRelease, setSelectedModuleRelease] = useState<string>('all');
    const [submittedRelease, setSubmittedRelease] = useState<string | null>(null);

    // Modal
    const [dnaModule, setDnaModule] = useState<{ app: string, module: string, device: string } | null>(null);
    const [hoveredModule, setHoveredModule] = useState<{ m: AnalyticsModule, x: number, y: number } | null>(null);
    const [selectedTrendModule, setSelectedTrendModule] = useState<{ module: string, device: string } | null>(null);
    const trendRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedTrendModule && trendRef.current) {
            trendRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selectedTrendModule]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/analytics/summary');
            const result: AnalyticsData = await response.json();
            setData(result);
            if (result.trend && result.trend.length > 0) {
                const apps = Array.from(new Set(result.trend.map(t => t.app)));
                if (apps.length > 0) setSelectedApp(apps[0]);
            }
        } catch (err) { setError('Failed to fetch analytics'); } finally { setLoading(false); }
    };

    const downloadFlakyReport = async (m: AnalyticsModule) => {
        if (downloading) return;
        setDownloading(true);
        try {
            const query = new URLSearchParams({ app: m.app, release: m.release, device: m.device, module: m.module }).toString();
            const response = await fetch(`/api/analytics/flaky-report?${query}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed');

            const wsAll = XLSX.utils.json_to_sheet(result);
            const diffResults = result.filter((row: any) => {
                const statuses = Object.keys(row).filter(k => k.startsWith('Run ')).map(k => row[k]).filter(s => s !== 'N/A');
                return new Set(statuses).size > 1;
            });
            const wsDiff = XLSX.utils.json_to_sheet(diffResults);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsAll, "All Multi-run Tests");
            XLSX.utils.book_append_sheet(wb, wsDiff, "Status Changes Only");
            XLSX.writeFile(wb, `Stability_Report_${m.app}_${m.module}_${m.release}.xlsx`);
        } catch (err) { alert('Failed.'); } finally { setDownloading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    if (loading) return <div className="flex justify-center p-20"><RefreshCcw className="animate-spin text-indigo-600" size={40} /></div>;
    if (error) return <div className="text-red-500 p-10 text-center bg-red-50 rounded-xl">{error}</div>;
    if (!data) return null;

    const availableApps = Array.from(new Set(data.trend.map(t => t.app)));
    const moduleDevices = ['all', ...Array.from(new Set(data.moduleStats.filter(m => m.app === selectedApp).map(m => m.device)))];
    const moduleReleases = ['all', ...Array.from(new Set(data.moduleStats.filter(m => m.app === selectedApp).map(m => m.release)))];

    const filteredModules = data.moduleStats.filter(m => 
        m.app === selectedApp &&
        (selectedModuleDevice === 'all' || m.device === selectedModuleDevice) &&
        (m.release === submittedRelease)
    );

    const getModuleTrendData = (moduleName: string, device: string) => {
        return data.moduleStats
            .filter(m => m.app === selectedApp && m.module === moduleName && m.device === device)
            .sort((a, b) => a.release.localeCompare(b.release));
    };

    const downloadFilteredAnalysisExcel = () => {
        if (filteredModules.length === 0) return;
        
        const reportData = filteredModules.map(m => ({
            'Release': m.release,
            'Device': m.device.toUpperCase(),
            'Module': m.module,
            'Stability': m.isUnstable ? 'UNSTABLE' : 'STABLE',
            'Total Tests': m.testCount,
            'Pass Count': m.passCount,
            'Fail Count': m.failCount,
            'Pass Rate (%)': `${m.passPct.toFixed(1)}%`
        }));

        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Module Analysis");
        XLSX.writeFile(wb, `Module_Analysis_${selectedApp}_${submittedRelease || 'all'}.xlsx`);
    };

    return (
        <div className="space-y-12 relative isolate">
            <DnaMatrixModal moduleData={dnaModule} onClose={() => setDnaModule(null)} />

            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                <div className="flex items-center space-x-3"><div className="bg-indigo-600 p-2 rounded-lg"><PieIcon size={20} className="text-white" /></div><h3 className="text-lg font-bold text-gray-900">Project Selection</h3></div>
                <div className="flex bg-gray-100 p-1 rounded-xl">{availableApps.map(app => (<button key={app} onClick={() => { setSelectedApp(app); setSubmittedRelease(null); setSelectedTrendModule(null); }} className={`px-6 py-2 rounded-lg text-sm font-extrabold transition-all uppercase ${selectedApp === app ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>{app}</button>))}</div>
            </div>

            {selectedTrendModule && (
                <div ref={trendRef} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200"><TrendingUp size={24} className="text-white" /></div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Module Execution History: <span className="text-indigo-600">{selectedTrendModule.module}</span></h3>
                                <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">App: {selectedApp} | Device: {selectedTrendModule.device}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedTrendModule(null)} className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"><X size={20} /></button>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getModuleTrendData(selectedTrendModule.module, selectedTrendModule.device)}>
                                <defs>
                                    <linearGradient id="moduleColorPass" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="release" axisLine={false} tickLine={false} tick={{fill: '#111827', fontSize: 10, fontWeight: 800}} dy={10} />
                                <YAxis yId="left" axisLine={false} tickLine={false} tick={{fill: '#111827', fontSize: 10, fontWeight: 800}} unit="%" />
                                <YAxis yId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#6366f1', fontSize: 10, fontWeight: 800}} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                                    itemStyle={{fontSize: '11px', fontWeight: 900, textTransform: 'uppercase'}}
                                />
                                <Area yId="left" type="monotone" dataKey="passPct" stroke="#4f46e5" fillOpacity={1} fill="url(#moduleColorPass)" strokeWidth={4} name="Pass Rate" />
                                <Area yId="right" type="monotone" dataKey="testCount" stroke="#6366f1" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" name="Tests" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 relative">
                <div className="flex flex-col space-y-8 mb-10 pb-10 border-b border-gray-100">
                    <div className="flex items-center justify-between"><div className="flex items-center space-x-3"><div className="bg-indigo-600 p-2 rounded-xl"><Filter className="text-white" size={24} /></div><h3 className="text-2xl font-black text-gray-900">Detailed Module Analysis</h3></div>{submittedRelease && <button onClick={() => { setSubmittedRelease(null); setSelectedModuleRelease('all'); }} className="text-[10px] font-black text-gray-400 hover:text-red-600 uppercase tracking-widest transition-colors">Reset View</button>}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
                        <div className="space-y-3"><span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center px-1 font-sans"><RefreshCcw size={14} className="mr-2" /> 1. Select Release</span><div className="relative"><input list="release-options" type="text" placeholder="Search release..." value={selectedModuleRelease === 'all' ? '' : selectedModuleRelease} onChange={(e) => setSelectedModuleRelease(e.target.value === '' ? 'all' : e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-inner" /><datalist id="release-options">{moduleReleases.filter(r => r !== 'all').map(rel => (<option key={rel} value={rel} />))}</datalist></div></div>
                        <div className="space-y-3"><span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center px-1 font-sans"><Layers size={14} className="mr-2" /> 2. Device Type</span><div className="flex flex-wrap bg-gray-50 p-1.5 rounded-2xl border-2 border-gray-100 shadow-inner">{moduleDevices.map(dev => (<button key={dev} onClick={() => setSelectedModuleDevice(dev)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[10px] font-black transition-all uppercase ${selectedModuleDevice === dev ? 'bg-white text-indigo-600 shadow-md border border-gray-100' : 'text-gray-500 hover:text-indigo-500'}`}>{dev}</button>))}</div></div>
                        <div className="pb-1">
                            <button onClick={() => setSubmittedRelease(selectedModuleRelease)} disabled={selectedModuleRelease === 'all' || selectedModuleRelease === ''} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-200 transition-all flex items-center justify-center space-x-2">
                                <BarChart3 size={18} />
                                <span>GENERATE ANALYSIS</span>
                            </button>
                        </div>
                        <div className="pb-1">
                            <button onClick={downloadFilteredAnalysisExcel} disabled={!submittedRelease || filteredModules.length === 0} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 disabled:bg-gray-200 transition-all flex items-center justify-center space-x-2">
                                <Download size={18} />
                                <span>EXPORT TO EXCEL</span>
                            </button>
                        </div>
                    </div>
                </div>

                {!submittedRelease ? (<div className="py-24 text-center"><div className="bg-gray-50 inline-block p-8 rounded-full mb-6"><Filter size={48} className="text-gray-300" /></div><h4 className="text-xl font-black text-gray-900">Analysis Pending</h4><p className="text-gray-500 font-medium max-w-xs mx-auto mt-2 italic uppercase tracking-tighter">Submit release above to decode module patterns.</p></div>) : (
                    <div className="overflow-x-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <table className="w-full text-left"><thead className="bg-gray-900 text-[10px] text-white uppercase font-black tracking-widest font-sans"><tr><th className="py-4 px-6 rounded-l-2xl">Release</th><th className="py-4 px-6">Device</th><th className="py-4 px-6">Module</th><th className="py-4 px-6 text-center">History</th><th className="py-4 px-6 text-center">Stability</th><th className="py-4 px-6 text-center">Trend</th><th className="py-4 px-6 text-center">Total</th><th className="py-4 px-6 text-center">Pass</th><th className="py-4 px-6 text-center text-red-400">Fail</th><th className="py-4 px-6 text-right rounded-r-2xl">Pass Rate</th></tr></thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {filteredModules.length === 0 ? (<tr><td colSpan={10} className="py-20 text-center text-gray-500 font-bold italic bg-gray-50 rounded-b-2xl">No modules found.</td></tr>) : (
                                    filteredModules.map((m, i) => {
                                        const history = getModuleTrendData(m.module, m.device);
                                        const latestIdx = history.findIndex(h => h.release === m.release);
                                        const prev = latestIdx > 0 ? history[latestIdx - 1] : null;
                                        const trend = prev ? m.passPct - prev.passPct : 0;

                                        return (
                                            <tr key={i} className="hover:bg-indigo-50/50 transition-colors group">
                                                <td className="py-5 px-6 font-bold text-indigo-600 font-sans">{m.release}</td>
                                                <td className="py-5 px-6 uppercase text-[10px] font-black text-gray-500 tracking-tighter font-sans">{m.device}</td>
                                                <td className="py-5 px-6">
                                                    <button onClick={() => setDnaModule({ app: selectedApp, module: m.module, device: m.device })} className="font-black text-gray-900 capitalize text-base hover:text-indigo-600 hover:underline transition-all underline-offset-4 font-sans text-left">{m.module}</button>
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    <button onClick={() => setSelectedTrendModule({ module: m.module, device: m.device })} className="text-[9px] font-black text-indigo-400 hover:text-indigo-600 flex items-center justify-center mx-auto uppercase tracking-widest"><TrendingUp size={10} className="mr-1" /> View History</button>
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    <div className="flex items-center justify-center space-x-2" onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoveredModule({ m, x: rect.left + rect.width / 2, y: rect.top }); }} onMouseLeave={() => setHoveredModule(null)}>
                                                        {m.isUnstable ? (
                                                            <button 
                                                                onClick={() => downloadFlakyReport(m)} 
                                                                disabled={downloading} 
                                                                className="flex items-center justify-center space-x-1 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition-all disabled:opacity-50"
                                                            >
                                                                <AlertCircle size={14} className={downloading ? "animate-spin text-amber-400" : "animate-pulse"} />
                                                                <span className="text-[10px] font-black">UNSTABLE</span>
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => downloadFlakyReport(m)} 
                                                                disabled={downloading} 
                                                                className="flex items-center justify-center space-x-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-all disabled:opacity-50"
                                                            >
                                                                <CheckCircle size={14} className={downloading ? "animate-spin text-green-400" : ""} />
                                                                <span className="text-[10px] font-black uppercase">Stable</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    {prev ? (
                                                        <div className={`flex items-center justify-center ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-300'}`} title={`Change from ${prev.release}: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`}>
                                                            {trend > 0 ? <ArrowUpRight size={18} /> : trend < 0 ? <ArrowDownRight size={18} /> : <Minus size={18} />}
                                                            <span className="text-[10px] font-black ml-0.5">{Math.abs(trend).toFixed(0)}%</span>
                                                        </div>
                                                    ) : <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">New</span>}
                                                </td>
                                                <td className="py-5 px-6 text-center font-mono font-bold text-gray-900 font-sans">{m.testCount}</td>
                                                <td className="py-5 px-6 text-center text-green-700 font-black font-sans">{m.passCount}</td>
                                                <td className="py-5 px-6 text-center text-red-700 font-black font-sans">{m.failCount}</td>
                                                <td className="py-5 px-6 text-right font-sans"><span className={`px-3 py-1.5 rounded-xl font-black text-xs ${m.passPct > 90 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{m.passPct.toFixed(1)}%</span></td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tooltip Portal */}
                {hoveredModule && (
                    <div className="fixed z-[9999] pointer-events-none transition-all duration-200 -translate-x-1/2 -translate-y-full" style={{ left: hoveredModule.x, top: hoveredModule.y - 12 }}>
                        <div className={`border border-gray-200 rounded-2xl shadow-2xl overflow-hidden w-72 ${hoveredModule.m.isUnstable ? 'bg-amber-50' : 'bg-indigo-50'}`}>
                            <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${hoveredModule.m.isUnstable ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}><AlertCircle size={14} /><span>{hoveredModule.m.isUnstable ? 'Stability Alert' : 'Quality Verified'}</span></div>
                            <div className="p-4 space-y-3 text-left whitespace-normal">
                                <div className={`p-3 rounded-xl border ${hoveredModule.m.isUnstable ? 'bg-white/60 border-amber-200' : 'bg-white/60 border-indigo-200'}`}><p className="text-black text-[11px] font-black leading-relaxed">{hoveredModule.m.isUnstable ? `This module contains ${hoveredModule.m.flakyCount} unique test(s) that flipped across ${hoveredModule.m.flipCount} total attempts.` : "Reliability is 100% across all execution attempts."}</p></div>
                                <div className="pt-1 flex items-center justify-center text-[9px] font-black text-indigo-600 italic"><Download size={10} className="mr-1" /> Click 'Stable' or 'UNSTABLE' badge to download details</div>
                            </div>
                        </div>
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 border-r border-b rotate-45 shadow-sm ${hoveredModule.m.isUnstable ? 'bg-amber-50' : 'bg-indigo-50'}`}></div>
                    </div>
                )}
            </div>
        </div>
    );
};

const RcaManagerView = () => {
    const [failures, setFailures] = useState<any[]>([]);
    const [debugInfo, setDebugInfo] = useState<any | null>(null);
    const [isFallbackResults, setIsFallbackResults] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMetaLoading, setIsMetaLoading] = useState(true);
    const [editingFailure, setEditingFailure] = useState<any | null>(null);
    const [updating, setUpdating] = useState(false);
    const [creatingBug, setCreatingBug] = useState<string | null>(null);

    // Filters
    const [selectedApp, setSelectedApp] = useState<string>('');
    const [selectedRelease, setSelectedRelease] = useState<string>('');
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [selectedModule, setSelectedModule] = useState<string>('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // Interactive Category Filter
    const [filterCategory, setFilterCategory] = useState<string | null>(null);

    // Persistent Metadata for Filters
    const [allMetadata, setAllMetadata] = useState<{
        apps: string[],
        releases: string[],
        devices: string[],
        modules: string[],
        combinations: any[]
    }>({ apps: [], releases: [], devices: [], modules: [], combinations: [] });

    // Cascading Handlers
    const handleAppChange = (val: string) => {
        setSelectedApp(val);
        setSelectedRelease('');
        setSelectedDevice('');
        setSelectedModule('');
        setIsSubmitted(false);
        setFilterCategory(null);
    };

    const handleReleaseChange = (val: string) => {
        setSelectedRelease(val);
        setSelectedDevice('');
        setSelectedModule('');
        setIsSubmitted(false);
        setFilterCategory(null);
    };

    const handleDeviceChange = (val: string) => {
        setSelectedDevice(val);
        setSelectedModule('');
        setIsSubmitted(false);
        setFilterCategory(null);
    };

    const handleModuleChange = (val: string) => {
        setSelectedModule(val);
        setIsSubmitted(false);
        setFilterCategory(null);
    };

    const categories = [
        'Comparision Failed', 'Validation Failed', 'Code Error', 'Locator Not Found', 
        'Logic Issue', 'DDSE - Given Element Not Found', 'Browser intermittently closed',
        'MEW/TAB compatability issue', 'Locator Frame Issue', 'API Failure (HTML Response)',
        'Validation Issue', 'Custom Error', 'Unknown'
    ];

    const statuses = ['Auto-Detected', 'Manual Review Required', 'Verified', 'Fix Planned', 'Env Issue'];

    const fetchMetadata = async () => {
        setIsMetaLoading(true);
        try {
            const response = await fetch('/api/rca/filters');
            const data = await response.json();
            setAllMetadata(data);
        } catch (err) { 
            console.error('Failed to fetch filter metadata', err); 
        } finally {
            setIsMetaLoading(false);
        }
    };

    // Derived Options based on selections (Cascading)
    const dynamicOptions = {
        apps: allMetadata.apps,
        releases: selectedApp 
            ? Array.from(new Set(allMetadata.combinations.filter(c => c.app === selectedApp).map(c => c.release)))
            : [],
        devices: (selectedApp && selectedRelease)
            ? Array.from(new Set(allMetadata.combinations.filter(c => c.app === selectedApp && c.release === selectedRelease).map(c => c.device)))
            : [],
        modules: (selectedApp && selectedRelease && selectedDevice)
            ? Array.from(new Set(allMetadata.combinations.filter(c => c.app === selectedApp && c.release === selectedRelease && c.device === selectedDevice).map(c => c.module)))
            : []
    };

    const isFilterComplete = selectedApp && selectedRelease && selectedDevice && selectedModule;

    const categoryStats = failures.reduce((acc: any, f) => {
        const cat = f.rcaCategory || 'Unknown';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});

    const fetchFailures = async () => {
        if (!selectedApp || !selectedRelease || !selectedDevice || !selectedModule) return;
        
        setLoading(true);
        setFilterCategory(null); // Reset interactive filter on new search
        try {
            const params = new URLSearchParams();
            params.append('app', selectedApp);
            params.append('release', selectedRelease);
            params.append('device', selectedDevice);
            params.append('module', selectedModule);

            const response = await fetch(`/api/rca/failures?${params.toString()}`);
            const result = await response.json();
            
            setFailures(result.failures || []);
            setIsSubmitted(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateJiraBug = async (category: string) => {
        const token = localStorage.getItem('resulthub_xray_token');
        if (!token) {
            alert('XRAY API Token not found. Please upload a report with token first, or go to Process Report tab.');
            return;
        }

        const categoryFailures = failures.filter(f => (f.rcaCategory || 'Unknown') === category);
        if (!confirm(`This will create ONE Jira Bug for all ${categoryFailures.length} failures in this category. Proceed?`)) {
            return;
        }

        setCreatingBug(category);
        try {
            const response = await fetch('/api/rca/create-jira-bug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    app: selectedApp,
                    release: selectedRelease,
                    device: selectedDevice,
                    module: selectedModule,
                    xrayToken: token
                })
            });

            const result = await response.json();
            if (response.ok) {
                alert(`✅ Jira Bug Created: ${result.bugKey}\n\nLinked to ${result.count} test cases and Xray executions.`);
                fetchFailures(); // Refresh to show the bug links
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        } catch (err) {
            alert('Failed to connect to Jira API.');
        } finally {
            setCreatingBug(null);
        }
    };

    const syncRunRca = async (runId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/rebuild-rca?runId=${runId}`);
            const data = await response.json();
            
            if (data.count > 0) {
                const breakdownStr = Object.entries(data.breakdown)
                    .map(([cat, count]) => `• ${count} records moved to ${cat}`)
                    .join('\n');
                
                alert(`✅ RCA Sync Complete\n\n${breakdownStr}\n\nTotal Updated: ${data.count} records.`);
            } else {
                alert(data.message || 'No records require backfilling.');
            }

            if (isSubmitted) fetchFailures(); // Refresh current view
        } catch (err) {
            alert('Failed to sync RCA.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    // Background Auto-Sync: Triggered whenever metadata is loaded or filters change
    useEffect(() => {
        const autoSync = async () => {
            if (isMetaLoading) return;
            try {
                const response = await fetch('/api/admin/rebuild-rca');
                const result = await response.json();
                if (result.count > 0) {
                    console.log(`Auto-Sync: Backfilled ${result.count} historical failures.`);
                    if (isSubmitted) fetchFailures(); // Refresh if currently viewing results
                }
            } catch (err) { /* Silent fail for background tasks */ }
        };
        autoSync();
    }, [isMetaLoading]);

    const handleUpdate = async (id: number, payload: any) => {
        setUpdating(true);
        try {
            const response = await fetch('/api/rca/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...payload })
            });
            if (response.ok) {
                setFailures(failures.map(f => f.id === id ? { ...f, ...payload } : f));
                setEditingFailure(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const getCategoryColor = (cat: string) => {
        const c = cat ? cat.toLowerCase() : '';
        if (c.includes('code')) return 'bg-red-100 text-red-700 border-red-200';
        if (c.includes('locator')) return 'bg-amber-100 text-amber-700 border-amber-200';
        if (c.includes('logic')) return 'bg-pink-100 text-pink-700 border-pink-200';
        if (c.includes('validation')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (c.includes('browser')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const clearFilters = () => {
        setSelectedApp('');
        setSelectedRelease('');
        setSelectedDevice('');
        setSelectedModule('');
        setIsSubmitted(false);
        setFilterCategory(null);
    };

    const downloadRcaReport = () => {
        if (failures.length === 0) return;
        const exportData = failures.map(f => ({
            'Scenario Name': f.testCaseName,
            'Test ID': f.testCaseId,
            'Release': f.releaseName,
            'Application': f.TestRunSummary?.channel,
            'Device': f.TestRunSummary?.device,
            'Module': f.TestRunSummary?.module,
            'Step Failed': f.step,
            'Detected RCA': f.rcaCategory,
            'Verification Status': f.rcaStatus,
            'Jira Bug': f.jiraBugKey || '',
            'Analysis Notes': f.rcaNote || '',
            'Error Message': f.errorMessage
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "RCA Report");
        XLSX.writeFile(wb, `RCA_Report_${selectedApp}_${selectedRelease}.xlsx`);
    };

    // Apply the interactive category filter
    const displayedFailures = filterCategory 
        ? failures.filter(f => (f.rcaCategory || 'Unknown') === filterCategory)
        : failures;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Guided Filters */}
            <div className="flex flex-col space-y-6">
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-rose-600 p-3 rounded-2xl shadow-lg shadow-rose-100 text-white">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Failure RCA Manager</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">Follow the steps to isolate execution failures</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {isSubmitted && failures.length > 0 && (
                                <button onClick={downloadRcaReport} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center border border-emerald-100 shadow-sm">
                                    <Download size={14} className="mr-1.5" /> Export Report
                                </button>
                            )}
                            {(selectedApp || selectedRelease || selectedDevice || selectedModule) && (
                                <button onClick={clearFilters} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center">
                                    <RefreshCcw size={14} className="mr-1.5" /> Reset Workflow
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center"><span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center mr-1 text-[8px] text-gray-500">1</span> Application</label>
                            <select value={selectedApp} onChange={(e) => handleAppChange(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-xs font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all">
                                <option value="">Select App</option>
                                {dynamicOptions.apps.map((app: string) => <option key={app} value={app}>{app.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center"><span className={`w-4 h-4 rounded-full ${selectedApp ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-300'} flex items-center justify-center mr-1 text-[8px]`}>2</span> Release</label>
                            <select disabled={!selectedApp} value={selectedRelease} onChange={(e) => handleReleaseChange(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-xs font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all disabled:opacity-40">
                                <option value="">Select Release</option>
                                {dynamicOptions.releases.map((rel: string) => <option key={rel} value={rel}>{rel}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center"><span className={`w-4 h-4 rounded-full ${selectedRelease ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-300'} flex items-center justify-center mr-1 text-[8px]`}>3</span> Device</label>
                            <select disabled={!selectedRelease} value={selectedDevice} onChange={(e) => handleDeviceChange(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-xs font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all disabled:opacity-40">
                                <option value="">Select Device</option>
                                {dynamicOptions.devices.map((dev: string) => <option key={dev} value={dev}>{dev.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center"><span className={`w-4 h-4 rounded-full ${selectedDevice ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-300'} flex items-center justify-center mr-1 text-[8px]`}>4</span> Module</label>
                            <select disabled={!selectedDevice} value={selectedModule} onChange={(e) => handleModuleChange(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-xs font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all disabled:opacity-40">
                                <option value="">Select Module</option>
                                <option value="All">All Modules</option>
                                {dynamicOptions.modules.map((mod: string) => <option key={mod} value={mod}>{mod.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="pb-0.5">
                            <button 
                                onClick={fetchFailures} 
                                disabled={!isFilterComplete || loading} 
                                className="w-full bg-indigo-600 text-white py-4 rounded-[20px] font-black text-[10px] tracking-widest uppercase shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-200 disabled:shadow-none transition-all flex items-center justify-center space-x-2"
                            >
                                {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Activity size={14} />}
                                <span>Generate RCA</span>
                            </button>
                        </div>
                    </div>
                </div>

                {!isSubmitted ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/50">
                        <div className="bg-gray-50 p-12 rounded-full">
                            <Filter size={64} className="text-gray-200" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Analysis Engine Ready</h4>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                                Select your project parameters above to begin deep-dive Root Cause Analysis.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <button 
                                onClick={() => setFilterCategory(null)}
                                className={`p-4 rounded-2xl border transition-all text-left ${filterCategory === null ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-100 hover:border-indigo-200 shadow-sm'}`}
                            >
                                <p className={`text-[10px] font-black uppercase mb-1 ${filterCategory === null ? 'text-indigo-100' : 'text-gray-400'}`}>Total Failures</p>
                                <h4 className="text-2xl font-black">{failures.length}</h4>
                            </button>
                            {Object.entries(categoryStats).map(([cat, count]: any) => (
                                <div key={cat} className="group relative">
                                    <button 
                                        onClick={() => setFilterCategory(cat)}
                                        className={`w-full p-4 rounded-2xl border transition-all text-left ${filterCategory === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-100 hover:border-indigo-200 shadow-sm'}`}
                                    >
                                        <p className={`text-[10px] font-black uppercase mb-1 truncate ${filterCategory === cat ? 'text-indigo-100' : 'text-gray-400'}`}>{cat}</p>
                                        <h4 className="text-2xl font-black">{count}</h4>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleCreateJiraBug(cat); }}
                                        disabled={creatingBug !== null}
                                        title="Create Jira Bug for this Category"
                                        className="absolute -top-2 -right-2 bg-white text-indigo-600 p-2 rounded-xl shadow-lg border border-indigo-50 hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110 disabled:opacity-50"
                                    >
                                        {creatingBug === cat ? <RefreshCcw size={14} className="animate-spin" /> : <Layers size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                                <div className="flex items-center space-x-2">
                                    <Layers size={16} className="text-indigo-600" />
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-900">
                                        Showing {displayedFailures.length} {filterCategory ? `${filterCategory} ` : ""}Failures
                                    </h5>
                                </div>
                                {filterCategory && (
                                    <button onClick={() => setFilterCategory(null)} className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase flex items-center">
                                        <X size={12} className="mr-1" /> Clear Category Filter
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase font-black tracking-widest border-b border-gray-100">
                                        <tr>
                                            <th className="py-6 px-8">Scenario / ID</th>
                                            <th className="py-6 px-8">Release / App</th>
                                            <th className="py-6 px-8 text-center">Detected RCA</th>
                                            <th className="py-6 px-8 text-center">Jira Status</th>
                                            <th className="py-6 px-8 text-center">Status</th>
                                            <th className="py-6 px-8 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-gray-50">
                                        {displayedFailures.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-24 text-center">
                                                    <div className="flex flex-col items-center space-y-4">
                                                        <div className="bg-amber-50 p-6 rounded-full">
                                                            <AlertTriangle size={48} className="text-amber-500" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter">No Results Found</h4>
                                                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                                                                Try changing your category or filter selection.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : displayedFailures.map((f) => (
                                            <tr key={f.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="py-6 px-8">
                                                    <div className="font-black text-gray-900 text-sm group-hover:text-indigo-600 transition-colors capitalize line-clamp-1">{f.testCaseName}</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">{f.testCaseId}</div>
                                                </td>
                                                <td className="py-6 px-8">
                                                    <div className="font-bold text-gray-700 text-xs">{f.releaseName}</div>
                                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter mt-1">{f.TestRunSummary?.channel}</div>
                                                </td>
                                                <td className="py-6 px-8 text-center">
                                                    <div className="flex flex-col items-center space-y-1">
                                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border whitespace-nowrap flex items-center ${getCategoryColor(f.rcaCategory)}`}>
                                                            {f.rcaStatus === 'Verified' || f.rcaStatus === 'Fix Planned' || f.jiraBugKey ? (
                                                                <UserCheck size={12} className="mr-1.5" />
                                                            ) : (
                                                                <Activity size={12} className="mr-1.5" />
                                                            )}
                                                            {f.rcaCategory || 'Unknown'}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
                                                            {f.rcaStatus === 'Verified' || f.rcaStatus === 'Fix Planned' || f.jiraBugKey ? 'Verified' : 'System Identified'}
                                                        </span>
                                                    </div>
                                                </td>
                                                
                                                <td className="py-6 px-8 text-center">
                                                    {f.jiraBugKey ? (
                                                        <a 
                                                            href={f.jiraBugLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                                        >
                                                            <ArrowUpRight size={12} className="mr-1" />
                                                            {f.jiraBugKey}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-gray-300 uppercase italic">No Bug Linked</span>
                                                    )}
                                                </td>

                                                <td className="py-6 px-8 text-center">
                                                    <span className={`inline-flex items-center text-[10px] font-black uppercase ${f.rcaStatus === 'Verified' || f.jiraBugKey ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        {f.rcaStatus === 'Verified' || f.jiraBugKey ? <CheckCircle size={14} className="mr-1.5" /> : <Activity size={14} className="mr-1.5" />}
                                                        {f.jiraBugKey ? 'Verified' : (f.rcaStatus || 'Auto-Detected')}
                                                    </span>
                                                </td>
                                                <td className="py-6 px-8 text-right flex items-center justify-end space-x-2">
                                                    <button 
                                                        onClick={() => syncRunRca(f.testRunSummaryId)} 
                                                        title="Refresh RCA for this Run"
                                                        className="p-3 bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm border border-gray-100"
                                                    >
                                                        <RotateCw size={20} />
                                                    </button>
                                                    <button onClick={() => setEditingFailure({...f})} className="p-3 bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm border border-gray-100">
                                                        <Edit3 size={20} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Edit Modal */}
            {editingFailure && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md" onClick={() => setEditingFailure(null)}></div>
                    <div className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center space-x-4">
                                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200 text-white"><MessageSquare size={24} /></div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Root Cause Analysis</h2>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate max-w-md">{editingFailure.testCaseName}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingFailure(null)} className="bg-white p-3 rounded-2xl border-2 border-gray-100 text-gray-400 hover:text-red-600 hover:border-red-50 transition-all shadow-sm"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                            {/* Error Info */}
                            <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Error Message</p>
                                <pre className="text-rose-900 text-[11px] font-mono whitespace-pre-wrap break-words bg-white/50 p-4 rounded-xl border border-rose-100 max-h-48 overflow-y-auto shadow-inner">
                                    {editingFailure.errorMessage}
                                </pre>
                            </div>

                            {/* Form */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">RCA Category</label>
                                    <select 
                                        value={editingFailure.rcaCategory || 'Unknown'} 
                                        onChange={(e) => setEditingFailure({...editingFailure, rcaCategory: e.target.value})}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Verification Status</label>
                                    <select 
                                        value={editingFailure.rcaStatus || 'Auto-Detected'} 
                                        onChange={(e) => setEditingFailure({...editingFailure, rcaStatus: e.target.value})}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm font-black text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                    >
                                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Analysis Notes</label>
                                <textarea 
                                    value={editingFailure.rcaNote || ''} 
                                    onChange={(e) => setEditingFailure({...editingFailure, rcaNote: e.target.value})}
                                    rows={4}
                                    placeholder="Enter findings, fix details or Jira tickets..."
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                            <button 
                                onClick={() => handleUpdate(editingFailure.id, { 
                                    rcaCategory: editingFailure.rcaCategory, 
                                    rcaNote: editingFailure.rcaNote, 
                                    rcaStatus: editingFailure.rcaStatus 
                                })}
                                disabled={updating}
                                className="bg-indigo-600 text-white px-10 py-4 rounded-[20px] font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-300 transition-all flex items-center space-x-3"
                            >
                                {updating ? <RefreshCcw size={20} className="animate-spin" /> : <Save size={20} />}
                                <span>SAVE ANALYSIS</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const JiraBugManagerView = () => {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingBug, setCreatingBug] = useState<string | null>(null);
    const [jiraEmail, setJiraEmail] = useState('');
    const [jiraToken, setJiraToken] = useState('');
    const [jiraBaseUrl, setJiraBaseUrl] = useState('');
    const [xrayToken, setXrayToken] = useState('');
    const [projectKey, setProjectKey] = useState('DIG');

    useEffect(() => {
        // Load settings
        setJiraEmail(sessionStorage.getItem('resulthub_jira_email') || '');
        setJiraToken(sessionStorage.getItem('resulthub_jira_token') || '');
        setJiraBaseUrl(sessionStorage.getItem('resulthub_jira_url') || '');
        setXrayToken(sessionStorage.getItem('resulthub_xray_token_jira') || '');
        setProjectKey(sessionStorage.getItem('resulthub_jira_project') || 'DIG');
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/jira/bug-groups');
            const data = await response.json();
            setGroups(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = () => {
        sessionStorage.setItem('resulthub_jira_email', jiraEmail);
        sessionStorage.setItem('resulthub_jira_token', jiraToken);
        sessionStorage.setItem('resulthub_jira_url', jiraBaseUrl);
        sessionStorage.setItem('resulthub_xray_token_jira', xrayToken);
        sessionStorage.setItem('resulthub_jira_project', projectKey);
        alert('All Jira & Xray settings saved for this session.');
    };

    const handleCreateBug = async (group: any) => {
        if (!jiraEmail || !jiraToken || !jiraBaseUrl || !xrayToken || !projectKey) {
            alert('Please configure all Jira and Xray settings first.');
            return;
        }

        setCreatingBug(`${group.release}-${group.app}-${group.category}`);
        try {
            const response = await fetch('/api/rca/create-jira-bug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: group.category,
                    app: group.app,
                    release: group.release,
                    xrayToken,
                    jiraEmail,
                    jiraToken,
                    jiraBaseUrl,
                    projectKey,
                    issueType: 'Bug',
                    severity: 'Medium',
                    foundIn: "Regression Testing"
                })
            });

            const result = await response.json();
            if (response.ok) {
                alert(`✅ Bug Created: ${result.bugKey}\nLinked to ${result.count} failures.`);
                fetchGroups();
            } else {
                alert(`❌ Failed: ${result.error}`);
            }
        } catch (err) {
            alert('Network error during bug creation.');
        } finally {
            setCreatingBug(null);
        }
    };

    const handleUnlinkBug = async (group: any) => {
        if (!confirm(`Are you sure you want to UNLINK bug ${group.jiraBugKey} from these ${group.failCount} failures?\n\nThis will NOT delete the Jira ticket, but will mark these failures as 'Pending Report' in ResultHub.`)) {
            return;
        }

        setCreatingBug(`unlink-${group.release}-${group.app}-${group.category}`);
        try {
            const response = await fetch('/api/jira/unlink-bug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: group.category,
                    app: group.app,
                    release: group.release
                })
            });

            const result = await response.json();
            if (response.ok) {
                alert(`✅ Successfully unlinked ${result.count} failures.`);
                fetchGroups();
            } else {
                alert(`❌ Failed: ${result.error}`);
            }
        } catch (err) {
            alert('Network error during unlinking.');
        } finally {
            setCreatingBug(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Jira Settings */}
            <div className="bg-gray-900 p-8 rounded-[40px] text-white shadow-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldCheck size={120} /></div>
                <div className="flex items-center space-x-4 mb-8">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20"><Bug size={24} /></div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter">Jira Core Integration</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Connect board for automated bug reporting</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Jira Base URL</label>
                        <input value={jiraBaseUrl} onChange={e => setJiraBaseUrl(e.target.value)} placeholder="https://macys.atlassian.net" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Work Email</label>
                        <input value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} placeholder="your.name@macys.com" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Project Key</label>
                        <input value={projectKey} onChange={e => setProjectKey(e.target.value)} placeholder="DIG" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Jira API Token</label>
                        <input type="password" value={jiraToken} onChange={e => setJiraToken(e.target.value)} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Xray API Token</label>
                        <div className="flex space-x-2">
                            <input type="password" value={xrayToken} onChange={e => setXrayToken(e.target.value)} placeholder="••••••••" className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                            <button onClick={saveSettings} title="Save all settings" className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-2xl transition-all shadow-xl shadow-indigo-500/20"><Save size={20} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Groups Table */}
            <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Layers size={20} /></div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Consolidated Bug Candidates</h3>
                    </div>
                    <button onClick={fetchGroups} className="bg-gray-50 hover:bg-gray-100 p-3 rounded-2xl text-gray-400 transition-all"><RotateCw size={20} /></button>
                </div>
                
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center space-y-4">
                        <RefreshCcw size={48} className="animate-spin text-indigo-600" />
                        <p className="font-black text-gray-400 uppercase text-xs tracking-widest">Consolidating Failures...</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="py-32 text-center">
                        <div className="bg-emerald-50 inline-block p-8 rounded-full mb-6"><CheckCircle size={48} className="text-emerald-500" /></div>
                        <h4 className="text-xl font-black text-gray-900">Zero Pending Issues</h4>
                        <p className="text-gray-400 font-bold text-xs uppercase mt-2">All failures are either fixed or already bugged.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase font-black tracking-widest">
                            <tr>
                                <th className="py-6 px-8">Release / Project</th>
                                <th className="py-6 px-8">RCA Category</th>
                                <th className="py-6 px-8 text-center">Failures</th>
                                <th className="py-6 px-8 text-center">Status</th>
                                <th className="py-6 px-8 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {groups.map((group, idx) => {
                                const isPending = !group.jiraBugKey;
                                const isProcessing = creatingBug === `${group.release}-${group.app}-${group.category}`;
                                const isUnlinking = creatingBug === `unlink-${group.release}-${group.app}-${group.category}`;
                                
                                return (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-6 px-8">
                                            <div className="font-black text-gray-900 text-sm">{group.release}</div>
                                            <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter mt-1">{group.app}</div>
                                        </td>
                                        <td className="py-6 px-8">
                                            <span className="px-4 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-[10px] font-black uppercase border border-gray-200">{group.category}</span>
                                        </td>
                                        <td className="py-6 px-8 text-center">
                                            <div className="inline-flex flex-col">
                                                <span className="text-lg font-black text-gray-900">{group.failCount}</span>
                                                <span className="text-[8px] font-bold text-gray-400 uppercase">Tests</span>
                                            </div>
                                        </td>
                                        <td className="py-6 px-8 text-center">
                                            {group.jiraBugKey ? (
                                                <a href={group.jiraBugLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm">
                                                    <Bug size={12} />
                                                    <span>{group.jiraBugKey}</span>
                                                    <ExternalLink size={10} />
                                                </a>
                                            ) : (
                                                <span className="inline-flex items-center text-amber-600 bg-amber-50 px-4 py-2 rounded-2xl text-[10px] font-black border border-amber-100">
                                                    <AlertTriangle size={12} className="mr-1.5" />
                                                    PENDING REPORT
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-6 px-8 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                {isPending ? (
                                                    <button 
                                                        onClick={() => handleCreateBug(group)}
                                                        disabled={creatingBug !== null}
                                                        className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                                                    >
                                                        {isProcessing ? <RefreshCcw size={14} className="animate-spin" /> : <Bug size={14} />}
                                                        <span>Create 1 Bug for {group.failCount} Tests</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] font-black text-emerald-500 flex items-center uppercase tracking-widest mr-2">
                                                            <CheckCircle size={14} className="mr-1.5" /> Tracked
                                                        </span>
                                                        <button 
                                                            onClick={() => handleUnlinkBug(group)}
                                                            disabled={creatingBug !== null}
                                                            title="Unlink bug from these failures"
                                                            className="p-3 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl transition-all border border-rose-100"
                                                        >
                                                            {isUnlinking ? <RefreshCcw size={18} className="animate-spin" /> : <Link2Off size={18} />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

interface RunSummary { id: number; releaseName: string; module: string; channel: string; device: string; passCount: number; failCount: number; createdAt: string; jiraExecutionKey?: string | null; }

const HistoryView = () => {
    const [runs, setRuns] = useState<RunSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncingRca, setSyncingRca] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [hasMore, setHasMore] = useState(true);

    const fetchHistory = async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        try {
            const skip = isLoadMore ? runs.length : 0;
            const response = await fetch(`/api/runs?skip=${skip}&take=50`);
            const data = await response.json();
            if (isLoadMore) setRuns([...runs, ...data]); else setRuns(data);
            setHasMore(data.length === 50);
        } catch (err) { } finally { setLoading(false); setLoadingMore(false); }
    };

    const syncRca = async (runId?: number) => {
        setSyncingRca(true);
        try {
            const url = runId ? `/api/admin/rebuild-rca?runId=${runId}` : '/api/admin/rebuild-rca';
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.count > 0) {
                const breakdownStr = Object.entries(data.breakdown)
                    .map(([cat, count]) => `• ${count} records moved to ${cat}`)
                    .join('\n');
                
                alert(`✅ RCA Sync Complete\n\n${breakdownStr}\n\nTotal Updated: ${data.count} records.`);
            } else {
                alert(data.message || 'No records require backfilling.');
            }
        } catch (err) {
            alert('Failed to sync RCA data.');
        } finally {
            setSyncingRca(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    const toggleSelectAll = () => { if (selectedIds.size === runs.length) setSelectedIds(new Set()); else setSelectedIds(new Set(runs.map(r => r.id))); };
    const toggleSelect = (id: number) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };

    const deleteSelected = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected?`)) return;
        try {
            await fetch('/api/runs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
            setRuns(runs.filter(r => !selectedIds.has(r.id)));
            setSelectedIds(new Set());
        } catch (err) { }
    };

    const getNamingSource = (module: string) => {
        // If the module name contains spaces, it was likely cleaned from a JSON ID
        // (Original filename parts were stored with spaces in our new logic)
        if (module.includes(' ')) return { label: 'JSON ID', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
        return { label: 'Filename', color: 'text-amber-600 bg-amber-50 border-amber-100' };
    };

    if (loading) return <div className="flex justify-center p-10"><RefreshCcw className="animate-spin text-indigo-600" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                    <h3 className="text-xl font-bold text-gray-900">Recent Uploads</h3>
                    {selectedIds.size > 0 && <button onClick={deleteSelected} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all"><Trash2 size={14} className="inline mr-2"/>Delete ({selectedIds.size})</button>}
                </div>
                <button 
                    onClick={() => syncRca()} 
                    disabled={syncingRca}
                    className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
                >
                    {syncingRca ? <RefreshCcw size={14} className="animate-spin" /> : <Dna size={14} />}
                    <span>{syncingRca ? 'Syncing...' : 'Re-Sync RCA History'}</span>
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-2 text-gray-900 text-[10px] uppercase font-black tracking-widest">
                            <th className="px-4 py-4"><input type="checkbox" checked={selectedIds.size === runs.length && runs.length > 0} onChange={toggleSelectAll}/></th>
                            <th className="px-4 py-4">Date</th>
                            <th className="px-4 py-4">Release</th>
                            <th className="px-4 py-4">Module</th>
                            <th className="px-4 py-4">Project</th>
                            <th className="px-4 py-4">Metadata</th>
                            <th className="px-4 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {runs.map((run) => {
                            const source = getNamingSource(run.module);
                            return (
                                <tr key={run.id} className={`border-b transition-colors ${selectedIds.has(run.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.has(run.id)} onChange={() => toggleSelect(run.id)}/></td>
                                    <td className="px-4 py-4 font-medium text-gray-900">
                                        <div className="font-black text-xs">{new Date(run.createdAt).toLocaleDateString()}</div>
                                        <div className="text-[10px] text-indigo-600 font-bold">{new Date(run.createdAt).toLocaleTimeString()}</div>
                                    </td>
                                    <td className="px-4 py-4 font-bold text-gray-900 text-xs">{run.releaseName}</td>
                                    <td className="py-4 px-4">
                                        <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm">{run.module}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center space-x-1">
                                            <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase">{run.channel}</span>
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">{run.device}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${source.color}`}>
                                            {source.label}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <div className="flex items-center justify-end">
                                            <button 
                                                onClick={() => syncRca(run.id)}
                                                title="Refresh RCA for this Run"
                                                className="p-2.5 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl transition-all border border-indigo-100 shadow-sm bg-white"
                                            >
                                                <RotateCw size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {hasMore && <div className="pt-6 flex justify-center"><button onClick={() => fetchHistory(true)} disabled={loadingMore} className="bg-indigo-50 text-indigo-600 px-8 py-2.5 rounded-xl text-sm font-bold">{loadingMore ? 'Loading...' : 'Load More'}</button></div>}
        </div>
    );
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'analytics' | 'moduleAnalysis' | 'rca' | 'jira'>('upload');
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <aside className="w-72 bg-white p-6 shadow-xl flex flex-col justify-between border-r">
        <div><div className="flex items-center mb-12"><div className="bg-indigo-600 p-2 rounded-lg shadow-lg"><TestTube2 size={24} className="text-white" /></div><h1 className="text-xl font-bold text-gray-800 ml-3 font-sans">ResultHub</h1></div>
          <nav className="space-y-4">
            <NavItem icon={<UploadCloud size={20} />} label="Process Report" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
            <NavItem icon={<BarChart3 size={20} />} label="Analytics Dashboard" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
            <NavItem icon={<PieIcon size={20} />} label="Module Analysis" active={activeTab === 'moduleAnalysis'} onClick={() => setActiveTab('moduleAnalysis')} />
            <NavItem icon={<AlertTriangle size={20} />} label="Failure RCA" active={activeTab === 'rca'} onClick={() => setActiveTab('rca')} />
            <NavItem icon={<Bug size={20} />} label="Jira Bug Manager" active={activeTab === 'jira'} onClick={() => setActiveTab('jira')} />
            <NavItem icon={<History size={20} />} label="History Management" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          </nav>
        </div>
        <div className="text-center text-xs font-bold border-t pt-4 font-sans"><p>&copy; {new Date().getFullYear()} Execution Results</p></div>
      </aside>
      <main className="flex-1 p-12 overflow-y-auto"><div className="max-w-[95%] mx-auto"><div className="mb-10 text-center lg:text-left"><h2 className="text-4xl font-extrabold text-gray-900 font-sans">{activeTab === 'upload' ? 'Report Processor' : activeTab === 'analytics' ? 'Execution Analytics' : activeTab === 'moduleAnalysis' ? 'Module Deep-Dive' : activeTab === 'rca' ? 'Root Cause Analysis' : activeTab === 'jira' ? 'Jira Bug Manager' : 'History & Overrides'}</h2><p className="text-gray-700 mt-2 text-lg font-medium font-sans">{activeTab === 'upload' ? 'Sync Cucumber with Jira Xray.' : activeTab === 'analytics' ? 'Visualize test health and trends.' : activeTab === 'moduleAnalysis' ? 'Examine per-module stability and DNA.' : activeTab === 'rca' ? 'Categorize and manage test failures.' : activeTab === 'jira' ? 'Consolidate failures into Jira bugs.' : 'Review past uploads.'}</p></div><div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">{activeTab === 'upload' ? <XrayUploadForm /> : activeTab === 'analytics' ? <AnalyticsView /> : activeTab === 'moduleAnalysis' ? <ModuleAnalysisView /> : activeTab === 'rca' ? <RcaManagerView /> : activeTab === 'jira' ? <JiraBugManagerView /> : <HistoryView />}</div></div></main>
    </div>
  );
}
