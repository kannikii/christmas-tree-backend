const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.post('/trees', (req, res) => {
  const { owner_id, tree_name, tree_type } = req.body;
  if (!owner_id || !tree_name) {
    return res.status(400).send('owner_id와 tree_name은 필수입니다.');
  }

  const type = tree_type && tree_type.toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
  let treeKey = null;
  if (type === 'PRIVATE') {
    treeKey = Math.random().toString(36).substring(2, 14).toUpperCase();
  }

  const sql = `
    INSERT INTO tree (owner_id, tree_name, tree_type, tree_key)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [owner_id, tree_name, type, treeKey], (err, result) => {
    if (err) {
      console.error('트리 생성 오류:', err);
      return res.status(500).send('트리 생성 실패');
    }

    res.status(201).json({
      message: '트리 생성 성공',
      tree_id: result.insertId,
      tree_type: type,
      tree_key: treeKey,
    });
  });
});

router.get('/tree/by-key/:key', (req, res) => {
  const { key } = req.params;
  const sql = 'SELECT * FROM tree WHERE tree_key = ?';
  db.query(sql, [key], (err, result) => {
    if (err) return res.status(500).send({ message: 'DB 오류' });
    if (result.length === 0) return res.status(404).send({ message: '트리를 찾을 수 없습니다.' });
    res.status(200).json(result[0]);
  });
});

router.post('/trees/:treeID/join', (req, res) => {
  const { treeID } = req.params;
  const { user_id, tree_key } = req.body;

  if (!user_id) {
    return res.status(400).send('user_id는 필수입니다.');
  }

  const checkTreeSql = 'SELECT tree_type, tree_key FROM tree WHERE tree_id = ?';
  db.query(checkTreeSql, [treeID], (err, result) => {
    if (err) {
      console.error('트리 조회 실패:', err);
      return res.status(500).send('DB 조회 실패');
    }
    if (result.length === 0) {
      return res.status(404).send('존재하지 않는 트리입니다.');
    }

    const tree = result[0];
    if (tree.tree_type === 'PRIVATE' && tree_key !== tree.tree_key) {
      return res.status(403).send('트리 키가 올바르지 않습니다.');
    }

    const insertSql = 'INSERT IGNORE INTO member_tree (user_id, tree_id) VALUES (?, ?)';
    db.query(insertSql, [user_id, treeID], (err2, result2) => {
      if (err2) {
        console.error('참여 실패:', err2);
        return res.status(500).send('참여 실패');
      }
      if (result2.affectedRows === 0) {
        return res.status(200).send('이미 트리에 참여 중입니다.');
      }
      res.status(201).send('트리 참가 성공!');
    });
  });
});

module.exports = router;
