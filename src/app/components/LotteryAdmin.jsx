'use client';

import React, { useEffect, useState } from 'react';
import WalletUtilService from '../lib/wallet-util-service';
import { generateSecretAndCommit } from '../lib/crypto-utils';
import { storeDrawSecret, getDrawSecret, removeDrawSecret, getAllDrawSecrets, clearAllDrawSecrets, isLocalStorageAvailable } from '../lib/secret-storage';

const CONTRACT = 'con_x00023';
const RPC = 'https://devnet.xian.org';

const LotteryAdmin = () => {
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState(null);
    const [error, setError] = useState(null);
    const [params, setParams] = useState({ token: 'currency', price: '1', fee: 10, cap: 0 });
    const [currentDraw, setCurrentDraw] = useState(0);
    const [admins, setAdmins] = useState([]);
    const [creator, setCreator] = useState('');
    const [drawSecrets, setDrawSecrets] = useState(new Map()); // Store secrets for each draw
    const [storageAvailable, setStorageAvailable] = useState(true);

    const fetchCurrent = async () => {
        try {
            const counterKey = `"/get/${CONTRACT}.draw_counter"`;
            const res = await fetch(`${RPC}/abci_query?path=${encodeURIComponent(counterKey)}&prove=false`);
            const json = await res.json();
            const base = json?.result?.response?.value;
            const id = base && base !== 'AA==' ? parseInt(window.atob(base)) : 0;
            setCurrentDraw(id || 0);

            if (id > 0) {
                const creatorKey = `"/get/${CONTRACT}.draw_creator:${id}"`;
                const creatorRes = await fetch(`${RPC}/abci_query?path=${encodeURIComponent(creatorKey)}&prove=false`);
                const cjson = await creatorRes.json();
                const cval = cjson?.result?.response?.value;
                setCreator(cval && cval !== 'AA==' ? window.atob(cval) : '');

                const adminsKey = `"/get/${CONTRACT}.draw_admin_list:${id}"`;
                const aRes = await fetch(`${RPC}/abci_query?path=${encodeURIComponent(adminsKey)}&prove=false`);
                const ajson = await aRes.json();
                const aval = ajson?.result?.response?.value;
                if (aval && aval !== 'AA==') {
                    try {
                        const arr = JSON.parse(window.atob(aval));
                        setAdmins([creator, ...(Array.isArray(arr) ? arr : [])].filter(Boolean));
                    } catch {
                        setAdmins([creator].filter(Boolean));
                    }
                } else {
                    setAdmins([creator].filter(Boolean));
                }
            } else {
                setCreator('');
                setAdmins([]);
            }
        } catch (e) {
            console.error('Fetch current draw failed', e);
        }
    };

    useEffect(() => {
        fetchCurrent();

        // Check localStorage availability and load existing secrets
        const available = isLocalStorageAvailable();
        setStorageAvailable(available);

        if (available) {
            const existingSecrets = getAllDrawSecrets();
            setDrawSecrets(existingSecrets);
            console.log(`Loaded ${existingSecrets.size} existing secrets from localStorage`);
        }
    }, []);

    const startDraw = async () => {
        try {
            setCreating(true);
            setError(null);
            setMsg(null);
            const svc = WalletUtilService.getInstance().XianWalletUtils;
            if (!svc.initialized) svc.init();

            const priceNum = Number(params.price);
            const feeNum = Number(params.fee);
            const capNum = Number(params.cap);

            if (!Number.isFinite(priceNum) || priceNum <= 0) {
                throw new Error('Please enter a valid ticket price greater than 0');
            }
            if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 100) {
                throw new Error('Fee must be a number between 0 and 100');
            }
            if (!Number.isFinite(capNum) || capNum < 0) {
                throw new Error('Cap must be a number greater than or equal to 0');
            }

            const priceStr = (params.price || '').toString().trim();
            if (!/^\d+(\.\d{1,8})?$/.test(priceStr)) throw new Error('Price must be a number with up to 8 decimals');

            // Generate secret and commit
            const { secret, commit } = generateSecretAndCommit();

            // Call start_draw with the commit
            const res = await svc.sendTransaction(CONTRACT, 'start_draw', {
                token_contract: params.token,
                price: priceStr,
                fee: Math.trunc(feeNum),
                cap: Math.trunc(capNum),
                commit: commit
            });
            if (res && res.errors) throw new Error(res.errors);

            // Store the secret for this draw
            const newDrawId = currentDraw + 1;

            // Store in localStorage for persistence
            if (storageAvailable) {
                storeDrawSecret(newDrawId, secret);
            }

            // Update component state
            setDrawSecrets(prev => new Map(prev).set(newDrawId, secret));

            setMsg('✅ Draw created successfully! Secret stored for finishing.');
            await fetchCurrent();
        } catch (e) {
            setError(e.message);
        } finally {
            setCreating(false);
            setTimeout(() => setMsg(null), 5000);
        }
    };

    const finishDraw = async (drawId) => {
        try {
            setCreating(true);
            setError(null);
            setMsg(null);

            const secret = drawSecrets.get(drawId);
            if (!secret) {
                throw new Error('Secret not found for this draw. Please check if you created this draw.');
            }

            const svc = WalletUtilService.getInstance().XianWalletUtils;
            if (!svc.initialized) svc.init();

            const res = await svc.sendTransaction(CONTRACT, 'finish_draw', {
                draw_id: drawId,
                reveal: secret
            });
            if (res && res.errors) throw new Error(res.errors);

            // Remove the secret from storage after successful finish
            if (storageAvailable) {
                removeDrawSecret(drawId);
            }

            setDrawSecrets(prev => {
                const newMap = new Map(prev);
                newMap.delete(drawId);
                return newMap;
            });

            setMsg('✅ Draw finished successfully!');
            await fetchCurrent();
        } catch (e) {
            setError(e.message);
        } finally {
            setCreating(false);
            setTimeout(() => setMsg(null), 5000);
        }
    };

    const handleClearAllSecrets = () => {
        if (window.confirm('Are you sure you want to clear all stored secrets? This action cannot be undone.')) {
            clearAllDrawSecrets();
            setDrawSecrets(new Map());
            setMsg('✅ All secrets cleared from storage');
            setTimeout(() => setMsg(null), 3000);
        }
    };

    return (
        <div className="lottery-admin">
            {/* Hero Section */}
            <div className="admin-hero">
                <div className="admin-hero-content">
                    <div className="admin-hero-icon">🔧</div>
                    <h1 className="admin-hero-title">Draw Administration</h1>
                    <p className="admin-hero-subtitle">Create new draws and manage lottery settings</p>
                    <div className="admin-hero-stats">
                        <div className="admin-stat-item">
                            <span className="admin-stat-number">{currentDraw}</span>
                            <span className="admin-stat-label">Current Draw</span>
                        </div>
                        <div className="admin-stat-item">
                            <span className="admin-stat-number">{admins.length}</span>
                            <span className="admin-stat-label">Admins</span>
                        </div>
                        <div className="admin-stat-item">
                            <span className="admin-stat-number">{creator ? 'Active' : 'None'}</span>
                            <span className="admin-stat-label">Creator</span>
                        </div>
                    </div>
                </div>
                <div className="admin-hero-background">
                    <div className="admin-floating-shapes">
                        <div className="admin-shape admin-shape-1"></div>
                        <div className="admin-shape admin-shape-2"></div>
                        <div className="admin-shape admin-shape-3"></div>
                    </div>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="notification notification-error">
                    <div className="notification-content">
                        <div className="notification-icon">⚠️</div>
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="notification-close">×</button>
                </div>
            )}

            {msg && (
                <div className="notification notification-success">
                    <div className="notification-content">
                        <div className="notification-icon">✅</div>
                        <span>{msg}</span>
                    </div>
                    <button onClick={() => setMsg(null)} className="notification-close">×</button>
                </div>
            )}

            {!storageAvailable && (
                <div className="notification notification-warning">
                    <div className="notification-content">
                        <div className="notification-icon">⚠️</div>
                        <span>localStorage is not available. Secrets will not be persisted between sessions.</span>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="admin-content">
                <div className="admin-grid">
                    {/* Create Draw Form */}
                    <div className="admin-card create-draw-card">
                        <div className="admin-card-header">
                            <div className="admin-card-icon">🆕</div>
                            <h3>Start New Draw</h3>
                            <p>Configure and launch a new lottery draw</p>
                        </div>

                        <div className="form-section">
                            <div className="form-group">
                                <label className="form-label">
                                    <span className="form-label-icon">🪙</span>
                                    Token Contract
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={params.token}
                                    onChange={(e) => setParams({ ...params, token: e.target.value })}
                                    placeholder="e.g. currency"
                                />
                                <div className="form-hint">The token contract for the lottery</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    <span className="form-label-icon">💰</span>
                                    Ticket Price
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="^\d+(\.\d{1,8})?$"
                                    className="form-input"
                                    value={params.price}
                                    onChange={(e) => setParams({ ...params, price: e.target.value })}
                                    placeholder="1.0"
                                />
                                <div className="form-hint">Price per ticket in the specified token</div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        <span className="form-label-icon">📊</span>
                                        Fee Percentage
                                    </label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        min="0"
                                        max="100"
                                        value={params.fee}
                                        onChange={(e) => setParams({ ...params, fee: parseInt(e.target.value) })}
                                        placeholder="10"
                                    />
                                    <div className="form-hint">Platform fee (0-100%)</div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <span className="form-label-icon">🎯</span>
                                        Max Tickets Per User
                                    </label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        min="0"
                                        value={params.cap}
                                        onChange={(e) => setParams({ ...params, cap: parseInt(e.target.value) })}
                                        placeholder="0"
                                    />
                                    <div className="form-hint">0 = unlimited</div>
                                </div>
                            </div>

                            <button
                                className={`create-button ${creating ? 'loading' : ''}`}
                                disabled={creating}
                                onClick={startDraw}
                            >
                                {creating ? (
                                    <>
                                        <div className="button-spinner"></div>
                                        Creating Draw...
                                    </>
                                ) : (
                                    <>
                                        <span className="button-icon">🚀</span>
                                        Create Draw
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Current Draw Info */}
                    <div className="admin-card current-draw-card">
                        <div className="admin-card-header">
                            <div className="admin-card-icon">ℹ️</div>
                            <h3>Current Draw Info</h3>
                            <p>Details about the active draw</p>
                        </div>

                        <div className="current-draw-content">
                            <div className="info-section">
                                <div className="info-item">
                                    <div className="info-label">
                                        <span className="info-icon">🎰</span>
                                        Draw ID
                                    </div>
                                    <div className="info-value">
                                        {currentDraw ? (
                                            <span className="draw-id-badge">#{currentDraw}</span>
                                        ) : (
                                            <span className="no-draw">No active draw</span>
                                        )}
                                    </div>
                                </div>

                                <div className="info-item">
                                    <div className="info-label">
                                        <span className="info-icon">👤</span>
                                        Creator
                                    </div>
                                    <div className="info-value">
                                        {creator ? (
                                            <code className="creator-address">{creator}</code>
                                        ) : (
                                            <span className="no-creator">—</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="admins-section">
                                <div className="admins-header">
                                    <span className="admins-icon">👥</span>
                                    <span className="admins-title">Administrators</span>
                                    <span className="admins-count">({admins.length})</span>
                                </div>

                                {admins.length > 0 ? (
                                    <div className="admins-list">
                                        {admins.map((admin, index) => (
                                            <div key={admin} className="admin-item">
                                                <div className="admin-avatar">
                                                    {admin === creator ? '👑' : '👤'}
                                                </div>
                                                <code className="admin-address">{admin}</code>
                                                {admin === creator && (
                                                    <span className="creator-badge">Creator</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="no-admins">
                                        <div className="no-admins-icon">📋</div>
                                        <span>No administrators found</span>
                                    </div>
                                )}
                            </div>

                            {/* Draw Management Section */}
                            {currentDraw > 0 && (
                                <div className="draw-management-section">
                                    <div className="draw-management-header">
                                        <span className="draw-management-icon">🎰</span>
                                        <span className="draw-management-title">Draw Management</span>
                                    </div>

                                    <div className="draw-management-content">
                                        <div className="secret-status">
                                            <span className="secret-status-label">Secret Available:</span>
                                            <span className={`secret-status-value ${drawSecrets.has(currentDraw) ? 'available' : 'unavailable'}`}>
                                                {drawSecrets.has(currentDraw) ? '✅ Yes' : '❌ No'}
                                            </span>
                                        </div>

                                        {drawSecrets.has(currentDraw) && (
                                            <button
                                                className={`finish-draw-button ${creating ? 'loading' : ''}`}
                                                disabled={creating}
                                                onClick={() => finishDraw(currentDraw)}
                                            >
                                                {creating ? (
                                                    <>
                                                        <div className="button-spinner"></div>
                                                        Finishing Draw...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="button-icon">🏁</span>
                                                        Finish Draw #{currentDraw}
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {!drawSecrets.has(currentDraw) && (
                                            <div className="secret-warning">
                                                <div className="warning-icon">⚠️</div>
                                                <span>No secret available for this draw. Only the creator can finish it.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Stored Secrets Section */}
                            {drawSecrets.size > 0 && (
                                <div className="stored-secrets-section">
                                    <div className="stored-secrets-header">
                                        <span className="stored-secrets-icon">🔐</span>
                                        <span className="stored-secrets-title">Your Stored Secrets</span>
                                        <span className="stored-secrets-count">({drawSecrets.size})</span>
                                    </div>

                                    <div className="stored-secrets-content">
                                        <div className="secrets-warning">
                                            <div className="warning-icon">💡</div>
                                            <span>Note down these secrets if you need to access them from another device or as backup.</span>
                                        </div>

                                        <div className="secrets-list">
                                            {Array.from(drawSecrets.entries()).map(([drawId, secret]) => (
                                                <div key={drawId} className="secret-item">
                                                    <div className="secret-header">
                                                        <span className="secret-draw-id">Draw #{drawId}</span>
                                                        <button
                                                            className="copy-secret-button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(secret);
                                                                setMsg('✅ Secret copied to clipboard!');
                                                                setTimeout(() => setMsg(null), 3000);
                                                            }}
                                                            title="Copy secret to clipboard"
                                                        >
                                                            📋 Copy
                                                        </button>
                                                    </div>
                                                    <div className="secret-value">
                                                        <code className="secret-text">{secret}</code>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="secrets-actions">
                                            <button
                                                className="clear-secrets-button"
                                                onClick={handleClearAllSecrets}
                                            >
                                                🗑️ Clear All Secrets
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LotteryAdmin;
