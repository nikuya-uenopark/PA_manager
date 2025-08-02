// グローバル変数
let staff = JSON.parse(localStorage.getItem('staff')) || [];
let criteria = JSON.parse(localStorage.getItem('criteria')) || [];
let evaluations = JSON.parse(localStorage.getItem('evaluations')) || {};

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // デフォルトの評価項目を設定（初回のみ）
    if (criteria.length === 0) {
        criteria = [
            {
                id: generateId(),
                name: '基本的な挨拶',
                category: '基本スキル',
                description: 'お客様への適切な挨拶ができる'
            },
            {
                id: generateId(),
                name: 'レジ操作',
                category: '基本スキル',
                description: 'レジでの基本的な会計処理ができる'
            },
            {
                id: generateId(),
                name: '商品の場所案内',
                category: '接客',
                description: 'お客様への商品案内が適切にできる'
            },
            {
                id: generateId(),
                name: 'クレーム対応',
                category: '接客',
                description: '基本的なクレーム対応ができる'
            },
            {
                id: generateId(),
                name: '清掃作業',
                category: '基本スキル',
                description: '店舗の清掃作業を適切に行える'
            }
        ];
        saveCriteria();
    }
    
    renderStaff();
    renderCriteria();
    updateDataInfo();
    setupEventListeners();
});

// IDジェネレーター
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// イベントリスナーの設定
function setupEventListeners() {
    // スタッフ追加フォーム
    document.getElementById('addStaffForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addStaff();
    });
    
    // 評価項目追加フォーム
    document.getElementById('addCriteriaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addCriteria();
    });
    
    // モーダル外クリックで閉じる
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// データ保存関数
function saveStaff() {
    localStorage.setItem('staff', JSON.stringify(staff));
}

function saveCriteria() {
    localStorage.setItem('criteria', JSON.stringify(criteria));
}

function saveEvaluations() {
    localStorage.setItem('evaluations', JSON.stringify(evaluations));
}

// スタッフ管理機能
function addStaff() {
    const name = document.getElementById('staffName').value.trim();
    const position = document.getElementById('staffPosition').value.trim();
    
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    const newStaff = {
        id: generateId(),
        name: name,
        position: position || '未設定',
        createdAt: new Date().toISOString()
    };
    
    staff.push(newStaff);
    saveStaff();
    
    // 新しいスタッフの評価データを初期化
    evaluations[newStaff.id] = {};
    criteria.forEach(criterion => {
        evaluations[newStaff.id][criterion.id] = 'learning'; // デフォルトは学習中
    });
    saveEvaluations();
    
    renderStaff();
    closeModal('addStaffModal');
    document.getElementById('addStaffForm').reset();
    updateDataInfo();
}

function removeStaff(staffId) {
    if (confirm('このスタッフを削除してもよろしいですか？')) {
        staff = staff.filter(s => s.id !== staffId);
        delete evaluations[staffId];
        saveStaff();
        saveEvaluations();
        renderStaff();
    }
}

