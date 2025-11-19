const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.post('/:noteID/comments', (req, res) => {
  const { noteID } = req.params;
  const { user_id, content } = req.body;

  if (!user_id || !content) {
    return res.status(401).send('userId와 content는 필수 입니다.');
  }
  const sql = `
    INSERT INTO comment (note_id, user_id, content)
    VALUES (?, ?, ?);
  `;
  db.query(sql, [noteID, user_id, content], (err, result) => {
    if (err) {
      console.error('댓글 등록 실패:', err);
      return res.status(500).send('댓글 작성 실패');
    }
    res.status(201).json({
      message: '댓글 등록 성공',
      comment_id: result.insertId,
    });
  });
});

router.get('/:noteID/comments', (req, res) => {
  const { noteID } = req.params;
  const sql = `
    SELECT 
      c.comment_id,
      c.content,
      c.created_at,
      u.user_id,
      u.username AS author
    FROM comment c
    JOIN user u ON c.user_id = u.user_id
    WHERE c.note_id = ?
    ORDER BY c.created_at ASC
  `;
  db.query(sql, [noteID], (err, result) => {
    if (err) {
      console.error('댓글 조회 실패:', err);
      return res.status(500).send('댓글 조회 실패');
    }
    res.status(200).json(result);
  });
});

module.exports = router;
