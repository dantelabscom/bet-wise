import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// Configure NextAuth using our auth options
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 