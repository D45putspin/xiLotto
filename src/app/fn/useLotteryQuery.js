import React from 'react';
import { gql, useQuery } from '@apollo/client';
import WalletUtilService from '../lib/wallet-util-service';

const LOTTERY_DATA = gql`
query LotteryData {
  allStates(
    filter: {
      or: [
        { key: { equalTo: "con_x00011.current_round" } }
        { key: { equalTo: "con_x00011.ticket_price" } }
        { key: { equalTo: "con_x00011.fee_percent" } }
        { key: { equalTo: "con_x00011.max_tickets_per_user" } }
        { key: { equalTo: "con_x00011.owner" } }
        { key: { startsWith: "con_x00011.pool:" } }
        { key: { startsWith: "con_x00011.ticket_count:" } }
        { key: { startsWith: "con_x00011.drawn:" } }
        { key: { startsWith: "con_x00011.winners:" } }
        { key: { startsWith: "con_x00011.user_counts:" } }
      ]
    }
  ) {
    edges {
      node {
        key
        value
      }
    }
  }
}
`;

export function useLotteryQuery() {
  const { data, loading, error, refetch } = useQuery(LOTTERY_DATA, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 10000,
    errorPolicy: 'all',
  });

  const [currentUserAddress, setCurrentUserAddress] = React.useState(null);
  
  React.useEffect(() => {
    const getCurrentUserAddress = async () => {
      try {
        const utils = WalletUtilService.getInstance().XianWalletUtils;
        if (utils && !utils.initialized) await utils.init();
        const info = await utils.requestWalletInfo();
        console.log('Got wallet info:', info);
        setCurrentUserAddress(info.address);
      } catch (e) {
        console.warn('Failed to get wallet address', e);
        setCurrentUserAddress(null);
      }
    };
    getCurrentUserAddress();
  }, []);

  const lotteryData = React.useMemo(() => {
    if (!data) {
      return {
        currentRound: 0,
        pool: 0,
        ticketCount: 0,
        myTickets: 0,
        ticketPrice: 1.0,
        feePercent: 10,
        maxTicketsPerUser: 0,
        isActive: false,
        isDrawn: false,
        winner: '',
        owner: '',
        isAdmin: false,
      };
    }

    const nodes = data.allStates.edges.map(e => e.node);
    console.log('GraphQL nodes:', nodes);
    
    let currentRound = 0,
        ticketPrice = 1.0,
        feePercent = 10,
        maxTicketsPerUser = 0,
        owner = '';
    const pools = {},
          ticketCounts = {},
          drawnFlags = {},
          winners = {},
          userCounts = {};

    for (const { key, value } of nodes) {
      if (!key.startsWith('con_x00011.')) continue;
      
      let payload;
      try {
        payload = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        payload = value;
      }

      console.log(`Processing: ${key} = ${payload}`);

      if (key === 'con_x00011.current_round') {
        currentRound = parseInt(payload) || 0;
      } else if (key === 'con_x00011.ticket_price') {
        ticketPrice = parseFloat(payload) || 1.0;
      } else if (key === 'con_x00011.fee_percent') {
        feePercent = parseInt(payload) || 10;
      } else if (key === 'con_x00011.max_tickets_per_user') {
        maxTicketsPerUser = parseInt(payload) || 0;
      } else if (key === 'con_x00011.owner') {
        owner = payload || '';
      } else if (key.startsWith('con_x00011.pool:')) {
        const r = key.split(':')[1];
        pools[r] = parseFloat(payload) || 0;
      } else if (key.startsWith('con_x00011.ticket_count:')) {
        const r = key.split(':')[1];
        ticketCounts[r] = parseInt(payload) || 0;
      } else if (key.startsWith('con_x00011.drawn:')) {
        const r = key.split(':')[1];
        // Fixed: Use the actual drawn flag from the contract
        drawnFlags[r] = payload === true || payload === 'true' || payload === 1 || payload === '1';
      } else if (key.startsWith('con_x00011.winners:')) {
        const r = key.split(':')[1];
        winners[r] = payload || '';
      } else if (key.startsWith('con_x00011.user_counts:')) {
        const parts = key.split(':');
        if (parts.length >= 3) {
          const r = parts[1];
          const user = parts.slice(2).join(':'); // Handle addresses that might contain colons
          userCounts[`${r}|${user}`] = parseInt(payload) || 0;
        }
      }
    }

    const pool = pools[currentRound] || 0;
    const ticketCount = ticketCounts[currentRound] || 0;
    const winner = winners[currentRound] || '';
    // Fixed: Use the actual drawn flag instead of deriving from winner
    const isDrawn = drawnFlags[currentRound] || false;
    const myTickets = currentUserAddress ? (userCounts[`${currentRound}|${currentUserAddress}`] || 0) : 0;
    const isActive = currentRound > 0 && !isDrawn;

    console.log('Computed lottery data:', {
      currentRound,
      pool,
      ticketCount,
      myTickets,
      isActive,
      isDrawn,
      winner,
      currentUserAddress,
      userCountsKey: `${currentRound}|${currentUserAddress}`
    });

    return {
      currentRound,
      pool,
      ticketCount,
      myTickets,
      ticketPrice,
      feePercent,
      maxTicketsPerUser,
      isActive,
      isDrawn,
      winner,
      owner,
      isAdmin: currentUserAddress === owner,
    };
  }, [data, currentUserAddress]);

  return { lotteryData, loading, error, refetch };
}