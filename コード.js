/**
 * AJD Navi 商品情報自動取得・改廃表リスト作成スクリプト
 * 
 * 取得対象:
 * - 期間: 2026/07/01 〜 2026/12/31
 * - 対象カテゴリー:
 *   [医薬品類]
 *     101: 医薬品類
 *   [その他（医薬品類以外）]
 *     102: 衛生・医療用品, 103: オーラルケア, 104: 健康・機能食品
 *     201: スキンケア, 202: メイク, 203: ヘアケア, 204: ボディケア・バスグッズ, 205: 化粧小物・機器, 206: メンズ化粧品
 *     301: ベビー, 302: 介護エイジングケア, 303: 女性用品, 304: 衣料用品, 305: ペット
 *     401: 紙製品, 402: 殺虫・園芸, 403: 洗濯・ファブリック, 404: キッチン, 405: ハウスホールド
 * 
 * 仕様:
 * - 「医薬品類」と「その他（医薬品類以外）」の2グループ構成
 * - メーカー名の自動短縮（花王、ニベア花王 → 花王、長大法人名の通称化）
 * - 英語メーカー名のカタカナ読みソート（P&G → ピーアンドジー等で五十音順整列）
 * - メーカーとメーカーの境目に1行空白行を挿入
 * - グループ内ソート: メーカー名順（読み仮名五十音順） → 発売日順 → カテゴリー順
 * - JAN同一のリニューアル品は除外
 * - 商品名称と規格を1セルに統合
 * - メーカー名列を共通化（B列）
 * - 最左列にカテゴリー名を配置（A列）
 * - 中央に空白列を配置（F列）
 * - 企画品アイコン判別による「企画品」列の出力（J列）
 * - 日付を YYYYMMDD 形式に統一
 * - K1セルに最終更新日時を記録
 * 
 * 出力先:
 * - スプレッドシート ID: 1Qq_ZMdokH1pHk_YhvFbVUv-v6tRJFK1p6q41m2zZ0Hk
 */

const CONFIG = {
  SPREADSHEET_ID: '1Qq_ZMdokH1pHk_YhvFbVUv-v6tRJFK1p6q41m2zZ0Hk',
  SHEET_NAME: '商品リスト_202607-202612',
  BASE_URL: 'https://www.ajd-navi.jp',
  LOGIN_ID: 'qbaa0001',
  LOGIN_PASS: '7812',
  START_DATE: '2026/07/01',
  END_DATE: '2026/12/31',
  GROUPS: [
    {
      id: 1,
      name: '■ 医薬品類',
      categories: [
        { code: '101', name: '医薬品類' }
      ]
    },
    {
      id: 2,
      name: '■ その他（医薬品類以外）',
      categories: [
        { code: '102', name: '衛生・医療用品' },
        { code: '103', name: 'オーラルケア' },
        { code: '104', name: '健康・機能食品' },
        { code: '201', name: 'スキンケア' },
        { code: '202', name: 'メイク' },
        { code: '203', name: 'ヘアケア' },
        { code: '204', name: 'ボディケア・バスグッズ' },
        { code: '205', name: '化粧小物・機器' },
        { code: '206', name: 'メンズ化粧品' },
        { code: '301', name: 'ベビー' },
        { code: '302', name: '介護エイジングケア' },
        { code: '303', name: '女性用品' },
        { code: '304', name: '衣料用品' },
        { code: '305', name: 'ペット' },
        { code: '401', name: '紙製品' },
        { code: '402', name: '殺虫・園芸' },
        { code: '403', name: '洗濯・ファブリック' },
        { code: '404', name: 'キッチン' },
        { code: '405', name: 'ハウスホールド' }
      ]
    }
  ]
};

/**
 * メーカー名の短縮・通称変換マップ
 */
