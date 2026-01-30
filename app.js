/**
 * FarfLife - Habit Tracker Application
 * A gamified habit tracking web app with XP system, streaks, and customizable tasks
 * Enhanced with animations, celebrations, full customization, and PWA support
 */

// ===========================================
// Application State & Constants
// ===========================================

const STORAGE_KEY = 'farflife_data';

// Default tasks for first-time users
const DEFAULT_DATA = {
    dailyGoal: 100,
    streak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    totalDaysCompleted: 0,
    totalXPEarned: 0,
    totalQuestsCompleted: 0,
    dailyEssentials: [
        { id: 'de1', name: 'Drink 5 Bottles of Water', xp: 10, completed: false },
        { id: 'de2', name: 'Exercise for 30 Minutes', xp: 20, completed: false },
        { id: 'de3', name: 'Read for 15 Minutes', xp: 15, completed: false }
    ],
    quests: [
        { id: 'q1', name: 'Learn a New Language', xp: 50, completedCount: 0 },
        { id: 'q2', name: 'Practice an Instrument', xp: 40, completedCount: 0 }
    ],
    weeklyProgress: [],
    dailyHistory: [], // Array of { date: string, xp: number, quests: [{ name, count }] }
    todayXP: 0,
    todayDate: null,
    celebratedToday: false
};

// Application state
let appData = null;
let isEditMode = false;
let currentEditTask = null;
let currentEditType = null;
let pendingDeleteTask = null;
let pendingDeleteType = null;
let deferredInstallPrompt = null;

// ===========================================
// DOM Elements
// ===========================================

const elements = {
    // Loading screen
    loadingScreen: document.getElementById('loadingScreen'),

    // Header
    logoBtn: document.getElementById('logoBtn'),
    reviewBtn: document.getElementById('reviewBtn'),
    editModeBtn: document.getElementById('editModeBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    dateDisplay: document.getElementById('dateDisplay'),

    // Views
    dailyView: document.getElementById('dailyView'),
    reviewView: document.getElementById('reviewView'),

    // XP Section
    currentXP: document.getElementById('currentXP'),
    dailyGoal: document.getElementById('dailyGoal'),
    xpBar: document.getElementById('xpBar'),
    xpBarContainer: document.querySelector('.xp-bar-container'),
    streakCount: document.getElementById('streakCount'),
    streakDisplay: document.querySelector('.streak-display'),
    editGoalContainer: document.getElementById('editGoalContainer'),
    goalInput: document.getElementById('goalInput'),
    saveGoalBtn: document.getElementById('saveGoalBtn'),

    // Task Lists
    dailyEssentialsList: document.getElementById('dailyEssentialsList'),
    questsList: document.getElementById('questsList'),
    addDailyBtn: document.getElementById('addDailyBtn'),
    addQuestBtn: document.getElementById('addQuestBtn'),

    // Weekly Progress
    weeklyDays: document.getElementById('weeklyDays'),

    // Stats
    daysCompleted: document.getElementById('daysCompleted'),
    totalXPEarned: document.getElementById('totalXPEarned'),
    questsCompleted: document.getElementById('questsCompleted'),

    // Review View
    backBtn: document.getElementById('backBtn'),
    reviewDaysCompleted: document.getElementById('reviewDaysCompleted'),
    reviewTotalXP: document.getElementById('reviewTotalXP'),
    reviewCompletionRate: document.getElementById('reviewCompletionRate'),
    xpChart: document.getElementById('xpChart'),
    reviewCurrentStreak: document.getElementById('reviewCurrentStreak'),
    reviewBestStreak: document.getElementById('reviewBestStreak'),
    topQuests: document.getElementById('topQuests'),
    reviewMotivation: document.getElementById('reviewMotivation'),

    // Task Modal
    taskModal: document.getElementById('taskModal'),
    modalTitle: document.getElementById('modalTitle'),
    taskNameInput: document.getElementById('taskNameInput'),
    taskXPInput: document.getElementById('taskXPInput'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalDeleteBtn: document.getElementById('modalDeleteBtn'),
    modalSaveBtn: document.getElementById('modalSaveBtn'),

    // Confirm Modal
    confirmModal: document.getElementById('confirmModal'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    settingsCloseBtn: document.getElementById('settingsCloseBtn'),
    settingsGoalInput: document.getElementById('settingsGoalInput'),
    resetTodayBtn: document.getElementById('resetTodayBtn'),
    resetAllBtn: document.getElementById('resetAllBtn'),
    settingsSaveBtn: document.getElementById('settingsSaveBtn'),
    installPrompt: document.getElementById('installPrompt'),
    installBtn: document.getElementById('installBtn'),

    // Offline indicator
    offlineIndicator: document.getElementById('offlineIndicator'),

    // Main card
    mainCard: document.querySelector('.main-card')
};

// ===========================================
// Utility Functions
// ===========================================

function generateId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(date) {
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleDateString('en-US', options);
}

function getDayAbbr(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date);
    }
    return days;
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===========================================
// Toast Notifications
// ===========================================

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ===========================================
// Data Persistence
// ===========================================

function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            appData = JSON.parse(stored);
            // Merge with defaults to handle new fields
            appData = { ...DEFAULT_DATA, ...appData };
            // Ensure dailyHistory exists
            if (!appData.dailyHistory) {
                appData.dailyHistory = [];
            }
            // Ensure bestStreak exists
            if (!appData.bestStreak) {
                appData.bestStreak = appData.streak || 0;
            }
        } else {
            appData = { ...DEFAULT_DATA };
        }
    } catch (e) {
        console.error('Error loading data:', e);
        appData = { ...DEFAULT_DATA };
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

function checkDayReset() {
    const today = getTodayString();

    if (appData.todayDate !== today) {
        const previousDate = appData.todayDate;
        const wasYesterday = previousDate && isYesterday(previousDate);
        const completedPreviousDay = appData.todayXP >= appData.dailyGoal;

        // Save previous day's data to history before reset
        if (previousDate && appData.todayXP > 0) {
            saveDayToHistory(previousDate, appData.todayXP);
        }

        if (completedPreviousDay && wasYesterday) {
            // Continue streak
        } else if (!wasYesterday && previousDate) {
            appData.streak = 0;
        }

        appData.dailyEssentials.forEach(task => {
            task.completed = false;
        });

        appData.quests.forEach(quest => {
            quest.completedCount = 0;
        });

        appData.todayXP = 0;
        appData.todayDate = today;
        appData.celebratedToday = false;

        saveData();
    }
}

function isYesterday(dateString) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateString === yesterday.toISOString().split('T')[0];
}

