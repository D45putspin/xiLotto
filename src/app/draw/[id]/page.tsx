'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useDrawsQuery } from '../../fn/useDrawsQuery';
import WalletUtilService from '../../lib/wallet-util-service';
import { formatTokenName } from '../../lib/token-utils';

const CONTRACT = 'con_x00023';

export default function DrawPage() {
    const params = useParams();
    const drawId = parseInt(params.id as string);
    const { activeDraws, completedDraws, loading, error, refetch, currentUserAddress } = useDrawsQuery();
    const [walletAddress, setWalletAddress] = useState(null);
    const [busyDraw, setBusyDraw] = useState(null);
    const [notice, setNotice] = useState(null);
    const [err, setErr] = useState(null);

    // Find the specific draw
    const allDraws = [...activeDraws, ...completedDraws];
    const draw = allDraws.find(d => d.id === drawId);

    useEffect(() => {
        (async () => {
            try {
                const utils = WalletUtilService.getInstance().XianWalletUtils;
                if (!utils.initialized) utils.init();
                const info = await utils.requestWalletInfo();
                setWalletAddress(info?.address || null);
            } catch (e) {
                setWalletAddress(null);
            }
        })();
    }, []);

    const buyTicket = async (draw, ticketCount = 1) => {
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

    const finishDraw = async (draw) => {
        setErr(null);
        if (!draw.isAdmin) { setErr('Only admins can finish a draw'); return; }
        try {
            setBusyDraw(draw.id);
            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) utils.init();
            const res = await utils.sendTransaction(CONTRACT, 'finish_draw', { draw_id: draw.id });
            if (res && res.errors) throw new Error(res.errors);
            await refetch();
            setTimeout(refetch, 2000);
        } catch (e) {
            setErr(e.message || 'Finish draw failed');
        } finally {
            setBusyDraw(null);
        }
    };

    if (loading) {
        return (
            <div className="draw-page">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading draw information...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="draw-page">
                <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <h3>Error Loading Draw</h3>
                    <p>{error.message}</p>
                </div>
            </div>
        );
    }

    if (!draw) {
        return (
            <div className="draw-page">
                <div className="not-found-state">
                    <div className="not-found-icon">🔍</div>
                    <h3>Draw Not Found</h3>
                    <p>Draw #{drawId} doesn't exist or has been removed.</p>
                    <a href="/" className="back-link">← Back to Dashboard</a>
                </div>
            </div>
        );
    }

    return (
        <div className="draw-page">
            {/* Hero Section */}
            <div className="draw-hero">
                <div className="draw-hero-content">
                    <div className="draw-hero-icon">
                        {draw.winner ? '🏆' : '🎰'}
                    </div>
                    <h1 className="draw-hero-title">
                        Draw #{draw.id}
                        {draw.winner && <span className="completed-badge">Completed</span>}
                    </h1>
                    <p className="draw-hero-subtitle">
                        {draw.winner ? 'This draw has been completed' : 'Join the lottery and win big!'}
                    </p>
                    
                    {!draw.winner && (
                        <div className="draw-hero-stats">
                            <div className="draw-stat-item">
                                <span className="draw-stat-number">{draw.ticketCount}</span>
                                <span className="draw-stat-label">Tickets Sold</span>
                            </div>
                            <div className="draw-stat-item">
                                <span className="draw-stat-number">{(draw.pool || 0).toFixed(2)}</span>
                                <span className="draw-stat-label">Prize Pool</span>
                            </div>
                            <div className="draw-stat-item">
                                <span className="draw-stat-number">{draw.price}</span>
                                <span className="draw-stat-label">Ticket Price</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="draw-hero-background">
                    <div className="draw-floating-shapes">
                        <div className="draw-shape draw-shape-1"></div>
                        <div className="draw-shape draw-shape-2"></div>
                        <div className="draw-shape draw-shape-3"></div>
                    </div>
                </div>
            </div>

            {/* Back Button */}
            <div className="back-button-container">
                <a href="/" className="back-button">
                    <span className="back-icon">←</span>
                    <span>Back to Dashboard</span>
                </a>
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

            {/* Draw Content */}
            <div className="draw-content">
                <div className="draw-grid">
                    {/* Draw Details */}
                    <div className="draw-card details-card">
                        <div className="draw-card-header">
                            <div className="draw-card-icon">📋</div>
                            <h3>Draw Details</h3>
                            <p>Complete information about this draw</p>
                        </div>
                        
                        <div className="details-section">
                            <div className="detail-item">
                                <div className="detail-label">
                                    <span className="detail-icon">👤</span>
                                    Creator
                                </div>
                                <div className="detail-value">
                                    <code className="creator-address">{draw.creator}</code>
                                </div>
                            </div>

                            <div className="detail-item">
                                <div className="detail-label">
                                    <span className="detail-icon">🪙</span>
                                    Token
                                </div>
                                <div className="detail-value">
                                    <span className="token-badge">{formatTokenName(draw.token)}</span>
                                </div>
                            </div>

                            <div className="detail-item">
                                <div className="detail-label">
                                    <span className="detail-icon">💰</span>
                                    Ticket Price
                                </div>
                                <div className="detail-value">
                                    <span className="price-amount">{draw.price} {formatTokenName(draw.token)}</span>
                                </div>
                            </div>

                            <div className="detail-item">
                                <div className="detail-label">
                                    <span className="detail-icon">📊</span>
                                    Platform Fee
                                </div>
                                <div className="detail-value">
                                    <span className="fee-amount">{draw.feePercent}%</span>
                                </div>
                            </div>

                            {currentUserAddress && (
                                <div className="detail-item highlight">
                                    <div className="detail-label">
                                        <span className="detail-icon">🎫</span>
                                        Your Tickets
                                    </div>
                                    <div className="detail-value">
                                        <span className="my-tickets-count">{draw.myTickets}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Card */}
                    <div className="draw-card actions-card">
                        <div className="draw-card-header">
                            <div className="draw-card-icon">⚡</div>
                            <h3>Actions</h3>
                            <p>Participate in this draw</p>
                        </div>
                        
                        <div className="actions-section">
                            {!draw.winner ? (
                                <>
                                    <TicketPurchaseSection 
                                        draw={draw} 
                                        onBuyTicket={buyTicket} 
                                        busyDraw={busyDraw} 
                                    />

                                    {draw.isAdmin && (
                                        <button
                                            className={`action-button secondary ${busyDraw === draw.id ? 'loading' : ''}`}
                                            disabled={busyDraw === draw.id || draw.ticketCount <= 0}
                                            onClick={() => finishDraw(draw)}
                                        >
                                            {busyDraw === draw.id ? (
                                                <>
                                                    <div className="button-spinner"></div>
                                                    Processing...
                                                </>
                                            ) : draw.ticketCount > 0 ? (
                                                <>
                                                    <span className="button-icon">🏁</span>
                                                    Finish Draw
                                                </>
                                            ) : (
                                                <>
                                                    <span className="button-icon">⚠️</span>
                                                    No Tickets
                                                </>
                                            )}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="winner-section">
                                    <div className="winner-badge">🏆 Winner!</div>
                                    <div className="winner-info">
                                        <div className="winner-label">Winner Address:</div>
                                        <code className="winner-address">{draw.winner}</code>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Share Section */}
                <div className="share-section">
                    <div className="share-card">
                        <div className="share-header">
                            <div className="share-icon">🔗</div>
                            <h4>Share This Draw</h4>
                        </div>
                        <div className="share-content">
                            <div className="share-url">
                                <input
                                    type="text"
                                    className="share-input"
                                    value={typeof window !== 'undefined' ? window.location.href : ''}
                                    readOnly
                                />
                                <button 
                                    className="copy-button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        setNotice('✅ Link copied to clipboard!');
                                        setTimeout(() => setNotice(null), 3000);
                                    }}
                                >
                                    📋 Copy
                                </button>
                            </div>
                            <div className="share-hint">
                                Share this link with others to invite them to participate in this draw!
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TicketPurchaseSection({ draw, onBuyTicket, busyDraw }) {
    const [ticketCount, setTicketCount] = useState(1);
    
    return (
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
                onClick={() => onBuyTicket(draw, ticketCount)}
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
    );
}
