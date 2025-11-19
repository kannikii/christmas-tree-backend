const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.post('/:treeID/notes', (req, res) => {
  const { treeID } = req.params;
  const { user_id, message, pos_x, pos_y } = req.body;

  if (!user_id || !message) {
    return res.status(400).send('user_id와 message는 필수입니다.');
  }

  const sql = `
    INSERT INTO note (tree_id, user_id, message, pos_x, pos_y)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [treeID, user_id, message, pos_x || 0, pos_y || 0], (err, result) => {
    if (err) {
      console.error('메모 등록 실패:', err);
      return res.status(500).send('메모 등록 실패');
    }
    res.status(200).json({
      message: '메모 등록 성공',
      note_id: result.insertId,
    });
  });
});

router.get('/:treeID/notes', (req, res) => {
  const { treeID } = req.params;
  const sql = `
    SELECT n.note_id, n.message, n.pos_x, n.pos_y, n.created_at,
           u.user_id, u.username AS author
    FROM note n
    JOIN user u ON n.user_id = u.user_id
    WHERE n.tree_id = ?
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

module.exports = router;
