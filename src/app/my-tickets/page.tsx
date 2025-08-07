'use client';

import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';
import WalletUtilService from '../lib/wallet-util-service.mjs';

interface Ticket {
  round: number;
  ticketCount: number;
  pool: number;
  isDrawn: boolean;
  winner: string;
  isWinner: boolean;
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get wallet address from store
  const walletAddress = useStore(s => s.walletAddress);
  const isConnected = useStore(s => s.isWalletConnected);

  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchMyTickets();
    } else {
      setLoading(false);
    }
  }, [isConnected, walletAddress]);

  async function fetchMyTickets() {
    if (!isConnected || !walletAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const utils = WalletUtilService.getInstance().XianWalletUtils;
      if (!utils.initialized) {
        await utils.init();
      }

      const baseUrl = 'https://testnet.xian.org/abci_query';
      
      // 1. Get current round
      const roundKey = `"/get/con_x00011.current_round"`;
      const roundRes = await fetch(`${baseUrl}?path=${encodeURIComponent(roundKey)}&prove=false`);
      const roundJson = await roundRes.json();
      
      let currentRound = 0;
      try {
        const roundValue = roundJson.result?.response?.value;
        if (roundValue) {
          const decodedValue = window.atob(roundValue);
          currentRound = parseInt(decodedValue, 10) || 0;
        }
      } catch (e) {
        console.error('Error parsing current round:', e);
        currentRound = 0;
      }

      console.log('Current round:', currentRound);

      const list: Ticket[] = [];

      // 2. For each round, get tickets data
      for (let r = 1; r <= currentRound; r++) {
        try {
          // Get tickets for this round
          const ticketsKey = `"/get/con_x00011.tickets:${r}"`;
          const ticketsRes = await fetch(`${baseUrl}?path=${encodeURIComponent(ticketsKey)}&prove=false`);
          const ticketsJson = await ticketsRes.json();
          
          let roundTickets: string[] = [];
          try {
            const ticketsValue = ticketsJson.result?.response?.value;
            if (ticketsValue) {
              const decodedTickets = window.atob(ticketsValue);
              roundTickets = JSON.parse(decodedTickets) || [];
            }
          } catch (e) {
            console.error(`Error parsing tickets for round ${r}:`, e);
            roundTickets = [];
          }

          // Check if user has tickets in this round
          const userTicketCount = roundTickets.filter(addr => addr === walletAddress).length;
          console.log(`Round ${r}: User has ${userTicketCount} tickets`);
          
          if (userTicketCount === 0) continue;

          // Get pool amount for this round
          const poolKey = `"/get/con_x00011.pool:${r}"`;
          const poolRes = await fetch(`${baseUrl}?path=${encodeURIComponent(poolKey)}&prove=false`);
          const poolJson = await poolRes.json();
          
          let poolAmt = 0;
          try {
            const poolValue = poolJson.result?.response?.value;
            if (poolValue) {
              const decodedPool = window.atob(poolValue);
              poolAmt = parseFloat(decodedPool) || 0;
            }
          } catch (e) {
            console.error(`Error parsing pool for round ${r}:`, e);
          }

          // Get drawn status for this round
          const drawnKey = `"/get/con_x00011.drawn:${r}"`;
          const drawnRes = await fetch(`${baseUrl}?path=${encodeURIComponent(drawnKey)}&prove=false`);
          const drawnJson = await drawnRes.json();
          
          let isDrawn = false;
          try {
            const drawnValue = drawnJson.result?.response?.value;
            if (drawnValue) {
              const decodedDrawn = window.atob(drawnValue);
              isDrawn = decodedDrawn === 'true' || decodedDrawn === '1';
            }
          } catch (e) {
            console.error(`Error parsing drawn status for round ${r}:`, e);
          }

          // Get winner if drawn
          let winner = '';
          if (isDrawn) {
            try {
              const winKey = `"/get/con_x00011.winners:${r}"`;
              const winRes = await fetch(`${baseUrl}?path=${encodeURIComponent(winKey)}&prove=false`);
              const winJson = await winRes.json();
              
              const winValue = winJson.result?.response?.value;
              if (winValue) {
                winner = window.atob(winValue) || '';
              }
            } catch (e) {
              console.error(`Error parsing winner for round ${r}:`, e);
            }
          }

          console.log(`Round ${r}: pool=${poolAmt}, drawn=${isDrawn}, winner=${winner}`);

          list.push({
            round: r,
            ticketCount: userTicketCount,
            pool: poolAmt,
            isDrawn,
            winner,
            isWinner: winner === walletAddress
          });
        } catch (e) {
          console.error(`Error processing round ${r}:`, e);
          // Continue with next round instead of failing completely
        }
      }

      console.log('Final tickets list:', list);
      setTickets(list);
    } catch (e) {
      console.error('Error fetching tickets:', e);
      setError('Failed to fetch ticket data');
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🎫 My Tickets</h1>
        <p>Please connect your Xian wallet to view your tickets.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🎫 My Tickets</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <h1>🎫 My Tickets</h1>
        <p>{error}</p>
        <button onClick={fetchMyTickets} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>🎫 My Tickets</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Wallet: {walletAddress}
      </p>
      
      {tickets.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p>No tickets found. <a href="/">Buy one now</a>.</p>
        </div>
      ) : (
        tickets.map(t => (
          <div key={t.round} style={{ 
            border: '1px solid #ccc', 
            padding: '1rem', 
            marginBottom: '1rem',
            borderRadius: '8px',
            backgroundColor: t.isWinner ? '#e8f5e8' : '#f9f9f9'
          }}>
            <h2>Round #{t.round}</h2>
            <p><strong>Your tickets:</strong> {t.ticketCount}</p>
            <p><strong>Pool size:</strong> {t.pool.toFixed(2)} XIAN</p>
            <p><strong>Status:</strong> {t.isDrawn ? 'Drawn' : 'Active'}</p>
            {t.isDrawn && (
              <p><strong>Winner:</strong> {t.isWinner ? '🎉 You Won!' : t.winner}</p>
            )}
            {t.isWinner && (
              <div style={{ 
                background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                color: '#000',
                padding: '0.5rem',
                borderRadius: '4px',
                textAlign: 'center',
                fontWeight: 'bold',
                marginTop: '0.5rem'
              }}>
                🎉 WINNER! 🎉
              </div>
            )}
          </div>
        ))
      )}
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          onClick={fetchMyTickets}
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
} 