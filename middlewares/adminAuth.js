const db = require('../config/db');

/**
 * 관리자 인증 미들웨어
 * - 요청 컨텍스트에서 user_id 추출 (세션/req.user/body/query/header)
 * - DB에서 is_admin, is_blocked 조회
 * - 관리자 아니거나 차단 계정이면 403
 */
module.exports = function adminAuth(req, res, next) {
  const candidateId =
    req.user?.user_id ||
    req.user?.id ||
    req.session?.passport?.user ||
    req.body?.user_id ||
    req.query?.user_id ||
    req.headers['x-user-id'];

  const userId = candidateId ? Number(candidateId) : null;
  if (!userId) {
    return res.status(401).send('로그인이 필요합니다.');
  }

  const sql = 'SELECT user_id, is_admin, is_blocked FROM user WHERE user_id = ? LIMIT 1';
  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error('관리자 확인 실패:', err);
      return res.status(500).send('관리자 확인 실패');
    }
    if (!rows.length) {
      return res.status(401).send('사용자를 찾을 수 없습니다.');
    }

    const user = rows[0];
    if (user.is_blocked) {
      return res.status(403).send('차단된 계정입니다.');
    }
    if (!user.is_admin) {
      return res.status(403).send('관리자만 접근할 수 있습니다.');
    }

    // 라우트 핸들러에서 참조할 수 있게 붙여둠
    req.adminUser = user;
    return next();
  });
};
