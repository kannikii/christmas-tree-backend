const express = require('express');
const db = require('../config/db');

const router = express.Router();

//note 생성
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

//note 조회
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
