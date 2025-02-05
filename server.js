const { ApolloServer, gql } = require("apollo-server");

// Define GraphQL schema
const typeDefs = gql`
  type Book {
    title: String
    author: String
  }

  type Query {
    books: [Book]
  }
`;

// Sample data
const books = [
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  { title: "To Kill a Mockingbird", author: "Harper Lee" },
];

// Define resolvers
const resolvers = {
  Query: {
    books: () => books,
  },
};

// Create Apollo Server
const server = new ApolloServer({ typeDefs, resolvers });

// Start server
server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});