const MAKER_SHORT_MAP = {
  '花王グループカスタマーマーケティング (花王)': '花王',
  '花王グループカスタマーマーケティング (ニベア花王)': '花王',
  'ニベア花王': '花王',
  'クラシエホームプロダクツ販売 (クラシエ)': 'クラシエ',
  'ファンケルヘルスサイエンス (ファンケル)': 'ファンケル',
  'コーセーコスメニエンス (コーセー)': 'コーセー',
  'コーセー (コーセーマルホファーマ)': 'コーセー',
  'スタイリングライフ・ホールディングス ＢＣＬカンパニー': 'BCL',
  'スタイリングライフ・ホールディングス BCLカンパニー': 'BCL',
  'ポッカサッポロフード＆ビバレッジ': 'ポッカサッポロ',
  'レキットベンキーザー・ジャパン': 'レキットベンキーザー',
  '資生堂インターナショナル': '資生堂',
  'JNTLコンシューマーヘルス (Ｋｅｎｖｕｅ)': 'JNTL',
  'JNTLコンシューマーヘルス (Kenvue)': 'JNTL',
  'アイリスオーヤマ (アイリス・ファインプロダクツ)': 'アイリスオーヤマ',
  'ハウス食品 (ハウスウェルネスフーズ)': 'ハウス食品'
};

/**
 * メーカー名を短い通称に変換
 */
function getShortMakerName(rawMaker) {
  if (!rawMaker) return '';
  rawMaker = rawMaker.trim();
  if (MAKER_SHORT_MAP[rawMaker]) {
    return MAKER_SHORT_MAP[rawMaker];
  }
  if (rawMaker.includes('花王')) {
    return '花王';
  }
  // 括弧内の通称を抽出（8文字以内の場合）
  const m = rawMaker.match(/[\(（]([^\)）]+)[\)）]$/);
  if (m) {
    const sub = m[1].trim();
    if (sub.length <= 8) {
      return sub;
    }
  }
  return rawMaker;
}

/**
 * 英語・アルファベットのカタカナ読みソートキー生成
 */
const MAKER_KANA_MAP = {
  'P&G': 'ピーアンドジー',
  'Ｐ＆Ｇ': 'ピーアンドジー',
  'BCL': 'ビーシーエル',
  'ＢＣＬ': 'ビーシーエル',
  'JNTL': 'ジェイエヌティーエル',
  'ＪＮＴＬ': 'ジェイエヌティーエル',
  'DHC': 'ディーエイチシー',
  'ＤＨＣ': 'ディーエイチシー',
  'HD': 'エイチディー',
  'ＨＤ': 'エイチディー',
  'MK': 'エムケイ',
  'フォーシーズHD': 'フォーシーズエイチディー',
  'フォーシーズＨＤ': 'フォーシーズエイチディー'
};

function getMakerSortKey(makerName) {
  if (!makerName) return '';
  let m = makerName.trim();
  if (MAKER_KANA_MAP[m]) {
    return MAKER_KANA_MAP[m];
  }

  for (const [k, v] of Object.entries(MAKER_KANA_MAP)) {
    if (m.includes(k)) {
      m = m.replace(new RegExp(k, 'g'), v);
    }
  }

  const engKana = {
    'A': 'エイ', 'B': 'ビー', 'C': 'シー', 'D': 'ディー', 'E': 'イー',
    'F': 'エフ', 'G': 'ジー', 'H': 'エイチ', 'I': 'アイ', 'J': 'ジェイ',
    'K': 'ケイ', 'L': 'エル', 'M': 'エム', 'N': 'エヌ', 'O': 'オー',
    'P': 'ピー', 'Q': 'キュー', 'R': 'アール', 'S': 'エス', 'T': 'ティー',
    'U': 'ユー', 'V': 'ブイ', 'W': 'ダブリュー', 'X': 'エックス', 'Y': 'ワイ', 'Z': 'ゼット',
    '&': 'アンド', '＆': 'アンド'
  };

  for (const [eng, kana] of Object.entries(engKana)) {
    m = m.replace(new RegExp(eng, 'gi'), kana);
  }

  return m;
}

