const express = require('express');
const bcrypt = require('bcryptjs');
const { db, toCamel } = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

// 检查是否有用户（判断首次使用）
router.get('/status', (req, res) => {
  const user = db.prepare('SELECT id FROM users LIMIT 1').get();
  res.json({ hasUser: !!user });
});

// 注册（首次设置密码）
router.post('/register', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: '密码至少4位' });
  }

  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existing) {
    return res.status(400).json({ error: '已设置过密码，请直接登录' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('default', passwordHash, now, now);

  const token = signToken('default');
  res.json({ token, message: '注册成功' });
});

// 登录
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: '请输入密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default');
  if (!user) {
    return res.status(400).json({ error: '请先设置密码' });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = signToken('default');
  res.json({ token, message: '登录成功' });
});

// 修改密码
router.put('/password', (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '新密码至少4位' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default');
  if (!user) {
    return res.status(400).json({ error: '用户不存在' });
  }

  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: '原密码错误' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(newHash, now, 'default');

  res.json({ message: '密码修改成功' });
});

module.exports = router;
