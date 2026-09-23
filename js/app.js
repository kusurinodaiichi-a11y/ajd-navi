/**
 * AJD Navi Web カタログ アプリケーションスクリプト (URLキー認証 ＆ AES暗号化復号対応版)
 */

document.addEventListener('DOMContentLoaded', () => {
  const periods = window.CATALOG_PERIODS || [
    {
      id: '202607-202612',
      name: '2026年 7月〜12月（2026年下期）',
      startDate: '2026/07/01',
      endDate: '2026/12/31',
      badge: '2026/07 〜 2026/12',
      dataFile: 'data/catalog_202607-202612.js',
      isDefault: true
    }
  ];

  // 1. URLパラメータから対象期間とキーを取得
  const urlParams = new URLSearchParams(window.location.search);
  let requestedPeriodId = urlParams.get('period');
  let urlKey = urlParams.get('key');

  let activePeriod = periods.find(p => p.id === requestedPeriodId);
  if (!activePeriod) {
    activePeriod = periods.find(p => p.isDefault) || periods[0];
  }

  // DOM Elements
  const periodBadge = document.getElementById('period-badge');
  const periodFilter = document.getElementById('period-filter');
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
  const btnLock = document.getElementById('btn-lock');

  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const authPasscode = document.getElementById('auth-passcode');
  const authError = document.getElementById('auth-error');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const catalogView = document.getElementById('catalog-view');
  const tableView = document.getElementById('table-view');

  // 対象期間バッジの更新
  if (periodBadge) {
    periodBadge.textContent = `対象期間: ${activePeriod.badge || activePeriod.name}`;
  }

  // 期間選択プルダウンの生成
  if (periodFilter) {
    periodFilter.innerHTML = '';
    periods.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === activePeriod.id) {
        opt.selected = true;
      }
      periodFilter.appendChild(opt);
    });

    periodFilter.addEventListener('change', () => {
      urlParams.set('period', periodFilter.value);
      window.location.search = urlParams.toString();
    });
  }

  // ログアウトボタン
  if (btnLock) {
    btnLock.addEventListener('click', () => {
      localStorage.removeItem('ajd_catalog_key');
      urlParams.delete('key');
      const newQuery = urlParams.toString();
      window.location.search = newQuery ? `?${newQuery}` : '';
    });
  }

  // ローディング表示
  catalogContainer.innerHTML = '<div style="text-align:center; padding: 40px; font-size: 15px; color: #666;">カタログデータを読み込み中...</div>';

  // 2. 暗号化データファイルを動的読み込み
  const scriptUrl = `${activePeriod.dataFile}?v=20260923_4`;
  const scriptTag = document.createElement('script');
  scriptTag.src = scriptUrl;
  scriptTag.onload = () => {
    handleAuthenticationAndInit();
  };
  scriptTag.onerror = () => {
    catalogContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: #d32f2f;">データファイル (${activePeriod.dataFile}) の読み込みに失敗しました。</div>`;
  };
  document.head.appendChild(scriptTag);

  // 3. AES復号化関数
  function decryptData(encryptedB64, key) {
    if (!encryptedB64 || !key) return null;
    try {
      if (typeof CryptoJS === 'undefined') {
        console.error('CryptoJS is not loaded');
        return null;
      }
      const bytes = CryptoJS.AES.decrypt(encryptedB64, key);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText) return null;
      return JSON.parse(decryptedText);
    } catch (e) {
      return null;
    }
  }

  // 4. 認証＆復号化処理フロー
  function handleAuthenticationAndInit() {
    const encryptedData = window.ENCRYPTED_CATALOG_DATA;
    if (!encryptedData) {
      // 暗号化されていないデータの場合の後方互換
      if (window.CATALOG_DATA) {
        initApp(window.CATALOG_DATA);
        return;
      }
      catalogContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #d32f2f;">データが存在しません。</div>';
      return;
    }

    // 鍵の優先順位: 1. URLパラメータ (?key=...) -> 2. LocalStorage
    const candidateKey = urlKey || localStorage.getItem('ajd_catalog_key');

    if (candidateKey) {
      const decrypted = decryptData(encryptedData, candidateKey);
      if (decrypted) {
        // 認証成功
        localStorage.setItem('ajd_catalog_key', candidateKey);
        if (authModal) authModal.style.display = 'none';
        initApp(decrypted);
        return;
      } else {
        // 保存されたキーまたはURLキーが無効
        localStorage.removeItem('ajd_catalog_key');
        showAuthModal(true);
      }
    } else {
      // キーなし
      showAuthModal(false);
    }
  }

  // 認証モーダル表示
  function showAuthModal(isInvalidKey) {
    if (!authModal) return;
    authModal.style.display = 'flex';
    if (authError) {
      if (isInvalidKey) {
        authError.textContent = 'パスコードが正しくありません。再度入力してください。';
        authError.style.display = 'block';
      } else {
        authError.style.display = 'none';
      }
    }
    if (authPasscode) {
      authPasscode.value = '';
      setTimeout(() => authPasscode.focus(), 100);
    }

    // フォーム送信
    authForm.onsubmit = (e) => {
      e.preventDefault();
      const inputVal = authPasscode.value.trim();
      if (!inputVal) return;

      const decrypted = decryptData(window.ENCRYPTED_CATALOG_DATA, inputVal);
      if (decrypted) {
        localStorage.setItem('ajd_catalog_key', inputVal);
        authModal.style.display = 'none';
        initApp(decrypted);
      } else {
        authError.textContent = 'パスコードが正しくありません。';
        authError.style.display = 'block';
        authPasscode.select();
      }
    };
  }

  // 5. アプリ初期化＆レンダリング
  function initApp(data) {
    const products = data.products || [];
    const discontinued = data.discontinued || [];

    // 最終更新日時の表示
    if (data.updatedAt) {
      updateTimestamp.textContent = `最終更新: ${data.updatedAt}`;
    }

    // 発売月プルダウンの動的生成
    if (monthFilter) {
      const months = Array.from(new Set(products.map(p => p.releaseMonth).filter(Boolean))).sort();
      monthFilter.innerHTML = '<option value="all">全期間</option>';
      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        const y = m.slice(0, 4);
        const mm = parseInt(m.slice(4, 6), 10);
        opt.textContent = `${y}年 ${mm}月`;
        monthFilter.appendChild(opt);
      });
    }

    let activeRenderTimeout = null;

    // カタログカード描画
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
      const CHUNK_SIZE = 48;
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
          const ajdBadgeHtml = p.isAjd ? '<span class="badge-ajd">AJD</span>' : '';

          const imgPlaceholder = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22150%22%20height%3D%22150%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999999%22%20dy%3D%22.3em%22%3E%E7%94%BB%E5%83%8F%E6%BA%96%E5%82%99%E4%B8%AD%3C%2Ftext%3E%3C%2Fsvg%3E';

          card.innerHTML = `
            <!-- カード上部ヘッダー -->
            <div class="card-top-header">
              <div class="card-maker" title="${escapeHtml(p.rawMaker)}">${escapeHtml(p.maker)}</div>
              <div class="card-type ${typeClass}">${escapeHtml(p.itemType)}</div>
            </div>

            <!-- 商品名称・規格バー -->
            <div class="card-title-bar">
              <span>${escapeHtml(p.fullName)}${kikakuBadgeHtml}${ajdBadgeHtml}</span>
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
                  <div class="jan-number">${escapeHtml(p.jan)}</div>
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

    // 改廃表（目次）レンダリング
    function renderMokujiTable(items) {
      mokujiTableBody.innerHTML = '';

      let currentGenreId = null;
      let lastMaker = null;

      items.forEach((p) => {
        if (p.genreId !== currentGenreId) {
          currentGenreId = p.genreId;
          const trGenre = document.createElement('tr');
          trGenre.className = 'genre-header-row';
          trGenre.innerHTML = `<td colspan="10">${escapeHtml(p.genreName)}</td>`;
          mokujiTableBody.appendChild(trGenre);
          lastMaker = null;
        }

        if (lastMaker !== null && lastMaker !== p.maker) {
          const trBlank = document.createElement('tr');
          trBlank.className = 'maker-blank-row';
          trBlank.innerHTML = `<td colspan="10"></td>`;
          mokujiTableBody.appendChild(trBlank);
        }
        lastMaker = p.maker;

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

        const ajdBadgeHtml = p.isAjd ? ' <span class="badge-ajd">AJD</span>' : '';

        tr.innerHTML = `
          <td class="col-cat">${escapeHtml(p.categoryName)}</td>
          <td class="col-maker">${escapeHtml(p.maker)}</td>
          <td class="col-jan">${escapeHtml(p.prevJan || '')}</td>
          <td class="col-name">${escapeHtml(p.prevFullName || '')}</td>
          <td class="col-date">${escapeHtml(p.discDateDisplay || '')}</td>
          <td class="col-sep"></td>
          <td class="col-jan">${escapeHtml(p.jan)}</td>
          <td class="col-name"><strong>${escapeHtml(p.fullName)}</strong>${ajdBadgeHtml}</td>
          <td class="col-date">${escapeHtml(p.releaseDateDisplay || '')}</td>
          <td class="col-badge">${badgeHtml}${ajdBadgeHtml}</td>
        `;

        tr.addEventListener('click', () => {
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

    // フィルタリング処理
    function applyFilters() {
      const keyword = searchInput.value.trim().toLowerCase();
      const selectedGroup = groupFilter.value;
      const selectedMonth = monthFilter ? monthFilter.value : 'all';
      const selectedType = typeFilter.value;

      const filtered = products.filter((p) => {
        if (selectedGroup !== 'all' && p.genreId.toString() !== selectedGroup) {
          return false;
        }
        if (selectedMonth !== 'all' && p.releaseMonth !== selectedMonth) {
          return false;
        }
        if (selectedType === '企画品' && !p.isKikaku) return false;
        if (selectedType === '新商品' && (p.itemType !== '新商品' || p.isKikaku)) return false;
        if (selectedType === 'リニューアル品' && p.itemType !== 'リニューアル品') return false;
        if (selectedType === 'AJD' && !p.isAjd) return false;

        if (keyword) {
          const text = `${p.fullName} ${p.maker} ${p.rawMaker} ${p.jan} ${p.prevJan} ${p.categoryName} ${p.features} ${p.isAjd ? 'ajd' : ''}`.toLowerCase();
          if (!text.includes(keyword)) {
            return false;
          }
        }
        return true;
      });

      renderCatalog(filtered);
      renderMokujiTable(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      applyFilters();
    });
    groupFilter.addEventListener('change', applyFilters);
    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
    typeFilter.addEventListener('change', applyFilters);

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

    function escapeHtml(str) {
      if (!str) return '';
      return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // 初回表示
    applyFilters();
  }
});
