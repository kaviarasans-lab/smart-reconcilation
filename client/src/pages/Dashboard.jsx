import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { formatNumber } from '../lib/utils';
import { chartColors } from '../lib/utils';
import {
  FileCheck,
  FileX,
  Files,
  Copy,
  Target,
  Filter,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '', uploadedBy: '' });
  const [filterOptions, setFilterOptions] = useState({ uploaders: [], statuses: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.status) params.status = filters.status;
      if (filters.uploadedBy) params.uploadedBy = filters.uploadedBy;

      const [summaryRes, chartRes] = await Promise.all([
        dashboardAPI.getSummary(params),
        dashboardAPI.getChart(params),
      ]);

      setSummary(summaryRes.data.data);
      setChartData(chartRes.data.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    dashboardAPI.getFilters().then((res) => setFilterOptions(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const summaryCards = summary
    ? [
        { label: 'Total Records', value: formatNumber(summary.totalRecords), icon: Files, color: 'bg-blue-500' },
        { label: 'Matched', value: formatNumber(summary.matched), icon: FileCheck, color: 'bg-green-500' },
        { label: 'Unmatched', value: formatNumber(summary.notMatched), icon: FileX, color: 'bg-red-500' },
        { label: 'Duplicates', value: formatNumber(summary.duplicate), icon: Copy, color: 'bg-orange-500' },
        { label: 'Accuracy', value: `${summary.accuracy}%`, icon: Target, color: 'bg-indigo-500' },
      ]
    : [];

  const pieData = chartData?.statusDistribution || [];

  const COLORS = pieData.map((item) => chartColors[item.name] || '#8884d8');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of reconciliation status and trends</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">All</option>
              {filterOptions.statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Uploaded By</label>
            <select
              value={filters.uploadedBy}
              onChange={(e) => setFilters({ ...filters, uploadedBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">All Users</option>
              {filterOptions.uploaders.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">{card.label}</span>
                  <div className={`${card.color} p-2 rounded-lg`}>
                    <card.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name.replace('_', ' ')} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400">
                  No reconciliation data yet
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Reconciliation Summary</h3>
              {summary && summary.totalRecords > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: 'Matched', count: summary.matched, fill: chartColors.matched },
                      { name: 'Partial', count: summary.partiallyMatched, fill: chartColors.partially_matched },
                      { name: 'Unmatched', count: summary.notMatched, fill: chartColors.not_matched },
                      { name: 'Duplicate', count: summary.duplicate, fill: chartColors.duplicate },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {[chartColors.matched, chartColors.partially_matched, chartColors.not_matched, chartColors.duplicate].map(
                        (color, index) => (
                          <Cell key={index} fill={color} />
                        )
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400">
                  No reconciliation data yet
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
