// components/MultiDrawDashboard.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { useDrawsQuery } from '../fn/useDrawsQuery';
import WalletUtilService from '../lib/wallet-util-service';
import { generateSecretAndCommit } from '../lib/crypto-utils';
import { getDrawSecret, removeDrawSecret, getAllDrawSecrets, isLocalStorageAvailable, clearAllDrawSecrets, storeDrawSecret } from '../lib/secret-storage';
import useStore from '../lib/store';
import { formatTokenName } from '../lib/token-utils';

const CONTRACT = 'con_x00023';

export default function MultiDrawDashboard() {
    const { activeDraws, completedDraws, loading, error, refetch, currentUserAddress } = useDrawsQuery();
    const [walletAddress, setWalletAddress] = useState(null);
    const [busyDraw, setBusyDraw] = useState(null);
    const [notice, setNotice] = useState(null);
    const [err, setErr] = useState(null);
    const [selectedTab, setSelectedTab] = useState('active');
    const [drawSecrets, setDrawSecrets] = useState(new Map()); // Store secrets for each draw
    const [storageAvailable, setStorageAvailable] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const utils = WalletUtilService.getInstance().XianWalletUtils;
                if (!utils.initialized) utils.init();
                const info = await utils.requestWalletInfo();
                const address = info?.address || null;
                setWalletAddress(address);
                // Update global store for Nav component
                useStore.getState().setWalletAddress(address);
            } catch (e) {
                setWalletAddress(null);
                useStore.getState().setWalletAddress(null);
            }
        })();

        // Check localStorage availability and load existing secrets
        const available = isLocalStorageAvailable();
        setStorageAvailable(available);

        if (available) {
            const existingSecrets = getAllDrawSecrets();
            setDrawSecrets(existingSecrets);
            console.log(`Loaded ${existingSecrets.size} existing secrets from localStorage`);
        }
    }, []);

    const buyTickets = async (draw, ticketCount) => {
        setErr(null);
        if (!walletAddress) { setErr('Please connect your wallet first'); return; }
        if (ticketCount < 1 || ticketCount > 100) { setErr('Ticket count must be between 1 and 100'); return; }

        try {
            setBusyDraw(draw.id);
            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) utils.init();

            if (draw.token === 'currency') {
                try {
                    const approveRes = await utils.sendTransaction('currency', 'approve', { to: CONTRACT, amount: draw.price * ticketCount });
                    if (approveRes && approveRes.errors) console.warn('Approve failed:', approveRes.errors);
                } catch (e) { console.warn('Approve threw:', e?.message || e); }
            }

            const before = await utils.getUserTicketsDraw(CONTRACT, draw.id, walletAddress);
            const buyRes = await utils.sendTransaction(CONTRACT, 'buy_tickets', { draw_id: draw.id, count: ticketCount });
            if (buyRes && buyRes.errors) throw new Error(buyRes.errors);

            let attempts = 12, nowCount = before;
            while (attempts-- > 0) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    nowCount = await utils.getUserTicketsDraw(CONTRACT, draw.id, walletAddress);
                    if (nowCount > before) break;
                } catch { }
            }
            setNotice(`✅ Bought ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} for draw #${draw.id}. You now have ${nowCount}.`);
            setTimeout(() => setNotice(null), 6000);
            await refetch();
        } catch (e) {
            setErr(e.message || 'Transaction failed');
        } finally {
            setBusyDraw(null);
        }
    };

    const finishDraw = async (draw, manualSecret = null) => {
        setErr(null);
        if (!draw.isAdmin) { setErr('Only admins can finish a draw'); return; }

        const secret = manualSecret || drawSecrets.get(draw.id);
        if (!secret) {
            setErr('Secret not found for this draw. Only the creator can finish it.');
            return;
        }

        try {
            setBusyDraw(draw.id);
            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) utils.init();
            const res = await utils.sendTransaction(CONTRACT, 'finish_draw', {
                draw_id: draw.id,
                reveal: secret
            });
            if (res && res.errors) throw new Error(res.errors);

            // Remove the secret from storage after successful finish (only if it was stored)
            if (!manualSecret && storageAvailable) {
                removeDrawSecret(draw.id);
            }

            if (!manualSecret) {
                setDrawSecrets(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(draw.id);
                    return newMap;
                });
            }

            await refetch();
            setTimeout(refetch, 2000);
        } catch (e) {
            setErr(e.message || 'Finish draw failed');
        } finally {
            setBusyDraw(null);
        }
    };

    return (
        <div className="lottery-dashboard">
            {/* Hero Section */}
            <div className="hero-section">
                <div className="hero-content">
                    <div className="hero-icon">🎰</div>
                    <h1 className="hero-title">XiLotto</h1>
                    <p className="hero-subtitle">Multiple permissionless draws on Xian</p>
                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-number">{activeDraws.length}</span>
                            <span className="stat-label">Active Draws</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{completedDraws.length}</span>
                            <span className="stat-label">Completed</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{activeDraws.reduce((sum, d) => sum + d.ticketCount, 0)}</span>
                            <span className="stat-label">Total Tickets</span>
                        </div>
                    </div>
                </div>
                <div className="hero-background">
                    <div className="floating-shapes">
                        <div className="shape shape-1"></div>
                        <div className="shape shape-2"></div>
                        <div className="shape shape-3"></div>
                    </div>
                </div>
            </div>

            {/* Notifications */}
            {(error || err) && (
                <div className="notification notification-error">
                    <div className="notification-content">
                        <div className="notification-icon">⚠️</div>
                        <span>{error?.message || err}</span>
                    </div>
                    <button onClick={() => { setErr(null); }} className="notification-close">×</button>
                </div>
            )}

            {notice && (
                <div className="notification notification-success">
                    <div className="notification-content">
                        <div className="notification-icon">✅</div>
                        <span>{notice}</span>
                    </div>
                    <button onClick={() => setNotice(null)} className="notification-close">×</button>
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

            {/* Tab Navigation */}
            <div className="tab-container">
                <div className="tab-navigation">
                    <button
                        className={`tab-button ${selectedTab === 'active' ? 'active' : ''}`}
                        onClick={() => setSelectedTab('active')}
                    >
                        <span className="tab-icon">🔥</span>
                        Active Draws
                        <span className="tab-badge">{activeDraws.length}</span>
                    </button>
                    <button
                        className={`tab-button ${selectedTab === 'completed' ? 'active' : ''}`}
                        onClick={() => setSelectedTab('completed')}
                    >
                        <span className="tab-icon">📜</span>
                        Completed Draws
                        <span className="tab-badge">{completedDraws.length}</span>
                    </button>
                </div>
            </div>

            {/* Content Sections */}
            {selectedTab === 'active' && (
                <section className="content-section">
                    {loading && activeDraws.length === 0 ? (
                        <div className="loading-state">
                            <div className="loading-spinner"></div>
                            <p>Loading draws...</p>
                        </div>
                    ) : activeDraws.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">🎯</div>
                            <h3>No Active Draws</h3>
                            <p>Check back later for new draws!</p>
                        </div>
                    ) : (
                        <div className="draws-grid">
                            {activeDraws.map((draw) => (
                                <DrawCard
                                    key={draw.id}
                                    draw={draw}
                                    onBuyTickets={buyTickets}
                                    onFinishDraw={finishDraw}
                                    busyDraw={busyDraw}
                                    currentUserAddress={currentUserAddress}
                                    drawSecrets={drawSecrets}
                                    setDrawSecrets={setDrawSecrets}
                                    setNotice={setNotice}
                                    storageAvailable={storageAvailable}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {selectedTab === 'completed' && (
                <section className="content-section">
                    <CompletedDrawsTable draws={completedDraws} currentUserAddress={currentUserAddress} />
                </section>
            )}

            {/* Stored Secrets Section */}
            {drawSecrets.size > 0 && (
                <section className="content-section">
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
                                                    setNotice('✅ Secret copied to clipboard!');
                                                    setTimeout(() => setNotice(null), 3000);
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
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to clear all stored secrets? This action cannot be undone.')) {
                                            clearAllDrawSecrets();
                                            setDrawSecrets(new Map());
                                            setNotice('✅ All secrets cleared from storage');
                                            setTimeout(() => setNotice(null), 3000);
                                        }
                                    }}
                                >
                                    🗑️ Clear All Secrets
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function DrawCard({ draw, onBuyTickets, onFinishDraw, busyDraw, currentUserAddress, drawSecrets, setDrawSecrets, setNotice, storageAvailable }) {
    const [showAdmin, setShowAdmin] = useState(false);
    const [ticketCount, setTicketCount] = useState(1);
    const [showSecretModal, setShowSecretModal] = useState(false);
    const [manualSecret, setManualSecret] = useState('');
    const [secretError, setSecretError] = useState('');

    const handleFinishDraw = () => {
        if (!drawSecrets.has(draw.id)) {
            setShowSecretModal(true);
            setManualSecret('');
            setSecretError('');
        } else {
            onFinishDraw(draw);
        }
    };

    const handleManualSecretSubmit = () => {
        // Validate secret format (64 hex characters)
        if (!manualSecret || manualSecret.length !== 64) {
            setSecretError('Secret must be exactly 64 hexadecimal characters');
            return;
        }

        if (!/^[0-9a-fA-F]{64}$/.test(manualSecret)) {
            setSecretError('Secret must contain only hexadecimal characters (0-9, a-f)');
            return;
        }

        // Check if there are tickets sold
        if (draw.ticketCount <= 0) {
            // No tickets sold, just save the secret for later
            if (storageAvailable) {
                storeDrawSecret(draw.id, manualSecret);
            }
            setDrawSecrets(prev => new Map(prev).set(draw.id, manualSecret));
            setShowSecretModal(false);
            setManualSecret('');
            setSecretError('');
            setNotice('✅ Secret saved for draw #' + draw.id + '. You can finish the draw when tickets are sold.');
            setTimeout(() => setNotice(null), 5000);
            return;
        }

        // Tickets are sold, proceed with finishing the draw
        onFinishDraw(draw, manualSecret);
        setShowSecretModal(false);
        setManualSecret('');
        setSecretError('');
    };

    return (
        <>
            <div className="draw-card">
                <div className="draw-header">
                    <div className="draw-id">
                        <span className="draw-number">#{draw.id}</span>
                        <span className="draw-status active">Active</span>
                    </div>
                    <div className="draw-token">
                        <span className="token-badge">{formatTokenName(draw.token)}</span>
                    </div>
                </div>

                <div className="draw-creator">
                    <span className="creator-label">Created by:</span>
                    <code className="creator-address">{draw.creator}</code>
                </div>

                <div className="draw-stats">
                    <div className="stat-grid">
                        <div className="stat-item">
                            <div className="stat-icon">💰</div>
                            <div className="stat-content">
                                <div className="stat-value">{draw.price}</div>
                                <div className="stat-label">Ticket Price</div>
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-icon">🎫</div>
                            <div className="stat-content">
                                <div className="stat-value">{draw.ticketCount}</div>
                                <div className="stat-label">Tickets Sold</div>
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-icon">🏆</div>
                            <div className="stat-content">
                                <div className="stat-value">{(draw.pool || 0).toFixed(2)}</div>
                                <div className="stat-label">Prize Pool</div>
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                                <div className="stat-value">{draw.feePercent}%</div>
                                <div className="stat-label">Fee</div>
                            </div>
                        </div>
                    </div>
                </div>

                {currentUserAddress && (
                    <div className="user-tickets">
                        <div className="ticket-indicator">
                            <span className="ticket-icon">🎫</span>
                            <span className="ticket-count">You have <strong>{draw.myTickets}</strong> ticket{draw.myTickets === 1 ? '' : 's'}</span>
                        </div>
                    </div>
                )}

                <div className="draw-actions">
                    <div className="ticket-purchase-section">
                        <div className="ticket-quantity">
                            <label className="quantity-label">
                                <span className="quantity-icon">🎫</span>
                                Quantity
                            </label>
                            <div className="quantity-controls">
                                <button
                                    className="quantity-btn"
                                    onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                                    disabled={busyDraw === draw.id}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    className="quantity-input"
                                    value={ticketCount}
                                    onChange={(e) => setTicketCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                    min="1"
                                    max="100"
                                    disabled={busyDraw === draw.id}
                                />
                                <button
                                    className="quantity-btn"
                                    onClick={() => setTicketCount(Math.min(100, ticketCount + 1))}
                                    disabled={busyDraw === draw.id}
                                >
                                    +
                                </button>
                            </div>
                            <div className="total-price">
                                Total: <strong>{(draw.price * ticketCount).toFixed(8)} {formatTokenName(draw.token)}</strong>
                            </div>
                        </div>

                        <button
                            className={`action-button primary ${busyDraw === draw.id ? 'loading' : ''}`}
                            disabled={busyDraw === draw.id}
                            onClick={() => onBuyTickets(draw, ticketCount)}
                        >
                            {busyDraw === draw.id ? (
                                <>
                                    <div className="button-spinner"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <span className="button-icon">🎫</span>
                                    Buy {ticketCount} Ticket{ticketCount === 1 ? '' : 's'}
                                </>
                            )}
                        </button>
                    </div>

                    <a
                        href={`/draw/${draw.id}`}
                        className="action-button view-draw"
                    >
                        <span className="button-icon">👁️</span>
                        View Draw
                    </a>

                    {draw.isAdmin && (
                        <button
                            className={`action-button secondary ${busyDraw === draw.id ? 'loading' : ''}`}
                            disabled={busyDraw === draw.id || (drawSecrets.has(draw.id) && draw.ticketCount <= 0)}
                            onClick={handleFinishDraw}
                        >
                            {busyDraw === draw.id ? (
                                <>
                                    <div className="button-spinner"></div>
                                    Processing...
                                </>
                            ) : !drawSecrets.has(draw.id) ? (
                                <>
                                    <span className="button-icon">🔑</span>
                                    Enter Secret
                                </>
                            ) : draw.ticketCount <= 0 ? (
                                <>
                                    <span className="button-icon">⚠️</span>
                                    No Tickets
                                </>
                            ) : (
                                <>
                                    <span className="button-icon">🏁</span>
                                    Finish Draw
                                </>
                            )}
                        </button>
                    )}
                </div>

                {draw.isAdmin && (
                    <div className="admin-section">
                        <button
                            className="admin-toggle"
                            onClick={() => setShowAdmin(!showAdmin)}
                        >
                            <span className="admin-icon">⚙️</span>
                            Admin Panel
                            <span className={`toggle-arrow ${showAdmin ? 'open' : ''}`}>▼</span>
                        </button>

                        {showAdmin && (
                            <div className="admin-panel">
                                <div className="admin-info">
                                    <h4>Admins:</h4>
                                    <div className="admin-list">
                                        {draw.admins.map(admin => (
                                            <div key={admin} className="admin-item">
                                                <code>{admin}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <AdminManager drawId={draw.id} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Secret Entry Modal */}
            {showSecretModal && (
                <div className="modal-overlay" onClick={() => setShowSecretModal(false)}>
                    <div className="secret-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="secret-modal-header">
                            <div className="secret-modal-icon">🔑</div>
                            <h3>Enter Draw Secret</h3>
                            <button
                                className="modal-close"
                                onClick={() => setShowSecretModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="secret-modal-content">
                            <p className="secret-modal-description">
                                Enter the 32-byte secret (64 hexadecimal characters) for draw #{draw.id}.
                                {draw.ticketCount <= 0 ?
                                    ' Since no tickets are sold yet, the secret will be saved for later use.' :
                                    ' This will finish the draw and determine the winner.'
                                }
                            </p>

                            <div className="secret-input-group">
                                <label className="secret-input-label">
                                    <span className="secret-input-icon">🔐</span>
                                    Secret (64 hex characters)
                                </label>
                                <input
                                    type="text"
                                    className={`secret-input ${secretError ? 'error' : ''}`}
                                    value={manualSecret}
                                    onChange={(e) => {
                                        setManualSecret(e.target.value);
                                        if (secretError) setSecretError('');
                                    }}
                                    placeholder="Enter 64-character hexadecimal secret..."
                                    maxLength={64}
                                />
                                {secretError && (
                                    <div className="secret-input-error">{secretError}</div>
                                )}
                            </div>

                            <div className="secret-modal-actions">
                                <button
                                    className="secret-modal-cancel"
                                    onClick={() => setShowSecretModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="secret-modal-submit"
                                    onClick={handleManualSecretSubmit}
                                    disabled={!manualSecret || manualSecret.length !== 64}
                                >
                                    <span className="button-icon">
                                        {draw.ticketCount <= 0 ? '💾' : '🏁'}
                                    </span>
                                    {draw.ticketCount <= 0 ? 'Save Secret' : 'Finish Draw'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function CompletedDrawsTable({ draws, currentUserAddress }) {
    if (!draws || draws.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No Completed Draws</h3>
                <p>Completed draws will appear here</p>
            </div>
        );
    }

    return (
        <div className="table-container">
            <div className="table-header">
                <h3>Completed Draws History</h3>
                <span className="table-count">{draws.length} draws</span>
            </div>
            <div className="table-wrapper">
                <table className="draws-table">
                    <thead>
                        <tr>
                            <th>Draw ID</th>
                            <th>Total Tickets</th>
                            <th>My Tickets</th>
                            <th>Total Pool</th>
                            <th>Prize (After Fee)</th>
                            <th>Owner Fee</th>
                            <th>Token</th>
                            <th>Winner</th>
                        </tr>
                    </thead>
                    <tbody>
                        {draws.map((draw) => (
                            <tr key={draw.id} className="table-row">
                                <td className="draw-id-cell">
                                    <a href={`/draw/${draw.id}`} className="draw-id-link">
                                        <span className="draw-id-badge">#{draw.id}</span>
                                    </a>
                                </td>
                                <td className="tickets-cell">
                                    <span className="ticket-count-badge">{draw.ticketCount}</span>
                                </td>
                                <td className="my-tickets-cell">
                                    <span className="my-ticket-count-badge">
                                        {currentUserAddress ? draw.myTickets : '—'}
                                    </span>
                                </td>
                                <td className="pool-cell">
                                    <span className="pool-amount">
                                        {draw.ticketCount > 0 ? (draw.price * draw.ticketCount).toFixed(2) : (draw.pool || 0).toFixed(2)}
                                    </span>
                                </td>
                                <td className="prize-cell">
                                    <span className="prize-amount">
                                        {draw.ticketCount > 0 ?
                                            ((draw.price * draw.ticketCount) * (1 - draw.feePercent / 100)).toFixed(2) :
                                            ((draw.pool || 0) * (1 - draw.feePercent / 100)).toFixed(2)
                                        }
                                    </span>
                                </td>
                                <td className="fee-cell">
                                    <span className="fee-amount">
                                        {draw.ticketCount > 0 ?
                                            ((draw.price * draw.ticketCount) * (draw.feePercent / 100)).toFixed(2) :
                                            ((draw.pool || 0) * (draw.feePercent / 100)).toFixed(2)
                                        }
                                    </span>
                                </td>
                                <td className="token-cell">
                                    <span className="token-label">{formatTokenName(draw.token)}</span>
                                </td>
                                <td className="winner-cell">
                                    {draw.winner ? (
                                        <code className="winner-address">
                                            {`${draw.winner.slice(0, 8)}...${draw.winner.slice(-6)}`}
                                        </code>
                                    ) : (
                                        <span className="no-winner">N/A</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AdminManager({ drawId }) {
    const [addr, setAddr] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    const call = async (method) => {
        if (!addr) return;
        try {
            setBusy(true);
            setMsg(null);
            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) utils.init();
            const res = await utils.sendTransaction(CONTRACT, method, { draw_id: drawId, who: addr });
            if (res && res.errors) throw new Error(res.errors);
            setMsg('✅ Admin updated successfully');
        } catch (e) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setBusy(false);
            setTimeout(() => setMsg(null), 3000);
        }
    };

    return (
        <div className="admin-manager">
            <div className="admin-input-group">
                <input
                    type="text"
                    placeholder="Enter wallet address"
                    className="admin-input"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                />
            </div>
            <div className="admin-buttons">
                <button
                    className={`admin-button add ${busy ? 'loading' : ''}`}
                    disabled={busy}
                    onClick={() => call('add_admin')}
                >
                    {busy ? (
                        <>
                            <div className="button-spinner"></div>
                            Working...
                        </>
                    ) : (
                        <>
                            <span className="button-icon">➕</span>
                            Add Admin
                        </>
                    )}
                </button>
                <button
                    className={`admin-button remove ${busy ? 'loading' : ''}`}
                    disabled={busy}
                    onClick={() => call('remove_admin')}
                >
                    {busy ? (
                        <>
                            <div className="button-spinner"></div>
                            Working...
                        </>
                    ) : (
                        <>
                            <span className="button-icon">➖</span>
                            Remove Admin
                        </>
                    )}
                </button>
            </div>
            {msg && (
                <div className={`admin-message ${msg.includes('✅') ? 'success' : 'error'}`}>
                    {msg}
                </div>
            )}
        </div>
    );
}
