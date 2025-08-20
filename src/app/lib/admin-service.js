import WalletUtilService from './wallet-util-service';

class AdminService {
    constructor() {
        this.isAdmin = false;
        this.isLoading = false;
        this.error = null;
    }

    async checkAdminStatus() {
        try {
            this.isLoading = true;
            this.error = null;

            const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;

            if (!xianWalletUtilInstance.initialized) {
                await xianWalletUtilInstance.init();
            }

            // Get current user's wallet address
            const walletInfo = await xianWalletUtilInstance.requestWalletInfo();
            const userAddress = walletInfo.address;

            if (!userAddress) {
                this.error = 'No wallet address available';
                this.isAdmin = false;
                return false;
            }

            // Get the owner address from the contract
            const ownerRes = await fetch(
                'https://node.xian.org/abci_query?path="get/con_x00011.owner"'
            );
            const ownerData = await ownerRes.json();
            
            if (!ownerData.result || !ownerData.result.response || !ownerData.result.response.value) {
                this.error = 'Failed to get owner address';
                this.isAdmin = false;
                return false;
            }

            const ownerAddress = window.atob(ownerData.result.response.value);
            
            // Check if current user is the owner
            this.isAdmin = userAddress.toLowerCase() === ownerAddress.toLowerCase();
            
            return this.isAdmin;
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.error = 'Failed to check admin status';
            this.isAdmin = false;
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    getAdminStatus() {
        return {
            isAdmin: this.isAdmin,
            isLoading: this.isLoading,
            error: this.error
        };
    }

    reset() {
        this.isAdmin = false;
        this.isLoading = false;
        this.error = null;
    }
}

// Singleton instance
let adminServiceInstance = null;

export const getAdminService = () => {
    if (!adminServiceInstance) {
        adminServiceInstance = new AdminService();
    }
    return adminServiceInstance;
};

export default AdminService; 