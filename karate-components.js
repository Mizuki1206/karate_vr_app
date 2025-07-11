const express = require('express');
const https = require('https');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();

// SSL証明書の設定
const options = {
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem')
};

// HTTPSサーバーの作成
const server = https.createServer(options, app);

// WebSocketサーバーの設定
const wss = new WebSocket.Server({ server });

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ユーザーセッション管理
const userSessions = new Map();
const practiceData = new Map();

// WebSocket接続管理
wss.on('connection', function connection(ws, req) {
  const userId = generateUserId();
  userSessions.set(userId, {
    ws: ws,
    joinTime: Date.now(),
    lastActivity: Date.now(),
    currentKata: 'basic',
    score: 0,
    combo: 0,
    practiceHistory: []
  });

  console.log(`新しいユーザーが接続しました: ${userId}`);
  
  // 接続確認メッセージ
  ws.send(JSON.stringify({
    type: 'connection_established',
    userId: userId,
    timestamp: Date.now(),
    message: '空手練習システムに接続しました'
  }));

  // メッセージ受信処理
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      handleUserMessage(userId, data);
    } catch (error) {
      console.error('メッセージ解析エラー:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'メッセージ形式が不正です'
      }));
    }
  });

  // 接続終了処理
  ws.on('close', function() {
    console.log(`ユーザーが切断しました: ${userId}`);
    // 練習データを保存
    savePracticeData(userId);
    userSessions.delete(userId);
  });

  // エラー処理
  ws.on('error', function(error) {
    console.error(`WebSocketエラー (${userId}):`, error);
  });
});

// ユーザーメッセージ処理
function handleUserMessage(userId, data) {
  const session = userSessions.get(userId);
  if (!session) return;

  session.lastActivity = Date.now();

  switch (data.type) {
    case 'kata_success':
      handleKataSuccess(userId, data);
      break;
    
    case 'kata_attempt':
      handleKataAttempt(userId, data);
      break;
      
    case 'request_guidance':
      sendGuidance(userId, data.kata);
      break;
      
    case 'practice_session_start':
      startPracticeSession(userId);
      break;
      
    case 'practice_session_end':
      endPracticeSession(userId);
      break;

    case 'get_leaderboard':
      sendLeaderboard(userId);
      break;

    default:
      console.log(`未知のメッセージタイプ: ${data.type}`);
  }
}

// 型成功処理
function handleKataSuccess(userId, data) {
  const session = userSessions.get(userId);
  if (!session) return;

  // セッションデータ更新
  session.currentKata = data.kata;
  session.score = data.score;
  session.combo = data.combo;
  
  // 練習履歴に追加
  session.practiceHistory.push({
    kata: data.kata,
    success: true,
    timestamp: data.timestamp,
    score: data.score,
    combo: data.combo
  });

  console.log(`${userId}: ${data.kata} 成功 (スコア: ${data.score}, コンボ: ${data.combo})`);

  // 他のユーザーに通知（マルチユーザー対応）
  broadcastToOthers(userId, {
    type: 'user_achievement',
    userId: userId,
    kata: data.kata,
    score: data.score,
    combo: data.combo
  });

  // リアルタイムフィードバック送信
  sendRealTimeFeedback(userId, data);
}

// 型試行処理
function handleKataAttempt(userId, data) {
  const session = userSessions.get(userId);
  if (!session) return;

  session.practiceHistory.push({
    kata: data.kata,
    success: false,
    timestamp: data.timestamp,
    accuracy: data.accuracy || 0
  });

  // 改善アドバイス送信
  sendImprovementAdvice(userId, data);
}

// リアルタイムフィードバック送信
function sendRealTimeFeedback(userId, data) {
  const session = userSessions.get(userId);
  if (!session) return;

  let feedback = {
    type: 'real_time_feedback',
    kata: data.kata,
    performance: 'excellent'
  };

  // コンボ数に基づくフィードバック
  if (data.combo >= 10) {
    feedback.message = '素晴らしい集中力です！この調子で続けましょう！';
    feedback.effect = 'golden_aura';
  } else if (data.combo >= 5) {
    feedback.message = '良いリズムです！もう少しで完璧になります';
    feedback.effect = 'blue_sparkle';
  } else {
    feedback.message = '上手です！継続して練習しましょう';
    feedback.effect = 'green_glow';
  }

  session.ws.send(JSON.stringify(feedback));
}

