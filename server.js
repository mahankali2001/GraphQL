// npm install apollo-server graphql pg pg-hstore sequelize bcryptjs jsonwebtoken dotenv graphql-subscriptions
// npm install express express-jwt
// npm install apollo-server-express express
// pg-hstore - Required internally by Sequelize when using PostgreSQL. It serializes and deserializes JSON data to hstore format.
require("dotenv").config();

// const express = require('express');
// const { ApolloServer, gql } = require('apollo-server-express'); // GraphQL server and schema definition
const { ApolloServer, gql } = require("apollo-server"); // GraphQL server and schema definition
const { PubSub } = require("graphql-subscriptions"); // PubSub for real-time updates
const { Sequelize, DataTypes } = require("sequelize"); // ORM for PostgreSQL, makes database operations easier
const bcrypt = require("bcryptjs");  // security - for hashing passwords before saving to db, helps to store passwords securely
const jwt = require("jsonwebtoken"); // security - for generating and verifying JWTs

const pubsub = new PubSub(); // For real-time updates

// Connect to PostgreSQL with Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
  }
);

// Define Sequelize Models
const Book = sequelize.define("Book", {
  title: { type: DataTypes.STRING, allowNull: false },
  author: { type: DataTypes.STRING, allowNull: false },
});

const User = sequelize.define("User", {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

// Sync Database - graphql_books is the name of the database
sequelize
  .sync()
  .then(() => console.log("✅ PostgreSQL Database Synced"))
  .catch((err) => console.error("❌ Database Sync Error:", err));

// Define GraphQL Schema
const typeDefs = gql`
  type Book {
    id: ID!
    title: String!
    author: String!
  }

  type User {
    id: ID!
    username: String!
    token: String
  }

  type Query {
    books: [Book]
  }

  type Mutation {
    register(username: String!, password: String!): User
    login(username: String!, password: String!): User
    addBook(title: String!, author: String!): Book
    deleteBook(id: ID!): String
  }

  type Subscription {
    bookAdded: Book
  }
`;

// Helper function to verify JWT
const authenticate = (token) => {
  if (!token) throw new Error("Authentication required!");
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid token!");
  }
};

// Define Resolvers
const resolvers = {
  Query: {
    books: async () => await Book.findAll(),
  },
  Mutation: {
    register: async (_, { username, password }) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword });
      const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: "1h" });
      return { id: user.id, username, token };
    },
    login: async (_, { username, password }) => {
      const user = await User.findOne({ where: { username } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error("Invalid credentials");
      }
      const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: "1h" });
      return { id: user.id, username, token };
    },
    addBook: async (_, { title, author }, { token }) => {
      authenticate(token); // Ensure user is logged in
      const newBook = await Book.create({ title, author });
      pubsub.publish("BOOK_ADDED", { bookAdded: newBook }); // Trigger subscription
      return newBook;
    },
    deleteBook: async (_, { id }, { token }) => {
      authenticate(token);
      await Book.destroy({ where: { id } });
      return "Book deleted successfully!";
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(["BOOK_ADDED"]),
    },
  },
};

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers.authorization || "";
    return { token };
  },
});

// Start the Server
server.listen().then(({ url }) => {
  console.log(`🚀 Server running at ${url}`);
});

// Access http://localhost:4000/graphql or https://studio.apollographql.com/sandbox/explorer to test the GraphQL APIs
// Register a user:
// mutation { register(username: "admin", password: "admin") { id, username, token } }
// Login: 
// mutation { login(username: "admin", password: "admin") { id, username, token } }
// Add a book:
// mutation { addBook(title: "The Hobbit", author: "J.R.R. Tolkien") { id, title, author } }
// Delete a book:
// mutation { deleteBook(id: 1) }
// Query all books:
// query { books { id, title, author } }
// Subscribe to bookAdded:
// subscription { bookAdded { id, title, author } }


// // Middleware to verify JWT
// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (token == null) return res.sendStatus(401);

//   jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403);
//     req.user = user;
//     next();
//   });
// };

// // Create an Express app and apply the middleware
// const app = express();
// app.use(authenticateToken);

// // Create Apollo Server
// const server = new ApolloServer({
//   typeDefs,
//   resolvers,
//   context: ({ req }) => {
//     const token = req.headers.authorization || '';
//     if (token) {
//       try {
//         const user = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
//         return { user };
//       } catch (e) {
//         throw new AuthenticationError('Invalid/Expired token');
//       }
//     }
//     return {};
//   },
// });

// async function startServer() {
//   await server.start();
//   server.applyMiddleware({ app });

//   // Start the server
//   app.listen({ port: 4000 }, () =>
//     console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)
//   );
// }

// // Start the server
// startServer();


// node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  // Generate JWT secret to use for JWT_SECRET in .env
// openssl rand -hex 32  // Generate a secret to use for JWT_SECRET, DB_PASSWORD in .env

// const hashedPassword = await bcrypt.hash("mypassword", 10);
// console.log(hashedPassword); // "$2a$10$...hashed..."
// const isMatch = await bcrypt.compare("mypassword", hashedPassword);
// console.log(isMatch); // true or false

// pg-hstore - A node package for serializing and deserializing JSON data to hstore format

// With Sequelize - Instead of writing basic SQL queries, we can use Sequelize to interact with the database:
// INSERT INTO books (title, author) VALUES ('The Hobbit', 'J.R.R. Tolkien');
// Like this:
// const newBook = await Book.create({ title: "The Hobbit", author: "J.R.R. Tolkien" });

// Generate a JWT when logging in
// const token = jwt.sign({ id: user.id, username: "admin" }, "secretkey", {
//   expiresIn: "1h",
// });
// console.log(token); // "eyJhbGciOiJIUzI1NiIs..."
// const decoded = jwt.verify(token, "secretkey");
// console.log(decoded); // { id: 'user_id', username: 'admin', iat: ..., exp: ... }