function saveDayToHistory(dateString, xp) {
    // Get quest completion data for this day
    const questData = appData.quests
        .filter(q => q.completedCount > 0)
        .map(q => ({ name: q.name, count: q.completedCount }));

    // Check if we already have an entry for this date
    const existingIndex = appData.dailyHistory.findIndex(h => h.date === dateString);

    if (existingIndex >= 0) {
        appData.dailyHistory[existingIndex] = { date: dateString, xp, quests: questData };
    } else {
        appData.dailyHistory.push({ date: dateString, xp, quests: questData });
    }

    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    appData.dailyHistory = appData.dailyHistory.filter(h => h.date >= thirtyDaysAgoStr);
}

// ===========================================
// Animation System
// ===========================================

function createXPParticles(sourceElement, xpAmount) {
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = elements.xpBarContainer.getBoundingClientRect();

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + targetRect.width * 0.8;
    const endY = targetRect.top + targetRect.height / 2;

    const coinCount = Math.min(Math.ceil(xpAmount / 10), 5);

    for (let i = 0; i < coinCount; i++) {
        setTimeout(() => {
            createSingleCoin(startX, startY, endX, endY, i);
        }, i * 80);
    }

    createXPText(startX, startY, xpAmount);
}

function createSingleCoin(startX, startY, endX, endY, index) {
    const coin = document.createElement('div');
    coin.className = 'xp-coin';

    const randomOffsetX = (Math.random() - 0.5) * 40;
    const randomOffsetY = (Math.random() - 0.5) * 20;

    const tx = (endX - startX) + randomOffsetX;
    const ty = (endY - startY) + randomOffsetY;

    coin.style.cssText = `
        left: ${startX}px;
        top: ${startY}px;
        --tx: ${tx}px;
        --ty: ${ty}px;
        --duration: ${0.6 + index * 0.1}s;
    `;

    document.body.appendChild(coin);
    setTimeout(() => coin.remove(), 1000);
}

function createXPText(x, y, amount) {
    const text = document.createElement('div');
    text.className = 'xp-particle';
    text.textContent = `+${amount} XP`;

    text.style.cssText = `
        left: ${x}px;
        top: ${y - 10}px;
        --tx: 0px;
        --ty: -50px;
        --duration: 1s;
    `;

    document.body.appendChild(text);
    setTimeout(() => text.remove(), 1000);
}

function addCheckboxRipple(checkbox) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    checkbox.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

function triggerConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const shapes = ['square', 'circle'];

    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.5;
            const duration = 2 + Math.random() * 2;
            const size = 5 + Math.random() * 10;

            confetti.style.cssText = `
                left: ${left}%;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: ${shape === 'circle' ? '50%' : '2px'};
                animation-delay: ${delay}s;
                --fall-duration: ${duration}s;
            `;

            container.appendChild(confetti);
        }, i * 20);
    }

    setTimeout(() => container.remove(), 5000);
}

