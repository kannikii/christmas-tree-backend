const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/:userID/trees', (req, res) => {
  const { userID } = req.params;

  const sql = `
    SELECT 
      t.tree_id, 
      t.tree_name, 
      t.tree_type, 
      t.tree_key,
      t.created_at,
      mt.joined_at
    FROM member_tree AS mt
    JOIN tree AS t ON mt.tree_id = t.tree_id
    WHERE mt.user_id = ?
    ORDER BY mt.joined_at DESC
  `;

  db.query(sql, [userID], (err, result) => {
    if (err) {
      console.error('❌ 내 트리 조회 실패:', err);
      return res.status(500).send('내 트리 조회 실패');
    }
    res.status(200).json(result);
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM user WHERE user_id = ?';

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('유저 삭제 실패:', err);
      return res.status(500).send('DB 오류');
    }
    if (result.affectedRows === 0) {
      return res.status(404).send('존재하지 않는 사용자입니다.');
    }
    res.status(200).send('계정 삭제 성공');
  });
});

module.exports = router;
