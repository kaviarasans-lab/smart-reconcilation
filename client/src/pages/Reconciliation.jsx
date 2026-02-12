import { useState, useEffect } from 'react';
import { uploadAPI, reconciliationAPI } from '../services/api';
import { formatCurrency, formatDate, statusColors, statusLabels, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { Eye, Edit3, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Reconciliation = () => {
  const { hasRole } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => {
    uploadAPI.getAll().then((res) => {
      const reconciledJobs = res.data.data.filter((j) => j.reconciled);
      setJobs(reconciledJobs);
      if (reconciledJobs.length > 0) {
        setSelectedJob(reconciledJobs[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchResults();
      reconciliationAPI.getSummary(selectedJob).then((res) => setSummary(res.data.data));
    }
  }, [selectedJob, statusFilter, page]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const res = await reconciliationAPI.getResults(selectedJob, params);
      setResults(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    try {
      await reconciliationAPI.resolve(resolveModal._id, {
        newStatus: resolveModal.newStatus,
        correctedFields: resolveModal.corrections,
      });
      toast.success('Record resolved successfully');
      setResolveModal(null);
      fetchResults();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resolve');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reconciliation Results</h1>

      {/* Job Selector & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Upload Job</label>
            <select
              value={selectedJob || ''}
              onChange={(e) => {
                setSelectedJob(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Select Job</option>
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.originalName} ({formatDate(j.createdAt)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All</option>
              <option value="matched">Matched</option>
              <option value="partially_matched">Partially Matched</option>
              <option value="not_matched">Not Matched</option>
              <option value="duplicate">Duplicate</option>
            </select>
          </div>
          {summary && (
            <div className="ml-auto flex gap-4 text-sm">
              <span className="text-green-600 font-medium">Matched: {summary.matched}</span>
              <span className="text-yellow-600 font-medium">Partial: {summary.partially_matched}</span>
              <span className="text-red-600 font-medium">Unmatched: {summary.not_matched}</span>
              <span className="text-orange-600 font-medium">Duplicate: {summary.duplicate}</span>
              <span className="text-indigo-600 font-bold">Accuracy: {summary.accuracy}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            {selectedJob ? 'No results found' : 'Select an upload job to view results'}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result) => {
                  const uploaded = result.uploadedRecordId;
                  const system = result.systemRecordId;
                  const hasMismatch = result.mismatchedFields?.length > 0;

                  return (
                    <tr key={result._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-800">
                        {uploaded?.transactionId || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            hasMismatch && result.mismatchedFields.some((m) => m.field === 'amount')
                              ? 'bg-red-100 text-red-800 px-2 py-0.5 rounded'
                              : 'text-gray-700'
                          )}
                        >
                          {formatCurrency(uploaded?.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            hasMismatch && result.mismatchedFields.some((m) => m.field === 'amount')
                              ? 'bg-red-100 text-red-800 px-2 py-0.5 rounded'
                              : 'text-gray-700'
                          )}
                        >
                          {system ? formatCurrency(system.amount) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-full', statusColors[result.status])}>
                          {statusLabels[result.status]}
                          {result.manuallyResolved && ' (Resolved)'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                result.matchScore >= 80
                                  ? 'bg-green-500'
                                  : result.matchScore >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${result.matchScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{result.matchScore}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDetailModal(result)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {hasRole('admin', 'analyst') && !result.manuallyResolved && (
                            <button
                              onClick={() =>
                                setResolveModal({
                                  ...result,
                                  newStatus: 'matched',
                                  corrections: {},
                                })
                              }
                              className="p-1 text-gray-400 hover:text-green-600"
                              title="Resolve"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Record Details</h3>
              <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Uploaded Record */}
              <div>
                <h4 className="text-sm font-medium text-blue-600 mb-3">Uploaded Record</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Transaction ID:</span>{' '}
                    <span className="font-mono">{detailModal.uploadedRecordId?.transactionId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>{' '}
                    {formatCurrency(detailModal.uploadedRecordId?.amount)}
                  </div>
                  <div>
                    <span className="text-gray-500">Reference:</span>{' '}
                    {detailModal.uploadedRecordId?.referenceNumber}
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>{' '}
                    {formatDate(detailModal.uploadedRecordId?.date)}
                  </div>
                </div>
              </div>

              {/* System Record */}
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-3">System Record</h4>
                {detailModal.systemRecordId ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Transaction ID:</span>{' '}
                      <span className="font-mono">{detailModal.systemRecordId.transactionId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount:</span>{' '}
                      {formatCurrency(detailModal.systemRecordId.amount)}
                    </div>
                    <div>
                      <span className="text-gray-500">Reference:</span>{' '}
                      {detailModal.systemRecordId.referenceNumber}
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>{' '}
                      {formatDate(detailModal.systemRecordId.date)}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No matching system record</p>
                )}
              </div>
            </div>

            {/* Mismatched Fields */}
            {detailModal.mismatchedFields?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-red-600 mb-3">Mismatched Fields</h4>
                <div className="space-y-2">
                  {detailModal.mismatchedFields.map((m) => (
                    <div key={m.field} className="flex items-center gap-4 bg-red-50 p-3 rounded-lg text-sm">
                      <span className="font-medium text-gray-700 w-32 capitalize">{m.field}</span>
                      <span className="text-blue-600">Uploaded: {String(m.uploadedValue)}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="text-green-600">System: {String(m.systemValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <span className={cn('px-2 py-1 text-xs font-medium rounded-full', statusColors[detailModal.status])}>
                {statusLabels[detailModal.status]}
              </span>
              <span className="text-sm text-gray-500">Match Score: {detailModal.matchScore}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Manual Resolution</h3>
              <button onClick={() => setResolveModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select
                  value={resolveModal.newStatus}
                  onChange={(e) => setResolveModal({ ...resolveModal, newStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="matched">Matched</option>
                  <option value="partially_matched">Partially Matched</option>
                  <option value="not_matched">Not Matched</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corrected Amount (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={resolveModal.corrections.amount || ''}
                  onChange={(e) =>
                    setResolveModal({
                      ...resolveModal,
                      corrections: { ...resolveModal.corrections, amount: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Enter corrected amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corrected Transaction ID (optional)
                </label>
                <input
                  type="text"
                  value={resolveModal.corrections.transactionId || ''}
                  onChange={(e) =>
                    setResolveModal({
                      ...resolveModal,
                      corrections: { ...resolveModal.corrections, transactionId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Enter corrected transaction ID"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setResolveModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reconciliation;