function showCelebration() {
    if (appData.celebratedToday) return;

    appData.celebratedToday = true;
    saveData();

    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.innerHTML = `
        <div class="celebration-message">
            <div class="celebration-emoji">🎉</div>
            <div class="celebration-title">Daily Goal Complete!</div>
            <div class="celebration-subtitle">You earned ${appData.todayXP} XP today!</div>
        </div>
    `;

    document.body.appendChild(overlay);
    triggerConfetti();
    elements.streakDisplay.classList.add('celebrating');

    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }, 2500);

    setTimeout(() => {
        elements.streakDisplay.classList.remove('celebrating');
    }, 800);
}

function animateStatChange(element) {
    element.classList.add('pop');
    setTimeout(() => element.classList.remove('pop'), 500);
}

function updateXPBarEffects() {
    const percentage = (appData.todayXP / appData.dailyGoal) * 100;

    if (percentage >= 80 && percentage < 100) {
        elements.xpBar.classList.add('near-complete');
        elements.xpBar.classList.remove('complete');
    } else if (percentage >= 100) {
        elements.xpBar.classList.remove('near-complete');
        elements.xpBar.classList.add('complete');
    } else {
        elements.xpBar.classList.remove('near-complete', 'complete');
    }
}

// ===========================================
// UI Rendering Functions
// ===========================================

function renderDate() {
    elements.dateDisplay.textContent = formatDate(new Date());
}

function renderXP() {
    const currentXP = appData.todayXP;
    const goal = appData.dailyGoal;
    const percentage = Math.min((currentXP / goal) * 100, 100);

    elements.currentXP.textContent = currentXP;
    elements.dailyGoal.textContent = goal;
    elements.xpBar.style.width = `${percentage}%`;
    elements.goalInput.value = goal;

    updateXPBarEffects();
}

function renderStreak() {
    elements.streakCount.textContent = appData.streak;
}

function renderDailyEssentials() {
    elements.dailyEssentialsList.innerHTML = '';

    appData.dailyEssentials.forEach(task => {
        const taskEl = createTaskElement(task, 'daily');
        elements.dailyEssentialsList.appendChild(taskEl);
    });
}

function renderQuests() {
    elements.questsList.innerHTML = '';

    appData.quests.forEach(quest => {
        const questEl = createQuestElement(quest);
        elements.questsList.appendChild(questEl);
    });
}

function createTaskElement(task, type) {
    const div = document.createElement('div');
    div.className = `task-item${task.completed ? ' completed' : ''}`;
    div.dataset.id = task.id;

    div.innerHTML = `
        <div class="task-checkbox"></div>
        <span class="task-name" data-field="name">${escapeHtml(task.name)}</span>
        <span class="task-xp" data-field="xp">+${task.xp} XP</span>
        <button class="task-edit-btn" title="Edit task">✏️</button>
        <button class="task-delete-btn" title="Delete task">✕</button>
    `;

    const checkbox = div.querySelector('.task-checkbox');
    const taskName = div.querySelector('.task-name');
    const taskXP = div.querySelector('.task-xp');
    const editBtn = div.querySelector('.task-edit-btn');
    const deleteBtn = div.querySelector('.task-delete-btn');

    // Checkbox click
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isEditMode && !task.completed) {
            addCheckboxRipple(checkbox);
            toggleDailyTask(task.id, checkbox);
        }
    });

    // Task row click (complete task)
    div.addEventListener('click', (e) => {
        if (!isEditMode && !e.target.closest('button') && !e.target.closest('input') && !task.completed) {
            addCheckboxRipple(checkbox);
            toggleDailyTask(task.id, checkbox);
        }
    });

    // Inline edit - task name
    taskName.addEventListener('click', (e) => {
        if (isEditMode) {
            e.stopPropagation();
            startInlineEdit(taskName, task, 'name', 'daily');
        }
    });

    // Inline edit - XP value
    taskXP.addEventListener('click', (e) => {
        if (isEditMode) {
            e.stopPropagation();
            startInlineEditXP(taskXP, task, 'daily');
        }
    });

    // Edit button
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(task, 'daily');
    });

    // Delete button
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmation(task, 'daily');
    });

    return div;
}

