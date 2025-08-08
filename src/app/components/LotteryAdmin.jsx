'use client'

import React, { useState, useEffect } from 'react';
import WalletUtilService from '../lib/wallet-util-service';

const LotteryAdmin = () => {
    const [parameters, setParameters] = useState({
        ticketPrice: 100,
        feePercent: 10,
        maxTicketsPerUser: 0
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const fetchParameters = async () => {
        try {
            const ticketPriceRes = await fetch(
                'https://devnet.xian.org/abci_query?path="get/con_x00011.ticket_price"'
            );
            const ticketPriceData = await ticketPriceRes.json();
            const ticketPrice = parseInt(window.atob(ticketPriceData.result.response.value)) || 100;

            const feePercentRes = await fetch(
                'https://devnet.xian.org/abci_query?path="get/con_x00011.fee_percent"'
            );
            const feePercentData = await feePercentRes.json();
            const feePercent = parseInt(window.atob(feePercentData.result.response.value)) || 10;

            const maxTicketsRes = await fetch(
                'https://devnet.xian.org/abci_query?path="get/con_x00011.max_tickets_per_user"'
            );
            const maxTicketsData = await maxTicketsRes.json();
            const maxTicketsPerUser = parseInt(window.atob(maxTicketsData.result.response.value)) || 0;

            setParameters({
                ticketPrice,
                feePercent,
                maxTicketsPerUser
            });
        } catch (error) {
            console.error('Error fetching parameters:', error);
            setError('Failed to fetch current parameters');
        }
    };

    useEffect(() => {
        fetchParameters();
    }, []);

    const updateParameter = async (method, value, parameterName) => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;

            if (!xianWalletUtilInstance.initialized) {
                await xianWalletUtilInstance.init();
            }

            const result = await xianWalletUtilInstance.sendTransaction(
                'con_x00011',
                method,
                { [parameterName]: value }
            );

            if (result && result.errors) {
                setError(`Failed to update ${parameterName}: ${result.errors}`);
            } else {
                setSuccess(`${parameterName} updated successfully!`);
                setTimeout(() => {
                    fetchParameters();
                    setSuccess(null);
                }, 2000);
            }
        } catch (error) {
            console.error(`Error updating ${parameterName}:`, error);
            setError(`Failed to update ${parameterName}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTicketPriceUpdate = () => {
        const newPrice = parseInt(document.getElementById('ticket-price-input').value);
        if (newPrice > 0) {
            updateParameter('set_ticket_price', newPrice, 'price');
        } else {
            setError('Ticket price must be greater than 0');
        }
    };

    const handleFeePercentUpdate = () => {
        const newFee = parseInt(document.getElementById('fee-percent-input').value);
        if (newFee >= 0 && newFee <= 100) {
            updateParameter('set_fee_percent', newFee, 'fee');
        } else {
            setError('Fee percentage must be between 0 and 100');
        }
    };

    const handleMaxTicketsUpdate = () => {
        const newMax = parseInt(document.getElementById('max-tickets-input').value);
        if (newMax >= 0) {
            updateParameter('set_max_tickets_per_user', newMax, 'max_tickets');
        } else {
            setError('Max tickets must be 0 or greater (0 = unlimited)');
        }
    };

    return (
        <div className="lottery-admin">
            <div className="admin-header text-center mb-5">
                <h2>🔧 Lottery Administration</h2>
                <p className="text-secondary">Manage lottery parameters and settings</p>
            </div>

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

            {success && (
                <div className="success-card mb-4">
                    <div className="flex justify-between items-center">
                        <span>{success}</span>
                        <button
                            onClick={() => setSuccess(null)}
                            className="error-close-btn"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-3 gap-4 mb-5">
                <div className="card parameter-card">
                    <h3>🎫 Ticket Price</h3>
                    <p className="text-secondary">Current: <span className="accent-text">{parameters.ticketPrice} XIAN</span></p>
                    <div className="parameter-input">
                        <input
                            id="ticket-price-input"
                            type="number"
                            min="1"
                            placeholder="New ticket price"
                            className="input"
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleTicketPriceUpdate}
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update Price'}
                        </button>
                    </div>
                </div>

                <div className="card parameter-card">
                    <h3>💰 Fee Percentage</h3>
                    <p className="text-secondary">Current: <span className="accent-text">{parameters.feePercent}%</span></p>
                    <div className="parameter-input">
                        <input
                            id="fee-percent-input"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="New fee percentage"
                            className="input"
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleFeePercentUpdate}
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update Fee'}
                        </button>
                    </div>
                </div>

                <div className="card parameter-card">
                    <h3>🎯 Max Tickets Per User</h3>
                    <p className="text-secondary">Current: <span className="accent-text">{parameters.maxTicketsPerUser === 0 ? 'Unlimited' : parameters.maxTicketsPerUser}</span></p>
                    <div className="parameter-input">
                        <input
                            id="max-tickets-input"
                            type="number"
                            min="0"
                            placeholder="Max tickets (0 = unlimited)"
                            className="input"
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleMaxTicketsUpdate}
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update Limit'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card admin-info">
                <h3>ℹ️ Parameter Information</h3>
                <ul>
                    <li><strong>Ticket Price:</strong> Amount in XIAN tokens required to buy one ticket</li>
                    <li><strong>Fee Percentage:</strong> Percentage of the pool taken as admin fee (0-100%)</li>
                    <li><strong>Max Tickets Per User:</strong> Maximum number of tickets a single user can buy (0 = unlimited)</li>
                </ul>
            </div>
        </div>
    );
};

export default LotteryAdmin; 