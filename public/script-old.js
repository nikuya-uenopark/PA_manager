// PA評価管理システム - メインJavaScript
// iPad横向き最適化バージョン

class PAManager {
    constructor() {
        this.currentStaff = [];
        this.currentCriteria = [];
        this.currentTab = 'staff';
        this.editingStaff = null;
        this.editingCriteria = null;
        this.chart = null;
        
        this.init();
    }

    async init() {
        // DOM読み込み完了後の初期化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.loadData();
                this.hideLoading();
            });
        } else {
            this.setupEventListeners();
            this.loadData();
            this.hideLoading();
        }
    }

    setupEventListeners() {
        // フォームイベント
        const staffForm = document.getElementById('staffForm');
        const criteriaForm = document.getElementById('criteriaForm');
        
        if (staffForm) staffForm.addEventListener('submit', (e) => this.handleStaffSubmit(e));
        if (criteriaForm) criteriaForm.addEventListener('submit', (e) => this.handleCriteriaSubmit(e));
        
        // モーダル外クリックで閉じる
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    // ローディング画面を非表示
    hideLoading() {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1500);
    }

    // データ読み込み
    async loadData() {
        try {
            await Promise.all([
                this.loadStaff(),
                this.loadCriteria()
            ]);
            this.updateStats();
            if (this.currentTab === 'analytics') {
                this.renderAnalytics();
            }
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            this.showNotification('データの読み込みに失敗しました', 'error');
        }
    }

    // スタッフデータ読み込み
    async loadStaff() {
        try {
            const response = await fetch('/api/staff');
            this.currentStaff = await response.json();
            this.renderStaff();
        } catch (error) {
            console.error('スタッフデータ読み込みエラー:', error);
        }
    }

    // 評価項目データ読み込み
    async loadCriteria() {
        try {
            const response = await fetch('/api/criteria');
            this.currentCriteria = await response.json();
            this.renderCriteria();
            this.setupSortable();
        } catch (error) {
            console.error('評価項目データ読み込みエラー:', error);
        }
    }

    // スタッフ表示
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
            const progress = this.calculateStaffProgress(staff.id);
            const avatarUrl = staff.avatar_url || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(staff.name)}&background=667eea&color=fff&size=128\`;
            
            return \`
                <div class="staff-card" onclick="showStaffDetail(\${staff.id})">
                    <div class="staff-header">
                        <img src="\${avatarUrl}" alt="\${staff.name}" class="staff-avatar" 
                             onerror="this.src='https://ui-avatars.com/api/?name=\${encodeURIComponent(staff.name)}&background=667eea&color=fff&size=128'">
                        <div class="staff-info">
                            <h3>\${staff.name}</h3>
                            <span class="position-badge">\${staff.position || '未設定'}</span>
                        </div>
                    </div>
                    <div class="staff-progress">
                        <div class="progress-label">
                            <span>進捗状況</span>
                            <span class="progress-percent">\${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${progress}%"></div>
                        </div>
                    </div>
                    <div class="staff-stats">
                        <div class="stat-item-small">
                            <span class="stat-value-small">\${this.getStaffEvaluationCount(staff.id)}</span>
                            <span class="stat-label-small">評価済み</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">\${this.getStaffMasteredCount(staff.id)}</span>
                            <span class="stat-label-small">習得済み</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">\${this.getStaffLearningCount(staff.id)}</span>
                            <span class="stat-label-small">学習中</span>
                        </div>
                    </div>
                </div>
            \`;
        }).join('');
    }

    // 評価項目表示
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

        container.innerHTML = this.currentCriteria.map(criteria => \`
            <div class="criteria-card" data-id="\${criteria.id}">
                <div class="criteria-header">
                    <div>
                        <div class="criteria-title">\${criteria.name}</div>
                        <span class="criteria-category">\${criteria.category || '共通'}</span>
                    </div>
                    <div class="criteria-actions">
                        <button class="btn btn-sm btn-secondary" onclick="editCriteria(\${criteria.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCriteria(\${criteria.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                \${criteria.description ? \`<div class="criteria-description">\${criteria.description}</div>\` : ''}
                <div class="criteria-stats">
                    <small class="text-muted">使用回数: \${this.getCriteriaUsageCount(criteria.id)}回</small>
                </div>
            </div>
        \`).join('');
    }

    // Sortable.js設定
    setupSortable() {
        const criteriaGrid = document.getElementById('criteriaGrid');
        if (criteriaGrid && typeof Sortable !== 'undefined') {
            new Sortable(criteriaGrid, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onEnd: async (evt) => {
                    await this.updateCriteriaOrder();
                }
            });
        }
    }

    // タブ切り替え
    switchTab(tabName) {
        // タブボタンの状態更新
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(\`\${tabName}Tab\`).classList.add('active');

        // パネルの表示切り替え
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(\`\${tabName}Panel\`).classList.add('active');

        this.currentTab = tabName;

        // 分析タブの場合、チャートを更新
        if (tabName === 'analytics') {
            setTimeout(() => this.renderAnalytics(), 100);
        }
    }

    // モーダル表示/非表示
    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // 通知表示
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = \`notification \${type} show\`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }

    // 統計更新
    updateStats() {
        const totalStaffElement = document.getElementById('totalStaff');
        const totalCriteriaElement = document.getElementById('totalCriteria');
        const avgProgressElement = document.getElementById('avgProgress');
        
        if (totalStaffElement) totalStaffElement.textContent = this.currentStaff.length;
        if (totalCriteriaElement) totalCriteriaElement.textContent = this.currentCriteria.length;
        
        if (avgProgressElement) {
            const avgProgress = this.calculateAverageProgress();
            avgProgressElement.textContent = \`\${avgProgress}%\`;
        }
    }

    // 平均進捗計算
    calculateAverageProgress() {
        if (this.currentStaff.length === 0) return 0;
        
        const totalProgress = this.currentStaff.reduce((sum, staff) => {
            return sum + this.calculateStaffProgress(staff.id);
        }, 0);
        
        return Math.round(totalProgress / this.currentStaff.length);
    }

    // スタッフ進捗計算（ダミー実装）
    calculateStaffProgress(staffId) {
        // 実際の実装では評価データを基に計算
        return Math.floor(Math.random() * 100);
    }

    // 各種カウント関数（ダミー実装）
    getStaffEvaluationCount(staffId) {
        return Math.floor(Math.random() * 20);
    }

    getStaffMasteredCount(staffId) {
        return Math.floor(Math.random() * 10);
    }

    getStaffLearningCount(staffId) {
        return Math.floor(Math.random() * 15);
    }

    getCriteriaUsageCount(criteriaId) {
        return Math.floor(Math.random() * 50);
    }

    // 分析・統計レンダリング
    renderAnalytics() {
        const ctx = document.getElementById('progressChart');
        if (ctx && typeof Chart !== 'undefined') {
            if (this.chart) {
                this.chart.destroy();
            }
            
            this.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['習得済み', '学習中', '未着手'],
                    datasets: [{
                        data: [30, 45, 25],
                        backgroundColor: [
                            'var(--success-color)',
                            'var(--warning-color)',
                            'var(--light-color)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }
}

// グローバル変数とインスタンス
let paManager;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    paManager = new PAManager();
});

// グローバル関数（HTMLから呼び出し用）
function switchTab(tabName) {
    paManager?.switchTab(tabName);
}

function showAddStaffModal() {
    paManager?.showModal('staffModal');
}

function showAddCriteriaModal() {
    paManager?.showModal('criteriaModal');
}

function closeModal(modalId) {
    paManager?.closeModal(modalId);
}
            
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
                <div class="criteria-header">
                    <div class="criteria-name">${criteria.name}</div>
                    <div class="criteria-category">${criteria.category}</div>
                </div>
                ${criteria.description ? `<div class="criteria-description">${criteria.description}</div>` : ''}
                ${this.criteriaEditMode ? `<button class='criteria-delete-btn' onclick='app.deleteCriteria(${criteria.id}); event.stopPropagation();' title='削除'><i class="fas fa-minus-circle"></i></button>` : ''}
            </div>
        `).join('');

    // 編集モード・関連UI・JSロジックは全て削除済み

        // 編集モード時のみSortable有効
        if (this.criteriaEditMode) {
            if (window.Sortable) {
                if (this._sortable) this._sortable.destroy();
                this._sortable = new window.Sortable(container, {
                    animation: 180,
                    handle: '.criteria-card',
                    ghostClass: 'drag-ghost',
                    chosenClass: 'drag-chosen',
                    onEnd: async (evt) => {
                        // 並び替え後の順序をthis.criteriaに反映
                        const newOrder = Array.from(container.children).map((el, i) => Number(el.dataset.id));
                        this.criteria.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
                    }
                });
            }
            // 編集モード解除（画面全体タップ）
            const endEdit = async (e) => {
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
                document.removeEventListener('touchstart', endEdit, true);
                document.removeEventListener('mousedown', endEdit, true);
            };
            setTimeout(() => {
                document.addEventListener('touchstart', endEdit, true);
                document.addEventListener('mousedown', endEdit, true);
            }, 300);
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
