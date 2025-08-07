# XiLotto - Decentralized Lottery System

A modern, blockchain-based lottery application built with Next.js and the Xian blockchain.

## 🚀 Features

- **Buy Tickets**: Users can purchase lottery tickets using XIAN tokens
- **Real-time Pool**: See live lottery pool amounts and ticket counts
- **Winner Drawing**: Admin can draw winners with deterministic randomness
- **User-friendly Interface**: Clean, modern UI with Bulma CSS framework
- **Wallet Integration**: Seamless integration with Xian wallet extension
- **Ticket History**: View your ticket history and winnings

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18
- **Styling**: Bulma CSS Framework
- **State Management**: Zustand
- **Blockchain**: Xian Network
- **Wallet**: Xian Wallet Extension

## 📋 Prerequisites

- Node.js 18+
- Xian Wallet Extension installed in your browser
- Access to Xian testnet

## 🚀 Getting Started

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Run Development Server**

   ```bash
   npm run dev
   ```

3. **Open Browser**
   Navigate to `http://localhost:3001`

4. **Connect Wallet**
   - Install the Xian Wallet Extension
   - Connect your wallet to the dapp
   - Ensure you have some test tokens

## 🎯 How to Use

### Buying Tickets

1. Connect your Xian wallet
2. Click "Buy Ticket" button
3. Confirm transaction in your wallet
4. See your ticket count update in real-time

### Admin Functions

1. **Start Lottery**: Begin a new lottery round
2. **Draw Winner**: Select a winner using deterministic randomness
3. **Set Parameters**: Adjust ticket price, fee percentage, and limits

### Viewing Results

- Real-time pool amounts and ticket counts
- Winner announcements with prize breakdowns
- Your ticket history and winnings

## 🔧 Smart Contract Integration

The dapp integrates with Xian smart contracts for:

- `buy_ticket`: Purchase lottery tickets
- `start_lottery`: Begin new lottery rounds
- `draw`: Select winners with deterministic randomness
- `set_ticket_price`: Adjust ticket pricing
- `set_fee_percent`: Configure fee percentages
- `set_max_tickets_per_user`: Set purchase limits

## 🎨 UI Components

- **Lottery Dashboard**: Main lottery interface with stats and actions
- **Admin Panel**: Parameter management and lottery control
- **Ticket History**: View your past tickets and winnings
- **Real-time Stats**: Live pool amounts and ticket counts

## 🔒 Security Features

- **Blockchain Verification**: All transactions recorded on-chain
- **Deterministic Randomness**: Fair winner selection using block data
- **Transparent Results**: All data publicly verifiable
- **Wallet Authentication**: Secure user identification

## 🚀 Future Enhancements

- [ ] Multiple lottery types
- [ ] Time-locked lotteries
- [ ] Token-weighted lotteries
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.
