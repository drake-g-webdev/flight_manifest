import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { optimizeApi } from '../services/api';
import type { OptimizationResult } from '../types';

export default function Optimize() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useAI, setUseAI] = useState(true);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const handleRunOptimization = async () => {
    setRunning(true);
    setResult(null);
    setApplied(false);
    try {
      const res = await optimizeApi.run(selectedDate, useAI);
      if (res.success && res.data) {
        setResult(res.data);
        if (res.data.status === 'ok') {
          toast.success('Optimization completed successfully!');
        } else if (res.data.status === 'infeasible') {
          toast.error('Could not find feasible assignment');
        }
      } else if (!res.success) {
        // Show specific error from backend
        const errorMsg = (res as any).error || 'Unknown error';
        toast.error(`Optimization failed: ${errorMsg}`);
        console.error('Optimization error:', res);
      }
    } catch (error: any) {
      // Extract error details from response
      const errorMsg = error?.response?.data?.error || error?.response?.data?.details || error?.message || 'Unknown error';
      toast.error(`Optimization failed: ${errorMsg}`);
      console.error('Optimization error:', error?.response?.data || error);
    } finally {
      setRunning(false);
    }
  };

  const handleApplyResult = async () => {
    if (!result) return;
    setApplying(true);
    try {
      const res = await optimizeApi.apply(result.assignmentPlan);
      if (res.success) {
        setApplied(true);
        toast.success('Assignments applied successfully!');
      }
    } catch (error) {
      toast.error('Failed to apply assignments');
    } finally {
      setApplying(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'infeasible':
        return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />;
      default:
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Optimization Console</h1>
        <p className="text-gray-600">Run AI-powered flight assignment optimization</p>
      </div>

      {/* Controls */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-6">
          <div>
            <label className="label">Flight Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useAI"
              checked={useAI}
              onChange={e => setUseAI(e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded"
            />
            <label htmlFor="useAI" className="text-sm flex items-center gap-1">
              <SparklesIcon className="h-4 w-4 text-green-500" />
              Use OpenAI optimization
            </label>
          </div>

          <button
            onClick={handleRunOptimization}
            disabled={running}
            className="btn-primary flex items-center gap-2"
          >
            <PlayIcon className="h-5 w-5" />
            {running ? 'Running...' : 'Run Optimization'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Status */}
          <div className={clsx('card p-6', {
            'border-green-300 bg-green-50': result.status === 'ok',
            'border-yellow-300 bg-yellow-50': result.status === 'infeasible',
            'border-red-300 bg-red-50': result.status === 'error',
          })}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(result.status)}
                <div>
                  <h2 className="text-lg font-semibold">
                    {result.status === 'ok' && 'Optimization Successful'}
                    {result.status === 'infeasible' && 'Partial Assignment'}
                    {result.status === 'error' && 'Optimization Failed'}
                  </h2>
                  <p className="text-sm text-gray-600">{result.explanations}</p>
                </div>
              </div>

              {(result.status === 'ok' || result.status === 'infeasible') && (
                applied ? (
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <CheckCircleIcon className="h-5 w-5" />
                    Assignments Applied
                  </div>
                ) : (
                  <button
                    onClick={handleApplyResult}
                    disabled={applying}
                    className={result.status === 'ok' ? 'btn-success' : 'btn-primary'}
                  >
                    {applying ? 'Applying...' : result.status === 'infeasible' ? 'Apply Partial Assignments' : 'Apply Assignments'}
                  </button>
                )
              )}
            </div>

            {result.meta && (
              <div className="mt-4 grid grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{result.meta.flightCount}</p>
                  <p className="text-xs text-gray-500">Flights</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.meta.passengerCount}</p>
                  <p className="text-xs text-gray-500">Passengers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.meta.freightCount}</p>
                  <p className="text-xs text-gray-500">Freight</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.meta.mailCount}</p>
                  <p className="text-xs text-gray-500">Mail</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.meta.durationMs}ms</p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
              </div>
            )}
          </div>

          {/* Flight Assignments */}
          <div className="card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Flight Assignments</h3>
            </div>
            <div className="divide-y">
              {result.assignmentPlan.flightAssignments.map(fa => (
                <div key={fa.flightId} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Flight {fa.flightId}</span>
                    <span className="text-sm text-gray-500">
                      {fa.totalWeightKg.toFixed(0)} kg | CG: {fa.cg.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-600">
                      Passengers: <strong>{fa.passengerIds.length}</strong>
                    </span>
                    <span className="text-gray-600">
                      Freight: <strong>{fa.freightIds.length}</strong>
                    </span>
                    <span className="text-gray-600">
                      Mail: <strong>{fa.mailIds.length}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unassigned Items */}
          {(result.assignmentPlan.unassignedItems.passengers.length > 0 ||
            result.assignmentPlan.unassignedItems.freight.length > 0 ||
            result.assignmentPlan.unassignedItems.mail.length > 0) && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4 text-yellow-700">Unassigned Items</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Passengers</p>
                  <p className="font-medium">
                    {result.assignmentPlan.unassignedItems.passengers.length > 0
                      ? result.assignmentPlan.unassignedItems.passengers.join(', ')
                      : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Freight</p>
                  <p className="font-medium">
                    {result.assignmentPlan.unassignedItems.freight.length > 0
                      ? result.assignmentPlan.unassignedItems.freight.join(', ')
                      : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Mail</p>
                  <p className="font-medium">
                    {result.assignmentPlan.unassignedItems.mail.length > 0
                      ? result.assignmentPlan.unassignedItems.mail.join(', ')
                      : 'None'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostics */}
          {result.diagnostics.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Diagnostics</h3>
              <div className="space-y-2">
                {result.diagnostics.map((d, idx) => (
                  <div key={idx} className={clsx('flex items-start gap-2 text-sm', {
                    'text-red-600': d.type === 'error',
                    'text-yellow-600': d.type === 'warning',
                    'text-gray-600': d.type === 'info',
                  })}>
                    {d.type === 'error' && <XCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    {d.type === 'warning' && <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    {d.type === 'info' && <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    <span>
                      <strong>[{d.code}]</strong> {d.message}
                      {d.flightId && <span className="text-gray-400"> (Flight {d.flightId})</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
