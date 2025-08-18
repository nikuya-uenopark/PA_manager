class PAManager {
  constructor() {
    this.currentStaff = [];
    this.currentCriteria = [];
    this.currentTab = "sharedNote";
    this.editingCriteriaId = null;
    this._chart = null;
    this._staffEvalCache = new Map(); // key: `${staffId}:${criteriaId}` -> status
    this.criteriaFilter = "";
    this.editingStaffId = null;
    this._savingEvals = new Set(); // `${staffId}:${criteriaId}` while saving
    this._isSavingStaff = false;
    this._isSavingCriteria = false;
    this.init();
  }

  async init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }
  // 初期セットアップ
  setup() {
    this.initLoginOverlay();
    this.setupEventListeners();
    // 常にログイン必須: 毎回オーバーレイ表示
    document.body.classList.add("prelogin");
    this.showLoginOverlay();
  }

  // ====== 簡易スワイプログイン ======
  isLoggedIn() {
    return !!this._loginDone;
  }
  setLoggedIn() {
    this._loginDone = true;
  }
  clearLogin() {
    this._loginDone = false;
  }
  showLoginOverlay() {
    const ov = document.getElementById("loginOverlay");
    if (ov) {
      ov.style.display = "flex";
      ov.setAttribute("aria-hidden", "false");
    }
    document.body.style.overflow = "hidden";
  }
  hideLoginOverlay(immediate = false) {
    const ov = document.getElementById("loginOverlay");
    if (!ov) return;
    if (immediate) {
      ov.style.display = "none";
    } else {
      ov.classList.add("fade-out");
      setTimeout(() => {
        ov.style.display = "none";
        ov.classList.remove("fade-out");
      }, 600);
    }
    ov.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "auto";
    document.body.classList.remove("prelogin");
  }
  initLoginOverlay() {
    const root = document.querySelector("#loginOverlay .login-root");
    const area = document.getElementById("loginSwipeArea");
    const pinDisplay = document.getElementById("loginPinDisplay");
    const pinError =
      document.getElementById("loginPinError") ||
      document.getElementById("loginPinError");
    if (!root || !area || !pinDisplay) return;
    // PIN状態
    this._loginPin = "";
    const maxLen = 4;
    const updateDisplay = () => {
      const masked = this._loginPin.padEnd(maxLen, "_");
      const chars = masked
        .split("")
        .map((ch, idx) => {
          const filled = idx < this._loginPin.length;
          const isNew = filled && idx === this._loginPin.length - 1; // 直近入力桁
          return `<span class="pin-char ${
            filled ? "filled-char" : "empty-char"
          } ${isNew ? "animate-in" : ""}" data-i="${idx}">${
            filled ? ch : "_"
          }</span>`;
        })
        .join("");
      pinDisplay.innerHTML = chars;
      pinDisplay.classList.toggle("filled", this._loginPin.length === maxLen);
      area.classList.toggle("swipe-ready", this._loginPin.length === maxLen);
      if (pinError) pinError.textContent = "";
    };
    this._loginPinUpdateDisplay = updateDisplay;
    updateDisplay();
    // 数字ボタン
    area.addEventListener("click", (e) => {
      const btn = e.target.closest(".login-digit");
      if (!btn) return;
      const val = btn.getAttribute("data-val");
      if (val && this._loginPin.length < maxLen) {
        this._loginPin += val;
        updateDisplay();
      }
    });
    // スワイプ判定 (4桁入力後のみ)
    let startX = null,
      startY = null,
      moved = false;
    const threshold = 110,
      restraint = 80;
    const onStart = (e) => {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
    };
    const onMove = (e) => {
      if (startX === null) return;
      if (this._loginPin.length !== maxLen) return; // 4桁未入力なら無効
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > restraint) return;
      if (dx > 10) moved = true;
      if (dx > threshold) {
        this._attemptLogin(this._loginPin, root, pinDisplay, pinError);
        startX = null;
        startY = null;
      }
    };
    const onEnd = () => {
      if (!moved && this._loginPin.length === maxLen) {
        root.classList.add("swipe-fail");
        setTimeout(() => root.classList.remove("swipe-fail"), 420);
      }
      startX = null;
      startY = null;
      moved = false;
    };
    ["touchstart", "mousedown"].forEach((ev) =>
      area.addEventListener(ev, onStart, { passive: true })
    );
    ["touchmove", "mousemove"].forEach((ev) =>
      area.addEventListener(ev, onMove, { passive: true })
    );
    ["touchend", "mouseup", "mouseleave"].forEach((ev) =>
      area.addEventListener(ev, onEnd)
    );
    // バックスペース(物理)対応
    window.addEventListener("keydown", (e) => {
      if (document.body.classList.contains("prelogin")) {
        if (/^[0-9]$/.test(e.key) && this._loginPin.length < maxLen) {
          this._loginPin += e.key;
          updateDisplay();
        } else if (e.key === "Backspace") {
          this._loginPin = this._loginPin.slice(0, -1);
          updateDisplay();
        }
      }
    });
  }

  async _attemptLogin(pin, root, pinDisplay, pinError) {
    try {
      // DBの mgmtCode 一覧を取得しクライアント側で一致判定 (件数少を想定)
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("staff list fetch failed");
      const list = await res.json();
      const found = Array.isArray(list)
        ? list.some((s) => s.mgmtCode === pin)
        : false;
      if (found) {
        root.classList.add("swipe-valid");
        this.setLoggedIn();
        this.hideLoginOverlay();
        this.loadData();
      } else {
        if (pinError)
          pinError.textContent =
            "コードが一致しません。入力をリセットしました。";
        // PINをリセット
        this._resetPin();
        const digitsRow = document.getElementById("loginDigitsRow");
        if (digitsRow) {
          digitsRow.classList.add("shake");
          setTimeout(() => digitsRow.classList.remove("shake"), 480);
        }
        root.classList.add("swipe-fail");
        setTimeout(() => root.classList.remove("swipe-fail"), 420);
      }
    } catch (e) {
      console.error("login error", e);
      if (pinError) pinError.textContent = "通信エラー。再試行してください";
      this._resetPin();
      const digitsRow = document.getElementById("loginDigitsRow");
      if (digitsRow) {
        digitsRow.classList.add("shake");
        setTimeout(() => digitsRow.classList.remove("shake"), 480);
      }
    }
  }

  _resetPin() {
    this._loginPin = "";
    if (this._loginPinUpdateDisplay) this._loginPinUpdateDisplay();
  }

  // イベント登録
  setupEventListeners() {
    // モーダル背景クリックで閉じる
    window.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains("modal")) {
        this.closeModal(t.id);
      }
    });

    // スタッフ追加/更新フォーム
    const staffForm = document.getElementById("staffForm");
    if (staffForm) {
      staffForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log(
          "[staffForm] submit start (editingStaffId=",
          this.editingStaffId,
          ")"
        );
        const nameEl = document.getElementById("staffName");
        const name = nameEl?.value?.trim();
        const kana =
          document.getElementById("staffKana")?.value?.trim() || null;
        const position =
          document.getElementById("staffPositionType")?.value || null;
        const birth_date =
          document.getElementById("staffBirthDate")?.value || null;
        let mgmtCode = document.getElementById("staffMgmtCode")?.value?.trim();
        if (mgmtCode === "") mgmtCode = null;
        if (mgmtCode && !/^\d{4}$/.test(mgmtCode)) {
          this.showNotification(
            "管理番号は4桁の数字で入力してください (例 0123)",
            "error"
          );
          console.warn("[staffForm] invalid mgmtCode", mgmtCode);
          return;
        }
        if (!name) {
          this.showNotification("名前は必須です", "error");
          nameEl && nameEl.focus();
          return;
        }
        if (this._isSavingStaff) {
          console.log("[staffForm] already saving; ignored duplicate");
          return;
        }
        this._isSavingStaff = true;
        const submitBtn = staffForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        submitBtn && (submitBtn.dataset.originalText = submitBtn.innerHTML);
        if (submitBtn)
          submitBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        try {
          const isEdit = !!this.editingStaffId;
          const url = isEdit
            ? `/api/staff?id=${this.editingStaffId}`
            : "/api/staff";
          const method = isEdit ? "PUT" : "POST";
          console.log("[staffForm] fetch", method, url);
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              kana,
              position,
              birth_date,
              mgmtCode,
            }),
          });
          let payload = null;
          try {
            payload = await res.json();
          } catch {}
          if (!res.ok) {
            console.error("[staffForm] server error", res.status, payload);
            this.showNotification(
              (payload && payload.error) ||
                `保存に失敗しました (${res.status})`,
              "error"
            );
            return;
          }
          console.log("[staffForm] success", payload);
          this.showNotification(
            isEdit ? "スタッフを更新しました" : "スタッフを追加しました"
          );
          this.closeModal("staffModal");
          staffForm.reset();
          this.editingStaffId = null;
          await this.loadStaff();
          await this.loadStaffProgress();
          await this.loadLogs();
          this.updateStats();
        } catch (err) {
          console.error("スタッフ保存エラー:", err);
          this.showNotification("スタッフの保存に失敗しました", "error");
        } finally {
          this._isSavingStaff = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
              submitBtn.dataset.originalText ||
              '<i class="fas fa-save"></i> 保存';
          }
        }
      });
    }

    // 評価項目追加/更新フォーム
    const criteriaForm = document.getElementById("criteriaForm");
    if (criteriaForm) {
      criteriaForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("criteriaName")?.value?.trim();
        const category =
          document.getElementById("criteriaCategory")?.value || "共通";
        let description =
          document.getElementById("criteriaDescription")?.value || null;
        if (description) {
          // 常時自動整形: 行ごとに - を付与し <br> 連結
          const lines = description
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          if (lines.length)
            description = lines
              .map((l) => (l.startsWith("-") ? l : `- ${l}`))
              .join("<br>");
        }
        if (!name) {
          this.showNotification("項目名は必須です", "error");
          return;
        }
        if (this._isSavingCriteria) return;
        this._isSavingCriteria = true;
        const submitBtn = criteriaForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const isEdit = !!this.editingCriteriaId;
          const url = isEdit
            ? `/api/criteria?id=${this.editingCriteriaId}`
            : "/api/criteria";
          const method = isEdit ? "PUT" : "POST";
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, category, description }),
          });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          this.showNotification(
            isEdit ? "評価項目を更新しました" : "評価項目を追加しました"
          );
          this.closeModal("criteriaModal");
          criteriaForm.reset();
          this.editingCriteriaId = null;
          await this.loadCriteria();
          await this.loadLogs();
          this.updateStats();
        } catch (err) {
          console.error("評価項目保存エラー:", err);
          this.showNotification("評価項目の保存に失敗しました", "error");
        } finally {
          this._isSavingCriteria = false;
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
    // (チェックボックス廃止) 常時自動整形のため追加イベント不要

    // カテゴリ絞り込み
    const filter = document.getElementById("criteriaCategoryFilter");
    if (filter) {
      filter.addEventListener("change", () => {
        this.criteriaFilter = filter.value || "";
        this.renderCriteria();
      });
    }

    // 数字のみ入力フィルタ (管理番号)
    document
      .querySelectorAll('input[data-digit-only="true"]')
      .forEach((inp) => {
        inp.addEventListener("input", () => {
          const before = inp.value;
          const only = before.replace(/[^0-9]/g, "").slice(0, 4);
          if (before !== only) inp.value = only;
          // スタッフフォームの保存ボタン活性/非活性
          if (inp.id === "staffMgmtCode") {
            const saveBtn = document.querySelector(
              '#staffForm button[type="submit"]'
            );
            if (saveBtn) {
              const nameVal = document
                .getElementById("staffName")
                ?.value?.trim();
              const mg = inp.value;
              // 条件: 名前必須 & (mgmtCode が空 または 4桁)
              const ok = !!nameVal && (mg === "" || /^\d{4}$/.test(mg));
              saveBtn.disabled = !ok;
            }
          }
        });
      });

    // 初期ロード時にも状態反映 (名前未入力でdisabled)
    const staffSaveBtn = document.querySelector(
      '#staffForm button[type="submit"]'
    );
    if (staffSaveBtn) {
      // 初期は追加モード想定で無効。編集モードで開いたら editStaff 内で再度有効化。
      staffSaveBtn.disabled = true;
      const recompute = () => {
        const nameVal = document.getElementById("staffName")?.value?.trim();
        const mgVal = document.getElementById("staffMgmtCode")?.value?.trim();
        const ok = !!nameVal && (mgVal === "" || /^\d{4}$/.test(mgVal));
        // 追加モード (editingStaffId null) でも条件満たせば活性化
        if (!this.editingStaffId && !ok) staffSaveBtn.disabled = true;
        else staffSaveBtn.disabled = !ok;
      };
      ["input", "change"].forEach((ev) => {
        document.getElementById("staffName")?.addEventListener(ev, recompute);
        document
          .getElementById("staffMgmtCode")
          ?.addEventListener(ev, recompute);
      });
    }
  }

  showNotification(message, type = "success") {
    const el = document.getElementById("notification");
    if (!el) return;
    el.textContent = message;
    el.className = "notification";
    void el.offsetWidth; // reflow to restart animation
    if (type === "error") el.classList.add("error");
    else if (type === "warning") el.classList.add("warning");
    el.classList.add("show");
    el.style.display = "block";
    clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => {
        if (!el.classList.contains("show")) el.style.display = "none";
      }, 500);
    }, 2000); // 約2秒表示
  }

  async _autoSaveStaffEvaluations() {
    try {
      const hasStatus =
        this._pendingEvalChanges && this._pendingEvalChanges.size > 0;
      const hasTester =
        this._pendingEvalTests && this._pendingEvalTests.size > 0;
      if (!hasStatus && !hasTester) return; // 変更なし
      const overlay = document.getElementById("savingOverlay");
      if (overlay) overlay.style.display = "flex";
      const changedById = document.getElementById("evaluationChangedBy")?.value
        ? Number(document.getElementById("evaluationChangedBy").value)
        : null;
      const keys = new Set();
      if (hasStatus)
        for (const k of this._pendingEvalChanges.keys()) keys.add(k);
      if (hasTester) for (const k of this._pendingEvalTests.keys()) keys.add(k);
      const payload = Array.from(keys).map((key) => {
        const [sid, cid] = key.split(":").map(Number);
        const status = this._pendingEvalChanges
          ? this._pendingEvalChanges.get(key)
          : undefined;
        const test = this._pendingEvalTests
          ? this._pendingEvalTests.get(key)
          : undefined;
        return { staffId: sid, criteriaId: cid, status, test };
      });
      const res = await fetch("/api/evaluations-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: payload, changedBy: changedById }),
      });
      if (!res.ok) throw new Error("auto batch failed");
      this._pendingEvalChanges.clear();
      if (this._pendingEvalTests) this._pendingEvalTests.clear();
      await this.loadLogs();
      await this.loadStaffProgress();
      this.showNotification("評価を自動保存しました");
    } catch (e) {
      console.error("自動保存エラー", e);
      this.showNotification("評価の自動保存に失敗", "error");
    } finally {
      const overlay = document.getElementById("savingOverlay");
      if (overlay) overlay.style.display = "none";
    }
  }

  async loadData() {
    try {
      await Promise.all([
        this.loadStaff(),
        this.loadCriteria(),
        this.loadLogs(),
      ]);
      // 共有メモは最後に読み込み（他と独立）
      this.loadSharedNote();
      await this.loadStaffProgress();
      this.updateStats();
    } catch (error) {
      console.error("データ読み込みエラー:", error);
    } finally {
      this.hideLoadingScreen();
    }
  }

  hideLoadingScreen() {
    const ls = document.getElementById("loadingScreen");
    if (!ls) return;
    // フェードアウト
    ls.style.opacity = "0";
    setTimeout(() => {
      ls.style.display = "none";
    }, 400);
  }

  async loadStaff() {
    try {
      const response = await fetch("/api/staff");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.currentStaff = await response.json();
      console.log("[loadStaff] loaded staff count =", this.currentStaff.length);
      this.renderStaff();
      if (window._refreshGamePlayerSelect) {
        console.log("[loadStaff] calling _refreshGamePlayerSelect");
        window._refreshGamePlayerSelect();
      } else {
        console.warn("[loadStaff] _refreshGamePlayerSelect not defined yet");
      }
    } catch (error) {
      console.error("スタッフデータ読み込みエラー:", error);
      // ユーザーに通知
      this.showNotification("スタッフデータの読み込みに失敗しました", "error");
    }
  }

  async loadStaffProgress() {
    try {
      const res = await fetch("/api/staff-progress");
      if (!res.ok) return;
      const list = await res.json();
      this._progressMap = new Map(list.map((x) => [x.staffId, x]));
      this.renderStaff();
    } catch (e) {
      console.error("進捗読み込みエラー:", e);
    }
  }

  async loadCriteria() {
    try {
      const response = await fetch("/api/criteria");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.length === 0) {
        this.showNotification("No criteria data available", "info");
      } else {
        this.currentCriteria = data;
        this.renderCriteria();
      }
    } catch (error) {
      console.error("Criteria data load error:", error);
      this.showNotification("Failed to load criteria data", "error");
    }
  }

  renderStaff() {
    const container = document.getElementById("staffGrid");
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

    container.innerHTML = this.currentStaff
      .map((staff) => {
        const prog = this._progressMap?.get(staff.id) || {
          progressPercent: 0,
          counts: {
            done: 0,
            learning: 0,
            notStarted: this.currentCriteria?.length || 0,
          },
        };
        const p = prog.progressPercent || 0;
        const counts = prog.counts || { done: 0, learning: 0, notStarted: 0 };
        const mgmt = staff.mgmtCode || "-";
        return `
                <div class="staff-card">
                    <div class="staff-header" onclick="showStaffDetail(${
                      staff.id
                    })">
                        <div class="staff-info">
                            <div style="color:#6b7280; font-size:12px;">${
                              staff.kana || ""
                            }</div>
                            <h3>${staff.name}</h3>
                            <span class="position-badge">${
                              staff.position || "未設定"
                            }</span>
                            <div style=\"font-size:11px; color:#555; margin-top:4px;\">管理番号: <span style=\"font-weight:600;\">${mgmt}</span></div>
                        </div>
                        <div class="staff-card-actions">
                            <button class="btn btn-secondary btn-icon" title="編集" onclick="event.stopPropagation(); editStaff(${
                              staff.id
                            })"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-icon" title="削除" onclick="event.stopPropagation(); deleteStaff(${
                              staff.id
                            })"><i class="fas fa-trash"></i></button>
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
                            <span class="stat-value-small">${
                              counts.notStarted
                            }</span>
                            <span class="stat-label-small">未着手</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${
                              counts.learning
                            }</span>
                            <span class="stat-label-small">学習中</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${counts.done}</span>
                            <span class="stat-label-small">習得済み</span>
                        </div>
                        <div class="stat-item-small">
                            <span class="stat-value-small">${
                              prog.tested ?? 0
                            }</span>
                            <span class="stat-label-small">テスト完了</span>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  renderCriteria() {
    const container = document.getElementById("criteriaGrid");
    if (!container) return;

    // フィルタ適用 + 名前順
    const filtered = (this.currentCriteria || [])
      .filter(
        (c) =>
          !this.criteriaFilter || (c.category || "") === this.criteriaFilter
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

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

    container.innerHTML = filtered
      .map(
        (criteria) => `
            <div class="criteria-card" data-id="${criteria.id}">
                <div class="criteria-header">
                    <div>
                        <div class="criteria-title">${criteria.name}</div>
                        <span class="criteria-category">${
                          criteria.category || "共通"
                        }</span>
                    </div>
                    <div class="criteria-actions">
                        <button class="btn btn-secondary" onclick="editCriteria(${
                          criteria.id
                        })">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger" onclick="deleteCriteria(${
                          criteria.id
                        })">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${
                  criteria.description
                    ? `<div class="criteria-description">${criteria.description}</div>`
                    : ""
                }
            </div>
        `
      )
      .join("");
  }

  // ドラッグ操作は廃止（no-op）
  setupSortable() {}

  switchTab(tabName) {
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.classList.remove("active");
    });
    const tabBtn = document.getElementById(tabName + "Tab");
    if (tabBtn) tabBtn.classList.add("active");

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    const panel = document.getElementById(tabName + "Panel");
    if (panel) panel.classList.add("active");

    this.currentTab = tabName;

    if (tabName === "analytics") {
      // ログのみ更新（グラフ廃止）
      this.loadLogs();
    } else if (tabName === "sharedNote") {
      // 遅延読み込み（まだ未読なら）
      if (!this._sharedNoteLoaded) this.loadSharedNote();
    }
  }
  // renderAnalytics 削除（円グラフ機能廃止）

  showModal(modalId) {
    document.getElementById(modalId).style.display = "block";
    document.body.style.overflow = "hidden";
  }

  closeModal(modalId) {
    if (modalId === "staffDetailModal") {
      const hasStatus =
        this._pendingEvalChanges && this._pendingEvalChanges.size > 0;
      const hasTester =
        this._pendingEvalTests && this._pendingEvalTests.size > 0;
      if (hasStatus || hasTester) {
        const changer = document.getElementById("evaluationChangedBy");
        const changedByVal = changer ? changer.value : "";
        if (!changedByVal) {
          if (changer) {
            changer.classList.add("input-error");
            changer.focus();
          }
          this.showNotification("進捗変更者を選択してください", "error");
          return; // abort close
        }
      }
    }
    const el = document.getElementById(modalId);
    if (el) el.style.display = "none";
    document.body.style.overflow = "auto";
    if (modalId === "criteriaModal") this.editingCriteriaId = null;
    if (modalId === "staffDetailModal") this._autoSaveStaffEvaluations();
  }

  updateStats() {
    const totalStaffElement = document.getElementById("totalStaff");
    const totalCriteriaElement = document.getElementById("totalCriteria");
    const avgProgressElement = document.getElementById("avgProgress");

    if (totalStaffElement)
      totalStaffElement.textContent = this.currentStaff.length;
    if (totalCriteriaElement)
      totalCriteriaElement.textContent = this.currentCriteria.length;
    if (avgProgressElement)
      avgProgressElement.textContent = Math.floor(Math.random() * 100) + "%";
  }

  async loadLogs() {
    try {
      const res = await fetch("/api/logs?limit=199");
      if (!res.ok) return;
      let logs = await res.json();
      // 念のため防御的に最大199件に丸める
      if (Array.isArray(logs) && logs.length > 199) {
        logs = logs.slice(0, 199);
      }
      const box = document.getElementById("activityLogs");
      if (!box) return;
      if (!logs || logs.length === 0) {
        box.innerHTML = '<div class="empty-state">まだログはありません</div>';
        return;
      }
      box.innerHTML = logs
        .map((l) => {
          const t = new Date(l.createdAt).toLocaleString();
          return `<div class="log-item"><div class="log-time">${t}</div><div class="log-message">${l.message}</div></div>`;
        })
        .join("");
    } catch (e) {
      console.error("ログ取得エラー", e);
    }
  }
}

// --- 共有メモ機能 ---
PAManager.prototype.loadSharedNote = async function () {
  try {
    const statusEl = document.getElementById("sharedNoteStatus");
    if (statusEl) statusEl.textContent = "読み込み中...";
    const res = await fetch("/api/shared-note");
    if (!res.ok) throw new Error("failed");
    const data = await res.json();
    const opsTa = document.getElementById("sharedNoteOps");
    const commTa = document.getElementById("sharedNoteComm");
    const stoveDateInput = document.getElementById("stoveDate");
    const stoveNumSelect = document.getElementById("stoveNumber");
    // 旧 font-wheel 要素は廃止（モーダルピッカーに移行）
    if (opsTa) opsTa.value = data?.ops || "";
    if (commTa) commTa.value = data?.comm || "";
    if (stoveDateInput && data?.stoveDate)
      stoveDateInput.value = data.stoveDate;
    if (stoveNumSelect && data?.stoveNumber)
      stoveNumSelect.value = data.stoveNumber;
    // 保存されているフォントサイズを初期反映 (従来はポーラー内のみだったため初回表示が16px固定になる問題を修正)
    if (data?.opsFont && opsTa) {
      const sz = parseInt(data.opsFont, 10);
      if (!isNaN(sz)) {
        opsTa.style.fontSize = sz + "px";
        opsTa.style.lineHeight = Math.round(sz * 1.4) + "px";
        const disp = document.querySelector(
          '.font-wheel-value[data-target-display="sharedNoteOps"]'
        );
        if (disp) disp.textContent = sz + "px";
      }
    }
    if (data?.commFont && commTa) {
      const sz = parseInt(data.commFont, 10);
      if (!isNaN(sz)) {
        commTa.style.fontSize = sz + "px";
        commTa.style.lineHeight = Math.round(sz * 1.4) + "px";
        const disp = document.querySelector(
          '.font-wheel-value[data-target-display="sharedNoteComm"]'
        );
        if (disp) disp.textContent = sz + "px";
      }
    }
    // 旧 font-wheel 初期化処理削除
    this._sharedNoteOriginal = JSON.stringify({
      ops: opsTa ? opsTa.value : "",
      comm: commTa ? commTa.value : "",
      stoveDate: stoveDateInput ? stoveDateInput.value : "",
      stoveNumber: stoveNumSelect ? stoveNumSelect.value : "",
      opsFont: data?.opsFont || "",
      commFont: data?.commFont || "",
    });
    this._sharedNoteLoaded = true;
    if (statusEl) statusEl.textContent = "最新です";
    const upd = document.getElementById("sharedNoteUpdated");
    if (upd && data?.updatedAt) {
      upd.textContent =
        "最終更新: " + new Date(data.updatedAt).toLocaleString();
    }
    // イベント1回だけ設定
    if (!this._sharedNoteBound && (opsTa || commTa)) {
      this._sharedNoteBound = true;
      const handler = () => {
        const s = document.getElementById("sharedNoteStatus");
        if (s) s.textContent = "編集中...";
        clearTimeout(this._sharedNoteTimer);
        this._sharedNoteTimer = setTimeout(() => {
          this.saveSharedNote();
        }, 1000);
      };
      if (opsTa) opsTa.addEventListener("input", handler);
      if (commTa) commTa.addEventListener("input", handler);
      if (stoveDateInput) stoveDateInput.addEventListener("change", handler);
      if (stoveNumSelect) stoveNumSelect.addEventListener("change", handler);
      // 定期的な外部更新同期 (編集していない時のみ)。既に設定済なら再設定しない
      if (!this._sharedNotePoller) {
        this._sharedNotePoller = setInterval(async () => {
          // 自分が未保存編集中(ステータスが編集中/保存中)なら衝突回避のため同期しない
          const st = document.getElementById("sharedNoteStatus");
          const stText = st ? st.textContent : "";
          if (
            stText &&
            (stText.includes("編集中") || stText.includes("保存中"))
          )
            return;
          try {
            const r = await fetch("/api/shared-note");
            if (!r.ok) return;
            const d = await r.json();
            const opsTa2 = document.getElementById("sharedNoteOps");
            const commTa2 = document.getElementById("sharedNoteComm");
            const stoveDate2 = document.getElementById("stoveDate");
            const stoveNum2 = document.getElementById("stoveNumber");
            // font-wheel は存在しない（モーダル制御に統一）
            if (!opsTa2 && !commTa2) return;
            const serverObj = {
              ops: d?.ops || "",
              comm: d?.comm || "",
              stoveDate: d?.stoveDate || "",
              stoveNumber: d?.stoveNumber || "",
              opsFont: d?.opsFont || "",
              commFont: d?.commFont || "",
            };
            const serverStr = JSON.stringify(serverObj);
            const currentStr = JSON.stringify({
              ops: opsTa2 ? opsTa2.value : "",
              comm: commTa2 ? commTa2.value : "",
              stoveDate: stoveDate2 ? stoveDate2.value : "",
              stoveNumber: stoveNum2 ? stoveNum2.value : "",
              opsFont: d?.opsFont || "",
              commFont: d?.commFont || "",
            });
            if (
              serverStr !== this._sharedNoteOriginal &&
              currentStr === this._sharedNoteOriginal
            ) {
              if (opsTa2) opsTa2.value = serverObj.ops;
              if (commTa2) commTa2.value = serverObj.comm;
              if (stoveDate2) stoveDate2.value = serverObj.stoveDate;
              if (stoveNum2) stoveNum2.value = serverObj.stoveNumber;
              if (serverObj.opsFont) {
                const sz = parseInt(serverObj.opsFont, 10);
                if (!isNaN(sz) && opsTa2) {
                  opsTa2.style.fontSize = sz + "px";
                  opsTa2.style.lineHeight = Math.round(sz * 1.4) + "px";
                  const el = document.querySelector(
                    `.font-wheel-value[data-target-display="sharedNoteOps"]`
                  );
                  if (el) el.textContent = sz + "px";
                }
              }
              if (serverObj.commFont) {
                const sz = parseInt(serverObj.commFont, 10);
                if (!isNaN(sz) && commTa2) {
                  commTa2.style.fontSize = sz + "px";
                  commTa2.style.lineHeight = Math.round(sz * 1.4) + "px";
                  const el = document.querySelector(
                    `.font-wheel-value[data-target-display="sharedNoteComm"]`
                  );
                  if (el) el.textContent = sz + "px";
                }
              }
              this._sharedNoteOriginal = serverStr;
              if (st) st.textContent = "同期中...";
              setTimeout(() => {
                if (st && st.textContent === "同期中...")
                  st.textContent = "最新です";
              }, 2000);
            }
          } catch (_) {
            /* ignore */
          }
        }, 15000); // 15秒毎
      }
    }
  } catch (e) {
    console.error("共有メモ読み込み失敗", e);
    const statusEl = document.getElementById("sharedNoteStatus");
    if (statusEl) statusEl.textContent = "読み込み失敗";
  }
};

PAManager.prototype.saveSharedNote = async function (force = false) {
  if (this._savingSharedNote) return;
  const opsTa = document.getElementById("sharedNoteOps");
  const commTa = document.getElementById("sharedNoteComm");
  const stoveDateInput = document.getElementById("stoveDate");
  const stoveNumSelect = document.getElementById("stoveNumber");
  const opsFontVal = document.querySelector(
    '.font-wheel-value[data-target-display="sharedNoteOps"]'
  );
  const commFontVal = document.querySelector(
    '.font-wheel-value[data-target-display="sharedNoteComm"]'
  );
  if (
    !opsTa &&
    !commTa &&
    !stoveDateInput &&
    !stoveNumSelect &&
    !opsFontVal &&
    !commFontVal
  )
    return;
  const ops = opsTa ? opsTa.value : "";
  const comm = commTa ? commTa.value : "";
  const stoveDate = stoveDateInput ? stoveDateInput.value : "";
  const stoveNumber = stoveNumSelect ? stoveNumSelect.value : "";
  const opsFont = opsFontVal
    ? (opsFontVal.textContent || "").replace("px", "")
    : "";
  const commFont = commFontVal
    ? (commFontVal.textContent || "").replace("px", "")
    : "";
  const currentStr = JSON.stringify({
    ops,
    comm,
    stoveDate,
    stoveNumber,
    opsFont,
    commFont,
  });
  if (
    !force &&
    currentStr === this._sharedNoteOriginal &&
    (ops !== "" ||
      comm !== "" ||
      stoveDate !== "" ||
      stoveNumber !== "" ||
      opsFont !== "" ||
      commFont !== "")
  ) {
    const s = document.getElementById("sharedNoteStatus");
    if (s) s.textContent = "変更なし";
    return;
  }
  this._savingSharedNote = true;
  const statusEl = document.getElementById("sharedNoteStatus");
  if (statusEl) statusEl.textContent = "保存中...";
  try {
    const res = await fetch("/api/shared-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ops,
        comm,
        stoveDate,
        stoveNumber,
        opsFont,
        commFont,
      }),
    });
    if (!res.ok) throw new Error("save failed");
    this._sharedNoteOriginal = currentStr;
    if (statusEl) statusEl.textContent = "保存しました";
    const upd = document.getElementById("sharedNoteUpdated");
    if (upd) upd.textContent = "最終更新: " + new Date().toLocaleString();
    this.loadLogs();
  } catch (e) {
    console.error("共有メモ保存失敗", e);
    if (statusEl) statusEl.textContent = "保存失敗";
    this.showNotification("共有メモの保存に失敗しました", "error");
  } finally {
    this._savingSharedNote = false;
    setTimeout(() => {
      if (statusEl && statusEl.textContent === "保存しました")
        statusEl.textContent = "最新です";
    }, 2000);
  }
};

function saveSharedNote() {
  paManager.saveSharedNote(true);
}

// グローバル変数とインスタンス (GameHub IIFE より前に生成する必要あり)
let paManager = new PAManager();
// window へ公開 (top-level let では window プロパティにならないため)
try {
  window.paManager = paManager;
} catch {}

// 共有メモ フォントサイズ切替
document.addEventListener("DOMContentLoaded", () => {
  // フォントサイズピッカーモーダル
  const modal = document.getElementById("fontSizePickerModal");
  const list = document.getElementById("fontSizePickerList");
  const applyBtn = document.getElementById("fontSizePickerApplyBtn");
  let currentTarget = null;
  let tempValue = 16;
  const values = Array.from({ length: 31 }, (_, i) => i + 10); // 10-40 (正順)
  const itemHeight = 48;
  const repeats = 5; // 十分な繰り返しで滑らか無限風
  const middleBlock = Math.floor(repeats / 2); // 2 (0..4)
  let framePending = false;
  function buildList(selected) {
    const parts = [];
    for (let r = 0; r < repeats; r++) {
      values.forEach((v, vi) => {
        const globalIdx = r * values.length + vi; // 0..(values.length*repeats-1)
        // active 初期判定: 中央ブロック内かつ値一致
        const isActive = r === middleBlock && v === selected;
        parts.push(
          `<div class="picker-item ${
            isActive ? "active" : ""
          }" data-v="${v}" data-gidx="${globalIdx}" role="option" aria-selected="${isActive}">${v}px</div>`
        );
      });
    }
    list.innerHTML = parts.join("");
    // 中央ブロックの該当値位置へ
    const vi = Math.max(0, values.indexOf(selected));
    const targetGlobalIdx = middleBlock * values.length + vi;
    setTimeout(() => {
      const container = list.parentElement;
      const centerOffset = container.clientHeight / 2 - itemHeight / 2;
      container.scrollTop = targetGlobalIdx * itemHeight - centerOffset;
    }, 0);
  }
  let pickerLoopId = null;
  function startPickerLoop() {
    stopPickerLoop();
    const container = list.parentElement;
    const blockSizePx = values.length * itemHeight;
    const run = () => {
      const centerOffset = container.clientHeight / 2 - itemHeight / 2;
      let pos = container.scrollTop;
      const minPx = (middleBlock - 1) * blockSizePx;
      const maxPx = (middleBlock + 1) * blockSizePx;
      if (pos < minPx || pos > maxPx + blockSizePx - itemHeight) {
        const approxIdx = Math.round((pos + centerOffset) / itemHeight);
        const rawIdx =
          ((approxIdx % values.length) + values.length) % values.length;
        const targetIdx = middleBlock * values.length + rawIdx;
        container.scrollTop = targetIdx * itemHeight - centerOffset;
        pos = container.scrollTop;
      }
      const approxIdx2 = Math.round((pos + centerOffset) / itemHeight);
      const rawIdx2 =
        ((approxIdx2 % values.length) + values.length) % values.length;
      const value = values[rawIdx2];
      if (value !== tempValue) {
        tempValue = value;
        const desiredGlobalIdx = middleBlock * values.length + rawIdx2;
        const prev = list.querySelector(".picker-item.active");
        if (prev) {
          prev.classList.remove("active");
          prev.setAttribute("aria-selected", "false");
        }
        const next = list.querySelector(
          `.picker-item[data-gidx="${desiredGlobalIdx}"]`
        );
        if (next) {
          next.classList.add("active");
          next.setAttribute("aria-selected", "true");
        }
      }
      pickerLoopId = requestAnimationFrame(run);
    };
    run();
  }
  function stopPickerLoop() {
    if (pickerLoopId) {
      cancelAnimationFrame(pickerLoopId);
      pickerLoopId = null;
    }
  }
  function openPicker(targetId) {
    currentTarget = targetId;
    const disp = document.querySelector(
      `.font-size-trigger[data-target="${targetId}"]`
    );
    const base = disp ? parseInt(disp.textContent.replace("px", ""), 10) : 16;
    tempValue = isNaN(base) ? 16 : base;
    buildList(tempValue);
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
    startPickerLoop();
  }
  function closePicker() {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
    currentTarget = null;
    stopPickerLoop();
  }
  list.addEventListener("click", (e) => {
    const it = e.target.closest(".picker-item");
    if (!it) return;
    const val = parseInt(it.getAttribute("data-v"), 10);
    if (isNaN(val)) return;
    tempValue = val;
    const container = list.parentElement;
    const centerOffset = container.clientHeight / 2 - itemHeight / 2;
    const rawIdx = values.indexOf(val);
    const targetIdx = middleBlock * values.length + rawIdx;
    container.scrollTo({
      top: targetIdx * itemHeight - centerOffset,
      behavior: "smooth",
    });
  });
  applyBtn.addEventListener("click", () => {
    if (!currentTarget) {
      closePicker();
      return;
    }
    const disp = document.querySelector(
      `.font-size-trigger[data-target="${currentTarget}"]`
    );
    const ta = document.getElementById(currentTarget);
    if (disp) disp.textContent = tempValue + "px";
    if (ta) {
      ta.style.fontSize = tempValue + "px";
      ta.style.lineHeight = Math.round(tempValue * 1.4) + "px";
    }
    // 保存トリガ
    if (window.paManager) {
      const s = document.getElementById("sharedNoteStatus");
      if (s) s.textContent = "編集中...";
      clearTimeout(window.paManager._sharedNoteTimer);
      window.paManager._sharedNoteTimer = setTimeout(
        () => window.paManager.saveSharedNote(),
        400
      );
    }
    closePicker();
  });
  window.closeFontSizePicker = closePicker;
  document.querySelectorAll(".font-size-trigger").forEach((el) => {
    el.addEventListener("click", () =>
      openPicker(el.getAttribute("data-target"))
    );
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker(el.getAttribute("data-target"));
      }
    });
  });
  // 背景クリックで閉じる
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closePicker();
  });
  // コンロつけ 日付 & 卓番号
  const dateInput = document.getElementById("stoveDate");
  const numSelect = document.getElementById("stoveNumber");
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  function updateStove() {
    let formattedDate = "";
    if (dateInput && dateInput.value) {
      const d = new Date(dateInput.value + "T00:00:00");
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        const w = weekdays[d.getDay()];
        formattedDate = `${y}/${m}/${da}(${w})`;
      }
    }
    const num = numSelect && numSelect.value ? numSelect.value : "";
    // デバウンス保存 (paManager利用可時のみ)
    if (window.paManager) {
      const s = document.getElementById("sharedNoteStatus");
      if (s) s.textContent = "編集中...";
      clearTimeout(window.paManager._sharedNoteTimer);
      window.paManager._sharedNoteTimer = setTimeout(() => {
        window.paManager.saveSharedNote();
      }, 800);
    }
  }
  if (dateInput) dateInput.addEventListener("change", updateStove);
  if (numSelect) numSelect.addEventListener("change", updateStove);
});

