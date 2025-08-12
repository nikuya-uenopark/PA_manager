// PA評価管理システム - メインJavaScript

class PAManager {
    constructor() {
        this.currentStaff = [];
        this.currentCriteria = [];
        this.currentTab = 'staff';
    this.editingCriteriaId = null;
    this._chart = null;
    this._staffEvalCache = new Map(); // key: `${staffId}:${criteriaId}` -> status
    this.criteriaFilter = '';
    this.editingStaffId = null;
    this._savingEvals = new Set(); // `${staffId}:${criteriaId}` while saving
    this._isSavingStaff = false;
    this._isSavingCriteria = false;
        
        this.init();
    }

    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    // 初期セットアップ
    setup() {
        this.setupEventListeners();
        this.loadData();
    }

    // イベント登録
    setupEventListeners() {
        // モーダル背景クリックで閉じる
        window.addEventListener('click', (e) => {
            const t = e.target;
            if (t && t.classList && t.classList.contains('modal')) {
                this.closeModal(t.id);
            }
        });

        // スタッフ追加/更新フォーム
        const staffForm = document.getElementById('staffForm');
        if (staffForm) {
            staffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('staffName')?.value?.trim();
                const kana = document.getElementById('staffKana')?.value?.trim() || null;
                const position = document.getElementById('staffPositionType')?.value || null;
                const birth_date = document.getElementById('staffBirthDate')?.value || null;
                if (!name) {
                    this.showNotification('名前は必須です', 'error');
                    return;
                }
                if (this._isSavingStaff) return;
                this._isSavingStaff = true;
                const submitBtn = staffForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                try {
                    const isEdit = !!this.editingStaffId;
                    const url = isEdit ? `/api/staff?id=${this.editingStaffId}` : '/api/staff';
                    const method = isEdit ? 'PUT' : 'POST';
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, kana, position, birth_date })
                    });
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    this.showNotification(isEdit ? 'スタッフを更新しました' : 'スタッフを追加しました');
                    if (!isEdit) {
                        try {
                            await fetch('/api/logs', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ event: 'staff:create', message: `新規スタッフ追加 名前:${name} 役職:${position || '-'} 生年月日:${birth_date || '-'}` })
                            });
                        } catch {}
                    }
                    this.closeModal('staffModal');
                    staffForm.reset();
                    this.editingStaffId = null;
                    await this.loadStaff();
                    await this.loadStaffProgress();
                    await this.loadLogs();
                    this.updateStats();
                } catch (err) {
                    console.error('スタッフ保存エラー:', err);
                    this.showNotification('スタッフの保存に失敗しました', 'error');
                } finally {
                    this._isSavingStaff = false;
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        // 評価項目追加/更新フォーム
        const criteriaForm = document.getElementById('criteriaForm');
        if (criteriaForm) {
            criteriaForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('criteriaName')?.value?.trim();
                const category = document.getElementById('criteriaCategory')?.value || '共通';
                let description = document.getElementById('criteriaDescription')?.value || null;
                if (description) {
                    // 常時自動整形: 行ごとに - を付与し <br> 連結
                    const lines = description.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
                    if (lines.length) description = lines.map(l => l.startsWith('-') ? l : `- ${l}`).join('<br>');
                }
                if (!name) {
                    this.showNotification('項目名は必須です', 'error');
                    return;
                }
                if (this._isSavingCriteria) return;
                this._isSavingCriteria = true;
                const submitBtn = criteriaForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                try {
                    const isEdit = !!this.editingCriteriaId;
                    const url = isEdit ? `/api/criteria?id=${this.editingCriteriaId}` : '/api/criteria';
                    const method = isEdit ? 'PUT' : 'POST';
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, category, description })
                    });
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    this.showNotification(isEdit ? '評価項目を更新しました' : '評価項目を追加しました');
                    this.closeModal('criteriaModal');
                    criteriaForm.reset();
                    this.editingCriteriaId = null;
                    await this.loadCriteria();
                    await this.loadLogs();
                    this.updateStats();
                } catch (err) {
                    console.error('評価項目保存エラー:', err);
                    this.showNotification('評価項目の保存に失敗しました', 'error');
                } finally {
                    this._isSavingCriteria = false;
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
    // (チェックボックス廃止) 常時自動整形のため追加イベント不要

        // カテゴリ絞り込み
        const filter = document.getElementById('criteriaCategoryFilter');
        if (filter) {
            filter.addEventListener('change', () => {
                this.criteriaFilter = filter.value || '';
                this.renderCriteria();
            });
        }
    }

    showNotification(message, type = 'success') {
        const el = document.getElementById('notification');
        if (!el) return;
        el.textContent = message;
        el.className = 'notification';
        void el.offsetWidth; // reflow to restart animation
        if (type === 'error') el.classList.add('error');
        else if (type === 'warning') el.classList.add('warning');
        el.classList.add('show');
        el.style.display = 'block';
        clearTimeout(this._notifyTimer);
        this._notifyTimer = setTimeout(()=>{
            el.classList.remove('show');
            setTimeout(()=>{ if(!el.classList.contains('show')) el.style.display='none'; }, 500);
        }, 2000); // 約2秒表示
    }

    async _autoSaveStaffEvaluations() {
        try {
            const hasStatus = this._pendingEvalChanges && this._pendingEvalChanges.size > 0;
            const hasTester = this._pendingEvalTests && this._pendingEvalTests.size > 0;
            if (!hasStatus && !hasTester) return; // 変更なし
            const overlay = document.getElementById('savingOverlay');
            if (overlay) overlay.style.display = 'flex';
            const changedById = (document.getElementById('evaluationChangedBy')?.value) ? Number(document.getElementById('evaluationChangedBy').value) : null;
            const keys = new Set();
            if (hasStatus) for (const k of this._pendingEvalChanges.keys()) keys.add(k);
            if (hasTester) for (const k of this._pendingEvalTests.keys()) keys.add(k);
            const payload = Array.from(keys).map(key => {
                const [sid, cid] = key.split(':').map(Number);
                const status = this._pendingEvalChanges ? this._pendingEvalChanges.get(key) : undefined;
                const test = this._pendingEvalTests ? this._pendingEvalTests.get(key) : undefined;
                return { staffId: sid, criteriaId: cid, status, test };
            });
            const res = await fetch('/api/evaluations-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes: payload, changedBy: changedById })
            });
            if (!res.ok) throw new Error('auto batch failed');
            this._pendingEvalChanges.clear();
            if (this._pendingEvalTests) this._pendingEvalTests.clear();
            await this.loadLogs();
            await this.loadStaffProgress();
            this.showNotification('評価を自動保存しました');
        } catch (e) {
            console.error('自動保存エラー', e);
            this.showNotification('評価の自動保存に失敗', 'error');
        } finally {
            const overlay = document.getElementById('savingOverlay');
            if (overlay) overlay.style.display = 'none';
        }
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadStaff(),
                this.loadCriteria(),
                this.loadLogs()
            ]);
            await this.loadStaffProgress();
            this.updateStats();
        } catch (error) {
            console.error('データ読み込みエラー:', error);
        } finally {
            this.hideLoadingScreen();
        }
    }

    hideLoadingScreen() {
        const ls = document.getElementById('loadingScreen');
        if (!ls) return;
        // フェードアウト
        ls.style.opacity = '0';
        setTimeout(() => {
            ls.style.display = 'none';
        }, 400);
    }

    async loadStaff() {
        try {
            const response = await fetch('/api/staff');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.currentStaff = await response.json();
            this.renderStaff();
        } catch (error) {
            console.error('スタッフデータ読み込みエラー:', error);
            // ユーザーに通知
            this.showNotification('スタッフデータの読み込みに失敗しました', 'error');
        }
    }

    async loadStaffProgress() {
        try {
            const res = await fetch('/api/staff-progress');
            if (!res.ok) return;
            const list = await res.json();
            this._progressMap = new Map(list.map(x => [x.staffId, x]));
            this.renderStaff();
        } catch (e) {
            console.error('進捗読み込みエラー:', e);
        }
    }

    async loadCriteria() {
        try {
            const response = await fetch('/api/criteria');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.length === 0) {
                this.showNotification('No criteria data available', 'info');
            } else {
                this.currentCriteria = data;
                this.renderCriteria();
            }
        } catch (error) {
            console.error('Criteria data load error:', error);
            this.showNotification('Failed to load criteria data', 'error');
        }
    }

    renderStaff() {
        const container = document.getElementById('staffGrid');
        if (!container) return;

        if (this.currentStaff.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users" style="font-size: 4rem; color: var(--light-color); margin-bottom: 20px;"></i>
                    <h3>まだスタッフが登録されていません</h3>
                    <p>「新規スタッフ追加」ボタンから最初のスタッフを追加してください</p>
                </div>
            `;
            return;
        }

    container.innerHTML = this.currentStaff.map(staff => {
            const prog = this._progressMap?.get(staff.id) || { progressPercent: 0, counts: { done: 0, learning: 0, notStarted: (this.currentCriteria?.length || 0) } };
            const p = prog.progressPercent || 0;
            const counts = prog.counts || { done: 0, learning: 0, notStarted: 0 };
            return `
                <div class="staff-card">
                    <div class="staff-header" onclick="showStaffDetail(${staff.id})">
                        <div class="staff-info">
                            <div style="color:#6b7280; font-size:12px;">${staff.kana || ''}</div>
                            <h3>${staff.name}</h3>
                            <span class="position-badge">${staff.position || '未設定'}</span>
                        </div>
                        <div class="staff-card-actions">
                            <button class="btn btn-secondary btn-icon" title="編集" onclick="event.stopPropagation(); editStaff(${staff.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-icon" title="削除" onclick="event.stopPropagation(); deleteStaff(${staff.id})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="staff-progress">
                        <div class="progress-label">
                            <span>進捗状況</span>
                            <span class="progress-percent">${p}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${p}%"></div>
                        </div>
                    </div>
                    <div class="staff-stats">
                        <div class="stat-item-small">
                            <span class="stat-value-small">${counts.notStarted}</span>
                            <span class="stat-label-small">未着手</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${counts.learning}</span>
                            <span class="stat-label-small">学習中</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${counts.done}</span>
                            <span class="stat-label-small">習得済み</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${prog.tested ?? 0}</span>
                            <span class="stat-label-small">テスト完了</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderCriteria() {
        const container = document.getElementById('criteriaGrid');
        if (!container) return;

        // フィルタ適用 + 名前順
        const filtered = (this.currentCriteria || [])
            .filter(c => !this.criteriaFilter || (c.category || '') === this.criteriaFilter)
            .sort((a,b) => (a.name||'').localeCompare(b.name||''));

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list-check" style="font-size: 4rem; color: var(--light-color); margin-bottom: 20px;"></i>
                    <h3>表示できる評価項目がありません</h3>
                    <p>右上のフィルタや「項目追加」をご利用ください</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(criteria => `
            <div class="criteria-card" data-id="${criteria.id}">
                <div class="criteria-header">
                    <div>
                        <div class="criteria-title">${criteria.name}</div>
                        <span class="criteria-category">${criteria.category || '共通'}</span>
                    </div>
                    <div class="criteria-actions">
                        <button class="btn btn-secondary" onclick="editCriteria(${criteria.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger" onclick="deleteCriteria(${criteria.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${criteria.description ? `<div class="criteria-description">${criteria.description}</div>` : ''}
            </div>
        `).join('');
    }

    // ドラッグ操作は廃止（no-op）
    setupSortable() {}

    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(tabName + 'Tab').classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(tabName + 'Panel').classList.add('active');

        this.currentTab = tabName;

        if (tabName === 'analytics') {
            // ログのみ更新（グラフ廃止）
            this.loadLogs();
        }
    }
    // renderAnalytics 削除（円グラフ機能廃止）

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.style.display = 'none';
        document.body.style.overflow = 'auto';
        if (modalId === 'criteriaModal') {
            this.editingCriteriaId = null;
        }
        if (modalId === 'staffDetailModal') {
            this._autoSaveStaffEvaluations();
        }
    }

    updateStats() {
        const totalStaffElement = document.getElementById('totalStaff');
        const totalCriteriaElement = document.getElementById('totalCriteria');
        const avgProgressElement = document.getElementById('avgProgress');
        
        if (totalStaffElement) totalStaffElement.textContent = this.currentStaff.length;
        if (totalCriteriaElement) totalCriteriaElement.textContent = this.currentCriteria.length;
        if (avgProgressElement) avgProgressElement.textContent = Math.floor(Math.random() * 100) + '%';
    }

    async loadLogs() {
        try {
            const res = await fetch('/api/logs?limit=199');
            if (!res.ok) return;
            let logs = await res.json();
            // 念のため防御的に最大199件に丸める
            if (Array.isArray(logs) && logs.length > 199) {
                logs = logs.slice(0, 199);
            }
            const box = document.getElementById('activityLogs');
            if (!box) return;
            if (!logs || logs.length === 0) {
                box.innerHTML = '<div class="empty-state">まだログはありません</div>';
                return;
            }
            box.innerHTML = logs.map(l => {
                const t = new Date(l.createdAt).toLocaleString();
                return `<div class="log-item"><div class="log-time">${t}</div><div class="log-message">${l.message}</div></div>`;
            }).join('');
        } catch (e) {
            console.error('ログ取得エラー', e);
        }
    }

    // 旧: カテゴリ順並び替えは廃止
}

