// lib/apolloClient.js
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: 'https://node.xian.org/graphql', // a URL do seu servidor GraphQL
    }),
    cache: new InMemoryCache(),
  });
}