// ---- iOSなどでのダブルタップズーム抑止 ----
let _lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  function (e) {
    const now = Date.now();
    if (now - _lastTouchEnd <= 350) {
      e.preventDefault();
    }
    _lastTouchEnd = now;
  },
  { passive: false }
);
// ピンチズーム無効化
document.addEventListener(
  "gesturestart",
  function (e) {
    e.preventDefault();
  },
  { passive: false }
);

// グローバル関数
function switchTab(tabName) {
  paManager.switchTab(tabName);
}

function showAddStaffModal() {
  // 追加モードに初期化
  paManager.editingStaffId = null;
  const title = document.getElementById("staffModalTitle");
  if (title) title.textContent = "新しいスタッフを追加";
  const form = document.getElementById("staffForm");
  if (form) form.reset();
  document.getElementById("staffPositionType").value = "バイト";
  const mgmtInput = document.getElementById("staffMgmtCode");
  if (mgmtInput) mgmtInput.value = "";
  paManager.showModal("staffModal");
}

function showAddCriteriaModal() {
  // 追加モード: 前回の編集状態をリセット
  paManager.editingCriteriaId = null;
  const title = document.getElementById("criteriaModalTitle");
  if (title) title.textContent = "新しい評価項目を追加";
  const nameEl = document.getElementById("criteriaName");
  if (nameEl) nameEl.value = "";
  const catEl = document.getElementById("criteriaCategory");
  if (catEl) catEl.value = "共通";
  const descEl = document.getElementById("criteriaDescription");
  if (descEl) descEl.value = "";
  paManager.showModal("criteriaModal");
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
  if (confirm("この評価項目を削除しますか？")) {
    paManager.deleteCriteria(criteriaId);
  }
}

