// fn/useDrawsQuery.js
import React from 'react';
import { gql, useQuery } from '@apollo/client';
import WalletUtilService from '../lib/wallet-util-service';

const CONTRACT = 'con_xilottov1';

const DRAWS_DATA = gql`
  query DrawsData {
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
        node { key value }
      }
    }
  }
`;

export function useDrawsQuery() {
  const { data, loading, error, refetch } = useQuery(DRAWS_DATA, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 5000,
    errorPolicy: 'all',
  });

  const [currentUserAddress, setCurrentUserAddress] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const svc = WalletUtilService.getInstance().XianWalletUtils;
        if (svc && !svc.initialized) svc.init();
        const info = await svc.requestWalletInfo();
        setCurrentUserAddress(info?.address || null);
      } catch {
        setCurrentUserAddress(null);
      }
    })();
  }, []);

  const { draws, activeDraws, completedDraws, lastId } = React.useMemo(() => {
    if (!data) return { draws: [], activeDraws: [], completedDraws: [], lastId: 0 };

    const nodes = data.allStates.edges.map((e) => e.node);

    let drawCounter = 0;
    const creators = {};
    const tokens = {};
    const prices  = {};
    const fees    = {};
    const caps    = {};
    const pools   = {};
    const tcounts = {};
    const drawn   = {};
    const winners = {};
    const userCounts = {}; // key `${id}|${addr}` -> int
    const adminLists = {};

    const parsePayload = (v) => {
      try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; }
    };

    for (const { key, value } of nodes) {
      if (!key.startsWith(`${CONTRACT}.`)) continue;
      const short = key.slice(CONTRACT.length + 1);
      const payload = parsePayload(value);

      if (short === 'draw_counter') {
        drawCounter = parseInt(payload) || 0;
      } else if (short.startsWith('draw_creator:')) {
        creators[short.split(':')[1]] = payload || '';
      } else if (short.startsWith('draw_token:')) {
        tokens[short.split(':')[1]] = payload || '';
      } else if (short.startsWith('draw_price:')) {
        prices[short.split(':')[1]] = parseFloat(payload) || 0;
      } else if (short.startsWith('draw_fee_percent:')) {
        fees[short.split(':')[1]] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_cap:')) {
        caps[short.split(':')[1]] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_pool:')) {
        pools[short.split(':')[1]] = parseFloat(payload) || 0;
      } else if (short.startsWith('draw_ticket_count:')) {
        tcounts[short.split(':')[1]] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_drawn:')) {
        const id = short.split(':')[1];
        const v = payload === true || payload === 'true' || payload === 1 || payload === '1' || payload === 'True';
        drawn[id] = !!v;
      } else if (short.startsWith('draw_winner:')) {
        winners[short.split(':')[1]] = payload || '';
      } else if (short.startsWith('draw_user_counts:')) {
        const rest = short.split(':')[1] || '';
        const [id, ...addrParts] = rest.split('|');
        const addr = addrParts.join('|');
        userCounts[`${id}|${addr}`] = parseInt(payload) || 0;
      } else if (short.startsWith('draw_admin_list:')) {
        const id = short.split(':')[1];
        try {
          adminLists[id] = Array.isArray(payload) ? payload : JSON.parse(payload);
        } catch {
          adminLists[id] = [];
        }
      }
    }

    const all = [];
    for (let i = 1; i <= drawCounter; i++) {
      const id = String(i);
      if (!creators[id]) continue; // skip non-existent
      const creator = creators[id] || '';
      const token = tokens[id] || '';
      const price = prices[id] || 0;
      const feePercent = fees[id] || 0;
      const cap = caps[id] || 0;
      const pool = pools[id] || 0;
      const ticketCount = tcounts[id] || 0;
      const isDrawn = !!drawn[id];
      const winner = winners[id] || '';
      const admins = [creator, ...(adminLists[id] || [])].filter(Boolean);
      const myTickets = currentUserAddress ? (userCounts[`${id}|${currentUserAddress}`] || 0) : 0;
      const isAdmin = currentUserAddress ? admins.includes(currentUserAddress) : false;

      all.push({
        id: i,
        creator, token, price, feePercent, cap,
        pool, ticketCount, isDrawn, winner,
        admins, myTickets, isAdmin,
      });
    }

    const active = all.filter(d => !d.isDrawn).sort((a,b) => b.id - a.id);
    const completed = all.filter(d => d.isDrawn).sort((a,b) => b.id - a.id);

    return { draws: all, activeDraws: active, completedDraws: completed, lastId: drawCounter };
  }, [data, currentUserAddress]);

  return { draws, activeDraws, completedDraws, lastId, loading, error, refetch, currentUserAddress };
}
