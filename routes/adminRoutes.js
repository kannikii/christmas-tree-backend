const express = require('express');
const db = require('../config/db');

const router = express.Router();

const rollback = (conn, res, status, message, err) => {
  if (err) {
    console.error(message, err);
  }
  conn.rollback(() => {
    conn.release();
    res.status(status).send(message);
  });
};

/**
 * 노트 숨김
 */
router.patch('/notes/:noteID/hide', (req, res) => {
  const noteID = Number(req.params.noteID);
  const adminId = req.adminUser?.user_id;
  if (!adminId) return res.status(401).send('관리자 인증 필요');

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT note_id, user_id FROM note WHERE note_id = ? FOR UPDATE';
      conn.query(selectSql, [noteID], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '노트 조회 실패', selErr);
        if (!rows.length) return rollback(conn, res, 404, '노트를 찾을 수 없습니다.');

        const authorId = rows[0].user_id;
        const hideSql = 'UPDATE note SET is_hidden = 1 WHERE note_id = ?';
        conn.query(hideSql, [noteID], (hideErr) => {
          if (hideErr) return rollback(conn, res, 500, '노트 숨김 실패', hideErr);

          const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
          conn.query(logSql, [adminId, 'HIDE_NOTE', noteID, authorId, noteID], (logErr) => {
            if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '노트 숨김 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 노트 표시
 */
router.patch('/notes/:noteID/show', (req, res) => {
  const noteID = Number(req.params.noteID);
  const adminId = req.adminUser?.user_id;
  if (!adminId) return res.status(401).send('관리자 인증 필요');

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT note_id, user_id FROM note WHERE note_id = ? FOR UPDATE';
      conn.query(selectSql, [noteID], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '노트 조회 실패', selErr);
        if (!rows.length) return rollback(conn, res, 404, '노트를 찾을 수 없습니다.');

        const authorId = rows[0].user_id;
        const showSql = 'UPDATE note SET is_hidden = 0 WHERE note_id = ?';
        conn.query(showSql, [noteID], (updErr) => {
          if (updErr) return rollback(conn, res, 500, '노트 표시 실패', updErr);

          const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
          conn.query(logSql, [adminId, 'SHOW_NOTE', noteID, authorId, noteID], (logErr) => {
            if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '노트 표시 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 노트 삭제 (복구 없음)
 */
router.delete('/notes/:noteID', (req, res) => {
  const noteID = Number(req.params.noteID);
  const adminId = req.adminUser?.user_id;
  if (!adminId) return res.status(401).send('관리자 인증 필요');

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT note_id, user_id FROM note WHERE note_id = ? FOR UPDATE';
      conn.query(selectSql, [noteID], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '노트 조회 실패', selErr);
        if (!rows.length) return rollback(conn, res, 404, '노트를 찾을 수 없습니다.');

        const authorId = rows[0].user_id;

        // 로그를 먼저 남기고 이후 삭제 (FK 제약 회피)
        const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
        conn.query(logSql, [adminId, 'DELETE_NOTE', noteID, authorId, noteID], (logErr) => {
          if (logErr) return rollback(conn, res, 500, '로그 기록 실패', logErr);

          // 순서: 좋아요 삭제 -> 댓글 삭제 -> 노트 삭제
          const deleteLikes = 'DELETE FROM like_note WHERE note_id = ?';
          conn.query(deleteLikes, [noteID], (likeErr) => {
            if (likeErr) return rollback(conn, res, 500, '좋아요 삭제 실패', likeErr);

            const deleteComments = 'DELETE FROM comment WHERE note_id = ?';
            conn.query(deleteComments, [noteID], (cmtErr) => {
              if (cmtErr) return rollback(conn, res, 500, '댓글 삭제 실패', cmtErr);

              const deleteNote = 'DELETE FROM note WHERE note_id = ?';
              conn.query(deleteNote, [noteID], (delErr) => {
                if (delErr) return rollback(conn, res, 500, '노트 삭제 실패', delErr);

                conn.commit((commitErr) => {
                  if (commitErr) return rollback(conn, res, 500, '커밋 실패');
                  conn.release();
                  res.json({ message: '노트 삭제 완료' });
                });
              });
            });
          });
        });
      });
    });
  });
});

/**
 * 댓글 숨김
 */
router.patch('/comments/:commentID/hide', (req, res) => {
  const commentID = Number(req.params.commentID);
  const adminId = req.adminUser?.user_id;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT comment_id, user_id, note_id FROM comment WHERE comment_id = ? FOR UPDATE';
      conn.query(selectSql, [commentID], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '댓글 조회 실패');
        if (!rows.length) return rollback(conn, res, 404, '댓글을 찾을 수 없습니다.');

        const { user_id: authorId, note_id: noteId } = rows[0];
        const hideSql = 'UPDATE comment SET is_hidden = 1 WHERE comment_id = ?';
        conn.query(hideSql, [commentID], (hideErr) => {
          if (hideErr) return rollback(conn, res, 500, '댓글 숨김 실패');

          const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
          conn.query(logSql, [adminId, 'HIDE_COMMENT', noteId, authorId, commentID], (logErr) => {
            if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '댓글 숨김 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 댓글 표시
 */
router.patch('/comments/:commentID/show', (req, res) => {
  const commentID = Number(req.params.commentID);
  const adminId = req.adminUser?.user_id;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT comment_id, user_id, note_id FROM comment WHERE comment_id = ? FOR UPDATE';
      conn.query(selectSql, [commentID], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '댓글 조회 실패');
        if (!rows.length) return rollback(conn, res, 404, '댓글을 찾을 수 없습니다.');

        const { user_id: authorId, note_id: noteId } = rows[0];
        const showSql = 'UPDATE comment SET is_hidden = 0 WHERE comment_id = ?';
        conn.query(showSql, [commentID], (updErr) => {
          if (updErr) return rollback(conn, res, 500, '댓글 표시 실패');

          const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
          conn.query(logSql, [adminId, 'SHOW_COMMENT', noteId, authorId, commentID], (logErr) => {
            if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '댓글 표시 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 댓글 삭제 (복구 없음)
 */
router.delete('/comments/:commentID', (req, res) => {
  const commentID = Number(req.params.commentID);
  const adminId = req.adminUser?.user_id;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT comment_id, user_id, note_id FROM comment WHERE comment_id = ? FOR UPDATE';
      conn.query(selectSql, [commentID], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '댓글 조회 실패');
        if (!rows.length) return rollback(conn, res, 404, '댓글을 찾을 수 없습니다.');

        const { user_id: authorId, note_id: noteId } = rows[0];

        // 로그를 먼저 남기고 이후 삭제 (FK 제약 회피)
        const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
        conn.query(logSql, [adminId, 'DELETE_COMMENT', noteId, authorId, commentID], (logErr) => {
          if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

          const deleteSql = 'DELETE FROM comment WHERE comment_id = ?';
          conn.query(deleteSql, [commentID], (delErr) => {
            if (delErr) return rollback(conn, res, 500, '댓글 삭제 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '댓글 삭제 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 사용자 차단
 */
router.patch('/users/:userID/block', (req, res) => {
  const targetUserId = Number(req.params.userID);
  const adminId = req.adminUser?.user_id;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT user_id FROM user WHERE user_id = ? FOR UPDATE';
      conn.query(selectSql, [targetUserId], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '사용자 조회 실패');
        if (!rows.length) return rollback(conn, res, 404, '사용자를 찾을 수 없습니다.');

        const blockSql = 'UPDATE user SET is_blocked = 1 WHERE user_id = ?';
        conn.query(blockSql, [targetUserId], (updErr) => {
          if (updErr) return rollback(conn, res, 500, '차단 실패');

          const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
          // target_note/note_id는 NOT NULL이라 0으로 채움 (스키마 제약 때문)
          conn.query(logSql, [adminId, 'BLOCK_USER', 0, targetUserId, 0], (logErr) => {
            if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '사용자 차단 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 사용자 차단 해제
 */
router.patch('/users/:userID/unblock', (req, res) => {
  const targetUserId = Number(req.params.userID);
  const adminId = req.adminUser?.user_id;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).send('DB 연결 실패');

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).send('트랜잭션 시작 실패');
      }

      const selectSql = 'SELECT user_id FROM user WHERE user_id = ? FOR UPDATE';
      conn.query(selectSql, [targetUserId], (selErr, rows) => {
        if (selErr) return rollback(conn, res, 500, '사용자 조회 실패');
        if (!rows.length) return rollback(conn, res, 404, '사용자를 찾을 수 없습니다.');

        const unblockSql = 'UPDATE user SET is_blocked = 0 WHERE user_id = ?';
        conn.query(unblockSql, [targetUserId], (updErr) => {
          if (updErr) return rollback(conn, res, 500, '차단 해제 실패');

          const logSql = 'INSERT IGNORE INTO admin_log (admin_id, action, target_note, user_id, note_id) VALUES (?, ?, ?, ?, ?)';
          conn.query(logSql, [adminId, 'UNBLOCK_USER', 0, targetUserId, 0], (logErr) => {
            if (logErr) return rollback(conn, res, 500, '로그 기록 실패');

            conn.commit((commitErr) => {
              if (commitErr) return rollback(conn, res, 500, '커밋 실패');
              conn.release();
              res.json({ message: '사용자 차단 해제 완료' });
            });
          });
        });
      });
    });
  });
});

/**
 * 사용자 목록 조회 (관리자용)
 */
router.get('/users', (req, res) => {
  const sql = `
    SELECT user_id, username, email, is_admin, is_blocked, created_at
    FROM user
    ORDER BY created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('관리자 사용자 목록 조회 실패:', err);
      return res.status(500).send('관리자 사용자 목록 조회 실패');
    }
    res.json(rows);
  });
});

/**
 * 특정 사용자의 노트 목록 (관리자용, 숨김 포함)
 */
router.get('/users/:userID/notes', (req, res) => {
  const userId = Number(req.params.userID);
  const sql = `
    SELECT n.note_id, n.message, n.is_hidden, n.created_at, n.tree_id, t.tree_name
    FROM note n
    JOIN tree t ON n.tree_id = t.tree_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error('관리자 노트 조회 실패:', err);
      return res.status(500).send('관리자 노트 조회 실패');
    }
    res.json(rows);
  });
});

/**
 * 특정 사용자의 댓글 목록 (관리자용, 숨김 포함)
 */
router.get('/users/:userID/comments', (req, res) => {
  const userId = Number(req.params.userID);
  const sql = `
    SELECT c.comment_id, c.content, c.is_hidden, c.created_at, c.note_id, n.tree_id
    FROM comment c
    JOIN note n ON c.note_id = n.note_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error('관리자 댓글 조회 실패:', err);
      return res.status(500).send('관리자 댓글 조회 실패');
    }
    res.json(rows);
  });
});

/**
 * 관리자 로그 조회
 */
router.get('/logs', (req, res) => {
  const sql = `
    SELECT admin_id, action, target_note, user_id, note_id, actiontime
    FROM admin_log
    ORDER BY actiontime DESC
    LIMIT 200
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('관리자 로그 조회 실패:', err);
      return res.status(500).send('관리자 로그 조회 실패');
    }
    res.json(rows);
  });
});

module.exports = router;
