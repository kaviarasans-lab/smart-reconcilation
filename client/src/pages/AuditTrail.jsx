import { useState, useEffect } from 'react';
import { auditAPI, uploadAPI } from '../services/api';
import { formatDateTime, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  History,
  Upload,
  GitCompare,
  Edit3,
  Plus,
  RefreshCw,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

const actionIcons = {
  create: Plus,
  upload: Upload,
  update: Edit3,
  reconcile: GitCompare,
  manual_resolve: Edit3,
  reprocess: RefreshCw,
};

const actionColors = {
  create: 'bg-blue-500',
  upload: 'bg-purple-500',
  update: 'bg-yellow-500',
  reconcile: 'bg-green-500',
  manual_resolve: 'bg-orange-500',
  reprocess: 'bg-indigo-500',
};

const AuditTrail = () => {
  const { hasRole } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entitySearch, setEntitySearch] = useState('');
  const [entityLogs, setEntityLogs] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');

  // Load all audit logs (admin) or job-specific
  useEffect(() => {
    if (hasRole('admin')) {
      fetchAllLogs();
    }
    uploadAPI.getAll().then((res) => setJobs(res.data.data)).catch(() => {});
  }, [page]);

  const fetchAllLogs = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.getAll({ page, limit: 20 });
      setLogs(res.data.logs);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const searchEntity = async () => {
    if (!selectedEntity) return;
    setLoading(true);
    try {
      const res = await auditAPI.getEntityAudit(selectedEntity);
      setEntityLogs(res.data.data);
    } catch (err) {
      toast.error('Failed to load entity audit');
    } finally {
      setLoading(false);
    }
  };

  const renderTimeline = (items) => (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {items.map((log, index) => {
          const Icon = actionIcons[log.action] || History;
          const colorClass = actionColors[log.action] || 'bg-gray-500';
          const isExpanded = expandedLog === log._id;

          return (
            <div key={log._id} className="relative flex gap-4">
              {/* Icon */}
              <div className={`relative z-10 w-12 h-12 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon className="h-5 w-5 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 capitalize">
                        {log.action.replace('_', ' ')}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {log.entityType.replace('_', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.source === 'manual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.userName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedLog(isExpanded ? null : log._id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {log.oldValue && (
                        <div>
                          <h5 className="text-xs font-medium text-red-600 mb-2">Old Value</h5>
                          <pre className="text-xs bg-red-50 p-3 rounded-lg overflow-x-auto text-gray-700 max-h-48 overflow-y-auto">
                            {JSON.stringify(log.oldValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValue && (
                        <div>
                          <h5 className="text-xs font-medium text-green-600 mb-2">New Value</h5>
                          <pre className="text-xs bg-green-50 p-3 rounded-lg overflow-x-auto text-gray-700 max-h-48 overflow-y-auto">
                            {JSON.stringify(log.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Entity ID: {log.entityId}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Trail</h1>

      {/* Entity Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">View Audit Timeline for Entity</h3>
        <div className="flex gap-3">
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Select an upload job...</option>
            {jobs.map((j) => (
              <option key={j._id} value={j._id}>
                {j.originalName} ({j.status})
              </option>
            ))}
          </select>
          <button
            onClick={searchEntity}
            disabled={!selectedEntity}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            View Timeline
          </button>
        </div>
      </div>

      {/* Entity Timeline */}
      {entityLogs && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Entity Timeline
            <span className="text-sm font-normal text-gray-500 ml-2">({entityLogs.length} events)</span>
          </h3>
          {entityLogs.length > 0 ? (
            renderTimeline(entityLogs)
          ) : (
            <p className="text-gray-400 text-center py-8">No audit logs found for this entity</p>
          )}
        </div>
      )}

      {/* All Audit Logs (Admin) */}
      {hasRole('admin') && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            All Audit Logs
            <span className="text-sm font-normal text-gray-500 ml-2">(Admin View)</span>
          </h3>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : logs.length > 0 ? (
            <>
              {renderTimeline(logs)}
              <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">No audit logs found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditTrail;
