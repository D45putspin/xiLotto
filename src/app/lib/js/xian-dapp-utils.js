// lib/wallet-util-service.mjs

const XianWalletUtils = {
  rpcUrl: 'https://devnet.xian.org',
  isWalletReady: false,
  initialized: false,
  isUnlocking: false,
  state: {
    walletReady: { resolvers: [] },
    walletInfo: { requests: [] },
    signMessage: { requests: [] },
    transaction: { requests: [] },
  },

  init: function (rpcUrl) {
    if (this.initialized) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (rpcUrl) this.rpcUrl = rpcUrl;

    document.addEventListener('xianWalletInfo', (e) => {
      if (this.state.walletInfo.requests.length > 0) {
        const resolver = this.state.walletInfo.requests.shift();
        resolver(e.detail);
      }
      if (typeof window !== 'undefined' && window.handleWalletInfo) {
        window.handleWalletInfo(e.detail);
      }
    });

    document.addEventListener('xianWalletSignMsgResponse', (e) => {
      if (this.state.signMessage.requests.length > 0) {
        const resolver = this.state.signMessage.requests.shift();
        resolver(e.detail);
      }
    });

    document.addEventListener('xianWalletTxStatus', (e) => {
      if (this.state.transaction.requests.length > 0) {
        const resolver = this.state.transaction.requests.shift();
        if ('errors' in e.detail) {
          resolver(e.detail);
        } else {
          this.getTxResultsAsyncBackoff(e.detail.txid)
            .then((tx) => {
              try {
                const decoded = JSON.parse(window.atob(tx.result.tx_result.data));
                resolver(decoded);
              } catch {
                resolver(null);
              }
            })
            .catch(() => resolver(null));
        }
      }
    });

    document.addEventListener('xianReady', () => {
      this.isWalletReady = true;
      this.isUnlocking = false;
      while (this.state.walletReady.resolvers.length > 0) {
        this.state.walletReady.resolvers.shift()();
      }
    });

    this.initialized = true;
  },

  waitForWalletReady: function () {
    return new Promise((resolve) => {
      if (this.isWalletReady) return resolve();
      this.state.walletReady.resolvers.push(resolve);
      setTimeout(() => {
        const idx = this.state.walletReady.resolvers.indexOf(resolve);
        if (idx !== -1) this.state.walletReady.resolvers.splice(idx, 1);
        resolve();
      }, 2000);
    });
  },

  requestWalletInfo: async function () {
    if (this.isUnlocking) {
      await this.waitForWalletReady();
      return new Promise((resolve, reject) => {
        this.state.walletInfo.requests.push(resolve);
        setTimeout(() => reject(new Error('Xian Wallet not responding')), 2000);
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));
        }
      });
    }

    if (this.isWalletReady) {
      return new Promise((resolve, reject) => {
        this.state.walletInfo.requests.push(resolve);
        setTimeout(() => reject(new Error('Xian Wallet not responding')), 2000);
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));
        }
      });
    }

    this.isUnlocking = true;
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));
    }

    return new Promise((resolve, reject) => {
      this.state.walletInfo.requests.push((info) => {
        this.isUnlocking = false;
        resolve(info);
      });
      setTimeout(() => {
        this.isUnlocking = false;
        reject(new Error('Xian Wallet not responding'));
      }, 2000);
    });
  },

  signMessage: async function (message) {
    await this.waitForWalletReady();
    return new Promise((resolve, reject) => {
      this.state.signMessage.requests.push(resolve);
      setTimeout(() => reject(new Error('Sign message timeout')), 30000);
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('xianWalletSignMsg', { detail: { message } }));
      }
    });
  },

  sendTransaction: async function (contract, method, kwargs = {}) {
    await this.waitForWalletReady();
    return new Promise((resolve, reject) => {
      this.state.transaction.requests.push(resolve);
      const timeoutId = setTimeout(() => {
        reject(new Error('Transaction timeout - wallet may not be responding'));
      }, 30000);

      if (typeof document !== 'undefined') {
        document.dispatchEvent(
          new CustomEvent('xianWalletSendTx', { detail: { contract, method, kwargs } })
        );
      } else {
        clearTimeout(timeoutId);
        reject(new Error('Document not available'));
        return;
      }

      const originalResolve = resolve;
      this.state.transaction.requests[this.state.transaction.requests.length - 1] = (result) => {
        clearTimeout(timeoutId);
        originalResolve(result);
      };
    });
  },

  getTxResults: async function (txHash) {
    const response = await fetch(`${this.rpcUrl}/tx?hash=0x${txHash}`);
    return response.json();
  },

  waitForTransaction: async function (txHash, retries = 15, delay = 1500) {
    while (retries-- > 0) {
      try {
        const res = await this.getTxResults(txHash);
        if (res?.result) return res;
      } catch {}
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error('Timeout waiting for tx result');
  },

  getTxResultsAsyncBackoff: async function (txHash, retries = 5, delay = 1000) {
    try {
      return await this.getTxResults(txHash);
    } catch (e) {
      if (retries === 0) throw e;
      await new Promise((r) => setTimeout(r, delay));
      return await this.getTxResultsAsyncBackoff(txHash, retries - 1, delay * 2);
    }
  },

  // === NEW: draw-style counters ===
  /**
   * Fetch how many tickets a user bought in a draw.
   * Uses key: draw_user_counts:{draw|address}
   */
  getUserTicketsDraw: async function (contract, drawId, userAddress) {
    const rawPath = `"/get/${contract}.draw_user_counts:${drawId}|${userAddress}"`;
    const path = encodeURIComponent(rawPath);
    const res = await fetch(`${this.rpcUrl}/abci_query?path=${path}&prove=false`);
    const data = await res.json();
    const base64 = data?.result?.response?.value;
    if (!base64 || base64 === 'AA==') return 0;
    return parseInt(window.atob(base64), 10) || 0;
  },

  getBalanceRequest: async function (address, tokenContract) {
    try {
      const response = await fetch(
        `${this.rpcUrl}/abci_query?path=%22/get/${tokenContract}.balances:${address}%22`
      );
      const data = await response.json();
      const balance = data?.result?.response?.value;
      if (!balance || balance === 'AA==') return '0';
      return window.atob(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  },
};

export default XianWalletUtils;
