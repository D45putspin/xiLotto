'use client'

import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';
import WalletUtilService from '../lib/wallet-util-service';
import { useLotteryQuery } from '../fn/useLotteryQuery';

// Component to fetch and display user's tickets for current round
const MyTicketsInfo = ({ currentRound, walletAddress, isDrawn }) => {
    const [ticketCount, setTicketCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (currentRound > 0 && walletAddress) {
            fetchUserTickets();
        } else {
            setLoading(false);
        }
    }, [currentRound, walletAddress]);

    const fetchUserTickets = async () => {
        if (!currentRound || !walletAddress) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const baseUrl = 'https://testnet.xian.org/abci_query';

            // Get tickets for current round
            const ticketsKey = `"/get/con_x00011.tickets:${currentRound}"`;
            const ticketsRes = await fetch(`${baseUrl}?path=${encodeURIComponent(ticketsKey)}&prove=false`);
            const ticketsJson = await ticketsRes.json();

            let roundTickets = [];
            try {
                const ticketsValue = ticketsJson.result?.response?.value;
                if (ticketsValue) {
                    const decodedTickets = window.atob(ticketsValue);
                    roundTickets = JSON.parse(decodedTickets) || [];
                }
            } catch (e) {
                console.error(`Error parsing tickets for round ${currentRound}:`, e);
                roundTickets = [];
            }

            // Count user's tickets in this round
            const userTickets = roundTickets.filter(addr => addr === walletAddress).length;
            console.log(`Round ${currentRound}: User has ${userTickets} tickets`);

            setTicketCount(userTickets);
        } catch (e) {
            console.error('Error fetching user tickets:', e);
            setError('Failed to fetch ticket data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <p className="text-secondary">Loading your tickets...</p>;
    }

    if (error) {
        return <p className="text-secondary">Error loading tickets</p>;
    }

    if (ticketCount > 0) {
        const roundText = isDrawn ? `round #${currentRound}` : `round #${currentRound}`;
        return (
            <div>
                <p className="text-secondary mb-2">
                    You had <span className="accent-text font-bold text-xl">{ticketCount}</span> ticket{ticketCount === 1 ? '' : 's'} in {roundText}
                </p>
            </div>
        );
    } else {
        const roundText = isDrawn ? `round #${currentRound}` : `round #${currentRound}`;
        return <p className="text-secondary">You didn&apos;t have any tickets in {roundText}</p>;
    }
};