// グローバル変数とインスタンス
let paManager;

// 初期化
paManager = new PAManager();

// ---- iOSなどでのダブルタップズーム抑止 ----
let _lastTouchEnd = 0;
document.addEventListener('touchend', function(e){
    const now = Date.now();
    if (now - _lastTouchEnd <= 350) {
        e.preventDefault();
    }
    _lastTouchEnd = now;
}, { passive:false });
// ピンチズーム無効化
document.addEventListener('gesturestart', function(e){ e.preventDefault(); }, { passive:false });

// グローバル関数
function switchTab(tabName) {
    paManager.switchTab(tabName);
}

function showAddStaffModal() {
    // 追加モードに初期化
    paManager.editingStaffId = null;
    const title = document.getElementById('staffModalTitle');
    if (title) title.textContent = '新しいスタッフを追加';
    const form = document.getElementById('staffForm');
    if (form) form.reset();
    document.getElementById('staffPositionType').value = 'バイト';
    paManager.showModal('staffModal');
}

function showAddCriteriaModal() {
    // 追加モード: 前回の編集状態をリセット
    paManager.editingCriteriaId = null;
    const title = document.getElementById('criteriaModalTitle');
    if (title) title.textContent = '新しい評価項目を追加';
    const nameEl = document.getElementById('criteriaName');
    if (nameEl) nameEl.value = '';
    const catEl = document.getElementById('criteriaCategory');
    if (catEl) catEl.value = '共通';
    const descEl = document.getElementById('criteriaDescription');
    if (descEl) descEl.value = '';
    paManager.showModal('criteriaModal');
}