/**
 * スプレッドシートを開いたときにカスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('AJDナビ連携')
    .addItem('商品データ取得・更新を実行', 'fetchAjdProductData')
    .addToUi();
}

/**
 * メイン実行関数
 */
function fetchAjdProductData() {
  const startTime = new Date();
  console.log('=== AJD Navi 改廃表データ取得処理 開始 ===');

  // 1. AJD Navi にログイン
  const session = loginAjdNavi();
  if (!session) {
    throw new Error('AJD Naviへのログインに失敗しました。');
  }
  console.log('ログイン成功');

  // 2. 各グループ・カテゴリーのデータ取得
  const allNewRenewalRows = [];
  const allDiscontinuedRows = [];

  for (const group of CONFIG.GROUPS) {
    console.log(`\n【グループ】${group.name}`);
    for (const cat of group.categories) {
      console.log(`  - カテゴリー取得中: ${cat.name} (${cat.code})`);

      // (A) 新商品・リニューアル品取得 (replaceStatusCondition = 0)
      const newRenewalData = fetchCategoryDataWithKikaku(session, group, cat, '0');
      console.log(`    新商品・リニューアル品: ${newRenewalData.length} 件`);
      allNewRenewalRows.push(...newRenewalData);

      // (B) 終売品取得 (replaceStatusCondition = 1)
      const discData = fetchCategoryDataWithKikaku(session, group, cat, '1');
      console.log(`    終売品: ${discData.length} 件`);
      allDiscontinuedRows.push(...discData);
    }
  }

  console.log(`\n取得合計: 新商品・リニューアル品 ${allNewRenewalRows.length} 件, 終売品 ${allDiscontinuedRows.length} 件`);

  // 3. データの結合・除外フィルタ・ソート
  const formattedSections = mergeAndFormatData(allNewRenewalRows, allDiscontinuedRows);

  // 4. スプレッドシートへ出力
  writeToSpreadsheet(formattedSections);

  const durationSec = Math.round((new Date() - startTime) / 1000);
  console.log(`=== 処理完了 (所要時間: ${durationSec}秒) ===`);
}

/**
 * AJD Navi ログイン処理 (二重ログイン自動突破対応)
 */
