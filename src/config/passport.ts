import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma';

export const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Check if user exists with this Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            // Check if user exists with this email
            user = await prisma.user.findUnique({
              where: { email },
            });

            if (user) {
              // Link Google account to existing user
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value,
                  emailVerified: true, // Google emails are verified
                },
              });
            } else {
              // Create new user
              user = await prisma.user.create({
                data: {
                  email,
                  name: profile.displayName || email.split('@')[0],
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value,
                  emailVerified: true, // Google emails are verified
                  password: null, // No password for OAuth users
                },
              });
            }
          }

          return done(null, { userId: user.id, email: user.email });
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error as Error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (user) {
        done(null, { userId: user.id, email: user.email });
      } else {
        done(null, null);
      }
    } catch (error) {
      done(error, null);
    }
  });
};
