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

    setup() {
        this.hideLoading();
        this.loadData();
        this.setupEventListeners();
    }

    hideLoading() {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);
    }

    setupEventListeners() {
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

                // スタッフ追加/更新フォーム送信
    const staffForm = document.getElementById('staffForm');
        if (staffForm) {
            staffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
        const name = document.getElementById('staffName')?.value?.trim();
        const kana = document.getElementById('staffKana')?.value?.trim() || null;
        const position = document.getElementById('staffPositionType')?.value || null; // バイト/社員
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
                    // ログを作成（読みやすい表記で）
                    try {
                        const birthText = (()=>{
                            if (!birth_date) return '-';
                            const d = new Date(birth_date);
                            const y = d.getFullYear();
                            const m = String(d.getMonth()+1).padStart(2,'0');
                            const day = String(d.getDate()).padStart(2,'0');
                            return `${y}/${m}/${day}`;
                        })();
                                                if (!isEdit) {
                                                    await fetch('/api/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                event: 'staff:create',
                                message: `新規スタッフ追加 名前:${name} 役職:${position || '-'} 生年月日:${birthText}`
                            })
                                                    });
                                                }
                    } catch {}
                    this.closeModal('staffModal');
                    // フォームをリセット
                    staffForm.reset();
                                        this.editingStaffId = null;
                    // 再読込
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

        // 評価項目追加/編集フォーム送信
        const criteriaForm = document.getElementById('criteriaForm');
        if (criteriaForm) {
            criteriaForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('criteriaName')?.value?.trim();
                const category = document.getElementById('criteriaCategory')?.value || '共通';
                const description = document.getElementById('criteriaDescription')?.value || null;
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
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
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
        }
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
            setTimeout(() => this.renderAnalytics(), 100);
        }
    }

    renderAnalytics() {
        const ctx = document.getElementById('progressChart');
        if (ctx && typeof Chart !== 'undefined') {
            if (this._chart) {
                this._chart.destroy();
            }
            this._chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['習得済み', '学習中', '未着手'],
                    datasets: [{
                        data: [30, 45, 25],
                        backgroundColor: ['#00d4aa', '#ff9f43', '#f1f2f6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    // 併せてログも更新
    this.loadLogs();
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = 'auto';
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
    document.getElementById('criteriaDescription').value = item.description || '';
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
        for (const ev of evals) {
            this._staffEvalCache.set(`${ev.staffId}:${ev.criteriaId}`,(ev.status||'not-started'));
        }

        // 基準（criteria）が0件なら案内
        if (!this.currentCriteria || this.currentCriteria.length === 0) {
            container.innerHTML = '<div class="empty-state">評価項目がありません。右上の「項目追加」から作成してください。</div>';
            return;
        }

        // グリッド描画
    container.innerHTML = this.currentCriteria.map(cr => {
            const key = `${staffId}:${cr.id}`;
            const status = this._staffEvalCache.get(key) || 'not-started';
            const color = status === 'done' ? '#00d4aa' : status === 'learning' ? '#ff9f43' : '#f1f2f6';
            const label = status === 'done' ? '習得済み' : status === 'learning' ? '学習中' : '未着手';
            return `
                <div class="criteria-chip" data-staff="${staffId}" data-criteria="${cr.id}" style="border:1px solid #eaeaea; padding:12px; border-radius:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600">${cr.name}</div>
                        <small style="color:#6b7280">${cr.category || '共通'}</small>
                    </div>
                    <span class="status-badge" style="background:${color}; color:#111; padding:6px 10px; border-radius:9999px; font-size:12px;">${label}</span>
                </div>
            `;
        }).join('');

        // クリックで状態トグル＆保存
    const changerSel = document.getElementById('evaluationChangedBy');
    container.querySelectorAll('.criteria-chip').forEach(el => {
            el.addEventListener('click', async () => {
                const sid = Number(el.getAttribute('data-staff'));
                const cid = Number(el.getAttribute('data-criteria'));
                const key = `${sid}:${cid}`;
        if (this._savingEvals.has(key)) return; // 連打防止
        this._savingEvals.add(key);
        el.classList.add('is-busy');
                const current = this._staffEvalCache.get(key) || 'not-started';
                const next = current === 'not-started' ? 'learning' : current === 'learning' ? 'done' : 'not-started';
                // 先に表示を更新（楽観的UI）
                this._staffEvalCache.set(key, next);
                const badge = el.querySelector('.status-badge');
                const color = next === 'done' ? '#00d4aa' : next === 'learning' ? '#ff9f43' : '#f1f2f6';
                const label = next === 'done' ? '習得済み' : next === 'learning' ? '学習中' : '未着手';
                badge.style.background = color;
                badge.textContent = label;

                try {
                    const changedById = changerSel && changerSel.value ? Number(changerSel.value) : null;
                    // まず更新（0件なら作成）
                    let res = await fetch('/api/evaluations', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ staffId: sid, criteriaId: cid, status: next, changedBy: changedById })
                    });
                    if (!res.ok) {
                        // PUT 失敗時は作成にフォールバック
                        res = await fetch('/api/evaluations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ staff_id: sid, criteria_id: cid, status: next, changed_by: changedById })
                        });
                        if (!res.ok) throw new Error(`save failed ${res.status}`);
                    }
                    this.showNotification('保存しました');
                    await this.loadLogs();
                    await this.loadStaffProgress();
                    // キャッシュをクリアしてから最新を取得して描画
                    this._staffEvalCache.clear();
                    await this.renderStaffEvaluations(sid);
                } catch (e) {
                    console.error('評価保存エラー:', e);
                    this.showNotification('保存に失敗しました', 'error');
                } finally {
                    this._savingEvals.delete(key);
                    el.classList.remove('is-busy');
                }
            });
        });
    } catch (e) {
        console.error('評価一覧読み込みエラー:', e);
        container.innerHTML = '<div class="empty-state">評価一覧の取得に失敗しました</div>';
    }
}