// 改善アドバイス送信
function sendImprovementAdvice(userId, data) {
  const session = userSessions.get(userId);
  if (!session) return;

  const advice = generateAdvice(data.kata, data.accuracy);
  
  session.ws.send(JSON.stringify({
    type: 'improvement_advice',
    kata: data.kata,
    advice: advice,
    accuracy: data.accuracy
  }));
}

// アドバイス生成
function generateAdvice(kata, accuracy) {
  const adviceDatabase = {
    punch: [
      '拳をしっかりと握り、腰から力を伝えましょう',
      '肩の力を抜いて、素早く突き出しましょう',
      '突いた後は素早く引き戻すことを意識しましょう'
    ],
    block: [
      '肘を適度に曲げて、上腕で受けましょう',
      '体の中心線を意識して防御しましょう',
      '相手の攻撃を見極めてから受けましょう'
    ],
    kick: [
      '軸足をしっかりと安定させましょう',
      '膝を高く上げてから蹴り出しましょう',
      '蹴り出した後は素早く足を引きましょう'
    ]
  };

  const kataAdvice = adviceDatabase[kata] || ['基本姿勢を大切にしましょう'];
  return kataAdvice[Math.floor(Math.random() * kataAdvice.length)];
}

// ガイダンス送信
function sendGuidance(userId, kata) {
  const session = userSessions.get(userId);
  if (!session) return;

  const guidance = {
    type: 'kata_guidance',
    kata: kata,
    instructions: getKataInstructions(kata),
    keyPoints: getKataKeyPoints(kata),
    commonMistakes: getCommonMistakes(kata)
  };

  session.ws.send(JSON.stringify(guidance));
}

// 型の指導内容取得
function getKataInstructions(kata) {
  const instructions = {
    punch: [
      '1. 基本立ちの姿勢から始めます',
      '2. 左手を腰に構えます',
      '3. 右拳を素早く前に突き出します',
      '4. 腰の回転を使って力を伝えます',
      '5. 突いた後は素早く引き戻します'
    ],
    block: [
      '1. 基本立ちの姿勢から始めます',
      '2. 両手を胸の前に構えます',
      '3. 攻撃に合わせて上腕で受けます', 
      '4. 肘を90度に保ちます',
      '5. 受けた後は反撃の準備をします'
    ],
    kick: [
      '1. 基本立ちの姿勢から始めます',
      '2. 右膝を高く上げます',
      '3. 足の裏で前方に蹴り出します',
      '4. 軸足でバランスを保ちます',
      '5. 蹴った後は素早く足を戻します'
    ]
  };
  return instructions[kata] || ['基本の動作を確認しましょう'];
}

// 型のポイント取得
function getKataKeyPoints(kata) {
  const keyPoints = {
    punch: ['腰の回転', '拳の握り方', '肩の力を抜く', '目線の安定'],
    block: ['肘の角度', '受ける部位', '体重移動', '次の動作への準備'],
    kick: ['軸足の安定', '膝の高さ', '蹴りの方向', 'バランス維持']
  };
  return keyPoints[kata] || ['基本姿勢', '呼吸法', '集中力'];
}

// よくある間違い取得
function getCommonMistakes(kata) {
  const mistakes = {
    punch: [
      '肩に力が入りすぎている',
      '腰が回転していない',
      '拳が正しく握れていない',
      '引き手が不十分'
    ],
    block: [
      '肘が下がりすぎている',
      '受ける位置が不適切',
      '体が後ろに下がりすぎている',
      '次の動作への準備不足'
    ],
    kick: [
      '軸足が不安定',
      '膝が十分に上がっていない',
      '蹴りの軌道が不正確',
      '戻りが遅い'
    ]
  };
  return mistakes[kata] || ['基本姿勢の乱れ'];
}

// 練習セッション開始
function startPracticeSession(userId) {
  const session = userSessions.get(userId);
  if (!session) return;

  session.sessionStartTime = Date.now();
  session.sessionScore = 0;
  session.sessionAttempts = 0;

  session.ws.send(JSON.stringify({
    type: 'session_started',
    message: '練習セッションを開始しました',
    timestamp: session.sessionStartTime
  }));

  console.log(`${userId}: 練習セッション開始`);
}

// 練習セッション終了
function endPracticeSession(userId) {
  const session = userSessions.get(userId);
  if (!session) return;

  const sessionDuration = Date.now() - (session.sessionStartTime || Date.now());
  const sessionStats = calculateSessionStats(session);

  session.ws.send(JSON.stringify({
    type: 'session_ended',
    duration: sessionDuration,
    stats: sessionStats,
    message: 'お疲れ様でした！'
  }));

  // セッションデータをファイルに保存
  savePracticeData(userId);
  
  console.log(`${userId}: 練習セッション終了 (${Math.round(sessionDuration/1000)}秒)`);
}

