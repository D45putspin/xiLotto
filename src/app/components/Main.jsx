'use client'

import React, { useState, useEffect } from 'react';
import Nav from './Nav';
import LotteryDashboard from './LotteryDashboard';
import LotteryAdmin from './LotteryAdmin';
import { getAdminService } from '../lib/admin-service';
import useStore from '../lib/store';

const Main = () => {
    const [activeTab, setActiveTab] = useState('lottery');
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminError, setAdminError] = useState(null);

    const walletAddressElementValue = useStore(state => state.walletAddressElementValue);
    const isWalletConnected = walletAddressElementValue !== 'Not connected';

    const checkAdminStatus = async () => {
        if (!isWalletConnected) {
            setIsAdmin(false);
            return;
        }

        try {
            setAdminLoading(true);
            setAdminError(null);

            const adminService = getAdminService();
            const adminStatus = await adminService.checkAdminStatus();
            setIsAdmin(adminStatus);
        } catch (error) {
            console.error('Error checking admin status:', error);
            setAdminError('Failed to check admin status');
            setIsAdmin(false);
        } finally {
            setAdminLoading(false);
        }
    };

    useEffect(() => {
        checkAdminStatus();
    }, [isWalletConnected]);

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
                            🎰 Lottery
                        </button>
                        {isAdmin && (
                            <button
                                className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                                onClick={() => setActiveTab('admin')}
                            >
                                🔧 Admin
                            </button>
                        )}
                        {adminLoading && (
                            <div className="admin-loading-indicator">
                                <span className="loading-spinner"></span>
                                Checking admin status...
                            </div>
                        )}
                    </div>

                    <div className="tab-content">
                        {activeTab === 'lottery' && (
                            <LotteryDashboard
                                isAdmin={isAdmin}
                                adminLoading={adminLoading}
                                adminError={adminError}
                                onCheckAdmin={checkAdminStatus}
                            />
                        )}
                        {activeTab === 'admin' && isAdmin && <LotteryAdmin />}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Main;