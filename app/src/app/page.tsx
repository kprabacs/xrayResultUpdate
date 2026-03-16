'use client';

import XrayUploadForm from '@/components/XrayUploadForm';
import { TestTube2, UploadCloud } from 'lucide-react';

export default function Home() {

    const NavItem = ({
        icon,
        label,
    }: {
        icon: React.ReactNode;
        label: string;
    }) => (
        <button
        className={`flex items-center w-full px-4 py-3 text-left rounded-lg transition-colors duration-200 bg-indigo-600 text-white shadow-lg`}
        >
        {icon}
        <span className="ml-4 text-sm font-medium">{label}</span>
        </button>
    );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center mb-12">
            <TestTube2 size={32} className="text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-800 ml-3">Report Processor</h1>
          </div>
          <nav className="space-y-4">
            <NavItem
              icon={<UploadCloud size={20} />}
              label="Xray result update"
            />
          </nav>
        </div>
        <div className="text-center text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} Execution Results</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
            <div className="mb-10">
                <h2 className="text-4xl font-bold text-gray-900">Test Report Processor</h2>
                <p className="text-gray-500 mt-2">Your one-stop tool for uploading test execution results to Jira Xray and generating reports.</p>
            </div>
            <div className="bg-white p-10 rounded-2xl shadow-lg">
                <XrayUploadForm />
            </div>
        </div>
      </main>
    </div>
  );
}
