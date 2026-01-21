import React from 'react';
import { ApplicationEntry } from '../types';

interface ApplicationHistoryProps {
    history: ApplicationEntry[];
}

export const ApplicationHistory: React.FC<ApplicationHistoryProps> = ({ history }) => {
    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleDateString();
        } catch (e) {
            return isoString;
        }
    };

    return (
        <div className="h-full p-6 bg-gray-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Application History</h2>
                    <p className="text-sm text-gray-500">Track your automated applications and time saved.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auto-fill Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manual Est.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {history.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(item.date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.company}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{formatDuration(item.autofillTimeSeconds)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(item.estimatedManualTimeSeconds)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${item.status === 'applied' ? 'bg-green-100 text-green-800' :
                                                item.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {history.length === 0 && (
                    <div className="p-12 text-center">
                        <p className="text-gray-500">No applications tracked yet. Use the Auto-Fill tab to start applying!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
