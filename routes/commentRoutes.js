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

router.post('/:noteID/comments', (req, res) => {
  const { noteID } = req.params;
  const { user_id, content } = req.body;

  if (!user_id || !content) {
    return res.status(401).send('user_id와 content는 필수 입니다.');
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
  const adminUserId = Number(req.query.admin_user_id);

  checkAdmin(adminUserId, (adminErr, isAdmin) => {
    if (adminErr) {
      console.error('관리자 확인 실패:', adminErr);
      return res.status(500).send('관리자 확인 실패');
    }

    const sql = `
      SELECT 
        c.comment_id,
        c.content,
        c.created_at,
        c.is_hidden,
        u.user_id,
        u.username AS author
      FROM comment c
      JOIN user u ON c.user_id = u.user_id
      WHERE c.note_id = ?
      ${isAdmin ? '' : 'AND c.is_hidden = 0'}
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
});

//댓글 수정
router.put('/:noteID/comments/:commentID', (req, res) => {
  const { noteID, commentID } = req.params;
  const { userID, content } = req.body;
  if (!userID) {
    return res.status(400).send('user_id는 필수 입니다.');
  }
  if (!content || !content.trim()) {
    return res.status(400).send('수정할 내용을 입력 하세요.');
  }

  const sql = `
    UPDATE comment
    SET content = ?
    WHERE note_id = ? AND comment_id = ? AND user_id = ?
  `;
  db.query(sql, [content, noteID, commentID, userID], (err, result) => {
    if (err) {
      console.error('댓글 수정 실패:', err);
      return res.status(500).send('댓글 수정 실패');
    }
    if (result.affectedRows === 0) {
      return res.status(403).send('수정 권한이 없거나 댓글을 찾을 수 없습니다.');
    }
    res.status(200).send('댓글 수정 완료');
  });
});

//댓글 삭제
router.delete('/:noteID/comments/:commentID',(req,res)=>{
  const {noteID,commentID} = req.params;
  const { userID} = req.body;
  if(!userID){
    return res.status(400).send('user_id는 필수 입니다.');
  }

  const sql = `
    DELETE FROM comment
    WHERE note_id = ? AND comment_id = ? AND user_id = ?
  `;

  db.query(sql,[noteID,commentID,userID],(err,result)=>{
    if(err){
      console.error('댓글 삭제 실패:',err);
      return res.status(500).send('댓글 삭제 실패');
    }
    if (result.affectedRows === 0) {
      return res.status(403).send('수정 권한이 없거나 댓글을 찾을 수 없습니다.');
    }
    res.status(200).send('댓글 삭제 완료');
  })
})

module.exports = router;