function renderStaff() {
    const staffList = document.getElementById('staffList');
    
    if (staff.length === 0) {
        staffList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>スタッフがいません</h3>
                <p>「スタッフ追加」ボタンから新しいスタッフを追加しましょう</p>
            </div>
        `;
        return;
    }
    
    staffList.innerHTML = staff.map(member => {
        const progress = calculateProgress(member.id);
        return `
            <div class="staff-card fade-in" onclick="showStaffDetail('${member.id}')">
                <h3>${member.name}</h3>
                <div class="staff-position">${member.position}</div>
                <div class="staff-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${progress}%</div>
                </div>
                <div class="staff-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-danger btn-small" onclick="removeStaff('${member.id}')">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function calculateProgress(staffId) {
    if (!evaluations[staffId] || criteria.length === 0) return 0;
    
    const staffEvals = evaluations[staffId];
    const completedCount = Object.values(staffEvals).filter(status => status === 'can-do').length;
    
    return Math.round((completedCount / criteria.length) * 100);
}

// 評価項目管理機能
function addCriteria() {
    const name = document.getElementById('criteriaName').value.trim();
    const category = document.getElementById('criteriaCategory').value;
    const description = document.getElementById('criteriaDescription').value.trim();
    
    if (!name) {
        alert('項目名を入力してください');
        return;
    }
    
    const newCriteria = {
        id: generateId(),
        name: name,
        category: category,
        description: description || ''
    };
    
    criteria.push(newCriteria);
    saveCriteria();
    
    // 既存スタッフの評価データに新項目を追加
    staff.forEach(member => {
        if (!evaluations[member.id]) {
            evaluations[member.id] = {};
        }
        evaluations[member.id][newCriteria.id] = 'learning';
    });
    saveEvaluations();
    
    renderCriteria();
    renderStaff(); // 進捗更新のため
    closeModal('addCriteriaModal');
    document.getElementById('addCriteriaForm').reset();
    updateDataInfo();
}

function removeCriteria(criteriaId) {
    if (confirm('この評価項目を削除してもよろしいですか？')) {
        criteria = criteria.filter(c => c.id !== criteriaId);
        saveCriteria();
        
        // 全スタッフの評価データからも削除
        Object.keys(evaluations).forEach(staffId => {
            delete evaluations[staffId][criteriaId];
        });
        saveEvaluations();
        
        renderCriteria();
        renderStaff(); // 進捗更新のため
        updateDataInfo();
    }
}

function renderCriteria() {
    const criteriaList = document.getElementById('criteriaList');
    
    if (criteria.length === 0) {
        criteriaList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list-check"></i>
                <h3>評価項目がありません</h3>
                <p>「項目追加」ボタンから新しい評価項目を追加しましょう</p>
            </div>
        `;
        return;
    }
    
    criteriaList.innerHTML = criteria.map(criterion => `
        <div class="criteria-card fade-in">
            <div class="criteria-header">
                <div>
                    <h3>${criterion.name}</h3>
                    <span class="criteria-category">${criterion.category}</span>
                </div>
            </div>
            ${criterion.description ? `<div class="criteria-description">${criterion.description}</div>` : ''}
            <div class="criteria-actions">
                <button class="btn btn-danger btn-small" onclick="removeCriteria('${criterion.id}')">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
        </div>
    `).join('');
}

// スタッフ詳細表示
function showStaffDetail(staffId) {
    const member = staff.find(s => s.id === staffId);
    if (!member) return;
    
    document.getElementById('staffDetailName').textContent = `${member.name} の評価詳細`;
    
    const evaluationsGrid = document.getElementById('staffEvaluations');
    evaluationsGrid.innerHTML = criteria.map(criterion => {
        const currentStatus = evaluations[staffId]?.[criterion.id] || 'learning';
        
        return `
            <div class="evaluation-item">
                <div class="evaluation-header">
                    <h4>${criterion.name}</h4>
                    <span class="criteria-category">${criterion.category}</span>
                </div>
                ${criterion.description ? `<p style="color: #718096; font-size: 0.9rem; margin-bottom: 10px;">${criterion.description}</p>` : ''}
                <div class="evaluation-status">
                    <button class="status-btn can-do ${currentStatus === 'can-do' ? 'active' : ''}" 
                            onclick="updateEvaluation('${staffId}', '${criterion.id}', 'can-do')">
                        <i class="fas fa-check"></i> できる
                    </button>
                    <button class="status-btn learning ${currentStatus === 'learning' ? 'active' : ''}" 
                            onclick="updateEvaluation('${staffId}', '${criterion.id}', 'learning')">
                        <i class="fas fa-clock"></i> 学習中
                    </button>
                    <button class="status-btn cannot-do ${currentStatus === 'cannot-do' ? 'active' : ''}" 
                            onclick="updateEvaluation('${staffId}', '${criterion.id}', 'cannot-do')">
                        <i class="fas fa-times"></i> できない
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    showModal('staffDetailModal');
}

function updateEvaluation(staffId, criteriaId, status) {
    if (!evaluations[staffId]) {
        evaluations[staffId] = {};
    }
    
    evaluations[staffId][criteriaId] = status;
    saveEvaluations();
    
    // ボタンの状態を更新
    const evaluationItem = event.target.closest('.evaluation-item');
    const statusButtons = evaluationItem.querySelectorAll('.status-btn');
    statusButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // 進捗バーを更新
    renderStaff();
}

// モーダル管理
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showAddStaffModal() {
    showModal('addStaffModal');
    document.getElementById('staffName').focus();
}

function showAddCriteriaModal() {
    showModal('addCriteriaModal');
    document.getElementById('criteriaName').focus();
}

// データのエクスポート・インポート機能
function exportData() {
    const data = {
        staff: staff,
        criteria: criteria,
        evaluations: evaluations,
        exportDate: new Date().toISOString(),
        version: "1.0"
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `pa_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 成功メッセージ
    showNotification('データがエクスポートされました！', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // データの妥当性チェック
            if (!data.staff || !data.criteria || !data.evaluations) {
                throw new Error('無効なデータ形式です');
            }
            
            if (confirm('データをインポートしますか？現在のデータは上書きされます。')) {
                staff = data.staff || [];
                criteria = data.criteria || [];
                evaluations = data.evaluations || {};
                
                saveStaff();
                saveCriteria();
                saveEvaluations();
                
                renderStaff();
                renderCriteria();
                updateDataInfo();
                
                showNotification('データのインポートが完了しました！', 'success');
            }
        } catch (error) {
            showNotification('ファイルの読み込みに失敗しました。正しいファイルを選択してください。', 'error');
        }
    };
    reader.readAsText(file);
    
    // ファイル選択をリセット
    event.target.value = '';
}

// データリセット機能
function resetAllData() {
    if (confirm('すべてのデータを削除してもよろしいですか？この操作は元に戻せません。')) {
        if (confirm('本当によろしいですか？')) {
            localStorage.removeItem('staff');
            localStorage.removeItem('criteria');
            localStorage.removeItem('evaluations');
            
            staff = [];
            criteria = [];
            evaluations = {};
            
            renderStaff();
            renderCriteria();
            updateDataInfo();
            
            showNotification('すべてのデータが削除されました。', 'info');
        }
    }
}

// データ統計情報の更新
function updateDataInfo() {
    document.getElementById('staffCount').textContent = staff.length;
    document.getElementById('criteriaCount').textContent = criteria.length;
    
    // 全体進捗の計算
    if (staff.length === 0 || criteria.length === 0) {
        document.getElementById('overallProgress').textContent = '0%';
        return;
    }
    
    let totalProgress = 0;
    staff.forEach(member => {
        totalProgress += calculateProgress(member.id);
    });
    
    const averageProgress = Math.round(totalProgress / staff.length);
    document.getElementById('overallProgress').textContent = `${averageProgress}%`;
}

// 通知システム
function showNotification(message, type = 'info') {
    // 既存の通知を削除
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // 3秒後に自動削除
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}
