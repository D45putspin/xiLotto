'use client';

import React from 'react';

import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '../../lib/apolloClient';

interface PollPageProps {
  params: {
    id: string;
  };
}

export default function PollPage({ params }: PollPageProps) {
  const client = createApolloClient();

  return (
    <ApolloProvider client={client}>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
        
        </div>
      </div>
    </ApolloProvider>
  );
} 