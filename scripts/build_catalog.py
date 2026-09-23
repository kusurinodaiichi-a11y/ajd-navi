#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AJD Navi 新商品・リニューアル品 カタログ生成スクリプト
"""

import os
import sys
import re
import csv
import io
import json
import time
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
LOGIN_ID = 'qbaa0001'
LOGIN_PASS = '7812'
START_DATE = '2026/07/01'
END_DATE = '2026/12/31'

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
    m = re.match(r'^(?:(\d{2,4})/)?(\d{1,2})/(\d{1,2}|--)$', date_str)
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
    text = res_login.content.decode('cp932', errors='replace')
    if '/forseLogon.do' in text or 'force' in text:
        session.post(f'{BASE_URL}/forseLogon.do', data={'force': '1', 'username': LOGIN_ID, 'password': LOGIN_PASS})
    return session

def fetch_category_data(session, genre, category):
    params = {
        'searchMode': 'true',
        'pageNo': '1',
        'orderType': '',
        'firstSearch': 'false',
        'startDateConditionStr': START_DATE,
        'endDateConditionStr': END_DATE,
        'replaceStatusCondition': '0', # new & renewal
        'categorySearchType': '1',
        'aspHighCategoryCondition': category['code'],
        'aspMiddleCategoryCondition': '-1',
        'aspLowCategoryCondition': '-1',
        'productDivType': '0',
        'newProductCondition': 'on',
        'renewalProductCondition': 'on'
    }

    # 1. searchResult.do for productIDs and Kikaku icons
    res_search = session.post(f'{BASE_URL}/productCalendar/searchResult.do', data=params)
    search_html = res_search.content.decode('cp932', errors='replace')
    soup = BeautifulSoup(search_html, 'html.parser')

    # Extract productID & Kikaku icon for each JAN
    jan_meta = {} # jan -> {'productId': '', 'isKikaku': bool, 'isRenewal': bool}
    table = soup.find('table')
    if table:
        for tr in table.find_all('tr'):
            tds = tr.find_all('td')
            if not tds:
                continue
            jan_match = re.search(r'\b\d{13}\b', tr.get_text())
            if not jan_match:
                continue
            jan = jan_match.group(0)

            # Find product ID in link
            pid_match = re.search(r'productID=(\d+)', str(tr))
            pid = pid_match.group(1) if pid_match else ''

            is_kikaku = bool(tr.find('img', src=re.compile(r'00167684')) or '企画品' in str(tr))
            is_renewal = bool(tr.find('img', src=re.compile(r'r_icon')) or 'リニューアル' in str(tr))

            jan_meta[jan] = {
                'productId': pid,
                'isKikaku': is_kikaku,
                'isRenewal': is_renewal
            }

    # 2. download CSV
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
        
        # Determine image URL
        # AJD image pattern: https://www.ajd-navi.jp/images/product/common/package/{JAN}_{productId}.jpg
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

        # Risk classification / legal category
        risk = r.get('リスク区分', '').strip() or r.get('法定製品カテゴリー', '').strip()

        # Classification (新商品 / リニューアル品)
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

def fetch_discontinued_data(session, genre, category):
    params = {
        'searchMode': 'true',
        'pageNo': '1',
        'orderType': '',
        'firstSearch': 'false',
        'startDateConditionStr': START_DATE,
        'endDateConditionStr': END_DATE,
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

def main():
    print("=== AJD-Navi Web カタログ生成処理 開始 ===")
    session = login_ajd()
    print("AJD-navi ログイン成功")

    all_products = []
    all_disc = []

    for genre in GROUPS:
        print(f"\n【ジャンル】{genre['name']}")
        for cat in genre['categories']:
            print(f"  - カテゴリー取得中: {cat['name']} ({cat['code']})...")
            new_items = fetch_category_data(session, genre, cat)
            disc_items = fetch_discontinued_data(session, genre, cat)
            print(f"    新商品/リニューアル: {len(new_items)} 件, 終売品: {len(disc_items)} 件")
            all_products.extend(new_items)
            all_disc.extend(disc_items)
            time.sleep(0.5)

    print(f"\n取得合計: カタログ掲載商品 {len(all_products)} 件, 終売品 {len(all_disc)} 件")

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

    # Save to data/catalog_data.js for instant client-side loading
    os.makedirs('data', exist_ok=True)
    
    updated_at = datetime.now().strftime('%Y/%m/%d %H:%M')
    catalog_json = {
        'updatedAt': updated_at,
        'totalCount': len(all_products),
        'products': all_products,
        'discontinued': all_disc
    }

    with open('data/catalog_data.js', 'w', encoding='utf-8') as f:
        f.write('window.CATALOG_DATA = ' + json.dumps(catalog_json, ensure_ascii=False, indent=2) + ';')

    print(f"data/catalog_data.js を出力しました (更新日時: {updated_at})")
    print("=== カタログデータ生成完了 ===")

if __name__ == '__main__':
    main()
