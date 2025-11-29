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

        this.ensureUserBalanceColumn();
        this.createTopUpTable();
        this.createGiftTransactionTable();
        this.createPasswordResetTokensTable();
    }

    ensureUserBalanceColumn() {
        this.db.all('PRAGMA table_info(users)', (err, columns) => {
            if (err) {
                console.error('檢查用戶表欄位失敗:', err);
                return;
            }

            const hasBalanceColumn = Array.isArray(columns) && columns.some((column) => column.name === 'balance');
            if (hasBalanceColumn) {
                return;
            }

            this.db.run('ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 0', (alterErr) => {
                if (alterErr) {
                    if (alterErr.message && alterErr.message.includes('duplicate column name')) {
                        console.log('ℹ️ 用戶表 balance 欄位已存在');
                    } else {
                        console.error('新增 balance 欄位失敗:', alterErr);
                    }
                } else {
                    console.log('✅ 已為用戶表新增 balance 欄位');
                }
            });
        });
    }

    createTopUpTable() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS top_ups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                operator_id INTEGER,
                amount INTEGER NOT NULL,
                payment_method TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reference TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                confirmed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (operator_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('創建儲值表失敗:', err);
            } else {
                console.log('✅ 儲值表創建成功');
            }
        });
    }

    createGiftTransactionTable() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS gift_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_user_id INTEGER NOT NULL,
                broadcaster_id TEXT,
                gift_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('創建禮物交易表失敗:', err);
            } else {
                console.log('✅ 禮物交易表創建成功');
            }
        });
    }

    createPasswordResetTokensTable() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('創建密碼重設令牌表失敗:', err);
            } else {
                console.log('✅ 密碼重設令牌表創建成功');
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
                                avatarUrl: user.avatar_url,
                                balance: user.balance ?? 0
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
                'SELECT id, username, email, display_name, avatar_url, balance FROM users WHERE id = ?',
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
                            avatarUrl: user.avatar_url,
                            balance: user.balance ?? 0
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
                'SELECT id, username, email, display_name, avatar_url, balance FROM users WHERE email = ?',
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
                            avatarUrl: user.avatar_url,
                            balance: user.balance ?? 0
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
                            avatarUrl: user.avatar_url,
                            balance: user.balance ?? 0
                        });
                    } else {
                        reject(new Error('會話無效或已過期'));
                    }
                }
            );
        });
    }

    // 根據使用者名稱獲取用戶
    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, username, email, display_name, avatar_url, balance FROM users WHERE username = ?',
                [username],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else if (user) {
                        resolve({
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            displayName: user.display_name,
                            avatarUrl: user.avatar_url,
                            balance: user.balance ?? 0
                        });
                    } else {
                        reject(new Error('用戶不存在'));
                    }
                }
            );
        });
    }

    getUserBalance(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve(row.balance ?? 0);
                } else {
                    reject(new Error('用戶不存在'));
                }
            });
        });
    }

    createTopUpRecord({ userId, operatorId = null, amount, paymentMethod, status = 'pending', reference = null, notes = null }) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO top_ups (user_id, operator_id, amount, payment_method, status, reference, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, operatorId, amount, paymentMethod, status, reference, notes],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            userId,
                            operatorId,
                            amount,
                            paymentMethod,
                            status,
                            reference,
                            notes
                        });
                    }
                }
            );
        });
    }

    createPasswordResetToken(userId, token, expiresAt) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO password_reset_tokens (user_id, token, expires_at)
                 VALUES (?, ?, datetime(?))`,
                [userId, token, expiresAt],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, userId, token, expiresAt });
                    }
                }
            );
        });
    }

    invalidatePasswordResetTokens(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE password_reset_tokens
                 SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
                 WHERE user_id = ? AND used_at IS NULL`,
                [userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes || 0);
                    }
                }
            );
        });
    }

    getPasswordResetToken(token) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM password_reset_tokens WHERE token = ?`,
                [token],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    markPasswordResetTokenUsed(token) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?`,
                [token],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes || 0);
                    }
                }
            );
        });
    }

    updateUserPassword(userId, passwordHash) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [passwordHash, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('更新密碼失敗，使用者不存在'));
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    getTopUpById(topUpId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT t.*, u.username AS target_username, u.display_name AS target_display_name,
                        op.username AS operator_username
                 FROM top_ups t
                 LEFT JOIN users u ON u.id = t.user_id
                 LEFT JOIN users op ON op.id = t.operator_id
                 WHERE t.id = ?`,
                [topUpId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        reject(new Error('儲值紀錄不存在'));
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    confirmTopUp(topUpId) {
        return new Promise((resolve, reject) => {
            this.getTopUpById(topUpId)
                .then((topUp) => {
                    if (topUp.status === 'confirmed') {
                        this.getUserBalance(topUp.user_id)
                            .then((balance) => resolve({ topUp, balance }))
                            .catch(reject);
                        return;
                    }

                    const db = this.db;
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION', (beginErr) => {
                            if (beginErr) {
                                reject(beginErr);
                                return;
                            }

                            db.run(
                                'UPDATE top_ups SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?',
                                ['confirmed', topUpId],
                                (updateErr) => {
                                    if (updateErr) {
                                        db.run('ROLLBACK');
                                        reject(updateErr);
                                        return;
                                    }

                                    db.run(
                                        'UPDATE users SET balance = COALESCE(balance, 0) + ? WHERE id = ?',
                                        [topUp.amount, topUp.user_id],
                                        (balanceErr) => {
                                            if (balanceErr) {
                                                db.run('ROLLBACK');
                                                reject(balanceErr);
                                                return;
                                            }

                                            db.get(
                                                'SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = ?',
                                                [topUp.user_id],
                                                (finalErr, row) => {
                                                    if (finalErr) {
                                                        db.run('ROLLBACK');
                                                        reject(finalErr);
                                                        return;
                                                    }

                                                    db.run('COMMIT', (commitErr) => {
                                                        if (commitErr) {
                                                            reject(commitErr);
                                                            return;
                                                        }

                                                        resolve({
                                                            topUp: { ...topUp, status: 'confirmed' },
                                                            balance: row ? row.balance ?? 0 : 0
                                                        });
                                                    });
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        });
                    });
                })
                .catch(reject);
        });
    }

    cancelTopUp(topUpId, reason = null) {
        return new Promise((resolve, reject) => {
            this.getTopUpById(topUpId)
                .then((topUp) => {
                    if (topUp.status === 'confirmed') {
                        reject(new Error('儲值紀錄已確認，無法取消'));
                        return;
                    }

                    if (topUp.status === 'canceled') {
                        this.getUserBalance(topUp.user_id)
                            .then((balance) => resolve({ topUp, balance }))
                            .catch(reject);
                        return;
                    }

                    const cancelNote = reason ? `[取消] ${reason}` : null;
                    const updatedNotes = cancelNote
                        ? `${topUp.notes ? `${topUp.notes}\n` : ''}${cancelNote}`
                        : topUp.notes;

                    this.db.run(
                        'UPDATE top_ups SET status = ?, notes = ? WHERE id = ?',
                        ['canceled', updatedNotes, topUpId],
                        (updateErr) => {
                            if (updateErr) {
                                reject(updateErr);
                                return;
                            }

                            this.getTopUpById(topUpId)
                                .then((updatedTopUp) => {
                                    this.getUserBalance(updatedTopUp.user_id)
                                        .then((balance) => resolve({ topUp: updatedTopUp, balance }))
                                        .catch(reject);
                                })
                                .catch(reject);
                        }
                    );
                })
                .catch(reject);
        });
    }

    getTopUpHistory(userId, limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT t.*, op.username AS operator_username, op.display_name AS operator_display_name
                 FROM top_ups t
                 LEFT JOIN users op ON op.id = t.operator_id
                 WHERE t.user_id = ?
                 ORDER BY t.created_at DESC
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    spendBalanceForGift({ userId, broadcasterId, giftType, amount, broadcasterUserId }) {
        return new Promise((resolve, reject) => {
            const db = this.db;
            const normalizeId = (value) => {
                if (value === null || typeof value === 'undefined') {
                    return null;
                }
                const trimmed = String(value).trim();
                return trimmed.length ? trimmed : null;
            };

            const toIntegerId = (value) => {
                if (value === null || typeof value === 'undefined') {
                    return null;
                }
                const parsed = Number(value);
                return Number.isInteger(parsed) ? parsed : null;
            };

            const presetBroadcasterUserId = toIntegerId(broadcasterUserId);
            const normalizedBroadcasterId = normalizeId(broadcasterId);

            const lookupBroadcasterUserId = (identifier, callback) => {
                if (!identifier) {
                    callback(null, null);
                    return;
                }

                const numericId = Number(identifier);
                const tryUsername = () => {
                    db.get('SELECT id FROM users WHERE username = ?', [identifier], (usernameErr, row) => {
                        if (usernameErr) {
                            callback(usernameErr);
                        } else {
                            callback(null, row ? row.id : null);
                        }
                    });
                };

                if (Number.isInteger(numericId) && numericId.toString() === identifier) {
                    db.get('SELECT id FROM users WHERE id = ?', [numericId], (idErr, row) => {
                        if (idErr) {
                            callback(idErr);
                        } else if (row) {
                            callback(null, row.id);
                        } else {
                            tryUsername();
                        }
                    });
                } else {
                    tryUsername();
                }
            };

            const lookupIdentifier = presetBroadcasterUserId
                ? presetBroadcasterUserId.toString()
                : normalizedBroadcasterId;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION', (beginErr) => {
                    if (beginErr) {
                        reject(beginErr);
                        return;
                    }

                    db.run(
                        'UPDATE users SET balance = COALESCE(balance, 0) - ? WHERE id = ? AND COALESCE(balance, 0) >= ?',
                        [amount, userId, amount],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                reject(err);
                                return;
                            }

                            if (this.changes === 0) {
                                db.run('ROLLBACK');
                                reject(new Error('餘額不足'));
                                return;
                            }

                            lookupBroadcasterUserId(lookupIdentifier, (lookupErr, lookedUpBroadcasterUserId) => {
                                if (lookupErr) {
                                    db.run('ROLLBACK');
                                    reject(lookupErr);
                                    return;
                                }

                                const resolvedBroadcasterUserId = presetBroadcasterUserId || lookedUpBroadcasterUserId;
                                const storedBroadcasterKey = normalizedBroadcasterId || (resolvedBroadcasterUserId ? resolvedBroadcasterUserId.toString() : null);

                                db.run(
                                    `INSERT INTO gift_transactions (sender_user_id, broadcaster_id, gift_type, amount)
                                     VALUES (?, ?, ?, ?)`,
                                    [userId, storedBroadcasterKey, giftType, amount],
                                    function(insertErr) {
                                        if (insertErr) {
                                            db.run('ROLLBACK');
                                            reject(insertErr);
                                            return;
                                        }

                                        const transactionId = this.lastID;

                                        const creditBroadcaster = (callback) => {
                                            if (!resolvedBroadcasterUserId) {
                                                callback(null, { balance: null, userId: null });
                                                return;
                                            }

                                            db.run(
                                                'UPDATE users SET balance = COALESCE(balance, 0) + ? WHERE id = ?',
                                                [amount, resolvedBroadcasterUserId],
                                                (creditErr) => {
                                                    if (creditErr) {
                                                        callback(creditErr);
                                                        return;
                                                    }

                                                    db.get(
                                                        'SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = ?',
                                                        [resolvedBroadcasterUserId],
                                                        (balanceErr, balanceRow) => {
                                                            if (balanceErr) {
                                                                callback(balanceErr);
                                                                return;
                                                            }

                                                            callback(null, {
                                                                balance: balanceRow ? balanceRow.balance ?? 0 : 0,
                                                                userId: resolvedBroadcasterUserId
                                                            });
                                                        }
                                                    );
                                                }
                                            );
                                        };

                                        creditBroadcaster((creditErr, broadcasterInfo) => {
                                            if (creditErr) {
                                                db.run('ROLLBACK');
                                                reject(creditErr);
                                                return;
                                            }

                                            db.get(
                                                'SELECT COALESCE(balance, 0) AS balance FROM users WHERE id = ?',
                                                [userId],
                                                (balanceErr, row) => {
                                                    if (balanceErr) {
                                                        db.run('ROLLBACK');
                                                        reject(balanceErr);
                                                        return;
                                                    }

                                                    db.run('COMMIT', (commitErr) => {
                                                        if (commitErr) {
                                                            reject(commitErr);
                                                            return;
                                                        }

                                                        resolve({
                                                            balance: row ? row.balance ?? 0 : 0,
                                                            transactionId,
                                                            broadcasterUserId: broadcasterInfo.userId,
                                                            broadcasterBalance: broadcasterInfo.balance
                                                        });
                                                    });
                                                }
                                            );
                                        });
                                    }
                                );
                            });
                        }
                    );
                });
            });
        });
    }

    getGiftHistory(userId, limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM gift_transactions
                 WHERE sender_user_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
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