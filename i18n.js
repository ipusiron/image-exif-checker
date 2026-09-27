/* 日本語と英語の文言。UI側のスクリプトは言語ごとの文字列を持たない。 */
/* Exifのタグ名（Make、Model、GPSLatitudeなど）は固有名詞なので訳さない。 */
const I18n = (() => {
  const ja = {
    'app.title': '画像Exifチェッカー - Image Exif Checker',
    'app.description': 'JPEGやPNG画像に含まれるExifメタ情報をチェックし、必要に応じて削除（クリーニング）できるツールです。画像の個人情報漏洩を防ぎましょう。',
    'app.keywords': 'Exif, メタデータ, 画像, セキュリティ, プライバシー, 画像解析, 個人情報, メタ情報削除',
    'app.ogDescription': '画像に含まれるExifメタ情報を可視化・削除。SNS投稿前のチェックに最適な無料ツール。',
    'app.siteName': '画像Exifチェッカー',
    'app.heading': '画像Exifチェッカー（Image Exif Checker）',
    'app.lead': 'JPEGやPNG画像のメタ情報（Exif）を確認・削除できます。',
    'app.langButton': 'English',
    'app.langAria': '言語を切り替える',
    'drop.label': 'ここに画像をタップまたはドラッグ＆ドロップ',
    'file.label': 'または、下からファイルを選択',
    'method.legend': '削除方式',
    'method.lossless': '無劣化（バイナリ除去）',
    'method.losslessHint': '画質を落とさずメタ情報だけを取り除く',
    'method.reencode': '完全再エンコード',
    'method.reencodeHint': '画像を描き直して保存する。JPEGはわずかに劣化する',
    'filename.label': '保存するファイル名（拡張子は自動付与）',
    'filename.placeholder': 'ファイル名のみ入力',
    'clean.button': 'メタ情報を削除して保存',
    'notice.icc': 'ICCプロファイルも除去するため、広色域の画像では色味が変わることがあります。',
    'notice.hidden':
      'すべての隠し情報の消去は保証しません。無劣化ではJPEGのSOS以降を保持し、再エンコードでも画素内の隠し情報が残る場合があります。',
    'footer.repo': 'GitHubリポジトリーはこちら（ipusiron/image-exif-checker）',
    'status.analyzing': 'メタ情報を解析中...',
    'status.cleaning': 'メタ情報を削除中...',
    'error.unsupported': 'この形式には対応していません。JPEG（.jpg / .jpeg）または PNG（.png）を選んでください。',
    'error.unreadable': '画像を読み取れませんでした。ファイルが壊れている可能性があります。',
    'error.saveFailed': '画像を保存できませんでした。別の画像か削除方式を選んで、もう一度お試しください。',
    'risk.found': '情報漏洩リスクのある項目が {count} 件見つかりました',
    'risk.none': '情報漏洩リスクのある項目は見つかりませんでした',
    'meta.heading': 'メタ情報',
    'meta.none': 'メタ情報は見つかりませんでした。',
    'tag.caution': '（注意）',
    'value.unavailable': '（値を表示できません）',
    'value.truncated': '…（全 {count} 文字）',
    'result.app1Label': 'APP1（Exifなど）',
    'result.stripItem': '{label} {bytes}バイト',
    'result.removedList': '{list}を除去しました。',
    'result.removedNone': '除去対象のメタ情報はありませんでした。',
    'result.sizes': '{before} → {after}バイト。',
    'result.pixelsUnchanged': '画素データは変更していません。',
    'result.reencoded': '完全再エンコードで画像を保存します。',
    'verify.clean': '残っている項目: 0 件（画像の幅・高さなど構造の情報のみ）',
    'verify.remaining': '残っている機微タグ: {count} 件。保存した画像を確認してください。',
    'verify.noMetadata': 'メタ情報は残っていません（機微タグ 0 件）。',
    'list.separator': '、',
    'text.sentenceJoin': ''
  };

  const en = {
    'app.title': 'Image Exif Checker',
    'app.description':
      'Inspect the Exif metadata inside JPEG and PNG images and remove it when you need to. Keep personal information out of the pictures you share.',
    'app.keywords': 'Exif, metadata, image, security, privacy, image analysis, personal information, exif cleaner',
    'app.ogDescription': 'Reveal and remove the Exif metadata in an image. A free tool for the last check before you post.',
    'app.siteName': 'Image Exif Checker',
    'app.heading': 'Image Exif Checker',
    'app.lead': 'Inspect and remove the metadata (Exif) inside a JPEG or PNG image.',
    'app.langButton': '日本語',
    'app.langAria': 'Switch language',
    'drop.label': 'Tap here, or drag and drop an image',
    'file.label': 'Or choose a file below',
    'method.legend': 'Removal method',
    'method.lossless': 'Lossless (binary removal)',
    'method.losslessHint': 'Takes out only the metadata, with no loss of image quality',
    'method.reencode': 'Full re-encoding',
    'method.reencodeHint': 'Redraws and saves the image. A JPEG loses a little quality',
    'filename.label': 'File name to save (the extension is added for you)',
    'filename.placeholder': 'Name only',
    'clean.button': 'Remove the metadata and save',
    'notice.icc': 'The ICC profile is removed as well, so the colors of a wide-gamut image may shift.',
    'notice.hidden':
      'Removal of every hidden piece of information is not guaranteed. Lossless removal keeps everything after ' +
      'the JPEG SOS marker, and re-encoding can still leave data hidden in the pixels.',
    'footer.repo': 'GitHub repository: ipusiron/image-exif-checker',
    'status.analyzing': 'Analyzing the metadata...',
    'status.cleaning': 'Removing the metadata...',
    'error.unsupported': 'This format is not supported. Choose a JPEG (.jpg / .jpeg) or a PNG (.png).',
    'error.unreadable': 'The image could not be read. The file may be damaged.',
    'error.saveFailed': 'The image could not be saved. Choose another image or another removal method and try again.',
    'risk.found': '{count} item(s) that could leak personal information were found',
    'risk.none': 'No item that could leak personal information was found',
    'meta.heading': 'Metadata',
    'meta.none': 'No metadata was found.',
    'tag.caution': ' (caution)',
    'value.unavailable': '(this value cannot be shown)',
    'value.truncated': '... ({count} characters in all)',
    'result.app1Label': 'APP1 (Exif and the like)',
    'result.stripItem': '{label}, {bytes} bytes',
    'result.removedList': 'Removed {list}.',
    'result.removedNone': 'There was no metadata to remove.',
    'result.sizes': '{before} → {after} bytes.',
    'result.pixelsUnchanged': 'The pixel data is unchanged.',
    'result.reencoded': 'The image is saved with full re-encoding.',
    'verify.clean': 'Remaining items: 0 (only structural values such as width and height)',
    'verify.remaining': 'Remaining sensitive tags: {count}. Check the saved image.',
    'verify.noMetadata': 'No metadata remains (0 sensitive tags).',
    'list.separator': ', ',
    'text.sentenceJoin': ' '
  };

  let language = 'ja';
  const STORAGE_KEY = 'image-exif-checker-language';

  function t(key, values = {}) {
    const dict = language === 'en' ? en : ja;
    const message = dict[key];
    if (typeof message !== 'string') throw new Error('Unknown message: ' + key);
    return message.replace(/\{(\w+)\}/g, (whole, name) =>
      (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole));
  }

  /** 数値の桁区切りを、表示中の言語にそろえる。 */
  function formatNumber(value) {
    return Number(value).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP');
  }

  function apply(root = document) {
    document.documentElement.lang = language;
    document.title = t('app.title');
    root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt', 'content']) {
      root.querySelectorAll('[data-i18n-' + attr + ']').forEach(element =>
        element.setAttribute(attr, t(element.getAttribute('data-i18n-' + attr))));
    }
  }

  function setLanguage(value) {
    if (value !== 'ja' && value !== 'en') return;
    language = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      /* ストレージが使えない環境では記憶しない。 */
    }
    apply();
    document.dispatchEvent(new Event('languagechange'));
  }

  function init() {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      /* ストレージが使えない環境では既定に従う。 */
    }
    const query = new URLSearchParams(location.search).get('lang');
    const chosen = [query, saved].find(value => value === 'ja' || value === 'en');
    language = chosen || (/^ja\b/i.test(navigator.language || '') ? 'ja' : 'en');
    apply();
  }

  return { ja, en, t, formatNumber, apply, init, setLanguage, get language() { return language; } };
})();

if (typeof window !== 'undefined') window.I18n = I18n;
if (typeof module === 'object' && module.exports) module.exports = I18n;