function sortCriteriaByCategory() {
  paManager.sortCriteriaByCategory();
}

// 追加メソッド群
PAManager.prototype.beginEditCriteria = function (criteriaId) {
  const item = this.currentCriteria.find((c) => c.id === criteriaId);
  if (!item) return;
  this.editingCriteriaId = criteriaId;
  document.getElementById("criteriaModalTitle").textContent = "評価項目を編集";
  document.getElementById("criteriaName").value = item.name || "";
  document.getElementById("criteriaCategory").value = item.category || "共通";
  // description に <br> を含む場合は改行に戻し、先頭の "- " は表示上そのまま
  const descEl = document.getElementById("criteriaDescription");
  if (descEl) {
    if (item.description) {
      // <br> を改行へ置換してテキストエリアに表示
      const restored = item.description.replace(/<br\s*\/?>/gi, "\n");
      descEl.value = restored;
    } else {
      descEl.value = "";
    }
  }
  this.showModal("criteriaModal");
};

// スタッフ編集（簡易: モーダルは既存の追加フォームを流用するなら別実装。ここでは名前だけの例）
function editStaff(id) {
  const s = paManager.currentStaff.find((x) => x.id === id);
  if (!s) return;
  paManager.editingStaffId = id;
  document.getElementById("staffModalTitle").textContent = "スタッフを編集";
  document.getElementById("staffName").value = s.name || "";
  document.getElementById("staffKana").value = s.kana || "";
  document.getElementById("staffPositionType").value = s.position || "バイト";
  const mgmtInput = document.getElementById("staffMgmtCode");
  if (mgmtInput) mgmtInput.value = s.mgmtCode || "";
  // birth_date: APIは birthDate(DB側), クライアントは birth_date(YYYY-MM-DD)
  const bd = s.birth_date || (s.birthDate ? new Date(s.birthDate) : null);
  if (bd) {
    const d = new Date(bd);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    document.getElementById("staffBirthDate").value = `${yyyy}-${mm}-${dd}`;
  } else {
    document.getElementById("staffBirthDate").value = "";
  }
  // 編集モードでは即ボタン活性化（名前が既にあるため）
  const saveBtn = document.querySelector('#staffForm button[type="submit"]');
  if (saveBtn) {
    saveBtn.disabled = false; // 編集開始時は既存データが正しい前提で有効化
  }
  paManager.showModal("staffModal");
}

