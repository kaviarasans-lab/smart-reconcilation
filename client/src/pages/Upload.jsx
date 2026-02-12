import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadAPI, reconciliationAPI } from '../services/api';
import { formatDate } from '../lib/utils';
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader,
  ArrowRight,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';

const SYSTEM_FIELDS = [
  { key: 'transactionId', label: 'Transaction ID', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'referenceNumber', label: 'Reference Number', required: true },
  { key: 'date', label: 'Date', required: true },
  { key: 'description', label: 'Description', required: false },
];

const Upload = () => {
  const [step, setStep] = useState(1); // 1: upload, 2: preview & map, 3: processing
  const [uploadJob, setUploadJob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [jobs, setJobs] = useState([]);

  // Load previous upload jobs
  useEffect(() => {
    uploadAPI.getAll().then((res) => setJobs(res.data.data)).catch(() => {});
  }, []);

  // File drop handler
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await uploadAPI.upload(formData);
      const job = res.data.data;
      setUploadJob(job);

      if (res.data.duplicate) {
        toast.success('File already uploaded. Showing existing job.');
      } else {
        toast.success('File uploaded successfully');
      }

      // Get preview
      const previewRes = await uploadAPI.getPreview(job._id);
      setPreview(previewRes.data.data);

      // Auto-map columns if names match
      const autoMapping = {};
      const headers = previewRes.data.data.headers;
      for (const field of SYSTEM_FIELDS) {
        const match = headers.find(
          (h) => h.toLowerCase().replace(/[\s_-]/g, '') === field.key.toLowerCase()
        );
        if (match) autoMapping[field.key] = match;
      }
      setMapping(autoMapping);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  // Save mapping and start processing
  const handleStartProcessing = async () => {
    // Validate required fields are mapped
    const missingFields = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingFields.length > 0) {
      toast.error(`Map required fields: ${missingFields.map((f) => f.label).join(', ')}`);
      return;
    }

    setProcessing(true);
    try {
      await uploadAPI.saveMapping(uploadJob._id, mapping);
      toast.success('Processing started');
      setStep(3);

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await uploadAPI.getStatus(uploadJob._id);
          const job = statusRes.data.data;
          setUploadJob(job);

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);
            setProcessing(false);
            if (job.status === 'completed') {
              toast.success(`Processing complete! ${job.processedRecords} records processed.`);
            } else {
              toast.error(`Processing failed: ${job.errorMessage}`);
            }
          }
        } catch {
          clearInterval(pollInterval);
          setProcessing(false);
        }
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start processing');
      setProcessing(false);
    }
  };

  // Run reconciliation
  const handleReconcile = async (jobId) => {
    try {
      const res = await reconciliationAPI.run(jobId);
      toast.success('Reconciliation complete!');
      // Refresh jobs
      const jobsRes = await uploadAPI.getAll();
      setJobs(jobsRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reconciliation failed');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">File Upload & Processing</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 mb-8">
        {['Upload File', 'Map Columns', 'Process'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step > i + 1
                  ? 'bg-green-500 text-white'
                  : step === i + 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > i + 1 ? <CheckCircle className="h-5 w-5" /> : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < 2 && <ArrowRight className="h-4 w-4 text-gray-300 ml-2" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <Loader className="h-12 w-12 text-blue-500 mx-auto animate-spin" />
          ) : (
            <UploadIcon className="h-12 w-12 text-gray-400 mx-auto" />
          )}
          <p className="mt-4 text-lg font-medium text-gray-700">
            {uploading ? 'Uploading...' : isDragActive ? 'Drop the file here' : 'Drag & drop a CSV or Excel file'}
          </p>
          <p className="mt-2 text-sm text-gray-500">or click to browse (Max 50MB)</p>
        </div>
      )}

      {/* Step 2: Preview & Column Mapping */}
      {step === 2 && preview && (
        <div className="space-y-6">
          {/* Column Mapping */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Column Mapping</h3>
            <p className="text-sm text-gray-500 mb-4">
              Map your file columns to system fields. Fields marked with * are required.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SYSTEM_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <label className="w-40 text-sm font-medium text-gray-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={mapping[field.key] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- Select Column --</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleStartProcessing}
                disabled={processing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {processing ? 'Processing...' : 'Start Processing'}
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Preview <span className="text-sm font-normal text-gray-500">({preview.totalRows} total rows)</span>
              </h3>
              <span className="text-sm text-gray-500">Showing first {Math.min(20, preview.rows.length)} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {preview.headers.map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {row[h] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Processing Status */}
      {step === 3 && uploadJob && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {uploadJob.status === 'processing' || uploadJob.status === 'pending' ? (
            <>
              <Loader className="h-16 w-16 text-blue-500 mx-auto animate-spin" />
              <h3 className="text-xl font-semibold mt-4">Processing File...</h3>
              <p className="text-gray-500 mt-2">
                {uploadJob.processedRecords} / {uploadJob.totalRecords || '?'} records processed
              </p>
              {uploadJob.totalRecords > 0 && (
                <div className="mt-4 w-64 mx-auto bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.round((uploadJob.processedRecords / uploadJob.totalRecords) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </>
          ) : uploadJob.status === 'completed' ? (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-semibold mt-4">Processing Complete!</h3>
              <p className="text-gray-500 mt-2">
                {uploadJob.processedRecords} records processed successfully
              </p>
              <div className="mt-6 flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setStep(1);
                    setUploadJob(null);
                    setPreview(null);
                    setMapping({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Upload Another
                </button>
                <button
                  onClick={() => handleReconcile(uploadJob._id)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Run Reconciliation
                </button>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto" />
              <h3 className="text-xl font-semibold mt-4">Processing Failed</h3>
              <p className="text-red-500 mt-2">{uploadJob.errorMessage || 'Unknown error'}</p>
              <button
                onClick={() => setStep(1)}
                className="mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      )}

      {/* Previous Upload Jobs */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload History</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reconciled</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No uploads yet
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-700">{job.originalName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          job.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : job.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{job.processedRecords || 0}</td>
                    <td className="px-4 py-3">
                      {job.reconciled ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(job.createdAt)}</td>
                    <td className="px-4 py-3">
                      {job.status === 'completed' && !job.reconciled && (
                        <button
                          onClick={() => handleReconcile(job._id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Reconcile
                        </button>
                      )}
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

export default Upload;
