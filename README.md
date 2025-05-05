# BetWise - A smarter way to Bet

A modern sports trading platform that allows users to buy and sell positions on sports outcomes. Built with Next.js, Firebase Authentication, PostgreSQL, and Rust.

## Features

- User authentication with Firebase
- Market creation and browsing
- Order book for matching trades
- Wallet management
- Real-time updates
- Mobile-responsive design

## Tech Stack

- **Frontend:** Next.js, React, TailwindCSS
- **Authentication:** Firebase Auth, NextAuth.js
- **Database:** PostgreSQL, Drizzle ORM
- **Backend:** Rust (API services)

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Firebase account
- Rust toolchain (for backend services)

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Database
DATABASE_URL=postgres://username:password@localhost:5432/dbname

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables as described above
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Visit http://localhost:3000 in your browser

### Database Setup

1. Create a PostgreSQL database
2. Set the `DATABASE_URL` in your `.env.local` file
3. Apply database migrations (to be implemented)

## Development Roadmap

### Phase 1: Foundation (Current)
- User authentication
- Basic UI design
- Market creation
- Simple order book
- Wallet functionality

### Phase 2: Trading Experience
- Advanced market types
- Odds calculation engine
- Order matching system
- Position management
- Risk management

### Phase 3: Enhanced Features
- Live data integration
- Social features
- Analytics dashboard
- Notifications system

### Phase 4: Polish & Scale
- Advanced risk management
- Expanded market coverage
- Administrative tools
- Marketing preparations

## License

[MIT](LICENSE)

## Contact

For questions or support, please open an issue on this repository.