function createQuestElement(quest) {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.dataset.id = quest.id;

    const countDisplay = quest.completedCount > 0 ?
        `<span class="task-count">+${quest.completedCount}</span>` : '';

    div.innerHTML = `
        <div class="task-checkbox"></div>
        <span class="task-name" data-field="name">${escapeHtml(quest.name)}</span>
        <span class="task-xp" data-field="xp">+${quest.xp}</span>
        ${countDisplay}
        <button class="task-edit-btn" title="Edit quest">✏️</button>
        <button class="task-delete-btn" title="Delete quest">✕</button>
    `;

    const checkbox = div.querySelector('.task-checkbox');
    const questName = div.querySelector('.task-name');
    const questXP = div.querySelector('.task-xp');
    const editBtn = div.querySelector('.task-edit-btn');
    const deleteBtn = div.querySelector('.task-delete-btn');

    // Checkbox click
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isEditMode) {
            addCheckboxRipple(checkbox);
            completeQuest(quest.id, checkbox);
        }
    });

    // Quest row click
    div.addEventListener('click', (e) => {
        if (!isEditMode && !e.target.closest('button') && !e.target.closest('input')) {
            addCheckboxRipple(checkbox);
            completeQuest(quest.id, checkbox);
        }
    });

    // Inline edit - quest name
    questName.addEventListener('click', (e) => {
        if (isEditMode) {
            e.stopPropagation();
            startInlineEdit(questName, quest, 'name', 'quest');
        }
    });

    // Inline edit - XP value
    questXP.addEventListener('click', (e) => {
        if (isEditMode) {
            e.stopPropagation();
            startInlineEditXP(questXP, quest, 'quest');
        }
    });

    // Edit button
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(quest, 'quest');
    });

    // Delete button
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmation(quest, 'quest');
    });

    return div;
}

function renderWeeklyProgress() {
    elements.weeklyDays.innerHTML = '';
    const days = getLast7Days();

    days.forEach(date => {
        const dateString = date.toISOString().split('T')[0];
        const isCompleted = appData.weeklyProgress.includes(dateString);
        const isTodayDate = isToday(date);

        const dayEl = document.createElement('div');
        dayEl.className = `day-item${isTodayDate ? ' today' : ''}`;
        dayEl.innerHTML = `
            <span class="day-name">${getDayAbbr(date)}</span>
            <div class="day-check${isCompleted ? ' completed' : ''}"></div>
        `;

        elements.weeklyDays.appendChild(dayEl);
    });
}

function renderStats() {
    elements.daysCompleted.textContent = appData.totalDaysCompleted;
    elements.totalXPEarned.textContent = appData.totalXPEarned;
    elements.questsCompleted.textContent = appData.totalQuestsCompleted;
}

function renderAll() {
    renderDate();
    renderXP();
    renderStreak();
    renderDailyEssentials();
    renderQuests();
    renderWeeklyProgress();
    renderStats();
}

// ===========================================
// Inline Editing
// ===========================================

function startInlineEdit(element, task, field, type) {
    if (element.querySelector('input')) return;

    const currentValue = task[field];
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-name-input';
    input.value = currentValue;

    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();

    function saveEdit() {
        const newValue = input.value.trim();
        if (newValue && newValue !== currentValue) {
            task[field] = newValue;
            saveData();
            showToast('Task updated', 'success');
        }
        if (type === 'daily') {
            renderDailyEssentials();
        } else {
            renderQuests();
        }
    }

    function cancelEdit() {
        if (type === 'daily') {
            renderDailyEssentials();
        } else {
            renderQuests();
        }
    }

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            input.removeEventListener('blur', saveEdit);
            cancelEdit();
        }
    });
}

function startInlineEditXP(element, task, type) {
    if (element.querySelector('input')) return;

    const currentValue = task.xp;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'task-xp-input';
    input.value = currentValue;
    input.min = 1;
    input.max = 500;

    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();

    function saveEdit() {
        const newValue = parseInt(input.value, 10);
        if (!isNaN(newValue) && newValue > 0 && newValue !== currentValue) {
            task.xp = newValue;
            saveData();
            showToast('XP updated', 'success');
        }
        if (type === 'daily') {
            renderDailyEssentials();
        } else {
            renderQuests();
        }
    }

    function cancelEdit() {
        if (type === 'daily') {
            renderDailyEssentials();
        } else {
            renderQuests();
        }
    }

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            input.removeEventListener('blur', saveEdit);
            cancelEdit();
        }
    });
}

// ===========================================
// Task Management Functions
// ===========================================

function toggleDailyTask(taskId, checkboxElement) {
    const task = appData.dailyEssentials.find(t => t.id === taskId);
    if (!task || task.completed) return;

    task.completed = true;
    appData.todayXP += task.xp;
    appData.totalXPEarned += task.xp;

    if (checkboxElement) {
        createXPParticles(checkboxElement, task.xp);
    }

    elements.currentXP.parentElement.classList.add('gained');
    setTimeout(() => elements.currentXP.parentElement.classList.remove('gained'), 500);

    const goalJustReached = checkDailyGoalCompletion();
    saveData();

    const taskEl = document.querySelector(`[data-id="${taskId}"]`);
    if (taskEl) {
        taskEl.classList.add('completed');
    }

    renderXP();
    renderStats();
    animateStatChange(elements.totalXPEarned);

    if (goalJustReached) {
        setTimeout(() => showCelebration(), 600);
    }
}

