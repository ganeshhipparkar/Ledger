"use client";
import { useState, useEffect } from 'react';
import { authHeaders } from '@/app/lib/auth';
import { decryptResponse } from '@/app/lib/crypto';
import { toast } from 'react-toastify';
import { LogIn, LogOut, UserCog, UserPlus, UserCheck, PlusSquare, Edit, FolderPlus, Activity, KeyRound } from 'lucide-react';
import PremiumDateRangePicker from './PremiumDateRangePicker';

const toIsoDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().split('T')[0];
};

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

export default function ActivityTimeline({ userId, targetType, targetId }) {
  const LIMIT = 10;
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [appliedRange, setAppliedRange] = useState(null);

  const fetchData = async (page = 1, range = appliedRange, append = false) => {
    setLoading(true);
    setError('');
    try {
      const filters = [];
      if (userId) filters.push({ key: 'userProfileId', value: String(userId), operator: 'eq' });
      if (targetType) filters.push({ key: 'targetType', value: targetType, operator: 'eq' });
      if (targetId) filters.push({ key: 'targetId', value: String(targetId), operator: 'eq' });

      const body = {
        page,
        limit: LIMIT,
        ...(filters.length > 0 ? { filters } : {}),
        ...(range?.startDate ? { startDate: toIsoDate(range.startDate) } : {}),
        ...(range?.endDate ? { endDate: toIsoDate(range.endDate) } : {}),
      };

      const response = await fetch('/relayapi', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          endpoint: 'list',
          module: 'activity',
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.message || 'Failed to fetch activity logs', { position: 'top-right' });
        setError(payload?.message || 'Failed to fetch');
        return;
      }

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
    fetchData(1, appliedRange, false);
  }, [userId, targetType, targetId, appliedRange]);

  const handleLoadMore = () => {
    if (currentPage >= totalPages) return;
    fetchData(currentPage + 1, appliedRange, true);
  };

  const severityColor = (severity) => {
    if (severity === 'HIGH') return 'bg-red-100 text-red-700';
    if (severity === 'MEDIUM') return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <PremiumDateRangePicker
          startDate={appliedRange?.startDate}
          endDate={appliedRange?.endDate}
          onChange={(start, end) => setAppliedRange({ startDate: start, endDate: end })}
        />
        {appliedRange && (
          <button
            type="button"
            onClick={() => setAppliedRange(null)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-red-600 cursor-pointer"
          >
            Clear Filter
          </button>
        )}
      </div>

      {error && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-red-600 font-semibold mb-4">
          {error}
        </div>
      )}

      <div className="relative pl-8 border-l border-gray-200 ml-4 space-y-6">
        {activities.map((a) => (
          <div key={a.logId || a.id} className="relative">
            <span className="absolute -left-[48px] top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm">
              {getIcon(a.activityCode)}
            </span>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">
                    {a.activityName ?? 'Activity'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {a.generatedMessage}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    {a.targetType && (
                      <span>Target: <span className="text-gray-600">{a.targetType} #{a.targetId}</span></span>
                    )}
                    {a.companyName && (
                      <span>Company: <span className="text-gray-600">{a.companyName}</span></span>
                    )}
                    <span>Status: <span className={`font-medium ${a.executionStatus === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>{a.executionStatus}</span></span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityColor(a.severity)}`}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && activities.length === 0 && (
          <div className="text-center text-gray-400 py-16 bg-white rounded-xl border border-gray-200 -ml-8">
            No activity records found.
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-4 text-gray-500 font-medium">
          Loading older activities...
        </div>
      )}

      {!loading && currentPage < totalPages && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 cursor-pointer"
          >
            Show older activities
          </button>
        </div>
      )}
    </div>
  );
}
