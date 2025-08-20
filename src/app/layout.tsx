'use client';

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from './lib/apolloClient';
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
});

// Create Apollo Client instance
const client = createApolloClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>xilotto - Decentralized Voting</title>
        <meta name="description" content="Decentralized voting on the Xian blockchain with advanced governance features" />
      </head>
      <body className={inter.className}>
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      </body>
    </html>
  );
}
