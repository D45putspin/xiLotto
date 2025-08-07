import React from 'react';
import { gql, useQuery } from '@apollo/client';
import WalletUtilService from '../lib/wallet-util-service';

// GraphQL query to batch-fetch polls, votes and counters
const xilotto_DATA = gql`
query xilottoData {
  allStates(
    filter: {
      or: [
        { key: { equalTo: "con_xilotto_v0_clean.poll_counter" } }
        { key: { startsWith: "con_xilotto_v0_clean.polls:" } }
        { key: { startsWith: "con_xilotto_v0_clean.user_votes:" } }
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

/**
 * Custom hook to fetch and normalize xilotto data
 */
export function usePollsQuery() {
  const { data, loading, error, refetch } = useQuery(xilotto_DATA, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 10000, // Refetch every 10 seconds to reduce frequency
    errorPolicy: 'all', // Allow partial results
  });

  // Get current user's address
  const [currentUserAddress, setCurrentUserAddress] = React.useState(null);

  React.useEffect(() => {
    const getCurrentUserAddress = async () => {
      try {
        const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;
        if (xianWalletUtilInstance && !xianWalletUtilInstance.initialized) {
          await xianWalletUtilInstance.init();
        }
        if (xianWalletUtilInstance) {
          const walletInfo = await xianWalletUtilInstance.requestWalletInfo();
          setCurrentUserAddress(walletInfo.address);
        }
      } catch (error) {
        console.warn('Failed to get current user address:', error);
      }
    };

    getCurrentUserAddress();
  }, []);

  // Log for debugging
 
  // Normalize into polls array
  const polls = React.useMemo(() => {
    if (!data) return [];
    const nodes = data.allStates.edges.map(({ node }) => node);
    let counter = 0;
    const pollsMap = {};
    const votesMap = {};

    for (const { key, value } of nodes) {
      // Filter for our contract
      if (!key.startsWith('con_xilotto_v0_clean.')) continue;
      
      try {
        // The value is already a JSON object, no need to decode
        const payload = typeof value === 'string' ? JSON.parse(value) : value;

        if (key.endsWith('poll_counter')) {
          counter = parseInt(payload) || 0;
        } else if (key.includes('polls:')) {
          const id = parseInt(key.split(':').pop());
          pollsMap[id] = payload;
        } else if (key.includes('user_votes:')) {
          const [, user, id] = key.split(':').slice(-3);
          votesMap[`${user}_${id}`] = payload;
        }
      } catch (error) {
        console.warn('Failed to parse payload for key:', key, error);
      }
    }

    // Build normalized list
    return Object.values(pollsMap).map(p => {
      const userKey = currentUserAddress ? `${currentUserAddress}_${p.id}` : null;
      return {
        id: p.id,
        title: p.title,
        options: p.options,
        totalVotes: p.total_votes,
        totalVotingPower: p.total_voting_power,
        creator: p.creator,
        createdAt: new Date(p.created_at),
        endDate: new Date(p.end_date),
        isActive: new Date() <= new Date(p.end_date),
        userVote: userKey ? (votesMap[userKey]?.option_id || 0) : 0,
        tokenContract: p.token_contract,
      };
    });
  }, [data, currentUserAddress]);

  return { polls, loading, error, refetch };
}
