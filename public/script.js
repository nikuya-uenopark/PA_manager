// PA Manager - iPad最適化版 JavaScript

class PAManager {
    constructor() {
        this.apiBase = '/api';
        this.currentTab = 'staff';
        this.staff = [];
        this.criteria = [];
        this.stats = {};
        
        this.init();
    }

    async init() {
        // ローディング画面表示
        this.showLoading();
        
        try {
            // データ初期読み込み
            await this.loadAllData();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // 初期レンダリング
            this.renderAll();
            
            // ローディング画面非表示
            this.hideLoading();
            
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showNotification('アプリケーションの初期化に失敗しました', 'error');
            this.hideLoading();
        }
    }

    showLoading() {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    }

    // API通信
    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API error:', error);
            throw error;
        }
    }

    async loadAllData() {
        // スタッフ進捗はPATCHで取得
        const [staffData, criteriaData, statsData] = await Promise.all([
            this.apiRequest('/staff', { method: 'PATCH' }),
            this.apiRequest('/criteria'),
            this.apiRequest('/stats')
        ]);
        this.staff = staffData;
        this.criteria = criteriaData;
        this.stats = statsData;
    }

    // イベントリスナー設定
    setupEventListeners() {
        // スタッフフォーム
        document.getElementById('addStaffForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addStaff();
        });

        // 評価項目フォーム
        document.getElementById('addCriteriaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCriteria();
        });

        // タッチイベント対応
        this.setupTouchEvents();
    }

    setupTouchEvents() {
        // カードのタッチフィードバック
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.staff-card, .criteria-card, .btn')) {
                e.target.closest('.staff-card, .criteria-card, .btn').style.opacity = '0.8';
            }
        });

        document.addEventListener('touchend', (e) => {
            if (e.target.closest('.staff-card, .criteria-card, .btn')) {
                setTimeout(() => {
                    e.target.closest('.staff-card, .criteria-card, .btn').style.opacity = '1';
                }, 100);
            }
        });
    }

    // タブ切り替え
    switchTab(tabName) {
        // アクティブなタブを更新
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // コンテンツを切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;

        // 必要に応じてデータを再読み込み
        if (tabName === 'stats') {
            this.loadStats();
        }
    }

    // レンダリング
    renderAll() {
        this.renderStaff();
        this.renderCriteria();
        this.renderStats();
    }

    renderStaff() {
        const container = document.getElementById('staffList');
        
        if (this.staff.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>スタッフがいません</h3>
                    <p>「新規追加」ボタンから新しいスタッフを追加しましょう</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.staff.map(member => `
            <div class="staff-card" onclick="app.showStaffDetail(${member.id})" data-staff-id="${member.id}">
                <div class="staff-name">${member.name}</div>
                ${member.position ? `<div class="staff-position">${member.position}</div>` : ''}
            </div>
        `).join('');
    }

    renderCriteria() {
    const container = document.getElementById('criteriaList');
    // 編集モードフラグ
    if (this.criteriaEditMode === undefined) this.criteriaEditMode = false;
        if (this.criteria.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list-check"></i>
                    <h3>評価項目がありません</h3>
                    <p>「項目追加」ボタンから新しい評価項目を追加しましょう</p>
                </div>
            `;
            return;
        }
        container.innerHTML = this.criteria.map((criteria, idx) => `
            <div class="criteria-card${this.criteriaEditMode ? ' edit-mode' : ''}" data-index="${idx}" data-id="${criteria.id}">
                ${this.criteriaEditMode ? `<span class='drag-handle' title='並び替え'>&#9776;</span>` : ''}
                <div class="criteria-header">
                    <div class="criteria-name">${criteria.name}</div>
                    <div class="criteria-category">${criteria.category}</div>
                </div>
                ${criteria.description ? `<div class="criteria-description">${criteria.description}</div>` : ''}
                ${this.criteriaEditMode ? `<button class='criteria-delete-btn' onclick='app.deleteCriteria(${criteria.id}); event.stopPropagation();' title='削除'><i class="fas fa-minus-circle"></i></button>` : ''}
            </div>
        `).join('');

        // タッチ長押しで編集モード
        let longPressTimer = null;
        container.querySelectorAll('.criteria-card').forEach(card => {
            card.addEventListener('touchstart', (e) => {
                if (this.criteriaEditMode) return;
                longPressTimer = setTimeout(() => {
                    this.criteriaEditMode = true;
                    this.renderCriteria();
                }, 800); // 0.8秒長押し
            });
            card.addEventListener('touchend', (e) => {
                clearTimeout(longPressTimer);
            });
            card.addEventListener('mousedown', (e) => {
                if (this.criteriaEditMode) return;
                longPressTimer = setTimeout(() => {
                    this.criteriaEditMode = true;
                    this.renderCriteria();
                }, 800);
            });
            card.addEventListener('mouseup', (e) => {
                clearTimeout(longPressTimer);
            });
        });

        // 編集モード時のみSortable有効
        if (this.criteriaEditMode) {
            if (window.Sortable) {
                if (this._sortable) this._sortable.destroy();
                this._sortable = new window.Sortable(container, {
                    animation: 180,
                    handle: '.drag-handle',
                    ghostClass: 'drag-ghost',
                    chosenClass: 'drag-chosen',
                    onEnd: async (evt) => {
                        // 並び替え後の順序をthis.criteriaに反映
                        const newOrder = Array.from(container.children).map((el, i) => Number(el.dataset.id));
                        this.criteria.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
                    }
                });
            }
            // 編集モード解除（タップ）
            container.addEventListener('click', async (e) => {
                if (!e.target.classList.contains('criteria-card') && !e.target.closest('.criteria-card')) return;
                this.criteriaEditMode = false;
                if (this._sortable) this._sortable.destroy();
                // 並び順をAPIで保存
                const order = this.criteria.map((c, i) => ({ id: c.id, sort_order: i + 1 }));
                try {
                    await this.apiRequest('/criteria', {
                        method: 'PUT',
                        body: JSON.stringify({ order })
                    });
                    this.showNotification('並び順を保存しました', 'success');
                } catch (e) {
                    this.showNotification('並び順の保存に失敗しました', 'error');
                }
                this.renderCriteria();
            }, { once: true });
        } else {
            if (this._sortable) this._sortable.destroy();
        }
    }

    renderStats() {
    document.getElementById('staffCount').textContent = this.stats.staffCount || 0;
    document.getElementById('criteriaCount').textContent = this.stats.criteriaCount || 0;
        document.getElementById('overallProgress').textContent = `${this.stats.overallProgress || 0}%`;
    }

    // スタッフ管理
    async addStaff() {
        const name = document.getElementById('staffName').value.trim();
        const position = document.getElementById('staffPosition').value;

        if (!name) {
            this.showNotification('名前を入力してください', 'error');
            return;
        }

        try {
            await this.apiRequest('/staff', {
                method: 'POST',
                body: JSON.stringify({ name, position })
            });

            this.showNotification('スタッフが追加されました', 'success');
            this.closeModal('addStaffModal');
            document.getElementById('addStaffForm').reset();
            await this.loadAllData();
            this.renderAll();

        } catch (error) {
            this.showNotification('スタッフの追加に失敗しました', 'error');
        }
    }

    async deleteStaff(staffId) {
        if (!confirm('このスタッフを削除してもよろしいですか？')) {
            return;
        }

        try {
            await this.apiRequest(`/staff?id=${staffId}`, {
                method: 'DELETE'
            });

            this.showNotification('スタッフが削除されました', 'success');
            await this.loadAllData();
            this.renderAll();

        } catch (error) {
            this.showNotification('スタッフの削除に失敗しました', 'error');
        }
    }

    async showStaffDetail(staffId) {
        try {
            // 全criteriaと評価済みデータを取得
            const [criteriaList, evaluations] = await Promise.all([
                this.apiRequest('/criteria'),
                this.apiRequest(`/evaluations?staffId=${staffId}`)
            ]);
            const staff = this.staff.find(s => s.id === staffId);
            if (!staff) return;

            // 詳細モーダルのヘッダーを大きく・1行ずつ・進捗バーも表示・削除ボタンは下に
            document.getElementById('staffDetailName').innerHTML = `
                <div style="margin-bottom:8px; font-size:1.3rem; font-weight:600;">${staff.name}</div>
                ${staff.position ? `<div class='staff-position' style='margin-bottom:12px; font-size:1.05rem;'>${staff.position}</div>` : ''}
                <div style=\"width:100%; margin-bottom:12px;\">
                    <div class=\"progress-label\" style=\"color:#666; margin-bottom:4px;\">進捗: ${staff.progress_percentage || 0}%</div>
                    <div class=\"progress-bar\" style=\"height:18px; background:#e2e8f0; border-radius:9px; overflow:hidden; width:100%;\">
                        <div class=\"progress-fill\" style=\"width: ${staff.progress_percentage || 0}%; height:100%; background:#74b9ff;\"></div>
                    </div>
                </div>
                <div style=\"width:100%; text-align:right; margin-bottom:10px;\">
                    <button class=\"btn btn-danger\" style=\"width:100%; max-width:320px;\" onclick=\"app.deleteStaff(${staff.id})\">スタッフ削除</button>
                </div>
            `;
            const container = document.getElementById('staffEvaluations');
            // criteriaごとに評価データを突き合わせ
            const evaluationMap = {};
            evaluations.forEach(ev => { evaluationMap[ev.criteria_id] = ev; });
            container.innerHTML = criteriaList.map(criteria => {
                const evaluation = evaluationMap[criteria.id] || {
                    criteria_id: criteria.id,
                    name: criteria.name,
                    category: criteria.category,
                    description: criteria.description,
                    status: 'cannot-do' // デフォルト
                };
                return `
                <div class="evaluation-item">
                    <div class="evaluation-header">
                        <div class="evaluation-name">${evaluation.name}</div>
                        <div class="evaluation-category">${evaluation.category}</div>
                    </div>
                    ${evaluation.description ? `<div class="evaluation-description">${evaluation.description}</div>` : ''}
                    <div class="evaluation-status">
                        <button class="status-btn can-do ${evaluation.status === 'can-do' ? 'active' : ''}" 
                                onclick="app.updateEvaluation(${staffId}, ${criteria.id}, 'can-do')">
                            <i class="fas fa-check"></i> できる
                        </button>
                        <button class="status-btn learning ${evaluation.status === 'learning' ? 'active' : ''}" 
                                onclick="app.updateEvaluation(${staffId}, ${criteria.id}, 'learning')">
                            <i class="fas fa-clock"></i> 学習中
                        </button>
                        <button class="status-btn cannot-do ${evaluation.status === 'cannot-do' ? 'active' : ''}" 
                                onclick="app.updateEvaluation(${staffId}, ${criteria.id}, 'cannot-do')">
                            <i class="fas fa-times"></i> できない
                        </button>
                    </div>
                </div>
                `;
            }).join('');
            this.showModal('staffDetailModal');
        } catch (error) {
            this.showNotification('評価データの読み込みに失敗しました', 'error');
        }
    }

    async updateEvaluation(staffId, criteriaId, status) {
        try {
            await this.apiRequest(`/evaluations`, {
                method: 'PUT',
                body: JSON.stringify({ staffId, criteriaId, status })
            });

            // UIを即座に更新
            const evaluationItem = event.target.closest('.evaluation-item');
            const statusButtons = evaluationItem.querySelectorAll('.status-btn');
            statusButtons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // データを再読み込みして進捗を更新
            await this.loadAllData();
            this.renderStaff();
            this.renderStats();

        } catch (error) {
            this.showNotification('評価の更新に失敗しました', 'error');
        }
    }

    // 評価項目管理
    async addCriteria() {
        const name = document.getElementById('criteriaName').value.trim();
        const category = document.getElementById('criteriaCategory').value;
        const description = document.getElementById('criteriaDescription').value.trim();

        if (!name) {
            this.showNotification('項目名を入力してください', 'error');
            return;
        }

        try {
            await this.apiRequest('/criteria', {
                method: 'POST',
                body: JSON.stringify({ name, category, description })
            });

            this.showNotification('評価項目が追加されました', 'success');
            this.closeModal('addCriteriaModal');
            document.getElementById('addCriteriaForm').reset();
            await this.loadAllData();
            this.renderAll();

        } catch (error) {
            this.showNotification('評価項目の追加に失敗しました', 'error');
        }
    }

    async deleteCriteria(criteriaId) {
        if (!confirm('この評価項目を削除してもよろしいですか？')) {
            return;
        }

        try {
            await this.apiRequest(`/criteria?id=${criteriaId}`, {
                method: 'DELETE'
            });

            this.showNotification('評価項目が削除されました', 'success');
            await this.loadAllData();
            this.renderAll();

        } catch (error) {
            this.showNotification('評価項目の削除に失敗しました', 'error');
        }
    }

    // 統計情報
    async loadStats() {
        try {
            this.stats = await this.apiRequest('/stats');
            this.renderStats();
        } catch (error) {
            this.showNotification('統計情報の読み込みに失敗しました', 'error');
        }
    }



    async refreshData() {
        try {
            await this.loadAllData();
            this.renderAll();
            this.showNotification('データを更新しました', 'success');
        } catch (error) {
            this.showNotification('データの更新に失敗しました', 'error');
        }
    }

    // UI管理
    showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            // 他に開いているモーダルがなければmodal-openを外す
            const anyOpen = document.querySelector('.modal.show');
            if (!anyOpen) {
                document.body.classList.remove('modal-open');
            }
        }, 300);
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    showSettings() {
        this.showModal('settingsModal');
    }

    showResetConfirm() {
        if (confirm('すべてのデータを削除してもよろしいですか？この操作は元に戻せません。')) {
            if (confirm('本当によろしいですか？')) {
                // データリセット機能は今回は実装しない（危険なため）
                this.showNotification('データリセット機能は管理者のみ利用可能です', 'warning');
            }
        }
    }
}

// グローバル関数（HTML側から呼び出すため）
function switchTab(tabName) {
    app.switchTab(tabName);
}

function showAddStaffModal() {
    app.showModal('addStaffModal');
    document.getElementById('staffName').focus();
}

function showAddCriteriaModal() {
    app.showModal('addCriteriaModal');
    document.getElementById('criteriaName').focus();
}

function closeModal(modalId) {
    app.closeModal(modalId);
}

function refreshData() {
    app.refreshData();
}

function showSettings() {
    app.showSettings();
}

function exportData() {
    app.exportData();
}

function showResetConfirm() {
    app.showResetConfirm();
}

// アプリケーション初期化
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PAManager();
});

// モーダル外クリックで閉じる
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        app.closeModal(modalId);
    }
});

// ESCキーでモーダルを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            app.closeModal(openModal.id);
        }
    }
});