function deleteStaff(id) {
  if (!confirm("このスタッフを削除しますか？")) return;
  fetch(`/api/staff?id=${id}`, { method: "DELETE" })
    .then((r) => {
      if (!r.ok) throw new Error("delete failed");
      return r.json();
    })
    .then(async () => {
      paManager.showNotification("スタッフを削除しました");
      await paManager.loadStaff();
      await paManager.loadStaffProgress();
      await paManager.loadLogs();
    })
    .catch((e) => {
      console.error(e);
      paManager.showNotification("削除に失敗しました", "error");
    });
}

PAManager.prototype.deleteCriteria = async function (criteriaId) {
  try {
    const res = await fetch(`/api/criteria?id=${criteriaId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    this.showNotification("評価項目を削除しました");
    await this.loadCriteria();
    await this.loadLogs();
    this.updateStats();
  } catch (e) {
    console.error("評価項目削除エラー:", e);
    this.showNotification("評価項目の削除に失敗しました", "error");
  }
};

PAManager.prototype.openStaffDetail = async function (staffId) {
  const staff = this.currentStaff.find((s) => s.id === staffId);
  if (!staff) return;
  document.getElementById("staffDetailName").textContent = staff.name;
  document.getElementById("staffDetailPosition").textContent =
    staff.position || "未設定";
  document.getElementById("staffDetailKana").textContent = staff.kana || "";
  document.getElementById("staffDetailBirth").textContent =
    staff.birth_date ||
    (staff.birthDate ? new Date(staff.birthDate).toLocaleDateString() : "-");
  const mgmtEl = document.getElementById("staffDetailMgmtCode");
  if (mgmtEl) mgmtEl.textContent = staff.mgmtCode || "-";
  const changer = document.getElementById("evaluationChangedBy");
  if (changer) {
    const options = (this.currentStaff || [])
      .map((s) => `<option value="${s.id}">${s.name}</option>`)
      .join("");
    changer.innerHTML = `<option value="">未選択</option>` + options;
    changer.value = ""; // default blank
    changer.classList.remove("input-error");
  }
  await this.renderStaffEvaluations(staffId);
  this._activeStaffDetailId = staffId;
  this.showModal("staffDetailModal");
};

PAManager.prototype.renderStaffEvaluations = async function (staffId) {
  const container = document.getElementById("staffEvaluations");
  if (!container) return;
  container.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    // 既存評価の取得
    const res = await fetch(`/api/evaluations?staffId=${staffId}`);
    const evals = res.ok ? await res.json() : [];
    if (!this._staffEvalCache) this._staffEvalCache = new Map();
    this._staffEvalCache.clear();
    if (!this._staffEvalTestCache) this._staffEvalTestCache = new Map();
    this._staffEvalTestCache.clear();
    for (const ev of evals) {
      this._staffEvalCache.set(
        `${ev.staffId}:${ev.criteriaId}`,
        ev.status || "not-started"
      );
      if (ev.comments) {
        try {
          const c = JSON.parse(ev.comments);
          if (c && (c.testedBy || c.testedBy === 0)) {
            this._staffEvalTestCache.set(`${ev.staffId}:${ev.criteriaId}`, {
              testedBy: typeof c.testedBy === "number" ? c.testedBy : null,
              testedAt: c.testedAt || null,
            });
          }
        } catch {}
      }
    }
    // 基準（criteria）が0件なら案内
    if (!this.currentCriteria || this.currentCriteria.length === 0) {
      container.innerHTML =
        '<div class="empty-state">評価項目がありません。右上の「項目追加」から作成してください。</div>';
      return;
    }
    // フィルタ選択取得
    const statusChecks = Array.from(
      document.querySelectorAll('input[name="evalStatusFilter[]"]:checked')
    ).map((i) => i.value);
    const catChecks = Array.from(
      document.querySelectorAll('input[name="evalCategoryFilter[]"]:checked')
    ).map((i) => i.value);
    const isTested = (key) =>
      this._staffEvalTestCache && this._staffEvalTestCache.has(key);
    const filteredCriteria = (this.currentCriteria || []).filter(
      (cr) =>
        catChecks.length === 0 || catChecks.includes(cr.category || "共通")
    );
    if (!this._pendingEvalChanges) this._pendingEvalChanges = new Map();
    container.innerHTML = filteredCriteria
      .map((cr) => {
        const key = `${staffId}:${cr.id}`;
        const status = this._staffEvalCache.get(key) || "not-started";
        const color =
          status === "done"
            ? "#00d4aa"
            : status === "learning"
            ? "#ff9f43"
            : "#f1f2f6";
        const label =
          status === "done"
            ? "習得済み"
            : status === "learning"
            ? "学習中"
            : "未着手";
        const tinfo = this._staffEvalTestCache.get(key);
        const testedById = tinfo?.testedBy ?? null;
        const testerName = testedById
          ? this.currentStaff.find((s) => s.id === testedById)?.name ||
            "歴代の猛者"
          : "";
        const testedText = testedById
          ? `完璧！${testerName}がテスト済み！`
          : "";
        const options = (this.currentStaff || [])
          .map(
            (s) =>
              `<option value="${s.id}" ${
                testedById === s.id ? "selected" : ""
              }>${s.name}</option>`
          )
          .join("");
        const logicalStatusValues = [status];
        if (testedById) logicalStatusValues.push("tested");
        const statusMatch =
          statusChecks.length === 0 ||
          statusChecks.some((v) => logicalStatusValues.includes(v));
        if (!statusMatch) return "";
        return `<div class="criteria-chip" data-staff="${staffId}" data-criteria="${
          cr.id
        }" style="border:1px solid #eaeaea; padding:12px; border-radius:10px; cursor:pointer; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div><div style="font-weight:600">${
            cr.name
          }</div><small style="color:#6b7280">${
          cr.category || "共通"
        }</small></div>
          <span class="status-badge" style="background:${color}; color:#111; padding:6px 10px; border-radius:9999px; font-size:12px; white-space:nowrap;">${label}</span>
        </div>
        ${
          cr.description
            ? `<div class=\"criteria-chip-desc\">${cr.description}</div>`
            : ""
        }
        <div class="tested-block" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${
            testedById
              ? `<span class=\"tested-text tested\">完璧！${testerName}がテスト済み！</span><button class=\"btn btn-secondary btn-small reset-tested-btn\" type=\"button\">未テストに戻す</button>`
              : `<button class=\"btn btn-primary btn-small open-tester-modal-btn\" type=\"button\">未テスト</button>`
          }
        </div>
      </div>`;
      })
      .join("");
    if (!this._evalFilterBound) {
      this._evalFilterBound = true;
      document
        .querySelectorAll('#evaluationFilters input[type="checkbox"]')
        .forEach((cb) => {
          cb.addEventListener("change", () =>
            this.renderStaffEvaluations(staffId)
          );
        });
    }
    container.querySelectorAll(".criteria-chip").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if (
          ev.target &&
          ev.target.classList &&
          (ev.target.classList.contains("open-tester-modal-btn") ||
            ev.target.classList.contains("reset-tested-btn"))
        )
          return;
        const sid = Number(el.getAttribute("data-staff"));
        const cid = Number(el.getAttribute("data-criteria"));
        const key = `${sid}:${cid}`;
        const current = this._staffEvalCache.get(key) || "not-started";
        const next =
          current === "not-started"
            ? "learning"
            : current === "learning"
            ? "done"
            : "not-started";
        this._staffEvalCache.set(key, next);
        this._pendingEvalChanges.set(key, next);
        const badge = el.querySelector(".status-badge");
        const color2 =
          next === "done"
            ? "#00d4aa"
            : next === "learning"
            ? "#ff9f43"
            : "#f1f2f6";
        const label2 =
          next === "done"
            ? "習得済み"
            : next === "learning"
            ? "学習中"
            : "未着手";
        badge.style.background = color2;
        badge.textContent = label2;
      });
      const openBtn = el.querySelector(".open-tester-modal-btn");
      if (openBtn) {
        openBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const sid = Number(el.getAttribute("data-staff"));
          const cid = Number(el.getAttribute("data-criteria"));
          const key = `${sid}:${cid}`;
          const sel = document.getElementById("testerSelect");
          if (sel) {
            sel.innerHTML =
              `<option value=\"\">選択してください</option>` +
              (this.currentStaff || [])
                .map((s) => `<option value=\"${s.id}\">${s.name}</option>`)
                .join("");
            sel.value = "";
          }
          this._pendingTesterTarget = { key, el };
          this.showModal("testerSelectModal");
        });
      }
      const resetBtn = el.querySelector(".reset-tested-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const sid = Number(el.getAttribute("data-staff"));
          const cid = Number(el.getAttribute("data-criteria"));
          const key = `${sid}:${cid}`;
          const block = el.querySelector(".tested-block");
          if (block) {
            block.innerHTML = `<button class=\"btn btn-primary btn-small open-tester-modal-btn\" type=\"button\">未テスト</button>`;
            const openBtn2 = block.querySelector(".open-tester-modal-btn");
            if (openBtn2) {
              openBtn2.addEventListener("click", (ev) => {
                ev.stopPropagation();
                const sel = document.getElementById("testerSelect");
                if (sel) {
                  sel.innerHTML =
                    `<option value=\"\">選択してください</option>` +
                    (this.currentStaff || [])
                      .map(
                        (s) => `<option value=\"${s.id}\">${s.name}</option>`
                      )
                      .join("");
                  sel.value = "";
                }
                this._pendingTesterTarget = { key, el };
                this.showModal("testerSelectModal");
              });
            }
          }
          if (!this._pendingEvalTests) this._pendingEvalTests = new Map();
          this._pendingEvalTests.set(key, { clear: true });
          if (!this._pendingEvalChanges) this._pendingEvalChanges = new Map();
          if (!this._pendingEvalChanges.has(key)) {
            const curStatus = this._staffEvalCache.get(key) || "not-started";
            this._pendingEvalChanges.set(key, curStatus);
          }
          if (this._staffEvalTestCache) this._staffEvalTestCache.delete(key);
        });
      }
    });
    const confirmBtn = document.getElementById("confirmTesterBtn");
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        const sel = document.getElementById("testerSelect");
        const val = sel && sel.value ? Number(sel.value) : null;
        if (!val || !this._pendingTesterTarget) {
          this.closeModal("testerSelectModal");
          return;
        }
        const { key, el } = this._pendingTesterTarget;
        const tester = (this.currentStaff || []).find((s) => s.id === val);
        const block = el.querySelector(".tested-block");
        if (block) {
          const displayName = tester?.name || "歴代の猛者";
          block.innerHTML = `<span class=\"tested-text tested\">完璧！${displayName}がテスト済み！</span><button class=\"btn btn-secondary btn-small reset-tested-btn\" type=\"button\">未テストに戻す</button>`;
          const resetBtn2 = block.querySelector(".reset-tested-btn");
          if (resetBtn2) {
            resetBtn2.addEventListener("click", (e) => {
              e.stopPropagation();
              block.innerHTML = `<button class=\"btn btn-primary btn-small open-tester-modal-btn\" type=\"button\">未テスト</button>`;
              if (this._pendingEvalTests) this._pendingEvalTests.delete(key);
              if (this._staffEvalTestCache)
                this._staffEvalTestCache.delete(key);
              const openBtn3 = block.querySelector(".open-tester-modal-btn");
              if (openBtn3) {
                openBtn3.addEventListener("click", (ev) => {
                  ev.stopPropagation();
                  const sel2 = document.getElementById("testerSelect");
                  if (sel2) {
                    sel2.innerHTML =
                      `<option value=\"\">選択してください</option>` +
                      (this.currentStaff || [])
                        .map(
                          (s) => `<option value=\"${s.id}\">${s.name}</option>`
                        )
                        .join("");
                    sel2.value = "";
                  }
                  this._pendingTesterTarget = { key, el };
                  this.showModal("testerSelectModal");
                });
              }
            });
          }
        }
        if (!this._pendingEvalTests) this._pendingEvalTests = new Map();
        this._pendingEvalTests.set(key, {
          testedBy: val,
          testedAt: new Date().toISOString(),
        });
        if (this._staffEvalTestCache)
          this._staffEvalTestCache.set(key, {
            testedBy: val,
            testedAt: new Date().toISOString(),
          });
        if (!this._pendingEvalChanges) this._pendingEvalChanges = new Map();
        if (!this._pendingEvalChanges.has(key)) {
          const curStatus = this._staffEvalCache.get(key) || "not-started";
          this._pendingEvalChanges.set(key, curStatus);
        }
        this._pendingTesterTarget = null;
        this.closeModal("testerSelectModal");
      };
    }
  } catch (e) {
    console.error("評価一覧読み込みエラー:", e);
    container.innerHTML =
      '<div class="empty-state">評価一覧の取得に失敗しました</div>';
  }
};

