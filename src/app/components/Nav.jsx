'use client'
import React from 'react';
import useStore from '../lib/store';

const Nav = () => {
    const walletAddressElementValue = useStore(state => state.walletAddressElementValue);

    const formatWalletAddress = (address) => {
        if (!address || address === 'Not connected') return 'Not connected';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <nav className="nav" aria-label="main navigation">
            <div className="nav-content">
                <div className="nav-brand">
                    <a href="/" className="nav-logo">
                        <div className="logo-icon">
                            🎰
                        </div>
                        <span className="logo-text">XiLotto</span>
                    </a>
                </div>

                <div className="nav-menu">

                    <div className="nav-end">
                        <div className="wallet-status">
                            <div className="wallet-indicator">
                                <div className={`status-dot ${walletAddressElementValue !== 'Not connected' ? 'connected' : 'disconnected'}`}></div>
                            </div>
                            <span className="wallet-address" id="wallet-address">
                                {formatWalletAddress(walletAddressElementValue)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Nav;