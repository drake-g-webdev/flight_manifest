import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DocumentTextIcon, ArrowDownTrayIcon, CheckIcon } from '@heroicons/react/24/outline';
import { manifestsApi } from '../services/api';
import type { Manifest } from '../types';

export default function Manifests() {
  const [searchParams] = useSearchParams();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  );

  useEffect(() => {
    loadManifests();
  }, [selectedDate]);

  const loadManifests = async () => {
    setLoading(true);
    try {
      const res = await manifestsApi.list({ date: selectedDate });
      if (res.success) {
        setManifests(res.data || []);
      }
    } catch {
      toast.error('Failed to load manifests');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (manifestId: number) => {
    try {
      await manifestsApi.sign(manifestId);
      toast.success('Manifest signed');
      loadManifests();
    } catch {
      toast.error('Failed to sign manifest');
    }
  };

  const handleDownload = (manifestId: number) => {
    window.open(manifestsApi.getPdfUrl(manifestId), '_blank');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manifests</h1>
          <p className="text-gray-600">View and download flight manifests</p>
        </div>
        <div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input w-48"
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading...</p>
        ) : manifests.length === 0 ? (
          <div className="p-8 text-center">
            <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No manifests found for this date</p>
            <p className="text-sm text-gray-400 mt-1">Generate manifests from the Dashboard</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Manifest ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Flight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Version</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Generated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Signed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {manifests.map(manifest => (
                <tr key={manifest.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{manifest.manifestJson.manifestId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {manifest.manifestJson.flightNumber} - {manifest.manifestJson.tail}
                  </td>
                  <td className="px-4 py-3 text-sm">v{manifest.version}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{new Date(manifest.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">by {manifest.generatedBy}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {manifest.signedBy ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckIcon className="h-4 w-4" />
                        <span>{manifest.signedBy}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not signed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(manifest.id)}
                        className="flex items-center gap-1 text-primary-600 hover:underline"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        PDF
                      </button>
                      {!manifest.signedBy && (
                        <button
                          onClick={() => handleSign(manifest.id)}
                          className="flex items-center gap-1 text-green-600 hover:underline"
                        >
                          <CheckIcon className="h-4 w-4" />
                          Sign
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manifest Preview */}
      {manifests.length > 0 && (
        <div className="mt-6 card p-6">
          <h2 className="text-lg font-semibold mb-4">Latest Manifest Details</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Weight Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Passengers ({manifests[0].manifestJson.totals.passengerCount})</span>
                  <span>{manifests[0].manifestJson.totals.passengerWeightKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Baggage</span>
                  <span>{manifests[0].manifestJson.totals.baggageWeightKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Freight</span>
                  <span>{manifests[0].manifestJson.totals.freightWeightKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mail</span>
                  <span>{manifests[0].manifestJson.totals.mailWeightKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fuel</span>
                  <span>{manifests[0].manifestJson.totals.fuelWeightKg.toFixed(1)} kg</span>
                </div>
                <hr />
                <div className="flex justify-between font-medium">
                  <span>Total Payload</span>
                  <span>{manifests[0].manifestJson.totals.totalPayloadKg.toFixed(1)} kg</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Weight & Balance</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Weight</span>
                  <span>{manifests[0].manifestJson.wAndB.totalWeightKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MTOW</span>
                  <span>{manifests[0].manifestJson.wAndB.mtow.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CG</span>
                  <span>{manifests[0].manifestJson.wAndB.cg.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CG Limits</span>
                  <span>{manifests[0].manifestJson.wAndB.cgMin} - {manifests[0].manifestJson.wAndB.cgMax}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={manifests[0].manifestJson.wAndB.withinEnvelope ? 'text-green-600' : 'text-red-600'}>
                    {manifests[0].manifestJson.wAndB.withinEnvelope ? 'Within Envelope' : 'OUT OF LIMITS'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {manifests[0].manifestJson.warnings.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Warnings</h3>
              <ul className="text-sm text-yellow-700 list-disc list-inside">
                {manifests[0].manifestJson.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
