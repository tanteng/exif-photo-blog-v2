import { isPathProtected } from '@/app/path';
import NextAuth, { User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const {
  handlers: { GET, POST },
  signIn,
  signOut,
  auth,
} = NextAuth({
  providers: [
    Credentials({
      async authorize({ email, password }) {
        if (
          process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL === email &&
          process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD === password
        ) {
          const user: User = { email, name: 'Admin User' };
          return user;
        } else {
          return null;
        }
      },
    }),
  ],
  // Disable NextAuth's sliding-session refresh: by default updateAge
  // is 24h, meaning every auth() call on a session older than 24h
  // re-issues the JWT and emits a Set-Cookie header. That breaks
  // EdgeOne caching for any response that runs auth() (e.g. tag pages
  // historically). Setting updateAge equal to maxAge means the JWT is
  // only refreshed on actual sign-in/sign-out, never on reads.
  // Trade-off: admin sessions last exactly 30 days from sign-in, with
  // no auto-extension on activity.
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      const isUrlProtected = isPathProtected(pathname);
      const isUserLoggedIn = !!auth?.user;
      const isRequestAuthorized = !isUrlProtected || isUserLoggedIn;

      return isRequestAuthorized;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
});

export const runAuthenticatedAdminServerAction = async <T>(
  callback: () => T,
): Promise<T> => {
  const session = await auth();
  if (session?.user) {
    return callback();
  } else {
    throw new Error('Unauthorized server action request');
  }
};
