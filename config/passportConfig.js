const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../schema/userSchema');
require('dotenv').config();

const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'https://leaforaa.store/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackURL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
     
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
        
          if (user.isBlocked) {
            return done(null, false, { message: 'User is blocked' });
          }
          return done(null, user);
        }

        const emailExists = await User.findOne({ email: profile.emails[0].value });
        if (emailExists) {
        
          emailExists.googleId = profile.id;
          await emailExists.save();
          
          if (emailExists.isBlocked) {
            return done(null, false, { message: 'User is blocked' });
          }
          return done(null, emailExists);
        }

    
        const newUser = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id
        });

        const referalCode = 'BOOK' + newUser._id.toString().slice(-6).toUpperCase();
        newUser.referalCode = referalCode;

        await newUser.save();
        return done(null, newUser);
        
      } catch (err) {
        console.error('Google OAuth Error:', err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error('Deserialize Error:', err);
    done(err, null);
  }
});

module.exports = passport;