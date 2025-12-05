const express = require('express');
const db = require('../config/db');

const router = express.Router();

const checkAdmin = (userId, cb) => {
  if (!userId) return cb(null, false);
  const sql = 'SELECT is_admin FROM user WHERE user_id = ? LIMIT 1';
  db.query(sql, [userId], (err, rows) => {
    if (err) return cb(err);
    if (!rows.length) return cb(null, false);
    return cb(null, rows[0].is_admin === 1);
  });
};

//note 생성
router.post('/:treeID/notes', (req, res) => {
  const { treeID } = req.params;
  const { user_id, message, pos_x, pos_y } = req.body;

  if (!user_id || !message) {
    return res.status(400).send('user_id와 message는 필수입니다.');
  }

  // const sql = `
  //   INSERT INTO note (tree_id, user_id, message, pos_x, pos_y)
  //   VALUES (?, ?, ?, ?, ?)
  // `;
  // db.query(sql, [treeID, user_id, message, pos_x || 0, pos_y || 0], (err, result) => {
  //   if (err) {
  //     console.error('메모 등록 실패:', err);
  //     return res.status(500).send('메모 등록 실패');
  //   }
  //   res.status(200).json({
  //     message: '메모 등록 성공',
  //     note_id: result.insertId,
  //   });
  // });

  db.getConnection((err, conn) => {
    if (err) {
      console.error('DB 연결 실패:', err);
      return res.status(500).send(`DB 연결 실패: ${err.message}`);
    }

    //트랜잭션 시작
    conn.beginTransaction((err) => {
      if (err) {
        conn.release();
        console.error('트랜잭션 시작 실패:', err);
        return res.status(500).send(`트랜잭션 시작 실패: ${err.message}`);
      }

      //트리 잠그기 (FOR UPDATE)
      const lockSql = 'SELECT tree_id FROM tree WHERE tree_id = ? FOR UPDATE';
      conn.query(lockSql, [treeID], (err, rows) => { // treeID 사용!
        if (err) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).send(`락 설정 실패: ${err.message}`);
          });
        }
        

        //현재 개수 세기
        const countSql = 'SELECT COUNT(*) AS count FROM note WHERE tree_id = ?';
        conn.query(countSql, [treeID], (err, rows) => {
          if (err) {
            return conn.rollback(() => {
              conn.release();
              res.status(500).send(`개수 조회 실패: ${err.message}`);
            });
          }

          if (rows[0].count >= 10) {
            //10개 넘으면 롤백하고 거절
            return conn.rollback(() => {
              conn.release();
              res.status(400).send('더 이상 장식을 추가할 수 없습니다! (최대 10개)');
            });
          }

          //안전하면 INSERT
          const insertSql = 'INSERT INTO note (tree_id, user_id, message, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)';
          conn.query(insertSql, [treeID, user_id, message, pos_x || 0, pos_y || 0], (err, result) => {
            if (err) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).send(`메모 저장 실패: ${err.message}`);
              });
            }

            //최종 커밋
            conn.commit((err) => {
              if (err) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).send(`커밋 실패: ${err.message}`);
                });
              }
              conn.release(); // 커넥션 반납
              res.status(200).json({ message: '성공', note_id: result.insertId });
            });
          });
        });
      });
    });
  });
});

//note 조회
router.get('/:treeID/notes', (req, res) => {
  const { treeID } = req.params;
  const adminUserId = Number(req.query.admin_user_id);

  checkAdmin(adminUserId, (adminErr, isAdmin) => {
    if (adminErr) {
      console.error('관리자 확인 실패:', adminErr);
      return res.status(500).send('관리자 확인 실패');
    }

    const sql = `
      SELECT n.note_id, n.message, n.pos_x, n.pos_y, n.created_at, n.is_hidden,
             u.user_id, u.username AS author
      FROM note n
      JOIN user u ON n.user_id = u.user_id
      WHERE n.tree_id = ?
      ${isAdmin ? '' : 'AND n.is_hidden = 0'}
      ORDER BY n.created_at DESC
    `;
    db.query(sql, [treeID], (err, result) => {
      if (err) {
        console.error('메모 조회 실패:', err);
        return res.status(500).send('메모 조회 실패');
      }
      res.status(200).json(result);
    });
  });
});

//노트 수정
router.put('/:treeID/notes/:noteID', (req, res) => {
  const { treeID, noteID } = req.params;
  const { user_id, message } = req.body;
  if (!user_id) {
    return res.status(400).send('user_id는 필수 입니다.');
  }
  if (!message) {
    return res.status(400).send('내용을 작성해 주세요');
  }
  const sql = `
    UPDATE note
    SET message = ?
    WHERE note_id = ? AND tree_id = ? AND user_id = ?
  `;

  db.query(sql, [message, noteID, treeID, user_id], (err, result) => {
    if (err) {
      console.error('메모 수정 실패:', err);
      return res.status(500).send('메모 수정 실패');
    }
    if (result.affectedRows === 0) {
      return res.status(403).send('수정 권한이 없거나 노트를 찾을 수 없습니다.');
    }
    res.status(200).send('메모 수정 완료');
  });
});

//노트 삭제
router.delete('/:treeID/notes/:noteID', (req, res) => {
  const { treeID, noteID } = req.params;
  const { user_id } = req.body;
  if (!user_id) {
    return res.status.send(400).send('user_id는 필수입니다.');
  };
  const sql = `
    DELETE FROM note
    WHERE note_id = ? AND tree_id = ? AND user_id = ?
  `;

  db.query(sql, [noteID, treeID, user_id], (err, result) => {
    if (err) {
      console.error('메모 삭제 실패:', err);
      return res.status(500).send('메모 삭제 실패');
    }
    if (result.affectedRows === 0) {
      return res.status(403).send('수정 권한이 없거나 노트를 찾을 수 없습니다.');
    }
    res.status(200).send('메모 삭제 성공');
  });
});

module.exports = router;