const LotteryDashboard = ({
    isAdmin = false,
    adminLoading = false,
    adminError = null,
    onCheckAdmin = null
}) => {
    const lotteryAddress = 'con_x00011';
    const {
        lotteryData,
        loading: queryLoading,
        error: queryError,
        refetch
    } = useLotteryQuery();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);

    // Debug lottery data
    console.log('Lottery Data:', lotteryData);
    console.log('Current Round:', lotteryData.currentRound);
    console.log('Is Active:', lotteryData.isActive);
    console.log('Is Drawn:', lotteryData.isDrawn);
    console.log('Winner:', lotteryData.winner);
    console.log('Ticket Count:', lotteryData.ticketCount);

    // Get wallet address on mount
    useEffect(() => {
        const getWallet = async () => {
            try {
                const utils = WalletUtilService.getInstance().XianWalletUtils;
                if (!utils.initialized) await utils.init();
                const walletInfo = await utils.requestWalletInfo();
                const address = walletInfo?.address || null;
                setWalletAddress(address);

                // Update the store with the wallet address
                if (address) {
                    useStore.getState().setWalletAddress(address);
                }
            } catch (e) {
                console.error('Failed to get wallet:', e);
                setWalletAddress(null);
                // Update store to show not connected
                useStore.getState().setWalletAddress(null);
            }
        };
        getWallet();
    }, []);

    // Buy one ticket function
    const buyOneTicket = async () => {
        if (!walletAddress) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const utils = WalletUtilService.getInstance().XianWalletUtils;
            if (!utils.initialized) await utils.init();

            // Calculate cost for one ticket
            const ticketCost = lotteryData.ticketPrice;
            console.log(`Buying 1 ticket for ${ticketCost} XIAN`);

            // Step 1: Approve tokens for one ticket
            let approveRes;
            try {
                approveRes = await utils.sendTransaction('currency', 'approve', {
                    to: lotteryAddress,
                    amount: ticketCost
                });
                console.log('Approve response:', approveRes);
            } catch (approveError) {
                console.error('Approve transaction error:', approveError);
                throw new Error(`Approve failed: ${approveError.message}`);
            }

            // Check approve response for errors
            if (approveRes && approveRes.errors) {
                console.error('Approve error details:', approveRes.errors);
                throw new Error(`Approve failed: ${approveRes.errors}`);
            }

            // Step 2: Buy one ticket
            let buyRes;
            try {
                buyRes = await utils.sendTransaction(lotteryAddress, 'buy_ticket', {});
                console.log('Buy ticket response:', buyRes);
                console.log('Buy ticket response type:', typeof buyRes);
                console.log('Buy ticket response keys:', buyRes ? Object.keys(buyRes) : 'null/undefined');
            } catch (buyError) {
                console.error('Buy ticket transaction error:', buyError);
                throw new Error(`Buy ticket failed: ${buyError.message}`);
            }

            // Check for explicit errors first
            if (buyRes && buyRes.errors) {
                console.error('Buy ticket error details:', buyRes.errors);
                throw new Error(`Buy ticket failed: ${buyRes.errors}`);
            }

            // If we have a response with txHash, proceed with waiting
            if (buyRes && buyRes.txHash) {
                console.log('Waiting for buy ticket transaction...');
                await utils.waitForTransaction(buyRes.txHash);
                console.log('Ticket bought successfully!');
                setError(null);
                // refetch to get latest data
                await refetch();
            } else {
                // If response is null but no explicit errors, the transaction was likely successful
                console.log('Transaction completed (null response but no errors), assuming success');
                console.log('Response was:', buyRes);
                setError(null);
                await refetch();
            }
        } catch (e) {
            console.error('Buy ticket error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Admin functions
    const startLottery = async () => {
        try {
            setLoading(true);
            setError(null);

            const utils = WalletUtilService.getInstance().XianWalletUtils;
            const res = await utils.sendTransaction(lotteryAddress, 'start_lottery', {});

            // Check for explicit errors first
            if (res && res.errors) {
                throw new Error(`Start lottery failed: ${res.errors}`);
            }

            // If we have a response with txHash, proceed with waiting
            if (res && res.txHash) {
                await utils.waitForTransaction(res.txHash);
                // refetch to pick up new round
                await refetch();
            } else {
                // If no explicit errors but also no txHash, assume success
                console.log('Start lottery completed (null response but no errors), assuming success');
                await refetch();
            }
        } catch (e) {
            console.error('Start lottery error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const drawWinner = async () => {
        try {
            setLoading(true);
            setError(null);

            const utils = WalletUtilService.getInstance().XianWalletUtils;
            const res = await utils.sendTransaction(lotteryAddress, 'draw', {});

            // Check for explicit errors first
            if (res && res.errors) {
                throw new Error(`Draw winner failed: ${res.errors}`);
            }

            // Optimistically update the UI to show the draw is complete
            // This will be overridden by the actual refetch data
            console.log('Draw transaction completed, optimistically updating UI...');

            // If we have a response with txHash, proceed with waiting
            if (res && res.txHash) {
                await utils.waitForTransaction(res.txHash);
                // Multiple refetch attempts to ensure we get the updated state
                await refetch();
                // Wait a bit and refetch again to handle potential delays
                setTimeout(async () => {
                    await refetch();
                }, 2000);
            } else {
                // If no explicit errors but also no txHash, assume success
                console.log('Draw winner completed (null response but no errors), assuming success');
                await refetch();
                // Additional refetch after a delay
                setTimeout(async () => {
                    await refetch();
                }, 2000);
            }
        } catch (e) {
            console.error('Draw winner error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lottery-dashboard">
            {/* Header */}
            <div className="lottery-header text-center mb-5">
                <h1 className="gradient-text">🎰 XiLotto</h1>
                <p className="text-secondary">Community lottery on Xian blockchain</p>
            </div>

            {/* Error Messages */}
            {error && (
                <div className="error-card mb-4">
                    <div className="flex justify-between items-center">
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="error-close-btn"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {queryError && (
                <div className="error-card mb-4">
                    {queryError.message}
                </div>
            )}

            {/* Show loading only for initial data fetch, not for individual operations */}
            {queryLoading && !lotteryData.currentRound ? (
                <div className="text-center mb-5">
                    <p className="text-secondary">Loading lottery data...</p>
                </div>
            ) : (
                <>
                    {/* Lottery Stats */}
                    <div className="grid grid-4 mb-5">
                        <div className="card stat-card">
                            <h3>Current Round</h3>
                            <div className="stat-value">{lotteryData.currentRound}</div>
                        </div>

                        <div className="card stat-card">
                            <h3>Pool Amount</h3>
                            <div className="stat-value">{lotteryData.pool.toFixed(2)} XIAN</div>
                        </div>

                        <div className="card stat-card">
                            <h3>Tickets Sold</h3>
                            <div className="stat-value">{lotteryData.ticketCount}</div>
                        </div>

                        <div className="card stat-card">
                            <h3>Ticket Price</h3>
                            <div className="stat-value">{lotteryData.ticketPrice} XIAN</div>
                        </div>
                    </div>

                    {/* My Tickets Section */}
                    {walletAddress && lotteryData.currentRound > 0 && (
                        <div className="card mb-4">
                            <h3 className="text-center mb-3">🎫 My Tickets</h3>
                            <div className="text-center">
                                <MyTicketsInfo
                                    currentRound={lotteryData.currentRound}
                                    walletAddress={walletAddress}
                                    isDrawn={lotteryData.isDrawn}
                                />
                            </div>
                        </div>
                    )}

                    {/* Buy Tickets Section */}
                    {lotteryData.isActive && !lotteryData.isDrawn && (
                        <div className="card action-card mb-4">
                            <h3 className="text-center mb-3">🎫 Buy Ticket</h3>
                            <p className="text-center mb-4">
                                Price: <span className="accent-text">{lotteryData.ticketPrice} XIAN</span> per ticket
                            </p>

                            {walletAddress ? (
                                <div className="text-center">
                                    <button
                                        onClick={buyOneTicket}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        {loading ? '⏳ Processing...' : '🎫 Buy 1 Ticket'}
                                    </button>
                                </div>
                            ) : (
                                <div className="wallet-notice">
                                    <p>🔗 Please connect your wallet to buy tickets</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Winner Section */}
                    {lotteryData.isDrawn && (
                        <div className="card winner-card mb-4">
                            <h3 className="text-center mb-4">🏆 Winner Drawn!</h3>
                            <div className="winner-info">
                                <p><strong>Round:</strong> #{lotteryData.currentRound}</p>
                                <p><strong>Winner:</strong> {lotteryData.winner}</p>
                                <p><strong>Total Pool:</strong> {lotteryData.pool.toFixed(2)} XIAN</p>
                                <p><strong>Prize:</strong> {(lotteryData.pool * (100 - lotteryData.feePercent) / 100).toFixed(2)} XIAN</p>
                                <p><strong>Admin Fee:</strong> {(lotteryData.pool * lotteryData.feePercent / 100).toFixed(2)} XIAN ({lotteryData.feePercent}%)</p>
                                <p><strong>Tickets Sold:</strong> {lotteryData.ticketCount}</p>
                            </div>

                            {lotteryData.winner === walletAddress && (
                                <div className="winner-badge">
                                    🎉 CONGRATULATIONS! YOU WON! 🎉
                                </div>
                            )}
                        </div>
                    )}

                    {/* Lottery Status */}
                    {lotteryData.currentRound > 0 && !lotteryData.isActive && !lotteryData.isDrawn && (
                        <div className="card status-card mb-4">
                            <h3 className="text-center mb-3">🔒 Lottery Closed</h3>
                            <p>Round #{lotteryData.currentRound} is closed. No winner has been drawn yet.</p>
                            <p>Total tickets sold: <span className="accent-text">{lotteryData.ticketCount}</span></p>
                            <p>Total pool: <span className="accent-text">{lotteryData.pool.toFixed(2)} XIAN</span></p>
                        </div>
                    )}

                    {!lotteryData.isActive && !lotteryData.isDrawn && lotteryData.currentRound === 0 && (
                        <div className="card status-card mb-4">
                            <h3 className="text-center mb-3">No Active Lottery</h3>
                            <p>Start a new lottery round to begin!</p>
                        </div>
                    )}

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="card admin-card mb-4">
                            <h3 className="text-center mb-4">🔧 Admin Functions</h3>

                            {adminError && (
                                <div className="error-card mb-4">
                                    <div className="flex justify-between items-center">
                                        <span>Admin Error: {adminError}</span>
                                        <button
                                            onClick={onCheckAdmin}
                                            className="error-close-btn"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            )}

                            {adminLoading && (
                                <div className="loading-card mb-4">
                                    <span>⏳ Checking admin status...</span>
                                </div>
                            )}

                            <div className="grid grid-2 gap-4">
                                {(lotteryData.currentRound === 0 || lotteryData.isDrawn) && (
                                    <button
                                        onClick={startLottery}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        {loading ? '⏳ Processing...' : (lotteryData.isDrawn ? '🎰 Start New Lottery Round' : '🎰 Start New Lottery')}
                                    </button>
                                )}

                                {lotteryData.currentRound > 0 && !lotteryData.isDrawn && lotteryData.ticketCount > 0 && (
                                    <button
                                        onClick={drawWinner}
                                        disabled={loading}
                                        className="btn btn-success"
                                    >
                                        {loading ? '⏳ Processing...' : `🏆 Draw Winner (${lotteryData.ticketCount} tickets sold)`}
                                    </button>
                                )}

                                {lotteryData.currentRound > 0 && !lotteryData.isDrawn && lotteryData.ticketCount <= 0 && (
                                    <button disabled className="btn btn-error">
                                        ⚠️ No Tickets Sold - Cannot Draw
                                    </button>
                                )}

                                {lotteryData.isDrawn && (
                                    <div className="success-card">
                                        <p>✅ Round #{lotteryData.currentRound} completed</p>
                                        <p>Winner: {lotteryData.winner}</p>
                                        <p>Ready for next round! 🎰</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manual Refresh Button */}
                    <div className="text-center">


                        {/* Show additional info if there's a potential state mismatch */}
                        {lotteryData.currentRound > 0 && lotteryData.ticketCount > 0 && !lotteryData.isDrawn && (
                            <div className="mt-2 text-sm text-secondary">
                                <p>💡 If the draw button is still showing after drawing a winner, try refreshing the data above.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default LotteryDashboard;