function completeQuest(questId, checkboxElement) {
    const quest = appData.quests.find(q => q.id === questId);
    if (!quest) return;

    quest.completedCount++;
    appData.todayXP += quest.xp;
    appData.totalXPEarned += quest.xp;
    appData.totalQuestsCompleted++;

    if (checkboxElement) {
        createXPParticles(checkboxElement, quest.xp);
    }

    elements.currentXP.parentElement.classList.add('gained');
    setTimeout(() => elements.currentXP.parentElement.classList.remove('gained'), 500);

    const goalJustReached = checkDailyGoalCompletion();
    saveData();

    renderXP();
    renderQuests();
    renderStats();
    animateStatChange(elements.totalXPEarned);
    animateStatChange(elements.questsCompleted);

    const questEl = document.querySelector(`[data-id="${questId}"]`);
    if (questEl) {
        const countEl = questEl.querySelector('.task-count');
        if (countEl) {
            countEl.classList.add('pop');
            setTimeout(() => countEl.classList.remove('pop'), 300);
        }
    }

    if (goalJustReached) {
        setTimeout(() => showCelebration(), 600);
    }
}

function checkDailyGoalCompletion() {
    const today = getTodayString();
    const wasAlreadyCompleted = appData.weeklyProgress.includes(today);

    if (appData.todayXP >= appData.dailyGoal && !wasAlreadyCompleted) {
        appData.weeklyProgress.push(today);
        appData.totalDaysCompleted++;
        appData.streak++;
        appData.lastCompletedDate = today;

        // Update best streak
        if (appData.streak > appData.bestStreak) {
            appData.bestStreak = appData.streak;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        appData.weeklyProgress = appData.weeklyProgress.filter(date => {
            return new Date(date) >= thirtyDaysAgo;
        });

        renderStreak();
        renderWeeklyProgress();
        animateStatChange(elements.daysCompleted);

        return true;
    }

    return false;
}

// ===========================================
// Edit Mode Functions
// ===========================================

function toggleEditMode() {
    isEditMode = !isEditMode;

    elements.editModeBtn.classList.toggle('active', isEditMode);
    elements.editModeBtn.querySelector('.edit-text').textContent = isEditMode ? 'Done' : 'Edit';

    elements.mainCard.classList.toggle('edit-mode', isEditMode);
    elements.editGoalContainer.classList.toggle('visible', isEditMode);
    elements.addDailyBtn.classList.toggle('visible', isEditMode);
}

// ===========================================
// Modal Functions
// ===========================================

function openEditModal(task, type) {
    currentEditTask = task;
    currentEditType = type;

    elements.modalTitle.textContent = task ? 'Edit Task' : 'Add New Task';
    elements.taskNameInput.value = task ? task.name : '';
    elements.taskXPInput.value = task ? task.xp : 10;

    if (task) {
        elements.modalDeleteBtn.classList.remove('hidden');
    } else {
        elements.modalDeleteBtn.classList.add('hidden');
    }

    elements.taskModal.classList.add('visible');
    elements.taskNameInput.focus();
}

function closeEditModal() {
    elements.taskModal.classList.remove('visible');
    currentEditTask = null;
    currentEditType = null;
}

function saveTaskFromModal() {
    const name = elements.taskNameInput.value.trim();
    const xp = parseInt(elements.taskXPInput.value, 10);

    if (!name) {
        elements.taskNameInput.focus();
        showToast('Please enter a task name', 'warning');
        return;
    }

    if (isNaN(xp) || xp < 1) {
        elements.taskXPInput.focus();
        showToast('Please enter a valid XP value', 'warning');
        return;
    }

    if (currentEditTask) {
        currentEditTask.name = name;
        currentEditTask.xp = xp;
        showToast('Task updated', 'success');
    } else {
        const newTask = {
            id: generateId(),
            name: name,
            xp: xp
        };

        if (currentEditType === 'daily') {
            newTask.completed = false;
            appData.dailyEssentials.push(newTask);
        } else {
            newTask.completedCount = 0;
            appData.quests.push(newTask);
        }
        showToast('Task added', 'success');
    }

    saveData();
    closeEditModal();

    if (currentEditType === 'daily' || !currentEditTask) {
        renderDailyEssentials();
    }
    if (currentEditType === 'quest' || !currentEditTask) {
        renderQuests();
    }
}

// ===========================================
// Delete Confirmation
// ===========================================

function showDeleteConfirmation(task, type) {
    pendingDeleteTask = task;
    pendingDeleteType = type;

    elements.confirmTitle.textContent = 'Delete Task?';
    elements.confirmMessage.textContent = `Are you sure you want to delete "${task.name}"? This action cannot be undone.`;

    elements.confirmModal.classList.add('visible');
}

function closeConfirmModal() {
    elements.confirmModal.classList.remove('visible');
    pendingDeleteTask = null;
    pendingDeleteType = null;
}

function confirmDelete() {
    if (!pendingDeleteTask) return;

    if (pendingDeleteType === 'daily') {
        appData.dailyEssentials = appData.dailyEssentials.filter(t => t.id !== pendingDeleteTask.id);
        renderDailyEssentials();
    } else {
        appData.quests = appData.quests.filter(q => q.id !== pendingDeleteTask.id);
        renderQuests();
    }

    saveData();
    showToast('Task deleted', 'success');
    closeConfirmModal();
    closeEditModal();
}

function deleteTaskFromModal() {
    if (!currentEditTask) return;
    showDeleteConfirmation(currentEditTask, currentEditType);
}

// ===========================================
// Settings Panel
// ===========================================

function openSettings() {
    elements.settingsGoalInput.value = appData.dailyGoal;
    elements.settingsModal.classList.add('visible');

    // Show install button if available
    if (deferredInstallPrompt) {
        elements.installPrompt.style.display = 'block';
    }
}

function closeSettings() {
    elements.settingsModal.classList.remove('visible');
}

function saveSettings() {
    const newGoal = parseInt(elements.settingsGoalInput.value, 10);

    if (isNaN(newGoal) || newGoal < 10) {
        showToast('Daily goal must be at least 10 XP', 'warning');
        return;
    }

    appData.dailyGoal = newGoal;
    saveData();
    renderXP();

    const goalJustReached = checkDailyGoalCompletion();
    renderWeeklyProgress();

    showToast('Settings saved', 'success');
    closeSettings();

    if (goalJustReached) {
        setTimeout(() => showCelebration(), 300);
    }
}

function resetTodayProgress() {
    elements.confirmTitle.textContent = 'Reset Today\'s Progress?';
    elements.confirmMessage.textContent = 'This will reset your XP and task completions for today. Your streak and stats will be preserved. Continue?';

    pendingDeleteTask = { type: 'resetToday' };
    pendingDeleteType = 'reset';

    elements.confirmModal.classList.add('visible');
}

function resetAllData() {
    elements.confirmTitle.textContent = 'Reset All Data?';
    elements.confirmMessage.textContent = 'This will delete ALL your data including tasks, stats, and history. This cannot be undone. Are you absolutely sure?';

    pendingDeleteTask = { type: 'resetAll' };
    pendingDeleteType = 'reset';

    elements.confirmModal.classList.add('visible');
}

function performReset() {
    if (pendingDeleteTask?.type === 'resetToday') {
        // Reset today only
        appData.todayXP = 0;
        appData.celebratedToday = false;
        appData.dailyEssentials.forEach(task => {
            task.completed = false;
        });
        appData.quests.forEach(quest => {
            quest.completedCount = 0;
        });

        // Remove today from weekly progress if it was there
        const today = getTodayString();
        const todayIndex = appData.weeklyProgress.indexOf(today);
        if (todayIndex > -1) {
            appData.weeklyProgress.splice(todayIndex, 1);
            appData.totalDaysCompleted = Math.max(0, appData.totalDaysCompleted - 1);
            appData.streak = Math.max(0, appData.streak - 1);
        }

        saveData();
        renderAll();
        showToast('Today\'s progress has been reset', 'success');
    } else if (pendingDeleteTask?.type === 'resetAll') {
        // Full reset
        localStorage.removeItem(STORAGE_KEY);
        appData = { ...DEFAULT_DATA };
        appData.todayDate = getTodayString();
        saveData();
        renderAll();
        showToast('All data has been reset', 'success');
        closeSettings();
    }

    closeConfirmModal();
}

function saveDailyGoal() {
    const newGoal = parseInt(elements.goalInput.value, 10);

    if (isNaN(newGoal) || newGoal < 10) {
        elements.goalInput.value = appData.dailyGoal;
        showToast('Daily goal must be at least 10 XP', 'warning');
        return;
    }

    appData.dailyGoal = newGoal;
    saveData();
    renderXP();

    const goalJustReached = checkDailyGoalCompletion();
    renderWeeklyProgress();

    showToast('Daily goal updated', 'success');

    if (goalJustReached) {
        setTimeout(() => showCelebration(), 300);
    }
}

// ===========================================
// Weekly Review Functions
// ===========================================

function showReviewView() {
    elements.dailyView.classList.add('hidden');
    elements.reviewView.classList.remove('hidden');
    renderReviewData();
}

function hideReviewView() {
    elements.reviewView.classList.add('hidden');
    elements.dailyView.classList.remove('hidden');
}

function renderReviewData() {
    const days = getLast7Days();
    const weekData = getWeekData(days);

    // Summary stats
    const daysCompleted = weekData.filter(d => d.completed).length;
    const totalXP = weekData.reduce((sum, d) => sum + d.xp, 0);
    const completionRate = Math.round((daysCompleted / 7) * 100);

    elements.reviewDaysCompleted.textContent = `${daysCompleted}/7`;
    elements.reviewTotalXP.textContent = totalXP;
    elements.reviewCompletionRate.textContent = `${completionRate}%`;

    // Streak stats
    elements.reviewCurrentStreak.textContent = appData.streak;
    elements.reviewBestStreak.textContent = appData.bestStreak;

    // Render XP chart
    renderXPChart(weekData);

    // Render top quests
    renderTopQuests(weekData);

    // Render motivational message
    renderMotivation(completionRate, daysCompleted);
}

function getWeekData(days) {
    const today = getTodayString();

    return days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const isCompleted = appData.weeklyProgress.includes(dateStr);

        // Get XP from history or current day
        let xp = 0;
        let quests = [];

        if (dateStr === today) {
            xp = appData.todayXP;
            quests = appData.quests
                .filter(q => q.completedCount > 0)
                .map(q => ({ name: q.name, count: q.completedCount }));
        } else {
            const historyEntry = appData.dailyHistory.find(h => h.date === dateStr);
            if (historyEntry) {
                xp = historyEntry.xp;
                quests = historyEntry.quests || [];
            }
        }

        return {
            date: dateStr,
            dayName: getDayAbbr(date),
            xp,
            completed: isCompleted,
            quests
        };
    });
}

