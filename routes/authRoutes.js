const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('../config/passport');
const db = require('../config/db');

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const buildUserPayload = (user) => ({
  id: user.user_id,
  username: user.username,
  email: user.email,
  is_admin: user.is_admin,
  is_blocked: user.is_blocked,
});

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=google`,
    session: true,
  }),
  (req, res) => {
    const payload = Buffer.from(JSON.stringify(buildUserPayload(req.user))).toString('base64url');
    res.redirect(`${FRONTEND_URL}/oauth-success?user=${payload}`);
  }
);

router.post('/auth/logout', (req, res) => {
  const finalize = () => {
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).send('로그아웃 완료');
      });
    } else {
      res.status(200).send('로그아웃 완료');
    }
  };

  if (typeof req.logout === 'function') {
    req.logout(() => finalize());
  } else {
    finalize();
  }
});

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send('모든 필드를 입력해야합니다.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `
      INSERT INTO user (username, email, password, provider)
      VALUES (?, ?, ?, 'local')
    `;
    db.query(sql, [username, email, hashedPassword], (err, result) => {
      if (err) {
        console.error('DB 오류:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).send('이미 등록된 이메일입니다.');
        }
        return res.status(500).send('회원가입 실패');
      }
      res.status(201).send(`회원가입 성공! user_id = ${result.insertId}`);
    });
  } catch (error) {
    console.error('암호화 실패:', error);
    res.status(500).send('서버 내부 오류');
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send('이메일과 비밀번호를 모두 입력하세요.');
  }

  const sql = `
    SELECT * FROM user
    WHERE email = ? AND provider = 'local'
  `;
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).send('DB 조회 실패');
    if (results.length === 0) return res.status(401).send('등록되지 않은 이메일입니다.');

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send('비밀번호가 올바르지 않습니다.');

    res.status(200).json({
      message: '로그인 성공',
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        is_blocked: user.is_blocked,
      },
    });
  });
});

module.exports = router;
