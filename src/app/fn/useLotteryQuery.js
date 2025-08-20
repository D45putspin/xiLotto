// fn/useLotteryQuery.js
import React from 'react';
import { gql, useQuery } from '@apollo/client';
import WalletUtilService from '../lib/wallet-util-service';

const CONTRACT = 'con_x00023';

const LOTTERY_DATA = gql`
  query LotteryData {
    allStates(
      filter: {
        or: [
          { key: { equalTo: "${CONTRACT}.draw_counter" } }
          { key: { startsWith: "${CONTRACT}.draw_creator:" } }
          { key: { startsWith: "${CONTRACT}.draw_token:" } }
          { key: { startsWith: "${CONTRACT}.draw_price:" } }
          { key: { startsWith: "${CONTRACT}.draw_fee_percent:" } }
          { key: { startsWith: "${CONTRACT}.draw_cap:" } }
          { key: { startsWith: "${CONTRACT}.draw_pool:" } }
          { key: { startsWith: "${CONTRACT}.draw_ticket_count:" } }
          { key: { startsWith: "${CONTRACT}.draw_drawn:" } }
          { key: { startsWith: "${CONTRACT}.draw_winner:" } }
          { key: { startsWith: "${CONTRACT}.draw_user_counts:" } }
          { key: { startsWith: "${CONTRACT}.draw_admin_list:" } }
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
    pollInterval: 5000,
    errorPolicy: 'all',
  });

  const [currentUserAddress, setCurrentUserAddress] = React.useState(null);

  React.useEffect(() => {
    const getCurrentUserAddress = async () => {
      try {
        const svc = WalletUtilService.getInstance().XianWalletUtils;
        if (svc && !svc.initialized) svc.init();
        const info = await svc.requestWalletInfo();
        setCurrentUserAddress(info?.address || null);
      } catch {
        setCurrentUserAddress(null);
      }
    };
    getCurrentUserAddress();
  }, []);

  const lotteryData = React.useMemo(() => {
    // default shape (kept names for minimal UI changes)
    const def = {
      currentRound: 0,     // == current draw id
      pool: 0,
      ticketCount: 0,
      myTickets: 0,
      ticketPrice: 0,
      feePercent: 0,
      maxTicketsPerUser: 0,
      isActive: false,
      isDrawn: false,
      winner: '',
      owner: '',           // == creator
      token: '',
      admins: [],
      isAdmin: false,
    };

    if (!data) return def;

    const nodes = data.allStates.edges.map((e) => e.node);

    let drawCounter = 0;
    const creators = {};
    const tokens = {};
    const prices = {};
    const fees = {};
    const caps = {};
    const pools = {};
    const ticketCounts = {};
    const drawnFlags = {};
    const winners = {};
    const userCounts = {};
    const adminLists = {};

    for (const { key, value } of nodes) {
      if (!key.startsWith(`${CONTRACT}.`)) continue;

      const short = key.slice(CONTRACT.length + 1); // remove "con_x00023."
      let payload;
      try {
        payload = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        payload = value;
      }

      if (short === 'draw_counter') {
        drawCounter = parseInt(payload) || 0;
      } else if (short.startsWith('draw_creator:')) {
        const id = short.split(':')[1];
        creators[id] = payload || '';
      } else if (short.startsWith('draw_token:')) {
        const id = short.split(':')[1];
        tokens[id] = payload || '';
      } else if (short.startsWith('draw_price:')) {
        const id = short.split(':')[1];
        prices[id] = parseFloat(payload) || 0;
      } else if (short.startsWith('draw_fee_percent:')) {
        const id = short.split(':')[1];
        fees[id] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_cap:')) {
        const id = short.split(':')[1];
        caps[id] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_pool:')) {
        const id = short.split(':')[1];
        pools[id] = parseFloat(payload) || 0;
      } else if (short.startsWith('draw_ticket_count:')) {
        const id = short.split(':')[1];
        ticketCounts[id] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_drawn:')) {
        const id = short.split(':')[1];
        const v = payload === true || payload === 'true' || payload === 1 || payload === '1' || payload === 'True';
        drawnFlags[id] = v;
      } else if (short.startsWith('draw_winner:')) {
        const id = short.split(':')[1];
        winners[id] = payload || '';
      } else if (short.startsWith('draw_user_counts:')) {
        // key form "draw_user_counts:{id}|{addr}"
        const rest = short.split(':')[1] || '';
        const [id, ...addrParts] = rest.split('|');
        const addr = addrParts.join('|');
        userCounts[`${id}|${addr}`] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_admin_list:')) {
        const id = short.split(':')[1];
        // value is likely a JSON list
        try {
          adminLists[id] = Array.isArray(payload) ? payload : JSON.parse(payload);
        } catch {
          adminLists[id] = [];
        }
      }
    }

    const id = drawCounter;
    if (!id || id <= 0) return { ...def, currentRound: 0 };

    const idStr = String(id);
    const creator = creators[idStr] || '';
    const token = tokens[idStr] || '';
    const price = prices[idStr] || 0;
    const feePercent = fees[idStr] || 0;
    const maxTicketsPerUser = caps[idStr] || 0;
    const pool = pools[idStr] || 0;
    const ticketCount = ticketCounts[idStr] || 0;
    const isDrawn = !!drawnFlags[idStr];
    const winner = winners[idStr] || '';

    // admins = [creator] + draw_admin_list
    const admins = [creator, ...(adminLists[idStr] || [])].filter(Boolean);

    const myTickets = currentUserAddress
      ? userCounts[`${idStr}|${currentUserAddress}`] || 0
      : 0;

    return {
      currentRound: id, // keep name
      pool,
      ticketCount,
      myTickets,
      ticketPrice: price,
      feePercent,
      maxTicketsPerUser,
      isActive: id > 0 && !isDrawn,
      isDrawn,
      winner,
      owner: creator,
      token,
      admins,
      isAdmin: currentUserAddress ? admins.includes(currentUserAddress) : false,
    };
  }, [data, currentUserAddress]);

  return { lotteryData, loading, error, refetch };
}