function renderXPChart(weekData) {
    elements.xpChart.innerHTML = '';

    const maxXP = Math.max(...weekData.map(d => d.xp), appData.dailyGoal);
    const today = getTodayString();

    weekData.forEach((day, index) => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';

        const heightPercent = maxXP > 0 ? (day.xp / maxXP) * 100 : 0;
        const isToday = day.date === today;

        bar.innerHTML = `
            <div class="chart-bar-fill${day.completed ? ' completed' : ''}${isToday ? ' today' : ''}"
                 style="height: 0%;"
                 data-height="${heightPercent}">
                <span class="chart-bar-value">${day.xp}</span>
            </div>
            <span class="chart-bar-label">${day.dayName}</span>
        `;

        elements.xpChart.appendChild(bar);

        // Animate bars
        setTimeout(() => {
            const fill = bar.querySelector('.chart-bar-fill');
            fill.style.height = `${heightPercent}%`;
        }, 100 + index * 50);
    });

    // Add goal line
    const goalLinePercent = (appData.dailyGoal / maxXP) * 100;
    const goalLine = document.createElement('div');
    goalLine.className = 'chart-goal-line';
    goalLine.style.bottom = `${goalLinePercent}%`;
    goalLine.innerHTML = `<span class="chart-goal-label">Goal: ${appData.dailyGoal}</span>`;
    elements.xpChart.appendChild(goalLine);
}