function closeModal(modalId) {
    paManager.closeModal(modalId);
}

function showStaffDetail(staffId) {
    paManager.openStaffDetail(staffId);
}

function editCriteria(criteriaId) {
    paManager.beginEditCriteria(criteriaId);
}

function deleteCriteria(criteriaId) {
    if (confirm('この評価項目を削除しますか？')) {
    paManager.deleteCriteria(criteriaId);
    }
}

function sortCriteriaByCategory() {
    paManager.sortCriteriaByCategory();
}

// 追加メソッド群
PAManager.prototype.beginEditCriteria = function (criteriaId) {
    const item = this.currentCriteria.find(c => c.id === criteriaId);
    if (!item) return;
    this.editingCriteriaId = criteriaId;
    document.getElementById('criteriaModalTitle').textContent = '評価項目を編集';
    document.getElementById('criteriaName').value = item.name || '';
    document.getElementById('criteriaCategory').value = item.category || '共通';
    // description に <br> を含む場合は改行に戻し、先頭の "- " は表示上そのまま
    const descEl = document.getElementById('criteriaDescription');
    if (descEl) {
        if (item.description) {
            // <br> を改行へ置換してテキストエリアに表示
            const restored = item.description.replace(/<br\s*\/?>/gi, '\n');
            descEl.value = restored;
        } else {
            descEl.value = '';
        }
    }
    this.showModal('criteriaModal');
}