// ====== ゲームセンター機能 ======
// DOMContentLoaded が既に発火済みでも初期化されるよう即時IIFE化
(function initGameHub() {
  if (initGameHub._inited) return; // 再入防止
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGameHub, {
      once: true,
    });
    return;
  }
  initGameHub._inited = true;
  const header = document.getElementById("mainHeader");
  const gameHub = document.getElementById("gameHub");
  const backBtn = document.getElementById("backToMain");
  const playerSelect = document.getElementById("gamePlayerSelect");
  const rankingEls = {
    reaction: document.getElementById("rankingReaction"),
    twenty: document.getElementById("rankingTwenty"),
    rpg: document.getElementById("rankingRpg"),
    rpgBoss: document.getElementById("rankingRpgBoss"),
  };
  const openRpgLink = document.getElementById("openRpgLink");
  // Reaction game state handled via object for clarity & persistence
  const reactionGame = {
    state: { timerId: null, started: false, reacted: false, startTime: 0 },
    reset() {
      if (this.state.timerId) clearTimeout(this.state.timerId);
      this.state.timerId = null;
      this.state.started = false;
      this.state.reacted = false;
      this.state.startTime = 0;
    },
    loadBestLabel() {
      if (!reactionBest) return;
      const sid = playerSelect.value;
      if (!sid) {
        reactionBest.removeAttribute("data-best");
        reactionBest.textContent = "自己ベスト: -";
        return;
      }
      try {
        const v = localStorage.getItem(`reactionBest:${sid}`);
        if (v) {
          reactionBest.setAttribute("data-best", v);
          reactionBest.textContent =
            "自己ベスト: " + (Number(v) / 1000).toFixed(3) + "秒";
        } else {
          reactionBest.removeAttribute("data-best");
          reactionBest.textContent = "自己ベスト: -";
        }
      } catch {
        reactionBest.textContent = "自己ベスト: -";
      }
    },
    start() {
      if (!playerSelect.value) {
        alert("プレイヤーを選択してください");
        return;
      }
      // 進行中は無視
      if (this.state.timerId || this.state.started) return;
      this.reset();
      reactionStatus.textContent = "ランダム待ち...";
      reactionStatus.style.color = "";
      reactionStopBtn.disabled = true;
      reactionStartBtn.disabled = true;
      const wait = 800 + Math.random() * 2200;
      this.state.timerId = setTimeout(() => {
        this.state.started = true;
        this.state.startTime = performance.now();
        reactionStatus.textContent = "今！ストップ！";
        reactionStopBtn.disabled = false;
        reactionStatus.style.color = "#dc2626";
      }, wait);
    },
    stop() {
      const s = this.state;
      if (s.reacted) return;
      s.reacted = true;
      // False start
      if (!s.started) {
        if (s.timerId) clearTimeout(s.timerId);
        s.timerId = null;
        reactionStatus.textContent = "フライング！";
        reactionStatus.style.color = "#f97316";
        reactionStartBtn.disabled = false;
        reactionStopBtn.disabled = true;
        this.reset();
        return;
      }
      const elapsed = Math.round(performance.now() - s.startTime);
      const sec = (elapsed / 1000).toFixed(3);
      reactionStatus.textContent = `結果: ${sec}秒`;
      reactionStartBtn.disabled = false;
      reactionStopBtn.disabled = true;
      submitScore("reaction", elapsed, null);
      const curBest = reactionBest.getAttribute("data-best");
      let improved = false;
      if (!curBest || elapsed < Number(curBest)) {
        improved = true;
        reactionBest.setAttribute("data-best", elapsed);
        reactionBest.textContent = "自己ベスト: " + sec + "秒";
      }
      if (playerSelect.value && improved) {
        try {
          localStorage.setItem(
            `reactionBest:${playerSelect.value}`,
            String(elapsed)
          );
        } catch {}
      }
      loadRanking("reaction");
      this.reset();
    },
  };
  let twentyState = { startTime: 0, running: false };
  const reactionStartBtn = document.getElementById("reactionStartBtn");
  const reactionStopBtn = document.getElementById("reactionStopBtn");
  const reactionStatus = document.getElementById("reactionStatus");
  const reactionBest = document.getElementById("reactionBest");
  const twentyStartBtn = document.getElementById("twentyStartBtn");
  const twentyStopBtn = document.getElementById("twentyStopBtn");
  const twentyStatus = document.getElementById("twentyStatus");
  const twentyBest = document.getElementById("twentyBest");

  function showGameHub() {
    if (!gameHub) return;
    const loader = document.getElementById("gameHubLoader");
    gameHub.style.display = "block";
    if (loader) loader.style.display = "flex";
    const doSync = async () => {
      // 1) スタッフ (未ロード/空ならロード)
      try {
        if (
          !window.paManager ||
          !Array.isArray(window.paManager.currentStaff)
        ) {
          console.warn("[GameHub] paManager 未初期化");
        } else if (!window.paManager.currentStaff.length) {
          await window.paManager.loadStaff();
        }
      } catch (e) {
        console.warn("[GameHub] staff load err", e);
      }
      // 2) セレクト更新
      try {
        refreshPlayerSelect();
      } catch {}
      // 3) ランキング並列ロード
      try {
        await Promise.all(
          ["reaction", "twenty", "rpg"].map((g) => loadRanking(g))
        );
        await loadBossRanking();
      } catch {}
    };
    doSync().finally(() => {
      if (loader) loader.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  function hideGameHub() {
    if (!gameHub) return;
    gameHub.style.display = "none";
  }
  if (header) {
    header.addEventListener("click", () => showGameHub());
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showGameHub();
      }
    });
  }
  if (backBtn) backBtn.addEventListener("click", () => hideGameHub());
  if (openRpgLink) {
    openRpgLink.addEventListener("click", (e) => {
      if (!playerSelect.value) {
        e.preventDefault();
        alert("プレイヤーを選択してください");
        return;
      }
      // クエリ引き継ぎ
      openRpgLink.href = `/rpg.html?staffId=${encodeURIComponent(
        playerSelect.value
      )}`;
    });
  }

  function refreshPlayerSelect() {
    if (!playerSelect) return;
    const staffRaw = window.paManager?.currentStaff || [];
    console.log(
      "[GameHub] refreshPlayerSelect staffRaw length=",
      staffRaw.length
    );
    // かな(存在すれば) / 名前 でソートして全スタッフを選択肢化
    const staff = [...staffRaw].sort((a, b) => {
      const ak = (a.kana || a.name || "").toLowerCase();
      const bk = (b.kana || b.name || "").toLowerCase();
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return 0;
    });
    const prev =
      playerSelect.value || localStorage.getItem("gameSelectedStaffId") || "";
    let html =
      '<option value="">-- プレイヤー選択 --</option>' +
      staff.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    playerSelect.innerHTML = html;
    if (prev && staff.some((s) => String(s.id) === prev)) {
      playerSelect.value = prev;
    }
    console.log(
      "[GameHub] refreshPlayerSelect done options=",
      playerSelect.options.length
    );
  }
  // スタッフ読み込み後に自動反映できるようグローバルフック（常に最新参照）
  window._refreshGamePlayerSelect = () => {
    try {
      console.log("[GameHub] _refreshGamePlayerSelect called");
      refreshPlayerSelect();
    } catch (e) {
      console.warn("refreshPlayerSelect failed", e);
    }
  };
  // 既に staff がロード済みの場合は即反映
  if (
    window.paManager &&
    Array.isArray(window.paManager.currentStaff) &&
    window.paManager.currentStaff.length
  ) {
    window._refreshGamePlayerSelect();
  } else if (window.paManager) {
    // まだロードされていない場合、ログイン後まで待たず先行ロード試行（PIN未完了でも公開情報として扱う想定なら可）
    try {
      console.log(
        "[GameHub] staff not loaded yet -> triggering early loadStaff"
      );
      window.paManager.loadStaff();
    } catch (e) {
      console.warn("[GameHub] early loadStaff failed", e);
    }
  }
  // Rankings
  async function loadRanking(game) {
    const el = rankingEls[game];
    if (!el) return;
    try {
      el.innerHTML = "<li>読み込み中...</li>";
      const res = await fetch(`/api/games/scores?game=${game}`);
      if (!res.ok) throw 0;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        el.innerHTML = "<li>なし</li>";
        return;
      }
      el.innerHTML = data
        .map((r, i) => {
          let v = r.value;
          if (game === "twenty") {
            const actual = r.extra || 0;
            const actualSec = (actual / 1000).toFixed(3);
            const early = actual < 20000;
            const diffMs = Math.abs(actual - 20000);
            const diffSec = (diffMs / 1000).toFixed(3);
            const phrase = early ? `${diffSec}秒早い` : `${diffSec}秒遅い`;
            v = `${phrase} (${actualSec}秒)`;
          }
          if (game === "reaction") v = (v / 1000).toFixed(3) + "秒";
          if (game === "rpg") v = "Lv" + v;
          const displayName = r.staff?.name || '<span style="color:#888">(削除済)</span>';
          return `<li><span>${i + 1}. ${displayName}</span><span>${v}</span></li>`;
        })
        .join("");
    } catch {
      el.innerHTML = "<li>取得失敗</li>";
    }
  }
  async function loadBossRanking() {
    const el = rankingEls.rpgBoss;
    if (!el) return;
    try {
      el.innerHTML = "<li>読み込み中...</li>";
      const res = await fetch("/api/games/bossKills");
      if (!res.ok) throw 0;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        el.innerHTML = "<li>なし</li>";
        return;
      }
      el.innerHTML = data
        .map(
          (r, i) =>
            `<li><span>${i + 1}. ${r.name}</span><span>${
              r.bossKills
            }回</span></li>`
        )
        .join("");
    } catch {
      el.innerHTML = "<li>取得失敗</li>";
    }
  }
  function loadRankingsAll() {
    ["reaction", "twenty", "rpg"].forEach((g) => loadRanking(g));
    loadBossRanking();
  }

  // Reaction Game wiring
  reactionGame.loadBestLabel();
  if (reactionStartBtn) reactionStartBtn.addEventListener("click", () => reactionGame.start());
  if (reactionStopBtn) reactionStopBtn.addEventListener("click", () => reactionGame.stop());

  // Twenty Game
  if (twentyStartBtn)
    twentyStartBtn.addEventListener("click", () => {
      if (!playerSelect.value) {
        alert("プレイヤーを選択してください");
        return;
      }
      twentyState.startTime = performance.now();
      twentyState.running = true;
      twentyStartBtn.disabled = true;
      twentyStopBtn.disabled = false;
      twentyStatus.textContent = "カウント中...";
    });
  if (twentyStopBtn)
    twentyStopBtn.addEventListener("click", () => {
      if (!twentyState.running) return;
      twentyState.running = false;
      const actual = Math.round(performance.now() - twentyState.startTime);
      twentyStartBtn.disabled = false;
      twentyStopBtn.disabled = true;
      const diff = Math.abs(actual - 20000);
      const actualSec = (actual / 1000).toFixed(3);
      const diffSec = (diff / 1000).toFixed(3);
      const early = actual < 20000;
      twentyStatus.textContent = `${diffSec}秒${
        early ? "早い" : "遅い"
      }！(${actualSec}秒)`;
      submitScore("twenty", diff, actual);
      const curBest = twentyBest.getAttribute("data-best");
      if (!curBest || diff < Number(curBest)) {
        twentyBest.setAttribute("data-best", diff);
        twentyBest.textContent = "自己ベスト: 差 " + diffSec + "秒";
      }
      loadRanking("twenty");
    });

  async function submitScore(game, value, extra) {
    try {
      const sid = Number(playerSelect.value);
      if (!sid) return;
      await fetch("/api/games/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, staffId: sid, value, extra }),
      });
    } catch (e) {
      console.warn("score submit failed", e);
    }
  }

  // RPG
  if (playerSelect)
    playerSelect.addEventListener("change", () => {
      if (playerSelect.value) {
        try {
          localStorage.setItem("gameSelectedStaffId", playerSelect.value);
        } catch {}
      }
      reactionGame.loadBestLabel();
      loadRankingsAll();
    });
})();