function renderTopQuests(weekData) {
    // Aggregate quest completions across the week
    const questCounts = {};

    weekData.forEach(day => {
        if (day.quests) {
            day.quests.forEach(q => {
                if (!questCounts[q.name]) {
                    questCounts[q.name] = 0;
                }
                questCounts[q.name] += q.count;
            });
        }
    });

    // Sort by count
    const sortedQuests = Object.entries(questCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    if (sortedQuests.length === 0) {
        elements.topQuests.innerHTML = '<p class="no-data">No quests completed this week</p>';
        return;
    }

    elements.topQuests.innerHTML = sortedQuests.map(([name, count], index) => {
        const medals = ['🥇', '🥈', '🥉'];
        return `
            <div class="top-quest-item">
                <span class="top-quest-medal">${medals[index] || ''}</span>
                <span class="top-quest-name">${escapeHtml(name)}</span>
                <span class="top-quest-count">×${count}</span>
            </div>
        `;
    }).join('');
}

function renderMotivation(completionRate, daysCompleted) {
    let emoji = '🌟';
    let message = 'Keep up the great work!';

    if (completionRate >= 100) {
        emoji = '🏆';
        message = 'Perfect week! You\'re unstoppable!';
    } else if (completionRate >= 85) {
        emoji = '🔥';
        message = 'Amazing progress! Almost perfect!';
    } else if (completionRate >= 70) {
        emoji = '💪';
        message = 'Great job! You\'re building strong habits!';
    } else if (completionRate >= 50) {
        emoji = '🌱';
        message = 'Good progress! Every day counts!';
    } else if (daysCompleted > 0) {
        emoji = '🌤️';
        message = 'You\'ve got this! One day at a time!';
    } else {
        emoji = '🚀';
        message = 'This week is a fresh start!';
    }

    elements.reviewMotivation.innerHTML = `
        <div class="motivation-emoji">${emoji}</div>
        <p class="motivation-text">${message}</p>
    `;
}

// ===========================================
// PWA & Service Worker Functions
// ===========================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('FarfLife: Service Worker registered', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('Update available! Refresh for new version.', 'info');
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('FarfLife: Service Worker registration failed', error);
            });
    }
}

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;

        // Show install option in settings
        if (elements.installPrompt) {
            elements.installPrompt.style.display = 'block';
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        if (elements.installPrompt) {
            elements.installPrompt.style.display = 'none';
        }
        showToast('App installed successfully!', 'success');
    });
}

