const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        // 創建或連接到資料庫
        const dbPath = path.join(__dirname, 'vibelo.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('資料庫連接失敗:', err.message);
            } else {
                console.log('✅ 成功連接到 SQLite 資料庫');
                this.createTables();
            }
        });
    }

    createTables() {
        // 創建用戶表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name VARCHAR(100) NOT NULL,
                avatar_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1
            )
        `, (err) => {
            if (err) {
                console.error('創建用戶表失敗:', err);
            } else {
                console.log('✅ 用戶表創建成功');
                this.createDefaultUsers();
            }
        });

        // 創建會話表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(128) PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('創建會話表失敗:', err);
            } else {
                console.log('✅ 會話表創建成功');
            }
        });

        // 創建直播記錄表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS streams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME,
                max_viewers INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('創建直播表失敗:', err);
            } else {
                console.log('✅ 直播表創建成功');
            }
        });

        // 創建聊天訊息表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stream_id INTEGER,
                username VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'viewer',
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                temp_id VARCHAR(40),
                ip_address VARCHAR(45),
                user_agent TEXT,
                FOREIGN KEY (stream_id) REFERENCES streams (id)
            )
        `, (err) => {
            if (err) {
                console.error('創建聊天訊息表失敗:', err);
            } else {
                console.log('✅ 聊天訊息表創建成功');
            }
        });
    }

    async createDefaultUsers() {
        const defaultUsers = [
            {
                username: 'testuser1',
                email: 'test1@vibelo.com',
                password: '123456',
                display_name: '測試用戶一號'
            },
            {
                username: 'demouser',
                email: 'demo@vibelo.com',
                password: 'demo123',
                display_name: '演示用戶'
            },
            {
                username: 'admin',
                email: 'admin@vibelo.com',
                password: 'admin888',
                display_name: '管理員'
            }
        ];

        for (const user of defaultUsers) {
            try {
                await this.createUser(user.username, user.email, user.password, user.display_name);
            } catch (error) {
                // 用戶可能已存在，忽略錯誤
                console.log(`用戶 ${user.username} 已存在`);
            }
        }
    }

    // 創建新用戶
    createUser(username, email, password, displayName) {
        return new Promise((resolve, reject) => {
            // 檢查用戶是否已存在
            this.db.get(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email],
                async (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (row) {
                        reject(new Error('用戶名或郵箱已存在'));
                        return;
                    }

                    try {
                        // 加密密碼
                        const saltRounds = 10;
                        const passwordHash = await bcrypt.hash(password, saltRounds);

                        // 插入新用戶
                        this.db.run(
                            `INSERT INTO users (username, email, password_hash, display_name) 
                             VALUES (?, ?, ?, ?)`,
                            [username, email, passwordHash, displayName],
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ id: this.lastID, username, email, displayName });
                                }
                            }
                        );
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    // 驗證用戶登入
    authenticateUser(username, password) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ? OR email = ?',
                [username, username],
                async (err, user) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!user) {
                        reject(new Error('用戶不存在'));
                        return;
                    }

                    try {
                        const isValidPassword = await bcrypt.compare(password, user.password_hash);
                        if (isValidPassword) {
                            // 更新最後登入時間
                            this.db.run(
                                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                                [user.id]
                            );
                            
                            resolve({
                                id: user.id,
                                username: user.username,
                                email: user.email,
                                displayName: user.display_name,
                                avatarUrl: user.avatar_url
                            });
                        } else {
                            reject(new Error('密碼錯誤'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    // 根據 ID 獲取用戶
    getUserById(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, username, email, display_name, avatar_url FROM users WHERE id = ?',
                [userId],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else if (user) {
                        resolve({
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            displayName: user.display_name,
                            avatarUrl: user.avatar_url
                        });
                    } else {
                        reject(new Error('用戶不存在'));
                    }
                }
            );
        });
    }

    // 根據郵箱獲取用戶
    getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, username, email, display_name, avatar_url FROM users WHERE email = ?',
                [email],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else if (user) {
                        resolve({
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            displayName: user.display_name,
                            avatarUrl: user.avatar_url
                        });
                    } else {
                        reject(new Error('用戶不存在'));
                    }
                }
            );
        });
    }

    // 創建會話
    createSession(sessionId, userId, expiresAt, ipAddress, userAgent) {
        return new Promise((resolve, reject) => {
            // 先刪除已存在的會話（如果有的話）
            this.db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (deleteErr) => {
                if (deleteErr) {
                    console.warn('刪除舊會話失敗:', deleteErr.message);
                }
                
                // 插入新會話
                this.db.run(
                    `INSERT INTO sessions (session_id, user_id, expires_at, ip_address, user_agent) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [sessionId, userId, expiresAt, ipAddress, userAgent],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(sessionId);
                        }
                    }
                );
            });
        });
    }

    // 驗證會話
    validateSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT s.*, u.id, u.username, u.email, u.display_name, u.avatar_url 
                 FROM sessions s 
                 JOIN users u ON s.user_id = u.id 
                 WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP`,
                [sessionId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve({
                            id: row.id,
                            username: row.username,
                            email: row.email,
                            displayName: row.display_name,
                            avatarUrl: row.avatar_url
                        });
                    } else {
                        reject(new Error('會話無效或已過期'));
                    }
                }
            );
        });
    }

    // 刪除會話（登出）
    deleteSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 更新用戶頭像
    updateUserAvatar(userId, avatarUrl) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET avatar_url = ? WHERE id = ?',
                [avatarUrl, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // 清理過期會話
    cleanupExpiredSessions() {
        this.db.run('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP', (err) => {
            if (err) {
                console.error('清理過期會話失敗:', err);
            }
        });
    }

    // 關閉資料庫連接
    close() {
        return new Promise((resolve, reject) => {
            if (this.db && this.db.open) {
                this.db.close((err) => {
                    if (err) {
                        console.error('關閉資料庫失敗:', err);
                        reject(err);
                    } else {
                        console.log('✅ 資料庫連接已關閉');
                        this.db = null;
                        resolve();
                    }
                });
            } else {
                console.log('ℹ️  資料庫已經關閉或未初始化');
                resolve();
            }
        });
    }

    // 儲存聊天訊息
    saveChatMessage({ streamId=null, username, role='viewer', content, tempId=null, ipAddress=null, userAgent=null }) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO chat_messages (stream_id, username, role, content, temp_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [streamId, username, role, content, tempId, ipAddress, userAgent], function(err){
                    if(err) return reject(err);
                    resolve({ id: this.lastID });
                });
        });
    }

    // 取得最近 N 筆聊天記錄
    getRecentChatMessages(limit=50) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT id, username, role, content, temp_id as tempId, datetime(created_at) as createdAt FROM chat_messages ORDER BY id DESC LIMIT ?`, [limit], (err, rows)=>{
                if(err) return reject(err);
                resolve(rows.reverse());
            });
        });
    }
}

module.exports = Database;