const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.post('/:noteID/likes', (req, res) => {
  const { noteID } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).send('userid는 필수입니다.');
  }
  const insertSql = `
    INSERT IGNORE INTO like_note (note_id, user_id)
    VALUES (?, ?)
  `;

  db.query(insertSql, [noteID, user_id], (err, result) => {
    if (err) {
      console.error('좋아요 등록 실패:', err);
      return res.status(500).send('좋아요 등록 실패');
    }
    const countSql = `
      SELECT COUNT(*) AS likeCount
      FROM like_note
      WHERE note_id = ?
    `;
    db.query(countSql, [noteID], (err2, rows) => {
      if (err2) {
        console.error('좋아요 수 조회 실패:', err2);
        return res.status(500).send('좋아요 수 조회 실패');
      }
      const likeCount = rows[0].likeCount;
      const liked = result.affectedRows > 0;

      res.status(200).json({
        message: liked ? '좋아요 추가' : '이미 좋아요를 누른 상태입니다.',
        liked,
        likeCount,
      });
    });
  });
});

router.delete('/:noteID/likes', (req, res) => {
  const { noteID } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).send('userid는 필수 입니다.');
  }
  const deleteSql = `
    DELETE FROM like_note
    WHERE note_id = ? AND user_id = ?
  `;
  db.query(deleteSql, [noteID, user_id], (err) => {
    if (err) {
      console.error('좋아요 취소 실패:', err);
      return res.status(500).send('좋아요 취소 실패');
    }
    const countSql = `
      SELECT COUNT(*) AS likeCount
      FROM like_note
      WHERE note_id = ?
    `;
    db.query(countSql, [noteID], (err2, rows) => {
      if (err2) {
        console.error('좋아요 수 조회 실패:', err2);
        return res.status(500).send('좋아요 수 조회 실패');
      }
      const likeCount = rows[0].likeCount;

      res.status(200).json({
        message: '좋아요 취소',
        likeCount,
      });
    });
  });
});

router.get('/:noteID/likes/count', (req, res) => {
  const { noteID } = req.params;

  const sql = `
    SELECT COUNT(*) AS likeCount
    FROM like_note
    WHERE note_id = ?
  `;
  db.query(sql, [noteID], (err, rows) => {
    if (err) {
      console.error('좋아요 수 조회 실패:', err);
      return res.status(500).send('좋아요 수 조회 실패');
    }
    res.status(200).json({ likeCount: rows[0].likeCount });
  });
});

module.exports = router;