function installApp() {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
            showToast('Installing FarfLife...', 'success');
        }
        deferredInstallPrompt = null;
    });
}

// ===========================================
// Offline Detection
// ===========================================

function setupOfflineDetection() {
    function updateOnlineStatus() {
        if (navigator.onLine) {
            elements.offlineIndicator.classList.add('hidden');
        } else {
            elements.offlineIndicator.classList.remove('hidden');
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();
}

// ===========================================
// Loading Screen
// ===========================================

function hideLoadingScreen() {
    if (elements.loadingScreen) {
        elements.loadingScreen.classList.add('hidden');
        setTimeout(() => {
            elements.loadingScreen.style.display = 'none';
        }, 500);
    }
}

// ===========================================
// Event Listeners Setup
// ===========================================

function setupEventListeners() {
    // Logo click - return to daily view
    elements.logoBtn.addEventListener('click', hideReviewView);

    // Review button
    elements.reviewBtn.addEventListener('click', showReviewView);

    // Back button in review view
    elements.backBtn.addEventListener('click', hideReviewView);

    // Edit mode toggle
    elements.editModeBtn.addEventListener('click', toggleEditMode);

    // Settings button
    elements.settingsBtn.addEventListener('click', openSettings);

    // Save goal button (in edit mode)
    elements.saveGoalBtn.addEventListener('click', saveDailyGoal);
    elements.goalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveDailyGoal();
    });

    // Add task buttons
    elements.addDailyBtn.addEventListener('click', () => {
        currentEditType = 'daily';
        openEditModal(null, 'daily');
    });

    elements.addQuestBtn.addEventListener('click', () => {
        currentEditType = 'quest';
        openEditModal(null, 'quest');
    });

    // Task Modal
    elements.modalCancelBtn.addEventListener('click', closeEditModal);
    elements.modalSaveBtn.addEventListener('click', saveTaskFromModal);
    elements.modalDeleteBtn.addEventListener('click', deleteTaskFromModal);

    elements.taskModal.addEventListener('click', (e) => {
        if (e.target === elements.taskModal) closeEditModal();
    });

    elements.taskNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveTaskFromModal();
    });

    elements.taskXPInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveTaskFromModal();
    });

    // Confirm Modal
    elements.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    elements.confirmDeleteBtn.addEventListener('click', () => {
        if (pendingDeleteType === 'reset') {
            performReset();
        } else {
            confirmDelete();
        }
    });

    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) closeConfirmModal();
    });

    // Settings Modal
    elements.settingsCloseBtn.addEventListener('click', closeSettings);
    elements.settingsSaveBtn.addEventListener('click', saveSettings);
    elements.resetTodayBtn.addEventListener('click', resetTodayProgress);
    elements.resetAllBtn.addEventListener('click', resetAllData);

    // Install button
    if (elements.installBtn) {
        elements.installBtn.addEventListener('click', installApp);
    }

    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.confirmModal.classList.contains('visible')) {
                closeConfirmModal();
            } else if (elements.taskModal.classList.contains('visible')) {
                closeEditModal();
            } else if (elements.settingsModal.classList.contains('visible')) {
                closeSettings();
            } else if (!elements.reviewView.classList.contains('hidden')) {
                hideReviewView();
            }
        }
    });
}

// ===========================================
// Midnight Reset Scheduler
// ===========================================

function scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow - now;

    setTimeout(() => {
        // Save current day to history before reset
        if (appData.todayXP > 0) {
            saveDayToHistory(appData.todayDate, appData.todayXP);
        }

        checkDayReset();
        renderAll();
        scheduleMidnightReset();
    }, msUntilMidnight);
}

// ===========================================
// Application Initialization
// ===========================================

function init() {
    loadData();
    checkDayReset();
    setupEventListeners();
    renderAll();
    scheduleMidnightReset();
    setInterval(renderDate, 60000);

    // PWA setup
    registerServiceWorker();
    setupInstallPrompt();
    setupOfflineDetection();

    // Hide loading screen after a short delay
    setTimeout(hideLoadingScreen, 800);
}

document.addEventListener('DOMContentLoaded', init);
