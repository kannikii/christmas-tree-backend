const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

const selectUserById = (id, callback) => {
  const sql = 'SELECT user_id, username, email, is_admin, is_blocked FROM user WHERE user_id = ?';
  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) return callback(null, null);
    callback(null, results[0]);
  });
};

passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

passport.deserializeUser((id, done) => {
  selectUserById(id, (err, user) => {
    if (err) return done(err);
    done(null, user);
  });
});

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    if (!email) {
      return done(new Error('Google 계정에서 이메일을 가져올 수 없습니다.'));
    }

    const selectSql = 'SELECT * FROM user WHERE email = ?';
    db.query(selectSql, [email], (err, results) => {
      if (err) return done(err);
      // 이미 등록한 경우
      if (results.length > 0) {
        return done(null, results[0]);
      }

      // 처음 이용하는 경우 사용자 등록 (구글)
      const insertSql = `
        INSERT INTO user (username, email, password, provider)
        VALUES (?, ?, ?, 'google')
      `;
      const username = profile.displayName || 'Google 사용자';
      db.query(insertSql, [username, email, 'GOOGLE_LOGIN'], (insertErr, insertResult) => {
        if (insertErr) return done(insertErr);
        const newUser = {
          user_id: insertResult.insertId,
          username,
          email,
        };
        done(null, newUser);
      });
    });
  }
));

module.exports = passport;