// スタッフ編集（簡易: モーダルは既存の追加フォームを流用するなら別実装。ここでは名前だけの例）
function editStaff(id) {
    const s = paManager.currentStaff.find(x => x.id === id);
    if (!s) return;
    paManager.editingStaffId = id;
    document.getElementById('staffModalTitle').textContent = 'スタッフを編集';
    document.getElementById('staffName').value = s.name || '';
    document.getElementById('staffKana').value = s.kana || '';
    document.getElementById('staffPositionType').value = s.position || 'バイト';
    // birth_date: APIは birthDate(DB側), クライアントは birth_date(YYYY-MM-DD)
    const bd = s.birth_date || (s.birthDate ? new Date(s.birthDate) : null);
    if (bd) {
        const d = new Date(bd);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const dd = String(d.getDate()).padStart(2,'0');
        document.getElementById('staffBirthDate').value = `${yyyy}-${mm}-${dd}`;
    } else {
        document.getElementById('staffBirthDate').value = '';
    }
    paManager.showModal('staffModal');
}

function deleteStaff(id) {
    if (!confirm('このスタッフを削除しますか？')) return;
    fetch(`/api/staff?id=${id}`, { method: 'DELETE' }).then(r=>{
        if (!r.ok) throw new Error('delete failed');
        return r.json();
    }).then(async ()=>{
        paManager.showNotification('スタッフを削除しました');
        await paManager.loadStaff();
        await paManager.loadStaffProgress();
        await paManager.loadLogs();
    }).catch(e=>{
        console.error(e);
        paManager.showNotification('削除に失敗しました', 'error');
    });
}

