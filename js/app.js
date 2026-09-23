/**
 * AJD Navi Web カタログ アプリケーションスクリプト
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = window.CATALOG_DATA || { products: [], discontinued: [], updatedAt: '' };
  const products = data.products || [];
  const discontinued = data.discontinued || [];

  // DOM Elements
  const catalogContainer = document.getElementById('catalog-container');
  const mokujiTableBody = document.getElementById('mokuji-table-body');
  const countDisplay = document.getElementById('count-display');
  const updateTimestamp = document.getElementById('update-timestamp');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const groupFilter = document.getElementById('group-filter');
  const monthFilter = document.getElementById('month-filter');
  const typeFilter = document.getElementById('type-filter');
  const noResults = document.getElementById('no-results');
  const btnBackToTop = document.getElementById('btn-back-to-top');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const catalogView = document.getElementById('catalog-view');
  const tableView = document.getElementById('table-view');

  // Set timestamp
  if (data.updatedAt) {
    updateTimestamp.textContent = `最終更新: ${data.updatedAt}`;
  }

  // 1. レンダリング関数 (段階的レンダリングで2,700件超でも超高速)
  let activeRenderTimeout = null;

  function renderCatalog(items) {
    if (activeRenderTimeout) {
      clearTimeout(activeRenderTimeout);
    }
    catalogContainer.innerHTML = '';
    
    if (items.length === 0) {
      noResults.style.display = 'block';
      countDisplay.textContent = '0';
      return;
    }

    noResults.style.display = 'none';
    countDisplay.textContent = items.length;

    let currentGenreId = null;
    const CHUNK_SIZE = 48; // 初期48件を一瞬で表示し、残りをバックグラウンドで段階的に追加
    let currentIndex = 0;

    function renderChunk() {
      const fragment = document.createDocumentFragment();
      const endIndex = Math.min(currentIndex + CHUNK_SIZE, items.length);

      for (let i = currentIndex; i < endIndex; i++) {
        const p = items[i];

        // ジャンル見出しの挿入
        if (p.genreId !== currentGenreId) {
          currentGenreId = p.genreId;
          const divider = document.createElement('div');
          divider.className = 'genre-divider';
          divider.textContent = p.genreName;
          fragment.appendChild(divider);
        }

        // カード要素の作成
        const card = document.createElement('div');
        card.className = 'product-card';
        card.id = `card-${p.jan}`;

        const typeClass = p.itemType === 'リニューアル品' ? 'renewal' : '';
        const kikakuBadgeHtml = p.isKikaku ? '<span class="badge-kikaku" style="margin-left: 6px;">企画品</span>' : '';

        // 代替画像
        const imgPlaceholder = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22150%22%20height%3D%22150%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999999%22%20dy%3D%22.3em%22%3E%E7%94%BB%E5%83%8F%E6%BA%96%E5%82%99%E4%B8%AD%3C%2Ftext%3E%3C%2Fsvg%3E';

        card.innerHTML = `
          <!-- カード上部ヘッダー -->
          <div class="card-top-header">
            <div class="card-maker" title="${escapeHtml(p.rawMaker)}">${escapeHtml(p.maker)}</div>
            <div class="card-type ${typeClass}">${escapeHtml(p.itemType)}</div>
          </div>

          <!-- 商品名称・規格バー -->
          <div class="card-title-bar">
            <span>${escapeHtml(p.fullName)}${kikakuBadgeHtml}</span>
          </div>

          <!-- カテゴリー ＆ 発売日行 -->
          <div class="card-info-row">
            <div class="info-category">${escapeHtml(p.categoryName)}</div>
            <div class="info-date-label">発売予定日</div>
            <div class="info-date-val">${escapeHtml(p.releaseDateDisplay || '-')}</div>
          </div>

          <!-- カード本体（画像 ＋ スペック） -->
          <div class="card-body">
            <!-- 左側画像 -->
            <div class="card-image-box">
              ${p.risk ? `<span class="risk-tag">${escapeHtml(p.risk)}</span>` : ''}
              <img class="card-img" 
                   src="${p.imageUrl || imgPlaceholder}" 
                   alt="${escapeHtml(p.name)}" 
                   loading="lazy"
                   referrerpolicy="no-referrer"
                   onerror="this.onerror=null;this.src='${imgPlaceholder}';">
            </div>

            <!-- 右側スペック表 -->
            <div class="card-specs">
              <!-- バーコード -->
              <div class="barcode-box">
                <svg class="barcode-svg" data-jan="${p.jan}"></svg>
                <div class="jan-number">${formatJanNumber(p.jan)}</div>
              </div>

              <!-- スペック表 -->
              <table class="spec-table">
                <tr>
                  <th>旧JAN</th>
                  <td>${escapeHtml(p.prevJan || '-')}</td>
                </tr>
                <tr>
                  <th>旧商品名</th>
                  <td style="font-size: 9.5px;">${escapeHtml(p.prevFullName || '-')}</td>
                </tr>
                <tr>
                  <th>希望小売価格</th>
                  <td>${escapeHtml(p.price || 'オープン')}</td>
                </tr>
                <tr>
                  <th>入数</th>
                  <td>${escapeHtml(p.casePack || '-')}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- カード下部 特徴文 -->
          <div class="card-features" title="${escapeHtml(p.features)}">
            ${escapeHtml(p.features || '※特徴情報の登録はありません。')}
          </div>
        `;

        fragment.appendChild(card);
      }

      catalogContainer.appendChild(fragment);

      // バーコード描画
      if (typeof JsBarcode !== 'undefined') {
        catalogContainer.querySelectorAll(`.barcode-svg:not([data-rendered])`).forEach((svg) => {
          const jan = svg.getAttribute('data-jan');
          svg.setAttribute('data-rendered', 'true');
          if (jan && (jan.length === 13 || jan.length === 8)) {
            try {
              JsBarcode(svg, jan, {
                format: jan.length === 13 ? 'EAN13' : 'EAN8',
                displayValue: false,
                margin: 0,
                height: 28
              });
            } catch (e) {
              svg.style.display = 'none';
            }
          } else {
            svg.style.display = 'none';
          }
        });
      }

      currentIndex = endIndex;
      if (currentIndex < items.length) {
        activeRenderTimeout = setTimeout(renderChunk, 16);
      }
    }

    renderChunk();
  }

  // 2. 改廃表（目次）レンダリング関数
  function renderMokujiTable(items) {
    mokujiTableBody.innerHTML = '';

    let currentGenreId = null;
    let lastMaker = null;

    items.forEach((p) => {
      // ジャンル見出し行
      if (p.genreId !== currentGenreId) {
        currentGenreId = p.genreId;
        const trGenre = document.createElement('tr');
        trGenre.className = 'genre-header-row';
        trGenre.innerHTML = `<td colspan="10">${escapeHtml(p.genreName)}</td>`;
        mokujiTableBody.appendChild(trGenre);
        lastMaker = null;
      }

      // メーカー区切り空行
      if (lastMaker !== null && lastMaker !== p.maker) {
        const trBlank = document.createElement('tr');
        trBlank.className = 'maker-blank-row';
        trBlank.innerHTML = `<td colspan="10"></td>`;
        mokujiTableBody.appendChild(trBlank);
      }
      lastMaker = p.maker;

      // データ行
      const tr = document.createElement('tr');
      tr.className = 'item-row';
      tr.setAttribute('data-target-jan', p.jan);

      let badgeHtml = '';
      if (p.isKikaku) {
        badgeHtml = '<span class="badge-kikaku">企画品</span>';
      } else if (p.itemType === 'リニューアル品') {
        badgeHtml = '<span class="badge-renewal">リニューアル</span>';
      } else {
        badgeHtml = '<span class="badge-new">新商品</span>';
      }

      tr.innerHTML = `
        <td class="col-cat">${escapeHtml(p.categoryName)}</td>
        <td class="col-maker">${escapeHtml(p.maker)}</td>
        <td class="col-jan">${escapeHtml(p.prevJan || '')}</td>
        <td class="col-name">${escapeHtml(p.prevFullName || '')}</td>
        <td class="col-date">${escapeHtml(p.discDateDisplay || '')}</td>
        <td class="col-sep"></td>
        <td class="col-jan">${escapeHtml(p.jan)}</td>
        <td class="col-name"><strong>${escapeHtml(p.fullName)}</strong></td>
        <td class="col-date">${escapeHtml(p.releaseDateDisplay || '')}</td>
        <td class="col-badge">${badgeHtml}</td>
      `;

      // 目次行クリックで該当カードへジャンプ
      tr.addEventListener('click', () => {
        // 画像カタログビューに切り替え
        switchView('catalog');
        
        setTimeout(() => {
          const targetCard = document.getElementById(`card-${p.jan}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.style.outline = '3px solid #e53935';
            targetCard.style.boxShadow = '0 0 20px rgba(229, 57, 53, 0.5)';
            setTimeout(() => {
              targetCard.style.outline = '';
              targetCard.style.boxShadow = '';
            }, 2000);
          }
        }, 100);
      });

      mokujiTableBody.appendChild(tr);
    });
  }

  // 3. フィルタリング＆更新処理
  function applyFilters() {
    const keyword = searchInput.value.trim().toLowerCase();
    const selectedGroup = groupFilter.value;
    const selectedMonth = monthFilter.value;
    const selectedType = typeFilter.value;

    const filtered = products.filter((p) => {
      // 1. グループ
      if (selectedGroup !== 'all' && p.genreId.toString() !== selectedGroup) {
        return false;
      }

      // 2. 発売月
      if (selectedMonth !== 'all' && p.releaseMonth !== selectedMonth) {
        return false;
      }

      // 3. 種別
      if (selectedType === '企画品' && !p.isKikaku) return false;
      if (selectedType === '新商品' && (p.itemType !== '新商品' || p.isKikaku)) return false;
      if (selectedType === 'リニューアル品' && p.itemType !== 'リニューアル品') return false;

      // 4. キーワード検索 (商品名, メーカー, JAN, カテゴリー, 特徴)
      if (keyword) {
        const text = `${p.fullName} ${p.maker} ${p.rawMaker} ${p.jan} ${p.prevJan} ${p.categoryName} ${p.features}`.toLowerCase();
        if (!text.includes(keyword)) {
          return false;
        }
      }

      return true;
    });

    renderCatalog(filtered);
    renderMokujiTable(filtered);
  }

  // 4. イベントリスナー設定
  searchInput.addEventListener('input', applyFilters);
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    applyFilters();
  });
  groupFilter.addEventListener('change', applyFilters);
  monthFilter.addEventListener('change', applyFilters);
  typeFilter.addEventListener('change', applyFilters);

  // タブ切替
  function switchView(viewName) {
    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (viewName === 'catalog') {
      catalogView.style.display = 'block';
      tableView.style.display = 'none';
    } else {
      catalogView.style.display = 'none';
      tableView.style.display = 'block';
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.getAttribute('data-view'));
    });
  });

  // TOPへ戻るボタン
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btnBackToTop.classList.add('visible');
    } else {
      btnBackToTop.classList.remove('visible');
    }
  });

  btnBackToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ヘルパー関数
  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatJanNumber(jan) {
    if (!jan) return '';
    if (jan.length === 13) {
      return `${jan[0]} ${jan.slice(1, 7)} ${jan.slice(7)}`;
    }
    return jan;
  }

  // 初回レンダリング
  applyFilters();
});