function loginAjdNavi() {
  const cookieJar = {};

  function updateCookies(res) {
    const headers = res.getAllHeaders();
    let rawCookies = headers['Set-Cookie'] || headers['set-cookie'];
    if (rawCookies) {
      if (!Array.isArray(rawCookies)) {
        rawCookies = [rawCookies];
      }
      for (const c of rawCookies) {
        const parts = c.split(';')[0].split('=');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          cookieJar[name] = val;
        }
      }
    }
  }

  function getCookieHeader() {
    return Object.keys(cookieJar).map(k => `${k}=${cookieJar[k]}`).join('; ');
  }

  // Step 1: GET /logout.do
  const resLogout = UrlFetchApp.fetch(`${CONFIG.BASE_URL}/logout.do`, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  updateCookies(resLogout);

  // Step 2: POST /logon.do
  const resLogon = UrlFetchApp.fetch(`${CONFIG.BASE_URL}/logon.do`, {
    method: 'post',
    payload: {
      username: CONFIG.LOGIN_ID,
      password: CONFIG.LOGIN_PASS
    },
    followRedirects: true,
    muteHttpExceptions: true,
    headers: {
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  updateCookies(resLogon);

  const logonHtml = resLogon.getContentText('Windows-31J');

  // Step 3: 二重ログイン警告が出ている場合は /forseLogon.do に送信
  if (logonHtml.includes('forseLogon.do') || logonHtml.includes('force')) {
    console.log('二重ログイン警告を検出。強制ログイン処理を実行します...');
    const resForce = UrlFetchApp.fetch(`${CONFIG.BASE_URL}/forseLogon.do`, {
      method: 'post',
      payload: {
        force: '1',
        username: CONFIG.LOGIN_ID,
        password: CONFIG.LOGIN_PASS
      },
      followRedirects: true,
      muteHttpExceptions: true,
      headers: {
        'Cookie': getCookieHeader(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    updateCookies(resForce);
  }

  return {
    cookieJar: cookieJar,
    getCookieHeader: getCookieHeader
  };
}

/**
 * カテゴリー別 CSV取得および企画品アイコンの判定
 */
function fetchCategoryDataWithKikaku(session, group, category, replaceStatus) {
  const searchPayload = {
    'searchMode': 'true',
    'pageNo': '1',
    'orderType': '',
    'firstSearch': 'false',
    'startDateConditionStr': CONFIG.START_DATE,
    'endDateConditionStr': CONFIG.END_DATE,
    'replaceStatusCondition': replaceStatus,
    'categorySearchType': '1',
    'aspHighCategoryCondition': category.code,
    'aspMiddleCategoryCondition': '-1',
    'aspLowCategoryCondition': '-1',
    'productDivType': '0'
  };

  if (replaceStatus === '0') {
    searchPayload['newProductCondition'] = 'on';
    searchPayload['renewalProductCondition'] = 'on';
  }

  const reqHeaders = {
    'Cookie': session.getCookieHeader(),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  // 1. searchResult.do で検索実行（HTMLから企画品アイコンのJANを収集）
  const resHtml = UrlFetchApp.fetch(`${CONFIG.BASE_URL}/productCalendar/searchResult.do`, {
    method: 'post',
    payload: searchPayload,
    headers: reqHeaders,
    muteHttpExceptions: true
  });

  const htmlText = resHtml.getContentText('Windows-31J');
  const kikakuJanSet = extractKikakuJansFromHtml(htmlText);

  // 2. downloadCsv.do で全件CSVをダウンロード
  const resCsv = UrlFetchApp.fetch(`${CONFIG.BASE_URL}/productCalendar/downloadCsv.do`, {
    method: 'post',
    payload: searchPayload,
    headers: reqHeaders,
    muteHttpExceptions: true
  });

  const bytes = resCsv.getBlob().getBytes();
  const csvText = Utilities.newBlob(bytes).getDataAsString('Windows-31J');
  const items = parseCsvToObjects(csvText);

  // グループ・カテゴリー情報および企画品フラグを各アイテムに付与
  for (const item of items) {
    item._groupId = group.id;
    item._groupName = group.name;
    item._categoryCode = category.code;
    item._categoryName = category.name;

    const jan = (item['JAN'] || '').trim();
    const name = (item['商品名称'] || '').trim();
    const spec = (item['規格'] || '').trim();
    const div = (item['AJD商品区分'] || '').trim();

    // 画面のアイコン または 商品名等の文言から企画品を判定
    const isKikaku = kikakuJanSet.has(jan) || name.includes('企画') || spec.includes('企画') || div.includes('企画');
    item._isKikaku = isKikaku;
  }

  return items;
}

/**
 * 検索結果HTMLから「企画品」アイコンが付いている商品のJANコードを抽出
 */
function extractKikakuJansFromHtml(html) {
  const kikakuJans = new Set();
  if (!html) return kikakuJans;

  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!trMatches) return kikakuJans;

  for (const tr of trMatches) {
    if (tr.includes('00167684') || tr.includes('企画品')) {
      const janMatch = tr.match(/\b\d{13}\b/);
      if (janMatch) {
        kikakuJans.add(janMatch[0]);
      }
    }
  }
  return kikakuJans;
}

/**
 * CSV文字列をオブジェクト配列に変換
 */
function parseCsvToObjects(csvText) {
  if (!csvText || csvText.trim() === '') return [];
  const parsed = Utilities.parseCsv(csvText);
  if (parsed.length < 2) return [];

  const headers = parsed[0].map(h => h.trim());
  const rows = [];

  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ? row[j].trim() : '';
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * 商品名称と規格を1つのセル用文字列に統合
 */
function combineNameAndSpec(name, spec) {
  const n = (name || '').trim();
  const s = (spec || '').trim();
  if (n && s) {
    return `${n} ${s}`;
  }
  return n || s;
}

/**
 * 日付文字列を YYYYMMDD 形式に変換 (例: 26/08/31 -> 20260831, 26/10/-- -> 202610--)
 */
function formatDateToYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  dateStr = dateStr.trim();
  
  const m = dateStr.match(/^(?:(\d{2,4})\/)?(\d{1,2})\/(\d{1,2}|--)$/);
  if (m) {
    let yy = m[1] || '';
    let mm = m[2] || '';
    let dd = m[3] || '';
    if (yy.length === 2) {
      yy = '20' + yy;
    }
    if (mm.length === 1) {
      mm = '0' + mm;
    }
    if (dd.length === 1 && dd !== '--') {
      dd = '0' + dd;
    }
    return `${yy}${mm}${dd}`;
  }
  return dateStr.replace(/\//g, '');
}

/**
 * データの突合・除外・短縮・ソート・グループ別まとめ
 */
function mergeAndFormatData(newRenewalList, discontinuedList) {
  // 終売品を JAN をキーにしたマップに登録
  const discMap = new Map();
  for (const item of discontinuedList) {
    if (item['JAN']) {
      discMap.set(item['JAN'], item);
    }
  }

  const resultRows = [];
  const usedDiscJans = new Set();
  let excludedSameJanCount = 0;

  // 1. 新商品・リニューアル品の処理
  for (const item of newRenewalList) {
    const prevJan = (item['リニューアル前商品JANコード'] || '').trim();
    const prevName = (item['リニューアル前商品名称'] || '').trim();
    const prevSpec = (item['リニューアル前商品規格'] || '').trim();

    const rawMaker = (item['メーカー名'] || '').trim();
    const shortMaker = getShortMakerName(rawMaker);
    const newJan = (item['JAN'] || '').trim();
    const newName = (item['商品名称'] || '').trim();
    const newSpec = (item['規格'] || '').trim();
    const newReleaseDate = formatDateToYYYYMMDD(item['発売日'] || '');
    const isKikaku = item._isKikaku ? '企画品' : '';

    // 【要件】JAN同一のリニューアル品はリスト化しない（除外）
    if ((prevJan || prevName) && (newJan === prevJan && newJan !== '')) {
      excludedSameJanCount++;
      continue;
    }

    let leftJan = '';
    let leftCombinedName = '';
    let leftDate = '';

    if (prevJan || prevName) {
      // JAN変更ありのリニューアル品
      leftJan = prevJan;
      leftCombinedName = combineNameAndSpec(prevName, prevSpec);

      // 終売品データに該当する旧JANがあれば処理日を取得
      if (prevJan && discMap.has(prevJan)) {
        leftDate = formatDateToYYYYMMDD(discMap.get(prevJan)['処理日（終売品アイコン表示開始日）'] || '');
        usedDiscJans.add(prevJan);
      }
    }

    const rightCombinedName = combineNameAndSpec(newName, newSpec);

    resultRows.push({
      groupId: item._groupId,
      groupName: item._groupName,
      categoryCode: item._categoryCode,
      categoryName: item._categoryName,
      maker: shortMaker,
      makerSortKey: getMakerSortKey(shortMaker),
      leftJan: leftJan,
      leftName: leftCombinedName,
      leftDate: leftDate,
      blank: '',
      rightJan: newJan,
      rightName: rightCombinedName,
      rightDate: newReleaseDate,
      kikaku: isKikaku
    });
  }

  console.log(`同一JANリニューアル品を除外: ${excludedSameJanCount} 件`);

  // 2. リニューアル品に紐付かなかった単体の終売品の処理
  for (const item of discontinuedList) {
    const jan = (item['JAN'] || '').trim();
    if (jan && usedDiscJans.has(jan)) {
      continue; // 既にリニューアル前商品として紐付け済み
    }

    const rawMaker = (item['メーカー名'] || '').trim();
    const shortMaker = getShortMakerName(rawMaker);
    const name = (item['商品名称'] || '').trim();
    const spec = (item['規格'] || '').trim();
    const discDate = formatDateToYYYYMMDD(item['処理日（終売品アイコン表示開始日）'] || '');

    resultRows.push({
      groupId: item._groupId,
      groupName: item._groupName,
      categoryCode: item._categoryCode,
      categoryName: item._categoryName,
      maker: shortMaker,
      makerSortKey: getMakerSortKey(shortMaker),
      leftJan: jan,
      leftName: combineNameAndSpec(name, spec),
      leftDate: discDate,
      blank: '',
      rightJan: '',
      rightName: '',
      rightDate: '',
      kikaku: ''
    });
  }

  // 3. 並び替え（ソート）
  // ① グループ順 (医薬品類 -> その他)
  // ② メーカー名順 (カタカナ読み五十音順)
  // ③ 発売日順 (発売日 または 処理日)
  // ④ カテゴリーコード順
  resultRows.sort((a, b) => {
    // 1. グループ順
    if (a.groupId !== b.groupId) return a.groupId - b.groupId;

    // 2. メーカー名順（読み仮名五十音順）
    const compMaker = (a.makerSortKey || '').localeCompare(b.makerSortKey || '', 'ja');
    if (compMaker !== 0) return compMaker;

    // 3. 日付順（発売日 または 処理日）
    const dateA = a.rightDate || a.leftDate || '';
    const dateB = b.rightDate || b.leftDate || '';
    const compDate = dateA.localeCompare(dateB);
    if (compDate !== 0) return compDate;

    // 4. カテゴリーコード順
    return (a.categoryCode || '').localeCompare(b.categoryCode || '');
  });

  // 4. グループごとにまとめる
  const groupMap = new Map();
  for (const group of CONFIG.GROUPS) {
    groupMap.set(group.id, {
      name: group.name,
      rows: []
    });
  }

  for (const r of resultRows) {
    if (groupMap.has(r.groupId)) {
      groupMap.get(r.groupId).rows.push(r);
    }
  }

  return groupMap;
}

/**
 * スプレッドシートへの書き込み・書式設定
 */
function writeToSpreadsheet(groupMap) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // 既存の内容をクリア
  sheet.clear();

  // ヘッダー行定義 (A〜J列)
  const headers = [
    'カテゴリー名', 'メーカー名',
    'JAN', '商品名称', '処理日（終売品アイコン表示開始日）',
    '',
    'JAN', '商品名称', '発売日', '企画品'
  ];

  const outputValues = [headers];
  const sectionHeaderRowIndices = []; // 見出し行の行番号（1-based）
  const blankRowIndices = []; // メーカー区切り空白行の行番号
  let totalDataRowCount = 0;

  for (const [groupId, group] of groupMap.entries()) {
    if (group.rows.length === 0) continue;

    // グループ見出し行を挿入
    outputValues.push([group.name, '', '', '', '', '', '', '', '', '']);
    const currentSectionHeaderIndex = outputValues.length;
    sectionHeaderRowIndices.push(currentSectionHeaderIndex);

    let lastMaker = null;

    // データ行を追加
    for (const r of group.rows) {
      // メーカーが変わった境目に1行空白行を挿入（グループ見出し直後を除く）
      if (lastMaker !== null && lastMaker !== r.maker) {
        outputValues.push(['', '', '', '', '', '', '', '', '', '']);
        blankRowIndices.push(outputValues.length);
      }
      lastMaker = r.maker;

      outputValues.push([
        r.categoryName,
        r.maker,
        r.leftJan ? "'" + r.leftJan : '',
        r.leftName,
        r.leftDate,
        '',
        r.rightJan ? "'" + r.rightJan : '',
        r.rightName,
        r.rightDate,
        r.kikaku
      ]);
      totalDataRowCount++;
    }
  }

  // データを一括書き込み
  const totalRows = outputValues.length;
  const range = sheet.getRange(1, 1, totalRows, headers.length);
  range.setValues(outputValues);

  // --- スタイル・装飾の設定 ---
  // 1. カラムヘッダー（1行目）
  sheet.getRange(1, 1, 1, 2).setBackground('#EFEFEF').setFontWeight('bold').setHorizontalAlignment('center'); // 分類・メーカー
  sheet.getRange(1, 3, 1, 3).setBackground('#F4CCCC').setFontWeight('bold').setHorizontalAlignment('center'); // 旧商品・終売品側 (薄赤)
  sheet.getRange(1, 6).setBackground('#FFFFFF'); // 空白列
  sheet.getRange(1, 7, 1, 4).setBackground('#D9EAD3').setFontWeight('bold').setHorizontalAlignment('center'); // 新商品・リニューアル品側 (薄緑)

  // 2. 見出し行の装飾（医薬品類 / その他）
  for (const rowIdx of sectionHeaderRowIndices) {
    const sectionRange = sheet.getRange(rowIdx, 1, 1, headers.length);
    sectionRange.setBackground('#1C4587'); // 濃い青
    sectionRange.setFontColor('#FFFFFF'); // 白文字
    sectionRange.setFontWeight('bold');
    sectionRange.setFontSize(11);
  }

  // 3. データエリアの枠線と中央揃え
  if (totalRows > 1) {
    // 全体枠線（薄いグレー）
    sheet.getRange(2, 1, totalRows - 1, 5).setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(2, 7, totalRows - 1, 4).setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);

    // 中央揃え（カテゴリー、JAN、日付、企画品）
    sheet.getRange(2, 1, totalRows - 1, 1).setHorizontalAlignment('center'); // A列: カテゴリー名
    sheet.getRange(2, 3, totalRows - 1, 1).setHorizontalAlignment('center'); // C列: 旧JAN
    sheet.getRange(2, 5, totalRows - 1, 1).setHorizontalAlignment('center'); // E列: 処理日
    sheet.getRange(2, 7, totalRows - 1, 1).setHorizontalAlignment('center'); // G列: 新JAN
    sheet.getRange(2, 9, totalRows - 1, 1).setHorizontalAlignment('center'); // I列: 発売日
    sheet.getRange(2, 10, totalRows - 1, 1).setHorizontalAlignment('center'); // J列: 企画品
  }

  // 4. メーカー区切り空白行の装飾（枠線なし、薄い背景色）
  for (const blankIdx of blankRowIndices) {
    const blankRange = sheet.getRange(blankIdx, 1, 1, headers.length);
    blankRange.setBackground('#F8F9FA'); // ごく薄いグレー
    blankRange.setBorder(false, false, false, false, false, false);
  }

  // 5. 列幅の調整
  sheet.setColumnWidth(1, 140); // A列: カテゴリー名
  sheet.setColumnWidth(2, 160); // B列: メーカー名（短縮によりスッキリ収まる）
  sheet.setColumnWidth(3, 130); // C列: 旧JAN
  sheet.setColumnWidth(4, 300); // D列: 旧商品名称（規格含む）
  sheet.setColumnWidth(5, 110); // E列: 処理日
  sheet.setColumnWidth(6, 30);  // F列: 空白列（区切り）
  sheet.setColumnWidth(7, 130); // G列: 新JAN
  sheet.setColumnWidth(8, 300); // H列: 新商品名称（規格含む）
  sheet.setColumnWidth(9, 110); // I列: 発売日
  sheet.setColumnWidth(10, 80); // J列: 企画品
  sheet.setColumnWidth(11, 160); // K列: 更新日時用

  // 1行目を固定
  sheet.setFrozenRows(1);

  // K1セルに更新日時を出力
  const now = new Date();
  const timestampStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const cellK1 = sheet.getRange('K1');
  cellK1.setValue(`最終更新: ${timestampStr}`);
  cellK1.setFontWeight('normal');
  cellK1.setFontSize(9);
  cellK1.setFontColor('#555555');
  cellK1.setHorizontalAlignment('left');

  console.log(`スプレッドシートへの出力が完了しました（データ総行数: ${totalDataRowCount} 行、更新日時: ${timestampStr}）`);
}
