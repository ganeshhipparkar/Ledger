"use client";
import { useState, useEffect } from 'react';
import { DataTable } from '@/components/data-table';
import { activityColumns } from './columns';
import ActivityFilters from './ActivityFilters';
import { authHeaders } from '@/app/lib/auth';
import { decryptResponse } from '@/app/lib/crypto';
import { toast } from 'react-toastify';
import { LogIn, LogOut, UserCog, UserPlus, UserCheck, PlusSquare, Edit, FolderPlus, Activity, KeyRound } from 'lucide-react';

const getIcon = (code) => {
  switch (code) {
    case 'USER_LOGIN':
      return <LogIn className="h-4 w-4 text-green-600" />;
    case 'USER_LOGOUT':
      return <LogOut className="h-4 w-4 text-red-600" />;
    case 'USER_IMPERSONATION':
      return <UserCog className="h-4 w-4 text-purple-600" />;
    case 'USER_CREATE':
      return <UserPlus className="h-4 w-4 text-blue-600" />;
    case 'USER_UPDATE':
      return <UserCheck className="h-4 w-4 text-teal-600" />;
    case 'USER_PASSWORD_CHANGE':
      return <KeyRound className="h-4 w-4 text-orange-600" />;
    case 'COMPANY_CREATE':
      return <PlusSquare className="h-4 w-4 text-sky-600" />;
    case 'COMPANY_UPDATE':
      return <Edit className="h-4 w-4 text-indigo-600" />;
    case 'GROUP_CREATE':
      return <FolderPlus className="h-4 w-4 text-yellow-600" />;
    case 'GROUP_UPDATE':
      return <Edit className="h-4 w-4 text-amber-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

export default function ActivityList() {
  const LIMIT = 10;
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({});

  const fetchData = async (page = 1, customFilters = filters, append = false) => {
    setLoading(true);
    setError('');
    try {
      const body = { page, limit: LIMIT, ...customFilters };
      const response = await fetch('/relayapi', {
        method: 'POST',
        headers: { ...authHeaders(), endpoint: 'list', module: 'activity' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        toast.error('Failed to fetch activity logs', { position: 'top-right' });
      }
      const payload = await response.json();
      const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

      const newActs = data?.data ?? [];
      setActivities((prev) => {
        const existingIds = new Set(prev.map(a => a.logId || a.id));
        const filteredActs = newActs.filter(a => !existingIds.has(a.logId || a.id));
        return append ? [...prev, ...filteredActs] : newActs;
      });
      setTotalPages(Math.ceil((data?.total || 1) / LIMIT));
      setCurrentPage(page);
    } catch (err) {
      toast.error(`${err}`, { position: 'top-right' });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, {}, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    fetchData(1, newFilters, false);
  };

  return (
    <div className="w-full min-h-screen bg-[#f5f6fa] overflow-x-hidden">
      <ActivityFilters onFilterChange={handleFilterChange} />

      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500" aria-label="Breadcrumb">
          <span className="cursor-pointer transition-colors hover:text-blue-600 hover:underline" onClick={() => (window.location.href = '/')}>Home</span>
          <span className="text-gray-400">{'>'}</span>
          <span className="text-gray-800">Activity Log</span>
        </nav>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[#1f2937]">Activity Log</h1>
        </div>

        {error && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-red-600 font-semibold mb-4">{error}</div>
        )}

        {!error && (
          <DataTable columns={activityColumns} data={activities} />
        )}

        {loading && (
          <div className="text-center py-8 text-gray-500 font-medium">
            Loading activities...
          </div>
        )}
      </div>
    </div>
  );
}
