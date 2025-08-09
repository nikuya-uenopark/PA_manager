// PA評価管理システム - メインJavaScript

class PAManager {
    constructor() {
        this.currentStaff = [];
        this.currentCriteria = [];
        this.currentTab = 'staff';
    this.editingCriteriaId = null;
    this._chart = null;
    this._staffEvalCache = new Map(); // key: `${staffId}:${criteriaId}` -> status
        
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

        // スタッフ追加フォーム送信
        const staffForm = document.getElementById('staffForm');
        if (staffForm) {
            staffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('staffName')?.value?.trim();
                const position = document.getElementById('staffPosition')?.value || null;
                const email = document.getElementById('staffEmail')?.value || null;
                const phone = document.getElementById('staffPhone')?.value || null;
                if (!name) {
                    this.showNotification('名前は必須です', 'error');
                    return;
                }
                try {
                    const res = await fetch('/api/staff', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, position, email, phone })
                    });
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    this.showNotification('スタッフを追加しました');
                    this.closeModal('staffModal');
                    // フォームをリセット
                    staffForm.reset();
                    // 再読込
                    await this.loadStaff();
                    this.updateStats();
                } catch (err) {
                    console.error('スタッフ保存エラー:', err);
                    this.showNotification('スタッフの保存に失敗しました', 'error');
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
                    this.updateStats();
                } catch (err) {
                    console.error('評価項目保存エラー:', err);
                    this.showNotification('評価項目の保存に失敗しました', 'error');
                }
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
                this.loadCriteria()
            ]);
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
                this.setupSortable();
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
            const progress = Math.floor(Math.random() * 100);
            const avatarUrl = staff.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(staff.name) + '&background=667eea&color=fff&size=128';
            
            return `
                <div class="staff-card" onclick="showStaffDetail(${staff.id})">
                    <div class="staff-header">
                        <img src="${avatarUrl}" alt="${staff.name}" class="staff-avatar">
                        <div class="staff-info">
                            <h3>${staff.name}</h3>
                            <span class="position-badge">${staff.position || '未設定'}</span>
                        </div>
                    </div>
                    <div class="staff-progress">
                        <div class="progress-label">
                            <span>進捗状況</span>
                            <span class="progress-percent">${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="staff-stats">
                        <div class="stat-item-small">
                            <span class="stat-value-small">${Math.floor(Math.random() * 20)}</span>
                            <span class="stat-label-small">評価済み</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${Math.floor(Math.random() * 10)}</span>
                            <span class="stat-label-small">習得済み</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${Math.floor(Math.random() * 15)}</span>
                            <span class="stat-label-small">学習中</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderCriteria() {
        const container = document.getElementById('criteriaGrid');
        if (!container) return;

        if (this.currentCriteria.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list-check" style="font-size: 4rem; color: var(--light-color); margin-bottom: 20px;"></i>
                    <h3>まだ評価項目が登録されていません</h3>
                    <p>「項目追加」ボタンから最初の評価項目を追加してください</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.currentCriteria.map(criteria => `
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
                <div class="criteria-stats">
                    <small>使用回数: ${Math.floor(Math.random() * 50)}回</small>
                </div>
            </div>
        `).join('');
    }

    setupSortable() {
        const criteriaGrid = document.getElementById('criteriaGrid');
        if (criteriaGrid && typeof Sortable !== 'undefined') {
            new Sortable(criteriaGrid, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag'
            });
        }
    }

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

    async sortCriteriaByCategory() {
        const sortedCriteria = [...this.currentCriteria].sort((a, b) => 
            (a.category || '').localeCompare(b.category || '')
        );

        try {
            const order = sortedCriteria.map((item, index) => ({
                id: item.id,
                sort_order: index + 1
            }));

            const response = await fetch('/api/criteria', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order })
            });

            if (response.ok) {
                this.showNotification('カテゴリー順で並び替えました');
                await this.loadCriteria();
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('並び替えエラー:', error);
            this.showNotification('並び替えに失敗しました', 'error');
        }
    }
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

PAManager.prototype.deleteCriteria = async function (criteriaId) {
    try {
        const res = await fetch(`/api/criteria?id=${criteriaId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        this.showNotification('評価項目を削除しました');
        await this.loadCriteria();
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
    const avatarUrl = staff.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(staff.name) + '&background=667eea&color=fff&size=128';
    document.getElementById('staffDetailAvatar').src = avatarUrl;

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
        container.querySelectorAll('.criteria-chip').forEach(el => {
            el.addEventListener('click', async () => {
                const sid = Number(el.getAttribute('data-staff'));
                const cid = Number(el.getAttribute('data-criteria'));
                const key = `${sid}:${cid}`;
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
                    // まず更新（0件なら作成）
                    let res = await fetch('/api/evaluations', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ staffId: sid, criteriaId: cid, status: next })
                    });
                    if (!res.ok) {
                        // PUT 失敗時は作成にフォールバック
                        res = await fetch('/api/evaluations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ staff_id: sid, criteria_id: cid, status: next })
                        });
                        if (!res.ok) throw new Error(`save failed ${res.status}`);
                    }
                    this.showNotification('保存しました');
                } catch (e) {
                    console.error('評価保存エラー:', e);
                    this.showNotification('保存に失敗しました', 'error');
                }
            });
        });
    } catch (e) {
        console.error('評価一覧読み込みエラー:', e);
        container.innerHTML = '<div class="empty-state">評価一覧の取得に失敗しました</div>';
    }
}
