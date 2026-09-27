# Image Exif Checker

Day007「生成AIで作るセキュリティツール100」の静的Webツールです。
JPEG/PNGのメタ情報をブラウザー内で解析し、無劣化除去またはCanvas再エンコードで保存します。
vanilla JavaScriptで構成し、npm依存やビルド工程はありません。
画面の文言は日本語と英語の2言語で、`i18n.js`に集めています。

## ファイル構成

- `index.html`：入力、削除方式、結果表示とCSP。文言は`data-i18n`で指す
- `i18n.js`：日英の辞書、`t()`、`apply()`、言語の保存と初期化
- `exif-logic.js`：DOMとExifReaderに依存しない判定とバイナリ処理
- `main.js`：DOM操作、ExifReader呼び出し、画像復号と保存
- `style.css`：ライト／ダーク、モバイル、フォーカス表示
- `vendor/exifreader/`：ExifReader 4.12.0、MPL-2.0全文と出典
- `test/`：7ファイルのNodeテスト、固定JPEG、画像生成Notebook
- `.github/workflows/test.yml`：push／pull_requestのNode 22テスト
- `package.json`：`npm test`の定義
- `LICENSE`：アプリのMITライセンス
- `README.md`と`README.en.md`：日本語版と英語版の説明
- `assets/`：README用スクリーンショット5枚

## 主要な関数

- `detectImageFormat`：先頭のバイト列によるJPEG/PNG判別
- `normalizeTagKey`、`isSensitiveTag`、`SENSITIVE_TAGS`、`countSensitiveTags`：機微タグの正規化と集計
- `formatTagValue`：表示用の`{ text, key, values }`を返す。制御文字の除去と200文字の表示上限
- `ERROR_CODES`：失敗の種類を文言ではなくコードで返す
- `sanitizeFileName`、`buildDownloadName`：100文字までの安全なファイル名と拡張子
- `extensionForFormat`、`mimeForFormat`：形式から拡張子とMIME型を取得
- `stripJpegMetadata`、`stripPngMetadata`、`stripMetadata`：画像データを再圧縮しないメタ情報除去
- `summarizeStrip`：除去した種類、バイト数、前後のサイズを集計
- `handleFile`、`loadImage`、`reencodeImage`：解析のエラー復帰、復号、Canvas保存
- `renderMeta`、`renderResult`：`metaState`と`resultState`から画面を作る。`languagechange`で呼び直す

## 開発時のコマンド

```sh
npm test
python -m http.server 8000 --bind 127.0.0.1
```

テストはNode 22以上の`node --test`で実行します。依存のインストールは不要です。
ブラウザーで`http://127.0.0.1:8000/`を開くか、`index.html`をfile://で直接開けます。
古典スクリプトの順序はi18n → vendor → exif-logic → mainです。ES moduleに変更しません。

## 安全側の決め事

- 外部送信、API、Cookie、npm依存を追加しない。
- localStorageに書くのは言語の選択だけとし、`i18n.js`に閉じ込める。`main.js`と`exif-logic.js`に書かない。
- 画面に出す文言を`main.js`と`exif-logic.js`に直書きしない。辞書のキー経由で渡す。
- Exifのタグ名と規格上の識別子（`APP1`、`tEXt`など）は訳さない。
- 表示中の状態を文字列の一致で判定しない。`metaState`・`resultState`とエラーコードで見分ける。
- vendorのJavaScriptとLICENSEは編集も整形もしない。変更時は版とハッシュを確認する。
- CSPの`script-src`は`'self'`のみ、`connect-src`は`'none'`とする。
- metaで無効な`frame-ancestors`をCSPに書かない。フレームバスティングも追加しない。
- 画面の値は`textContent`または`createTextNode`で表示する。
- 機微タグを変更するときは`test/exif-logic.test.js`を含む全テストを通す。
- 無劣化処理を変更するときは固定JPEGの2,509バイトとスキャンデータの一致を確認する。
- 既存の画像と固定JPEGを変更しない。Object URLは成功時も失敗時も解放する。