// セッション統計計算
function calculateSessionStats(session) {
  const history = session.practiceHistory;
  const sessionHistory = history.filter(h => 
    h.timestamp >= (session.sessionStartTime || 0)
  );

  const totalAttempts = sessionHistory.length;
  const successfulAttempts = sessionHistory.filter(h => h.success).length;
  const accuracy = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

  // 型別統計
  const kataStats = {};
  sessionHistory.forEach(h => {
    if (!kataStats[h.kata]) {
      kataStats[h.kata] = { attempts: 0, successes: 0 };
    }
    kataStats[h.kata].attempts++;
    if (h.success) kataStats[h.kata].successes++;
  });

  return {
    totalAttempts,
    successfulAttempts,
    accuracy: Math.round(accuracy),
    maxCombo: session.combo,
    finalScore: session.score,
    kataStats,
    improvement: calculateImprovement(session, sessionHistory)
  };
}

// 上達度計算
function calculateImprovement(session, sessionHistory) {
  if (sessionHistory.length < 10) return 'データ不足';

  const firstHalf = sessionHistory.slice(0, Math.floor(sessionHistory.length / 2));
  const secondHalf = sessionHistory.slice(Math.floor(sessionHistory.length / 2));

  const firstAccuracy = firstHalf.filter(h => h.success).length / firstHalf.length;
  const secondAccuracy = secondHalf.filter(h => h.success).length / secondHalf.length;

  const improvement = secondAccuracy - firstAccuracy;

  if (improvement > 0.1) return '大幅改善';
  if (improvement > 0.05) return '改善';
  if (improvement > -0.05) return '安定';
  return '要練習';
}

// リーダーボード送信
function sendLeaderboard(userId) {
  const session = userSessions.get(userId);
  if (!session) return;

  // 全ユーザーのスコアを集計
  const leaderboard = Array.from(userSessions.entries())
    .map(([id, sess]) => ({
      userId: id.substring(0, 8) + '***', // プライバシー保護
      score: sess.score,
      combo: sess.combo,
      practiceTime: Date.now() - sess.joinTime
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // トップ10

  session.ws.send(JSON.stringify({
    type: 'leaderboard',
    data: leaderboard,
    currentUser: {
      rank: leaderboard.findIndex(entry => 
        entry.userId === userId.substring(0, 8) + '***') + 1,
      score: session.score
    }
  }));
}

// 他のユーザーへのブロードキャスト
function broadcastToOthers(excludeUserId, message) {
  userSessions.forEach((session, userId) => {
    if (userId !== excludeUserId && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(message));
    }
  });
}

// 練習データ保存
function savePracticeData(userId) {
  const session = userSessions.get(userId);
  if (!session) return;

  const dataDir = path.join(__dirname, 'data', 'practice_logs');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const practiceData = {
    userId: userId,
    joinTime: session.joinTime,
    lastActivity: session.lastActivity,
    totalScore: session.score,
    maxCombo: session.combo,
    practiceHistory: session.practiceHistory,
    sessionStats: calculateSessionStats(session)
  };

  const filename = `practice_${userId}_${Date.now()}.json`;
  const filepath = path.join(dataDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(practiceData, null, 2));
  console.log(`練習データを保存しました: ${filename}`);
}

// ユーザーID生成
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// ファイルアップロード設定（練習データやカスタム型用）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = path.parse(file.originalname);
    cb(null, `${originalName.name}_${timestamp}${originalName.ext}`);
  },
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // 許可するファイルタイプ
    const allowedTypes = ['.json', '.csv', '.txt'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB制限
  }
});

// REST APIエンドポイント

// 練習データアップロード
app.post('/upload_practice_data', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    res.json({ 
      message: '練習データがアップロードされました',
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    res.status(500).json({ error: 'アップロードに失敗しました' });
  }
});

// 統計データ取得
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      totalUsers: userSessions.size,
      activeUsers: Array.from(userSessions.values())
        .filter(session => Date.now() - session.lastActivity < 300000).length, // 5分以内
      totalSessions: userSessions.size,
      avgScore: Array.from(userSessions.values())
        .reduce((sum, session) => sum + session.score, 0) / userSessions.size || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('統計取得エラー:', error);
    res.status(500).json({ error: '統計データの取得に失敗しました' });
  }
});

