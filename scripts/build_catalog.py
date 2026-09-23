#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AJD Navi 新商品・リニューアル品 カタログ生成スクリプト (全ページ画像URL対応版)
"""

import os
import sys
import re
import csv
import io
import json
import time
import math
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# Windows console encoding safety
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_URL = 'https://www.ajd-navi.jp'
LOGIN_ID = os.environ.get('AJD_LOGIN_ID', 'qbaa0001')
LOGIN_PASS = os.environ.get('AJD_LOGIN_PASS', '7812')
START_DATE = os.environ.get('START_DATE', '2026/07/01')
END_DATE = os.environ.get('END_DATE', '2026/12/31')

GROUPS = [
    {
        'id': 1,
        'name': '■ 医薬品類',
        'categories': [
            {'code': '101', 'name': '医薬品類'}
        ]
    },
    {
        'id': 2,
        'name': '■ その他（医薬品類以外）',
        'categories': [
            {'code': '102', 'name': '衛生・医療用品'},
            {'code': '103', 'name': 'オーラルケア'},
            {'code': '104', 'name': '健康・機能食品'},
            {'code': '201', 'name': 'スキンケア'},
            {'code': '202', 'name': 'メイク'},
            {'code': '203', 'name': 'ヘアケア'},
            {'code': '204', 'name': 'ボディケア・バスグッズ'},
            {'code': '205', 'name': '化粧小物・機器'},
            {'code': '206', 'name': 'メンズ化粧品'},
            {'code': '301', 'name': 'ベビー'},
            {'code': '302', 'name': '介護エイジングケア'},
            {'code': '303', 'name': '女性用品'},
            {'code': '304', 'name': '衣料用品'},
            {'code': '305', 'name': 'ペット'},
            {'code': '401', 'name': '紙製品'},
            {'code': '402', 'name': '殺虫・園芸'},
            {'code': '403', 'name': '洗濯・ファブリック'},
            {'code': '404', 'name': 'キッチン'},
            {'code': '405', 'name': 'ハウスホールド'}
        ]
    }
]

MAKER_SHORT_MAP = {
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
}

def get_short_maker_name(raw_maker):
    if not raw_maker:
        return ''
    raw_maker = raw_maker.strip()
    if raw_maker in MAKER_SHORT_MAP:
        return MAKER_SHORT_MAP[raw_maker]
    if '花王' in raw_maker:
        return '花王'
    m = re.search(r'[\(（]([^\)）]+)[\)）]$', raw_maker)
    if m:
        sub = m.group(1).strip()
        if len(sub) <= 8:
            return sub
    return raw_maker

MAKER_KANA_MAP = {
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
}

def get_maker_sort_key(maker_name):
    if not maker_name:
        return ''
    m = maker_name.strip()
    if m in MAKER_KANA_MAP:
        return MAKER_KANA_MAP[m]

    for k, v in MAKER_KANA_MAP.items():
        if k in m:
            m = m.replace(k, v)

    eng_kana = {
        'A': 'エイ', 'B': 'ビー', 'C': 'シー', 'D': 'ディー', 'E': 'イー',
        'F': 'エフ', 'G': 'ジー', 'H': 'エイチ', 'I': 'アイ', 'J': 'ジェイ',
        'K': 'ケイ', 'L': 'エル', 'M': 'エム', 'N': 'エヌ', 'O': 'オー',
        'P': 'ピー', 'Q': 'キュー', 'R': 'アール', 'S': 'エス', 'T': 'ティー',
        'U': 'ユー', 'V': 'ブイ', 'W': 'ダブリュー', 'X': 'エックス', 'Y': 'ワイ', 'Z': 'ゼット',
        '&': 'アンド', '＆': 'アンド'
    }
    for eng, kana in eng_kana.items():
        m = re.sub(eng, kana, m, flags=re.IGNORECASE)
    return m

def format_date_to_yyyymmdd(date_str):
    if not date_str:
        return ''
    date_str = date_str.strip()
    m = re.match(r'^(?:(\d{2,4})\/)?(\d{1,2})\/(\d{1,2}|--)$', date_str)
    if m:
        yy = m.group(1) or ''
        mm = m.group(2) or ''
        dd = m.group(3) or ''
        if len(yy) == 2:
            yy = '20' + yy
        if len(mm) == 1:
            mm = '0' + mm
        if len(dd) == 1 and dd != '--':
            dd = '0' + dd
        return f"{yy}{mm}{dd}"
    return date_str.replace('/', '')

def format_display_date(yyyymmdd):
    if not yyyymmdd:
        return ''
    if len(yyyymmdd) == 8 and yyyymmdd[6:] != '--':
        return f"{yyyymmdd[:4]}/{int(yyyymmdd[4:6])}/{int(yyyymmdd[6:])}"
    elif len(yyyymmdd) >= 6:
        return f"{yyyymmdd[:4]}/{int(yyyymmdd[4:6])}"
    return yyyymmdd

def login_ajd():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    session.get(f'{BASE_URL}/logout.do')
    res_login = session.post(f'{BASE_URL}/logon.do', data={'username': LOGIN_ID, 'password': LOGIN_PASS})
    text = res_login.content.decode('utf-8', errors='replace')
    if '/forseLogon.do' in text or 'force' in text:
        session.post(f'{BASE_URL}/forseLogon.do', data={'force': '1', 'username': LOGIN_ID, 'password': LOGIN_PASS})
    return session

PERIODS_CONFIG = [
    {
        'id': '202607-202612',
        'name': '2026年 7月〜12月（2026年下期）',
        'startDate': '2026/07/01',
        'endDate': '2026/12/31',
        'badge': '2026/07 〜 2026/12',
        'dataFile': 'data/catalog_202607-202612.js',
        'isDefault': True
    }
]

def fetch_category_data(session, genre, category, start_date=START_DATE, end_date=END_DATE):
    # Step 1: Initialize search form
    session.get(f'{BASE_URL}/productCalendar/allSearchInit.do')

    params = {
        'searchMode': 'true',
        'pageNo': '1',
        'orderType': '',
        'firstSearch': 'false',
        'startDateConditionStr': start_date,
        'endDateConditionStr': end_date,
        'replaceStatusCondition': '0', # new & renewal
        'categorySearchType': '1',
        'aspHighCategoryCondition': category['code'],
        'aspMiddleCategoryCondition': '-1',
        'aspLowCategoryCondition': '-1',
        'productDivType': '0',
        'newProductCondition': 'on',
        'renewalProductCondition': 'on'
    }

    # First page search to get total count and first batch
    res_search = session.post(f'{BASE_URL}/productCalendar/searchResult.do', data=params)
    html_p1 = res_search.content.decode('utf-8', errors='replace')

    cnt_match = re.search(r'全\s*(\d+)\s*件中', html_p1)
    total_count = int(cnt_match.group(1)) if cnt_match else 0
    total_pages = math.ceil(total_count / 50) if total_count > 0 else 0

    jan_meta = {}

    def extract_from_soup(soup_obj):
        tbl = soup_obj.find('table')
        if not tbl:
            return
        for tr in tbl.find_all('tr'):
            jan_m = re.search(r'\b\d{13}\b', tr.get_text())
            if not jan_m:
                continue
            jan = jan_m.group(0)
            pid_m = re.search(r'productID=(\d+)', str(tr))
            pid = pid_m.group(1) if pid_m else ''
            is_kikaku = bool(tr.find('img', src=re.compile(r'00167684')) or '企画品' in str(tr))
            is_renewal = bool(tr.find('img', src=re.compile(r'r_icon')) or 'リニューアル' in str(tr))
            jan_meta[jan] = {'productId': pid, 'isKikaku': is_kikaku, 'isRenewal': is_renewal}

    extract_from_soup(BeautifulSoup(html_p1, 'html.parser'))

    # Fetch remaining pages to extract all product IDs for all images
    for p in range(2, total_pages + 1):
        params['pageNo'] = str(p)
        params['searchMode'] = 'false'
        res_p = session.post(f'{BASE_URL}/productCalendar/searchResult.do', data=params)
        extract_from_soup(BeautifulSoup(res_p.content.decode('utf-8', errors='replace'), 'html.parser'))

    # Step 2: Download full CSV
    res_csv = session.post(f'{BASE_URL}/productCalendar/downloadCsv.do', data=params)
    csv_text = res_csv.content.decode('cp932', errors='replace')
    rows = list(csv.DictReader(io.StringIO(csv_text)))

    items = []
    for r in rows:
        jan = r.get('JAN', '').strip()
        if not jan:
            continue
        meta = jan_meta.get(jan, {})

        raw_maker = r.get('メーカー名', '').strip()
        short_maker = get_short_maker_name(raw_maker)
        
        name = r.get('商品名称', '').strip()
        spec = r.get('規格', '').strip()
        prev_jan = r.get('リニューアル前商品JANコード', '').strip()
        prev_name = r.get('リニューアル前商品名称', '').strip()
        prev_spec = r.get('リニューアル前商品規格', '').strip()
        
        # Exclude same JAN renewals
        if (prev_jan or prev_name) and (jan == prev_jan):
            continue
        
        rel_date = format_date_to_yyyymmdd(r.get('発売日', ''))
        
        is_kikaku = meta.get('isKikaku', False) or ('企画' in name) or ('企画' in spec)
        product_id = meta.get('productId', '')
        
        # Image URL (AJD pattern)
        image_url = ''
        if product_id:
            image_url = f"{BASE_URL}/images/product/common/package/{jan}_{product_id}.jpg"
        
        # Price
        price_tax_in = r.get('希望小売価格（税込）', '').strip()
        price_tax_ex = r.get('希望小売価格（税抜）', '').strip()
        price_display = ''
        if price_tax_ex:
            price_display = f"¥{price_tax_ex} (税抜)"
        elif price_tax_in:
            price_display = f"¥{price_tax_in} (税込)"
        else:
            price_display = 'オープン'
            
        # Case packing
        case_pack = r.get('入数/外箱', '').strip() or r.get('入数/梱', '').strip()
        inner_pack = r.get('入数/内箱', '').strip() or r.get('内箱数/外箱', '').strip()
        pack_display = ''
        if case_pack and inner_pack:
            pack_display = f"ケース: {case_pack} / 内箱: {inner_pack}"
        elif case_pack:
            pack_display = f"ケース: {case_pack}"
        elif inner_pack:
            pack_display = f"内箱: {inner_pack}"

        risk = r.get('リスク区分', '').strip() or r.get('法定製品カテゴリー', '').strip()
        is_renewal_item = bool(prev_jan or prev_name or meta.get('isRenewal', False))
        item_type = 'リニューアル品' if is_renewal_item else '新商品'

        item = {
            'id': f"{jan}_{product_id}",
            'genreId': genre['id'],
            'genreName': genre['name'],
            'categoryCode': category['code'],
            'categoryName': category['name'],
            'maker': short_maker,
            'rawMaker': raw_maker,
            'makerSortKey': get_maker_sort_key(short_maker),
            'jan': jan,
            'name': name,
            'spec': spec,
            'fullName': f"{name} {spec}".strip(),
            'itemType': item_type,
            'isKikaku': is_kikaku,
            'releaseDate': rel_date,
            'releaseDateDisplay': format_display_date(rel_date),
            'releaseMonth': rel_date[:6] if len(rel_date) >= 6 else '',
            'prevJan': prev_jan,
            'prevName': prev_name,
            'prevSpec': prev_spec,
            'prevFullName': f"{prev_name} {prev_spec}".strip() if (prev_name or prev_spec) else '',
            'productId': product_id,
            'imageUrl': image_url,
            'price': price_display,
            'casePack': pack_display,
            'risk': risk,
            'features': r.get('特徴', '').strip(),
            'brand': r.get('ブランド名', '').strip(),
            'manufacturer': r.get('製造販売元', '').strip() or r.get('発売元', '').strip()
        }
        items.append(item)

    return items

def fetch_discontinued_data(session, genre, category, start_date=START_DATE, end_date=END_DATE):
    params = {
        'searchMode': 'true',
        'pageNo': '1',
        'orderType': '',
        'firstSearch': 'false',
        'startDateConditionStr': start_date,
        'endDateConditionStr': end_date,
        'replaceStatusCondition': '1', # discontinued
        'categorySearchType': '1',
        'aspHighCategoryCondition': category['code'],
        'aspMiddleCategoryCondition': '-1',
        'aspLowCategoryCondition': '-1',
        'productDivType': '0'
    }
    res_csv = session.post(f'{BASE_URL}/productCalendar/downloadCsv.do', data=params)
    csv_text = res_csv.content.decode('cp932', errors='replace')
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    disc_items = []
    for r in rows:
        jan = r.get('JAN', '').strip()
        if not jan:
            continue
        raw_maker = r.get('メーカー名', '').strip()
        short_maker = get_short_maker_name(raw_maker)
        name = r.get('商品名称', '').strip()
        spec = r.get('規格', '').strip()
        disc_date = format_date_to_yyyymmdd(r.get('処理日（終売品アイコン表示開始日）', ''))

        disc_items.append({
            'genreId': genre['id'],
            'genreName': genre['name'],
            'categoryCode': category['code'],
            'categoryName': category['name'],
            'maker': short_maker,
            'makerSortKey': get_maker_sort_key(short_maker),
            'jan': jan,
            'name': name,
            'spec': spec,
            'fullName': f"{name} {spec}".strip(),
            'discDate': disc_date,
            'discDateDisplay': format_display_date(disc_date)
        })
    return disc_items

import concurrent.futures

def download_product_images(session, products, output_dir='images/products'):
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n商品画像のダウンロード/同期処理を開始します (保存先: {output_dir})...")
    
    download_tasks = []
    seen_jans = set()
    for p in products:
        jan = p.get('jan')
        pid = p.get('productId')
        if jan and pid and jan not in seen_jans:
            seen_jans.add(jan)
            local_rel_path = f"{output_dir}/{jan}.jpg"
            download_tasks.append({
                'jan': jan,
                'pid': pid,
                'local_rel_path': local_rel_path,
                'url': f"{BASE_URL}/images/product/common/package/{jan}_{pid}.jpg"
            })

    # Cache check
    to_download = []
    already_cached = 0
    success_jans = set()
    
    for task in download_tasks:
        local_path = os.path.normpath(task['local_rel_path'])
        if os.path.exists(local_path) and os.path.getsize(local_path) > 500:
            already_cached += 1
            success_jans.add(task['jan'])
        else:
            to_download.append(task)

    print(f"画像対象: {len(download_tasks)} 件 (キャッシュ済み: {already_cached} 件, 新規ダウンロード: {len(to_download)} 件)")

    if to_download:
        completed = 0
        total = len(to_download)

        def fetch_image(task):
            try:
                res = session.get(task['url'], timeout=15)
                if res.status_code == 200 and len(res.content) > 500:
                    content_start = res.content[:20].lower()
                    if b'<!doctype' not in content_start and b'<html' not in content_start:
                        local_path = os.path.normpath(task['local_rel_path'])
                        with open(local_path, 'wb') as f:
                            f.write(res.content)
                        return task['jan'], True
            except Exception:
                pass
            return task['jan'], False

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_task = {executor.submit(fetch_image, task): task for task in to_download}
            for future in concurrent.futures.as_completed(future_to_task):
                jan, ok = future.result()
                if ok:
                    success_jans.add(jan)
                completed += 1
                if completed % 200 == 0 or completed == total:
                    print(f"  画像ダウンロード進捗: {completed}/{total} 完了")

    print(f"画像保存完了: 利用可能画像合計 {len(success_jans)} 件")

    # Update imageUrl to local static path
    for p in products:
        jan = p.get('jan')
        if jan in success_jans:
            p['imageUrl'] = f"images/products/{jan}.jpg"
        else:
            p['imageUrl'] = ""

    return len(success_jans)

def main():
    print("=== AJD-Navi Web カタログ生成処理 開始 (複数期間対応版) ===")
    session = login_ajd()
    print("AJD-navi ログイン成功")

    os.makedirs('data', exist_ok=True)
    updated_at = datetime.now().strftime('%Y/%m/%d %H:%M')

    for p_cfg in PERIODS_CONFIG:
        p_id = p_cfg['id']
        p_start = p_cfg['startDate']
        p_end = p_cfg['endDate']
        p_name = p_cfg['name']
        print(f"\n==========================================")
        print(f"期間処理中: {p_name} ({p_start} 〜 {p_end})")
        print(f"==========================================")

        all_products = []
        all_disc = []

        for genre in GROUPS:
            print(f"\n【ジャンル】{genre['name']}")
            for cat in genre['categories']:
                print(f"  - カテゴリー取得中: {cat['name']} ({cat['code']})...")
                new_items = fetch_category_data(session, genre, cat, start_date=p_start, end_date=p_end)
                disc_items = fetch_discontinued_data(session, genre, cat, start_date=p_start, end_date=p_end)
                print(f"    新商品/リニューアル: {len(new_items)} 件, 終売品: {len(disc_items)} 件")
                all_products.extend(new_items)
                all_disc.extend(disc_items)
                time.sleep(0.3)

        print(f"\n取得合計: カタログ掲載商品 {len(all_products)} 件, 終売品 {len(all_disc)} 件")

        # Download product images to images/products/{JAN}.jpg
        total_with_images = download_product_images(session, all_products)

        # Sort products: Genre -> Maker -> Date -> Category
        all_products.sort(key=lambda x: (
            x['genreId'],
            x['makerSortKey'],
            x['releaseDate'] or '99999999',
            x['categoryCode']
        ))

        # Match discontinued dates to prevJan
        disc_map = {d['jan']: d for d in all_disc if d['jan']}
        for p in all_products:
            if p['prevJan'] and p['prevJan'] in disc_map:
                p['discDate'] = disc_map[p['prevJan']]['discDate']
                p['discDateDisplay'] = disc_map[p['prevJan']]['discDateDisplay']
            else:
                p['discDate'] = ''
                p['discDateDisplay'] = ''

        catalog_json = {
            'periodId': p_id,
            'periodName': p_name,
            'updatedAt': updated_at,
            'totalCount': len(all_products),
            'totalImages': total_with_images,
            'products': all_products,
            'discontinued': all_disc
        }

        # 期間別データ出力
        period_data_path = f"data/catalog_{p_id}.js"
        with open(period_data_path, 'w', encoding='utf-8') as f:
            f.write('window.CATALOG_DATA = ' + json.dumps(catalog_json, ensure_ascii=False, indent=2) + ';')
        print(f"{period_data_path} を出力しました (商品数: {len(all_products)})")

        if p_cfg.get('isDefault'):
            with open('data/catalog_data.js', 'w', encoding='utf-8') as f:
                f.write('window.CATALOG_DATA = ' + json.dumps(catalog_json, ensure_ascii=False, indent=2) + ';')
            print("data/catalog_data.js (デフォルト) を出力しました")

    # 期間マニフェスト出力
    with open('data/periods.js', 'w', encoding='utf-8') as f:
        f.write('window.CATALOG_PERIODS = ' + json.dumps(PERIODS_CONFIG, ensure_ascii=False, indent=2) + ';')
    print("data/periods.js を出力しました")

    print("\n=== 全期間のカタログデータ生成完了 ===")

if __name__ == '__main__':
    main()
