const express = require('express');
const bcrypt = require('bcryptjs');
const https = require('https');
const { db, toCamel } = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

// 微信小程序配置（需要用户填入自己的 AppID 和 AppSecret）
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';

// 检查是否有用户
router.get('/status', (req, res) => {
  const user = db.prepare('SELECT id FROM users LIMIT 1').get();
  res.json({ hasUser: !!user });
});

// 微信登录
router.post('/wechat-login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;

    if (!code) {
      return res.status(400).json({ error: '缺少微信登录code' });
    }

    // 调用微信接口换取 openid
    let openid: string;
    if (WECHAT_APPID && WECHAT_SECRET) {
      const wxRes = await wechatCode2Session(code);
      openid = wxRes.openid;
    } else {
      // 开发模式：未配置 AppID 时使用 code 作为 openid 的哈希
      openid = 'wx_dev_' + Buffer.from(code).toString('base64').slice(0, 28);
    }

    // 查找或创建用户
    let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
    const now = new Date().toISOString();

    if (!user) {
      // 检查是否有 default 密码用户（从 Web 版迁移来的）
      const defaultUser = db.prepare('SELECT * FROM users WHERE id = ?').get('default');

      if (defaultUser && !defaultUser.openid) {
        // 更新已有用户绑定 openid
        db.prepare('UPDATE users SET openid = ?, nickname = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
          .run(openid, userInfo?.nickName || '', userInfo?.avatarUrl || '', now, 'default');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get('default');
      } else {
        // 创建新用户
        const userId = 'u_' + Date.now();
        db.prepare('INSERT INTO users (id, password_hash, openid, nickname, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(userId, '', openid, userInfo?.nickName || '', userInfo?.avatarUrl || '', now, now);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      }
    } else {
      // 更新用户信息
      if (userInfo?.nickName || userInfo?.avatarUrl) {
        db.prepare('UPDATE users SET nickname = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
          .run(userInfo.nickName || user.nickname, userInfo.avatarUrl || user.avatar_url, now, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    }

    const token = signToken(user.id);
    res.json({
      token,
      userInfo: {
        openid: user.openid,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('微信登录失败:', err);
    res.status(500).json({ error: '登录失败: ' + err.message });
  }
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

// 微信 code2session
function wechatCode2Session(code) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errcode) {
            reject(new Error(`微信接口错误: ${result.errmsg}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error('解析微信返回数据失败'));
        }
      });
    }).on('error', reject);
  });
}

module.exports = router;