PAManager.prototype.deleteCriteria = async function (criteriaId) {
    try {
        const res = await fetch(`/api/criteria?id=${criteriaId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        this.showNotification('評価項目を削除しました');
        await this.loadCriteria();
        await this.loadLogs();
        this.updateStats();
    } catch (e) {
        console.error('評価項目削除エラー:', e);
        this.showNotification('評価項目の削除に失敗しました', 'error');
    }
}

PAManager.prototype.openStaffDetail = async function (staffId) {
    const staff = this.currentStaff.find(s => s.id === staffId);
    if (!staff) return;
    // ヘッダ情報
    document.getElementById('staffDetailName').textContent = staff.name;
    document.getElementById('staffDetailPosition').textContent = staff.position || '未設定';
    document.getElementById('staffDetailKana').textContent = staff.kana || '';
    document.getElementById('staffDetailBirth').textContent = staff.birth_date || (staff.birthDate ? new Date(staff.birthDate).toLocaleDateString() : '-');

    // 変更者セレクトを初期化（全スタッフから選択）
    const changer = document.getElementById('evaluationChangedBy');
    if (changer) {
        const options = (this.currentStaff || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        changer.innerHTML = `<option value="">未選択</option>` + options;
        changer.value = String(staffId);
    }

    // 評価一覧
    await this.renderStaffEvaluations(staffId);
    // モーダル閉じる時に一括保存するためフラグ
    this._activeStaffDetailId = staffId;
    this.showModal('staffDetailModal');
}

PAManager.prototype.renderStaffEvaluations = async function (staffId) {
    const container = document.getElementById('staffEvaluations');
    if (!container) return;
    container.innerHTML = '<div class="loading">読み込み中...</div>';

    try {
        // 既存評価の取得
        const res = await fetch(`/api/evaluations?staffId=${staffId}`);
        const evals = res.ok ? await res.json() : [];
        this._staffEvalCache.clear();
        if (!this._staffEvalTestCache) this._staffEvalTestCache = new Map();
        this._staffEvalTestCache.clear();
        for (const ev of evals) {
            this._staffEvalCache.set(`${ev.staffId}:${ev.criteriaId}`,(ev.status||'not-started'));
            if (ev.comments) {
                try {
                    const c = JSON.parse(ev.comments);
                    if (c && (c.testedBy || c.testedBy === 0)) {
                        this._staffEvalTestCache.set(`${ev.staffId}:${ev.criteriaId}`, {
                            testedBy: typeof c.testedBy === 'number' ? c.testedBy : null,
                            testedAt: c.testedAt || null
                        });
                    }
                } catch {}
            }
        }

        // 基準（criteria）が0件なら案内
        if (!this.currentCriteria || this.currentCriteria.length === 0) {
            container.innerHTML = '<div class="empty-state">評価項目がありません。右上の「項目追加」から作成してください。</div>';
            return;
        }

        // フィルタ選択取得
        const statusChecks = Array.from(document.querySelectorAll('input[name="evalStatusFilter[]"]:checked')).map(i=>i.value);
        const catChecks = Array.from(document.querySelectorAll('input[name="evalCategoryFilter[]"]:checked')).map(i=>i.value);
        // ステータス判定関数 (tested: commentsにtestedByがある)
        const isTested = (key) => this._staffEvalTestCache && this._staffEvalTestCache.has(key);
        const filteredCriteria = (this.currentCriteria || []).filter(cr => catChecks.length===0 || catChecks.includes(cr.category || '共通'));

        // 描画
        if (!this._pendingEvalChanges) this._pendingEvalChanges = new Map();
        container.innerHTML = filteredCriteria.map(cr => {
            const key = `${staffId}:${cr.id}`;
            const status = this._staffEvalCache.get(key) || 'not-started';
            const color = status === 'done' ? '#00d4aa' : status === 'learning' ? '#ff9f43' : '#f1f2f6';
            const label = status === 'done' ? '習得済み' : status === 'learning' ? '学習中' : '未着手';
            const tinfo = this._staffEvalTestCache.get(key);
            const testedById = tinfo?.testedBy ?? null;
            const testerName = testedById ? (this.currentStaff.find(s=>s.id===testedById)?.name || '歴代の猛者') : '';
            const testedText = testedById ? `完璧！${testerName}がテスト済み！` : '';
            const testedClass = testedById ? 'tested' : '';
            const options = (this.currentStaff || []).map(s => `<option value="${s.id}" ${testedById===s.id ? 'selected' : ''}>${s.name}</option>`).join('');
            // ステータスフィルタ適合判定
            const logicalStatusValues = [];
            logicalStatusValues.push(status); // not-started | learning | done
            if (testedById) logicalStatusValues.push('tested');
            const statusMatch = statusChecks.length===0 || statusChecks.some(v => logicalStatusValues.includes(v));
            if (!statusMatch) return ''; // 非表示
            return `
                <div class="criteria-chip" data-staff="${staffId}" data-criteria="${cr.id}" style="border:1px solid #eaeaea; padding:12px; border-radius:10px; cursor:pointer; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                        <div>
                            <div style="font-weight:600">${cr.name}</div>
                            <small style="color:#6b7280">${cr.category || '共通'}</small>
                        </div>
                        <span class="status-badge" style="background:${color}; color:#111; padding:6px 10px; border-radius:9999px; font-size:12px; white-space:nowrap;">${label}</span>
                    </div>
                    ${cr.description ? `<div class="criteria-chip-desc">${cr.description}</div>` : ''}
                    <div class="tested-block" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${testedById
                            ? `<span class=\"tested-text tested\">${testedText}</span><button class=\"btn btn-secondary btn-small reset-tested-btn\" type=\"button\">未テストに戻す</button>`
                            : `<button class=\"btn btn-primary btn-small open-tester-modal-btn\" type=\"button\">未テスト</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        // フィルタ更新イベント（初期登録は1回）
        if (!this._evalFilterBound) {
            this._evalFilterBound = true;
            document.querySelectorAll('#evaluationFilters input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    // 再描画（キャッシュ/変更マップは保持）
                    this.renderStaffEvaluations(staffId);
                });
            });
        }

        // クリックで状態トグル＆保存
    container.querySelectorAll('.criteria-chip').forEach(el => {
            // チップ本体クリックで状態トグル
            el.addEventListener('click', async (ev) => {
                // テスト系ボタンは無視
                if (ev.target && ev.target.classList && (ev.target.classList.contains('open-tester-modal-btn') || ev.target.classList.contains('reset-tested-btn'))) return;
                const sid = Number(el.getAttribute('data-staff'));
                const cid = Number(el.getAttribute('data-criteria'));
                const key = `${sid}:${cid}`;
                const current = this._staffEvalCache.get(key) || 'not-started';
                const next = current === 'not-started' ? 'learning' : current === 'learning' ? 'done' : 'not-started';
                // 先に表示を更新（楽観的UI）
                this._staffEvalCache.set(key, next);
                this._pendingEvalChanges.set(key, next);
                const badge = el.querySelector('.status-badge');
                const color = next === 'done' ? '#00d4aa' : next === 'learning' ? '#ff9f43' : '#f1f2f6';
                const label = next === 'done' ? '習得済み' : next === 'learning' ? '学習中' : '未着手';
                badge.style.background = color;
                badge.textContent = label;
            });

            // 「未テスト」→ モーダルで確認者選択
            const openBtn = el.querySelector('.open-tester-modal-btn');
            if (openBtn) {
                openBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sid = Number(el.getAttribute('data-staff'));
                    const cid = Number(el.getAttribute('data-criteria'));
                    const key = `${sid}:${cid}`;
                    const sel = document.getElementById('testerSelect');
                    if (sel) {
                        sel.innerHTML = `<option value=\"\">選択してください</option>` + (this.currentStaff||[]).map(s=>`<option value=\"${s.id}\">${s.name}</option>`).join('');
                        sel.value = '';
                    }
                    this._pendingTesterTarget = { key, el };
                    this.showModal('testerSelectModal');
                });
            }
            // 「未テストに戻す」
            const resetBtn = el.querySelector('.reset-tested-btn');
        if (resetBtn) {
                resetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sid = Number(el.getAttribute('data-staff'));
                    const cid = Number(el.getAttribute('data-criteria'));
                    const key = `${sid}:${cid}`;
                    const block = el.querySelector('.tested-block');
                    if (block) {
                        block.innerHTML = `<button class=\"btn btn-primary btn-small open-tester-modal-btn\" type=\"button\">未テスト</button>`;
                        const openBtn2 = block.querySelector('.open-tester-modal-btn');
                        if (openBtn2) {
                            openBtn2.addEventListener('click', (ev) => {
                                ev.stopPropagation();
                                const sel = document.getElementById('testerSelect');
                                if (sel) {
                                    sel.innerHTML = `<option value=\"\">選択してください</option>` + (this.currentStaff||[]).map(s=>`<option value=\"${s.id}\">${s.name}</option>`).join('');
                                    sel.value = '';
                                }
                                this._pendingTesterTarget = { key, el };
                                this.showModal('testerSelectModal');
                            });
                        }
                    }
            if (!this._pendingEvalTests) this._pendingEvalTests = new Map();
            // DB側も未テスト化するため clear 指定
            this._pendingEvalTests.set(key, { clear: true });
                    if (this._staffEvalTestCache) this._staffEvalTestCache.delete(key);
                });
            }
        });

        // モーダルの「決定」ボタン
        const confirmBtn = document.getElementById('confirmTesterBtn');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const sel = document.getElementById('testerSelect');
                const val = sel && sel.value ? Number(sel.value) : null;
                if (!val || !this._pendingTesterTarget) { this.closeModal('testerSelectModal'); return; }
                const { key, el } = this._pendingTesterTarget;
                const tester = (this.currentStaff||[]).find(s => s.id === val);
                const block = el.querySelector('.tested-block');
                if (block) {
                    const displayName = tester?.name || '歴代の猛者';
                    block.innerHTML = `<span class=\"tested-text tested\">完璧！${displayName}がテスト済み！</span><button class=\"btn btn-secondary btn-small reset-tested-btn\" type=\"button\">未テストに戻す</button>`;
                    const resetBtn2 = block.querySelector('.reset-tested-btn');
                    if (resetBtn2) {
                        resetBtn2.addEventListener('click', (e) => {
                            e.stopPropagation();
                            block.innerHTML = `<button class=\"btn btn-primary btn-small open-tester-modal-btn\" type=\"button\">未テスト</button>`;
                            if (this._pendingEvalTests) this._pendingEvalTests.delete(key);
                            if (this._staffEvalTestCache) this._staffEvalTestCache.delete(key);
                            const openBtn3 = block.querySelector('.open-tester-modal-btn');
                            if (openBtn3) {
                                openBtn3.addEventListener('click', (ev) => {
                                    ev.stopPropagation();
                                    const sel2 = document.getElementById('testerSelect');
                                    if (sel2) {
                                        sel2.innerHTML = `<option value=\"\">選択してください</option>` + (this.currentStaff||[]).map(s=>`<option value=\"${s.id}\">${s.name}</option>`).join('');
                                        sel2.value = '';
                                    }
                                    this._pendingTesterTarget = { key, el };
                                    this.showModal('testerSelectModal');
                                });
                            }
                        });
                    }
                }
                if (!this._pendingEvalTests) this._pendingEvalTests = new Map();
                this._pendingEvalTests.set(key, { testedBy: val, testedAt: new Date().toISOString() });
                if (this._staffEvalTestCache) this._staffEvalTestCache.set(key, { testedBy: val, testedAt: new Date().toISOString() });
                this._pendingTesterTarget = null;
                this.closeModal('testerSelectModal');
            };
        }
    } catch (e) {
        console.error('評価一覧読み込みエラー:', e);
        container.innerHTML = '<div class="empty-state">評価一覧の取得に失敗しました</div>';
    }
}
