'use client'

import React, { useState, useEffect } from 'react';
import Nav from './Nav';
import MultiDrawDashboard from './MultiDrawDashboard'; // ⬅️ new dashboard
import LotteryAdmin from './LotteryAdmin';
import useStore from '../lib/store';
import WalletUtilService from '../lib/wallet-util-service';

const Main = () => {
    const [activeTab, setActiveTab] = useState('lottery');

    const walletAddressElementValue = useStore(state => state.walletAddressElementValue);
    const isWalletConnected = walletAddressElementValue && walletAddressElementValue !== 'Not connected';

    // Global wallet connection check
    useEffect(() => {
        const checkWalletConnection = async () => {
            try {
                const utils = WalletUtilService.getInstance().XianWalletUtils;
                if (!utils.initialized) utils.init();
                const info = await utils.requestWalletInfo();
                const address = info?.address || null;
                useStore.getState().setWalletAddress(address);
            } catch (e) {
                useStore.getState().setWalletAddress(null);
            }
        };

        checkWalletConnection();
    }, []);

    return (
        <div className="app">
            <Nav />
            <div className="main-content">
                <div className="container">
                    <div className="tab-navigation">
                        <button
                            className={`tab-button ${activeTab === 'lottery' ? 'active' : ''}`}
                            onClick={() => setActiveTab('lottery')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor" />
                            </svg>
                            Draws
                        </button>

                        <button
                            className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                            onClick={() => setActiveTab('admin')}
                            disabled={!isWalletConnected}
                            title={isWalletConnected ? 'Start a new draw' : 'Connect wallet to create draws'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                                <path d="M2 17L12 22L22 17" fill="currentColor" />
                                <path d="M2 12L12 17L22 12" fill="currentColor" />
                            </svg>
                            Create
                        </button>

                        {!isWalletConnected && (
                            <span className="admin-loading-indicator">
                                Connect your wallet to create draws
                            </span>
                        )}
                    </div>

                    <div className="tab-content">
                        {activeTab === 'lottery' && (
                            // ⬇️ no props needed; it handles per-draw admin internally
                            <MultiDrawDashboard />
                        )}

                        {activeTab === 'admin' && (
                            // Permissionless: anyone can start a draw
                            <LotteryAdmin />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Main;
