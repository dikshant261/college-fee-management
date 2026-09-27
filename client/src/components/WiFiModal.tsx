import React, { useState, useEffect } from 'react';
import { fetchNetworkInfo, NetworkInfo } from '../lib/networkApi';

interface WiFiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WiFiModal({ isOpen, onClose }: WiFiModalProps) {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPort, setSelectedPort] = useState<'client' | 'server'>('server');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchNetworkInfo()
        .then((data) => setNetworkInfo(data))
        .catch((err) => console.error('Failed to load network info', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const primaryIp = networkInfo?.primaryIp || '192.168.1.15';
  const clientPort = networkInfo?.clientPort || 5000;
  const serverPort = networkInfo?.serverPort || 5000;

  const currentUrl =
    selectedPort === 'client' && clientPort !== serverPort
      ? networkInfo?.clientUrl || `http://${primaryIp}:${clientPort}`
      : networkInfo?.serverUrl || `http://${primaryIp}:${serverPort}`;

  const currentQr =
    selectedPort === 'client' && clientPort !== serverPort
      ? networkInfo?.clientQrDataUrl || networkInfo?.qrDataUrl
      : networkInfo?.serverQrDataUrl || networkInfo?.qrDataUrl;

  const handleCopy = () => {
    if (currentUrl) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[88vh] sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            HEADER: Fixed at top (flex-shrink-0), high contrast & always visible
            ========================================================================= */}
        <div className="flex-shrink-0 border-b border-blue-700/30 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-5 py-4 sm:px-6 sm:py-4 text-white shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-xs border border-white/25">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight truncate">
                  Run on Local Wi-Fi
                </h3>
                <p className="text-xs text-blue-100 font-medium truncate">
                  Connect phones, tablets & other computers
                </p>
              </div>
            </div>

            {/* Prominent Close button in header */}
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/25 text-white transition border border-white/20 focus:outline-none"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* =========================================================================
            BODY: Scrollable area (flex-1 overflow-y-auto), prevents modal clipping
            ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-0 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-medium">Detecting local network interfaces...</p>
            </div>
          ) : (
            <>
              {/* Host Machine Info Badge */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-700 truncate">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex-shrink-0"></span>
                  <span className="font-medium text-slate-500">Host PC:</span>
                  <span className="font-semibold text-slate-900 truncate">
                    {networkInfo?.hostname || 'This Computer'}
                  </span>
                </div>
                <div className="text-slate-600 font-mono text-2xs flex-shrink-0 pl-2">
                  IP: <span className="font-bold text-blue-600">{primaryIp}</span>
                </div>
              </div>

              {/* Mode Display: Toggle in dev mode, unified badge in production */}
              {clientPort !== serverPort ? (
                <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setSelectedPort('server')}
                    className={`flex-1 py-1.5 px-2 rounded-md transition text-center truncate ${
                      selectedPort === 'server'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Direct Server (Port {serverPort})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPort('client')}
                    className={`flex-1 py-1.5 px-2 rounded-md transition text-center truncate ${
                      selectedPort === 'client'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Frontend Dev (Port {clientPort})
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-50/80 rounded-xl border border-blue-200/80 text-xs">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold truncate">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex-shrink-0 animate-pulse"></span>
                    <span>Unified Production Web App</span>
                  </div>
                  <div className="text-blue-800 font-mono text-2xs font-bold bg-blue-100/90 px-2 py-0.5 rounded-md flex-shrink-0">
                    Port {serverPort}
                  </div>
                </div>
              )}

              {/* QR Code and Scan Section */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex-shrink-0 bg-white p-2.5 rounded-xl shadow-xs border border-slate-200">
                  {currentQr ? (
                    <img
                      src={currentQr}
                      alt="Wi-Fi Access QR Code"
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1.5 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-blue-100 text-blue-800">
                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                    <span>Instant Mobile Access</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Scan to Open On Phone</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Make sure your phone or tablet is connected to the same Wi-Fi network, then scan this QR code with your camera.
                  </p>
                </div>
              </div>

              {/* URL and Copy Link Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Local Network Address
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      readOnly
                      value={currentUrl}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-medium text-slate-900 select-all focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs transition active:scale-95 flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                          />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs flex-shrink-0"
                    title="Open in new browser tab"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Instructions List */}
              <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>If Phone Shows "Site Can't Be Reached":</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                  <li><b>Turn OFF Mobile Data:</b> Ensure your phone is using Wi-Fi only (disable 4G/5G mobile data so it routes locally).</li>
                  <li><b>Private Wi-Fi Profile:</b> Set this PC's Wi-Fi network profile to <b>Private network</b> in Windows Settings $\rightarrow$ Network & Internet.</li>
                  <li><b>Windows Firewall:</b> Right-click <code>allow-wifi-firewall.bat</code> in the app folder and click <b>Run as administrator</b>.</li>
                  <li><b>Check URL:</b> Make sure your phone opens <code>http://</code> (not <code>https://</code>).</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* =========================================================================
            FOOTER: Fixed at bottom (flex-shrink-0), always visible and accessible
            ========================================================================= */}
        <div className="flex-shrink-0 border-t border-slate-200 px-5 py-3 sm:px-6 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="hidden sm:inline">Wi-Fi Network Active:</span>
            <span className="font-mono text-slate-700 font-semibold">{primaryIp}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-900 shadow-xs transition active:scale-95"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
