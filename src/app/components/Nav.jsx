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
            <div className="container">
                <div className="nav-content">
                    <a href="/" className="nav-logo">
                        <div className="logo-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                                <path d="M2 17L12 22L22 17" fill="currentColor" />
                                <path d="M2 12L12 17L22 12" fill="currentColor" />
                            </svg>
                        </div>
                        <span>XiLotto</span>
                    </a>

                    <div className="nav-menu">
                        <div className="wallet-status">
                            <div className={`status-dot ${walletAddressElementValue !== 'Not connected' ? 'connected' : ''}`}></div>
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