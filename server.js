const express = require('express');
const multer = require('multer');
const app = express();

const https = require('https');

const fs = require('fs');
const path = require('path');

const options = {
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem')
};

https.createServer(options, app).listen(3001, () =>
  console.log('HTTPS listening on 3001...')
);

// 静的ファイルのルーティング
app.use(express.static(path.join(__dirname, "public"))); // publicディレクトリを静的ファイルのルートディレクトリに設定


//routes内に用意したajax.jsをロード
//const ajax = require("./routes/json_output");
//　/ajaxに割り当てる = /ajaxにアクセスするとajax.jsが実行される
//app.use("/ajax", ajax);

// ファイルアップロードの設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/CSV/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// エンドポイントの作成
app.post('/upload_csv', upload.single('file'), (req, res) => {
  res.status(200).send({ message: 'File uploaded successfully' });
});

// ホームページに利用可能なルームのURLを表示（開発用）
app.use((req, res, next) => {
  if (req.path !== "/") {
    // リクエストのパスがルートパスでない場合、次のミドルウェアに進む
    return next();
  }
  const publicPath = path.join(__dirname, "public"); // publicディレクトリのパスを取得
  // リクエストされたパスを読み込む
  fs.readdir(publicPath, (err, files) => {
    // HTMLファイルをフィルタリングする
    const htmlFiles = files.filter((file) => file.endsWith(".html"));
    // ファイルリストのハイパーリンクを生成する
    const fileListHTML = htmlFiles
      .map((file) => `<a href="${path.join(req.path, file)}">${file}</a>`)
      .join("</br>");
    // ファイルリストを含むHTMLレスポンスを送信する
    res.send(`<h1>Room：</h1>${fileListHTML}`);
  });
});