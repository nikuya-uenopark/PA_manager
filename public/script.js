// PA評価管理システム - メインJavaScript

class PAManager {
    constructor() {
        this.currentStaff = [];
        this.currentCriteria = [];
        this.currentTab = 'staff';
        
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
            new Chart(ctx, {
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
    // スタッフ詳細機能の実装
    paManager.showNotification('スタッフ詳細機能は開発中です');
}

function editCriteria(criteriaId) {
    // 評価項目編集機能の実装
    paManager.showNotification('編集機能は開発中です');
}

function deleteCriteria(criteriaId) {
    if (confirm('この評価項目を削除しますか？')) {
        // 削除機能の実装
        paManager.showNotification('削除機能は開発中です');
    }
}

function sortCriteriaByCategory() {
    paManager.sortCriteriaByCategory();
}