// 型定義データ取得
app.get('/api/kata-definitions', (req, res) => {
  const kataDefinitions = {
    basic: {
      name: '基本立ち',
      description: '空手の基本となる立ち方',
      difficulty: 1,
      positions: {
        leftHand: { x: 0, y: 1.2, z: 0, tolerance: 0.3 },
        rightHand: { x: 0, y: 1.2, z: 0, tolerance: 0.3 }
      }
    },
    punch: {
      name: '正拳突き',
      description: '基本的な突き技',
      difficulty: 2,
      positions: {
        leftHand: { x: -0.2, y: 1.4, z: 0.2, tolerance: 0.2 },
        rightHand: { x: 0.2, y: 1.4, z: -0.4, tolerance: 0.2 }
      }
    },
    block: {
      name: '上段受け',
      description: '上段への攻撃を防ぐ技',
      difficulty: 2,
      positions: {
        leftHand: { x: -0.3, y: 1.7, z: -0.2, tolerance: 0.2 },
        rightHand: { x: 0.3, y: 1.7, z: -0.2, tolerance: 0.2 }
      }
    },
    kick: {
      name: '前蹴り',
      description: '前方への基本的な蹴り技',
      difficulty: 3,
      positions: {
        leftHand: { x: -0.2, y: 1.3, z: 0.1, tolerance: 0.3 },
        rightHand: { x: 0.2, y: 1.3, z: 0.1, tolerance: 0.3 }
      }
    }
  };

  res.json(kataDefinitions);
});

// 練習履歴取得
app.get('/api/practice-history/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const session = userSessions.get(userId);
    
    if (!session) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    res.json({
      practiceHistory: session.practiceHistory,
      stats: calculateSessionStats(session)
    });
  } catch (error) {
    console.error('履歴取得エラー:', error);
    res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
});

// ホームページ（利用可能なファイル一覧）
app.use((req, res, next) => {
  if (req.path !== "/") {
    return next();
  }
  
  const publicPath = path.join(__dirname, "public");
  fs.readdir(publicPath, (err, files) => {
    if (err) {
      return res.status(500).send('ディレクトリの読み込みに失敗しました');
    }

    const htmlFiles = files.filter(file => file.endsWith(".html"));
    const fileListHTML = htmlFiles
      .map(file => `<a href="${path.join(req.path, file)}">${file}</a>`)
      .join("</br>");
    
    res.send(`
      <h1>空手・護身術VR学習システム</h1>
      <h2>利用可能なページ:</h2>
      ${fileListHTML}
      <h2>API エンドポイント:</h2>
      <ul>
        <li><a href="/api/stats">システム統計</a></li>
        <li><a href="/api/kata-definitions">型定義データ</a></li>
      </ul>
      <h2>WebSocket接続:</h2>
      <p>wss://localhost:3001 でリアルタイム通信が利用できます</p>
    `);
  });
});

// エラーハンドリング
app.use((error, req, res, next) => {
  console.error('サーバーエラー:', error);
  res.status(500).json({ 
    error: '内部サーバーエラーが発生しました',
    message: error.message 
  });
});

// 定期的なクリーンアップ（非アクティブユーザーの削除）
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 30 * 60 * 1000; // 30分

  userSessions.forEach((session, userId) => {
    if (now - session.lastActivity > inactiveThreshold) {
      console.log(`非アクティブユーザーを削除: ${userId}`);
      savePracticeData(userId);
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      userSessions.delete(userId);
    }
  });
}, 10 * 60 * 1000); // 10分間隔でチェック

// サーバー起動
server.listen(3001, () => {
  console.log('='.repeat(50));
  console.log('🥋 空手・護身術VR学習システム');
  console.log('='.repeat(50));
  console.log('🌐 HTTPS Server: https://localhost:3001');
  console.log('🔌 WebSocket: wss://localhost:3001');
  console.log('📊 API統計: https://localhost:3001/api/stats');
  console.log('🎯 型定義: https://localhost:3001/api/kata-definitions');
  console.log('='.repeat(50));
  console.log('システムが正常に起動しました');
  console.log('Ctrl+C で終了');
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.log('\n終了処理を開始します...');
  
  // 全ユーザーのデータを保存
  userSessions.forEach((session, userId) => {
    savePracticeData(userId);
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({
        type: 'server_shutdown',
        message: 'サーバーがメンテナンスのため終了します'
      }));
      session.ws.close();
    }
  });

  server.close(() => {
    console.log('サーバーが正常に終了しました');
    process.exit(0);
  });
});

module.exports = app;