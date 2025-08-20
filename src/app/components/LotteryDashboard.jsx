'use client';

import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';
import WalletUtilService from '../lib/wallet-util-service';
import { useLotteryQuery } from '../fn/useLotteryQuery';
import { formatTokenName } from '../lib/token-utils';

const CONTRACT = 'con_xilottov1';
const RPC = 'https://node.xian.org';

const LotteryResultsTable = ({ lotteryData, walletAddress }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    const isActive = lotteryData.isActive;
    const isDrawn = lotteryData.isDrawn;

    useEffect(() => {
        if (lotteryData.currentRound > 0) {
            fetchHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lotteryData.currentRound, walletAddress]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const baseUrl = `${RPC}/abci_query`;
            const rows = [];

            // we consider completed past draws: from 1..currentRound-1 (if current active)
            // or 1..currentRound (if current is drawn)
            let drawsToFetch = [];
            if (lotteryData.currentRound > 1) {
                if (isDrawn) {
                    drawsToFetch = Array.from({ length: lotteryData.currentRound }, (_, i) => i + 1);
                } else {
                    drawsToFetch = Array.from({ length: lotteryData.currentRound - 1 }, (_, i) => i + 1);
                }
            } else if (lotteryData.currentRound === 1 && isDrawn) {
                drawsToFetch = [1];
            }

            for (const drawId of drawsToFetch) {
                if (drawId <= 0) continue;
                try {
                    const poolKey = `"/get/${CONTRACT}.draw_pool:${drawId}"`;
                    const poolRes = await fetch(`${baseUrl}?path=${encodeURIComponent(poolKey)}&prove=false`);
                    const poolJson = await poolRes.json();

                    const countKey = `"/get/${CONTRACT}.draw_ticket_count:${drawId}"`;
                    const countRes = await fetch(`${baseUrl}?path=${encodeURIComponent(countKey)}&prove=false`);
                    const countJson = await countRes.json();

                    const winnerKey = `"/get/${CONTRACT}.draw_winner:${drawId}"`;
                    const winnerRes = await fetch(`${baseUrl}?path=${encodeURIComponent(winnerKey)}&prove=false`);
                    const winnerJson = await winnerRes.json();

                    const tokenKey = `"/get/${CONTRACT}.draw_token:${drawId}"`;
                    const tokenRes = await fetch(`${baseUrl}?path=${encodeURIComponent(tokenKey)}&prove=false`);
                    const tokenJson = await tokenRes.json();

                    let pool = 0, ticketCount = 0, winner = '', token = '';

                    try {
                        if (poolJson.result?.response?.value) {
                            pool = parseFloat(window.atob(poolJson.result.response.value)) || 0;
                        }
                        if (countJson.result?.response?.value) {
                            ticketCount = parseInt(window.atob(countJson.result.response.value)) || 0;
                        }
                        if (winnerJson.result?.response?.value) {
                            winner = window.atob(winnerJson.result.response.value) || '';
                        }
                        if (tokenJson.result?.response?.value) {
                            token = window.atob(tokenJson.result.response.value) || '';
                        }
                    } catch (e) {
                        console.error(`Parse error for draw ${drawId}:`, e);
                    }

                    rows.push({ drawId, pool, ticketCount, winner, token });
                } catch (e) {
                    console.error(`Error fetching draw ${drawId}:`, e);
                }
            }

            rows.sort((a, b) => b.drawId - a.drawId);
            setHistory(rows);
        } finally {
            setLoading(false);
        }
    };

    if (lotteryData.currentRound === 0) return null;

    let title = '';
    if (isActive && lotteryData.currentRound > 1) title = 'Last Draw Results';
    else if (isDrawn) title = 'Current Draw Results';
    else if (lotteryData.currentRound > 1) title = 'Draw History';
    else title = 'Draw Results';

    return (
        <div className="card mb-4">
            <h3 className="text-center mb-4" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                📊 {title}
                {loading && (<span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: 'var(--space-sm)' }}>(Loading…)</span>)}
            </h3>

            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'linear-gradient(90deg, var(--bg-tertiary), var(--bg-secondary))', borderBottom: '1px solid var(--border-primary)' }}>
                        <tr>
                            <th className="px-xl py-lg text-left font-semibold">Draw</th>
                            <th className="px-xl py-lg text-left font-semibold">Tickets Sold</th>
                            <th className="px-xl py-lg text-left font-semibold">Value Raised</th>
                            <th className="px-xl py-lg text-left font-semibold">Token</th>
                            <th className="px-xl py-lg text-left font-semibold">Winner</th>
                        </tr>
                    </thead>
                    <tbody style={{ background: 'var(--bg-card)' }}>
                        {history.length === 0 && !loading ? (
                            <tr><td colSpan="5" className="px-xl py-lg text-center text-secondary">No completed draws found</td></tr>
                        ) : (
                            history.map((r) => (
                                <tr key={r.drawId} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <td className="px-xl py-lg">#{r.drawId}</td>
                                    <td className="px-xl py-lg">{r.ticketCount}</td>
                                    <td className="px-xl py-lg">
                                        <span style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{r.pool.toFixed(2)}</span>
                                    </td>
                                    <td className="px-xl py-lg">{r.token || '—'}</td>
                                    <td className="px-xl py-lg">
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                            {r.winner ? `${r.winner.slice(0, 8)}...${r.winner.slice(-6)}` : 'N/A'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const MyTicketsInfo = ({ currentDraw, walletAddress }) => {
    const [ticketCount, setTicketCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    useEffect(() => {
        if (currentDraw > 0 && walletAddress) {
            (async () => {
                setLoading(true);
                setErr(null);
                try {
                    const utils = WalletUtilService.getInstance().XianWalletUtils;
                    if (!utils.initialized) utils.init();
                    const count = await utils.getUserTicketsDraw(CONTRACT, currentDraw, walletAddress);
                    setTicketCount(count || 0);
                } catch (e) {
                    console.error('Error fetching user tickets:', e);
                    setErr('Failed to fetch ticket data');
                    setTicketCount(0);
                } finally {
                    setLoading(false);
                }
            })();
        } else {
            setLoading(false);
            setTicketCount(0);
        }
    }, [currentDraw, walletAddress]);

    if (loading) return <p className="text-secondary">Loading your tickets…</p>;
    if (err) return <p className="text-secondary">Error loading tickets</p>;

    const drawText = `draw #${currentDraw}`;
    if (ticketCount > 0) {
        return (
            <p className="text-secondary mb-2">
                You have <span className="accent-text font-bold text-xl">{ticketCount}</span> ticket{ticketCount === 1 ? '' : 's'} in {drawText}
            </p>
        );
    }
    return <p className="text-secondary">You didn&apos;t buy any tickets in {drawText}</p>;
};

const LotteryDashboard = ({ isAdmin = false }) => {
    const { lotteryData, loading: queryLoading, error: queryError, refetch } = useLotteryQuery();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);
    const [txNotice, setTxNotice] = useState(null);
    const [refreshToken, setRefreshToken] = useState(0);

    // wallet
    useEffect(() => {
        (async () => {
            try {
                const utils = WalletUtilService.getInstance().XianWalletUtils;
                if (!utils.initialized) utils.init();
                const walletInfo = await utils.requestWalletInfo();
                const address = walletInfo?.address || null;
                setWalletAddress(address);
                useStore.getState().setWalletAddress(address || null);
            } catch (e) {
                console.error('Failed to get wallet:', e);
                setWalletAddress(null);
                useStore.getState().setWalletAddress(null);
            }
        })();
    }, []);

    const buyOneTicket = async () => {
        if (!walletAddress) {
            setError('Please connect your wallet first');
            return;
        }
        if (!lotteryData.currentRound) {
            setError('No active draw');
            return;
        }
        try {
            setLoading(true);
            setError(null);
            setTxNotice(null);

            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) utils.init();

            // Snapshot current user ticket count to detect increment
            const before = await utils.getUserTicketsDraw(CONTRACT, lotteryData.currentRound, walletAddress);

            // Optional: attempt approve if token is 'currency'
            if (lotteryData.token === 'currency') {
                try {
                    const approveRes = await utils.sendTransaction('currency', 'approve', {
                        to: CONTRACT,
                        amount: lotteryData.ticketPrice,
                    });
                    if (approveRes && approveRes.errors) {
                        console.warn('Approve failed (continuing):', approveRes.errors);
                    }
                } catch (e) {
                    console.warn('Approve threw (continuing):', e?.message || e);
                }
            }

            // Buy ticket (requires draw_id)
            const buyRes = await utils.sendTransaction(CONTRACT, 'buy_ticket', { draw_id: lotteryData.currentRound });
            if (buyRes && buyRes.errors) throw new Error(`Buy ticket failed: ${buyRes.errors}`);

            // poll for count increase
            let attempts = 12;
            let nowCount = before;
            while (attempts-- > 0) {
                await new Promise((r) => setTimeout(r, 1000));
                try {
                    nowCount = await utils.getUserTicketsDraw(CONTRACT, lotteryData.currentRound, walletAddress);
                    if (nowCount > before) break;
                } catch { }
            }

            setTxNotice(`✅ Ticket purchased! You now have ${nowCount} ticket${nowCount === 1 ? '' : 's'} in draw #${lotteryData.currentRound}.`);
            setRefreshToken((t) => t + 1);
            await refetch();
        } catch (e) {
            console.error('Buy ticket error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
            if (txNotice) setTimeout(() => setTxNotice(null), 6000);
        }
    };

    const finishDraw = async () => {
        try {
            setLoading(true);
            setError(null);
            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) utils.init();
            const res = await utils.sendTransaction(CONTRACT, 'finish_draw', { draw_id: lotteryData.currentRound });
            if (res && res.errors) throw new Error(`Finish draw failed: ${res.errors}`);
            await refetch();
            setTimeout(refetch, 2000);
        } catch (e) {
            console.error('Finish draw error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lottery-dashboard">
            <div className="lottery-header text-center mb-5">
                <h1 className="gradient-text">🎰 XiLotto</h1>
                <p className="text-secondary">Permissionless draws on Xian blockchain</p>
            </div>

            {error && (
                <div className="error-card mb-4">
                    <div className="flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="error-close-btn">×</button>
                    </div>
                </div>
            )}
            {queryError && <div className="error-card mb-4">{queryError.message}</div>}

            {queryLoading && !lotteryData.currentRound ? (
                <div className="text-center mb-5"><p className="text-secondary">Loading draw data…</p></div>
            ) : (
                <>
                    <div className="grid grid-4 mb-5">
                        <div className="card stat-card">
                            <h3>Current Draw</h3>
                            <div className="stat-value">{lotteryData.currentRound}</div>
                        </div>
                        <div className="card stat-card">
                            <h3>Pool Amount</h3>
                            <div className="stat-value">{lotteryData.pool.toFixed(2)} {formatTokenName(lotteryData.token)}</div>
                        </div>
                        <div className="card stat-card">
                            <h3>Tickets Sold</h3>
                            <div className="stat-value">{lotteryData.ticketCount}</div>
                        </div>
                        <div className="card stat-card">
                            <h3>Ticket Price</h3>
                            <div className="stat-value">{lotteryData.ticketPrice} {formatTokenName(lotteryData.token)}</div>
                        </div>
                    </div>

                    {walletAddress && lotteryData.currentRound > 0 && (
                        <div className="card mb-4">
                            <h3 className="text-center mb-3">🎫 My Tickets</h3>
                            <div className="text-center">
                                <MyTicketsInfo currentDraw={lotteryData.currentRound} walletAddress={walletAddress} />
                            </div>
                        </div>
                    )}

                    {lotteryData.isActive && (
                        <div className="card action-card mb-4">
                            <h3 className="text-center mb-3">🎫 Buy Ticket</h3>
                            <p className="text-center mb-4">
                                Price: <span className="accent-text">{lotteryData.ticketPrice} {formatTokenName(lotteryData.token)}</span> per ticket
                            </p>

                            {txNotice && <div className="success-card mb-3" role="status">{txNotice}</div>}

                            {walletAddress ? (
                                <div className="text-center">
                                    <button onClick={buyOneTicket} disabled={loading} className="btn btn-primary">
                                        {loading ? '⏳ Processing…' : '🎫 Buy 1 Ticket'}
                                    </button>
                                </div>
                            ) : (
                                <div className="wallet-notice">
                                    <p>🔗 Please connect your wallet to buy tickets</p>
                                </div>
                            )}
                        </div>
                    )}

                    {lotteryData.isDrawn && (
                        <div className="card winner-card mb-4">
                            <h3 className="text-center mb-4">🏆 Winner Drawn!</h3>
                            <div className="winner-info">
                                <p><strong>Draw:</strong> #{lotteryData.currentRound}</p>
                                <p><strong>Winner:</strong> {lotteryData.winner}</p>
                                <p><strong>Total Pool:</strong> {lotteryData.pool.toFixed(2)} {formatTokenName(lotteryData.token)}</p>
                                <p><strong>Prize:</strong> {(lotteryData.pool * (100 - lotteryData.feePercent) / 100).toFixed(2)} {formatTokenName(lotteryData.token)}</p>
                                <p><strong>Admin Fee:</strong> {(lotteryData.pool * lotteryData.feePercent / 100).toFixed(2)} {formatTokenName(lotteryData.token)} ({lotteryData.feePercent}%)</p>
                                <p><strong>Tickets Sold:</strong> {lotteryData.ticketCount}</p>
                            </div>
                            {lotteryData.winner === walletAddress && (
                                <div className="winner-badge">🎉 CONGRATULATIONS! YOU WON! 🎉</div>
                            )}
                        </div>
                    )}

                    <LotteryResultsTable lotteryData={lotteryData} walletAddress={walletAddress} />

                    {/* Admin controls (multi-admin aware) */}
                    {lotteryData.isAdmin && (
                        <div className="card admin-card mb-4">
                            <h3 className="text-center mb-4">🔧 Admin Functions</h3>

                            <div className="grid grid-2 gap-4 mb-4">
                                {lotteryData.currentRound > 0 && !lotteryData.isDrawn && lotteryData.ticketCount > 0 && (
                                    <button onClick={finishDraw} disabled={loading} className="btn btn-success">
                                        {loading ? '⏳ Processing…' : `🏁 Finish Draw (${lotteryData.ticketCount} tickets)`}
                                    </button>
                                )}
                                {lotteryData.currentRound > 0 && !lotteryData.isDrawn && lotteryData.ticketCount <= 0 && (
                                    <button disabled className="btn btn-error">⚠️ No Tickets Sold - Cannot Finish</button>
                                )}
                            </div>

                            <div className="card mb-3">
                                <h4 className="mb-2">👥 Admins for Draw #{lotteryData.currentRound}</h4>
                                <p className="text-secondary mb-2">Creator: <code>{lotteryData.owner}</code></p>
                                <ul className="mb-3">
                                    {lotteryData.admins.map((a) => (
                                        <li key={a}><code>{a}</code></li>
                                    ))}
                                </ul>

                                <AdminManager currentDraw={lotteryData.currentRound} />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const AdminManager = ({ currentDraw }) => {
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
            const res = await utils.sendTransaction('con_xilottov1', method, { draw_id: currentDraw, who: addr });
            if (res && res.errors) throw new Error(res.errors);
            setMsg('✅ Done');
        } catch (e) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setBusy(false);
            setTimeout(() => setMsg(null), 3000);
        }
    };

    return (
        <div>
            <div className="parameter-input">
                <input
                    type="text"
                    placeholder="Address to add/remove"
                    className="input"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                />
            </div>
            <div className="flex gap-2 mt-2">
                <button className="btn btn-primary" disabled={busy} onClick={() => call('add_admin')}>
                    {busy ? 'Working…' : 'Add Admin'}
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => call('remove_admin')}>
                    {busy ? 'Working…' : 'Remove Admin'}
                </button>
            </div>
            {msg && <p className="mt-2 text-secondary">{msg}</p>}
        </div>
    );
};

export default LotteryDashboard;
