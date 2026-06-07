// =====================================================
// ЛЕНИВАЯ ЗАГРУЗКА ЗАДАНИЙ
// =====================================================

// Кэш загруженных заданий
const tasksCache = { oge: {}, ege: {} };

// Счётчики заданий
const tasksCounts = {
    oge: {1:15,2:10,3:15,4:10,5:15,6:10,7:10,8:10,9:10,10:15,11:10,12:10,13:10,14:10,15:10,16:10},
    ege: {1:10,2:10,3:10,4:10,5:10,6:10,7:10,8:10,9:10,11:10,12:10,13:10,14:10,15:10,16:10,17:10,18:10,19:10,20:10,21:10,22:10,23:10,24:10,25:10,26:10,27:10}
};

async function loadTasks(exam, num) {
    if (tasksCache[exam][num]) return tasksCache[exam][num];
    try {
        const module = await import(`./tasks/${exam}/task${num}.js`);
        const tasksKey = `${exam}${num}Tasks`;
        tasksCache[exam][num] = module[tasksKey];
        return tasksCache[exam][num];
    } catch(e) {
        console.error(`Ошибка загрузки ${exam}/${num}:`, e);
        return [];
    }
}

// =====================================================
// ОСНОВНОЙ КОД ПРИЛОЖЕНИЯ
// =====================================================

let currentUser = null, userExam = "oge", includeOge = false, solvedTasks = {}, answerHistory = [], ogeCorrectHistory = [], egeCorrectHistory = [], chart = null, currentRandomTask = null, currentModalExam = "oge", currentModalNum = 1, currentVariantTasks = [];

function toggleSolution(id){
    let d = document.getElementById(id);
    if(d.style.display === 'none' || d.style.display === ''){
        d.style.display = 'block';
    } else {
        d.style.display = 'none';
    }
}

function toggleSolutionById(id){
    let d = document.getElementById(id);
    if(d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
}

let cachedRandomTasks = null;
let lastRandomParams = { userExam: null, includeOge: null };

async function getAllTasksLazy() {
    if (cachedRandomTasks && lastRandomParams.userExam === userExam && lastRandomParams.includeOge === includeOge) {
        return cachedRandomTasks;
    }
    
    const allTasks = [];
    const numbers = Object.keys(tasksCounts[userExam]);
    
    for (let num of numbers) {
        const tasks = await loadTasks(userExam, parseInt(num));
        for (let t of tasks) {
            allTasks.push({...t, exam: userExam, num: parseInt(num)});
        }
    }
    
    if (includeOge && userExam === 'ege') {
        const ogeNumbers = Object.keys(tasksCounts.oge);
        for (let num of ogeNumbers) {
            const tasks = await loadTasks('oge', parseInt(num));
            for (let t of tasks) {
                allTasks.push({...t, exam: 'oge', num: parseInt(num)});
            }
        }
    }
    
    cachedRandomTasks = allTasks;
    lastRandomParams = { userExam, includeOge };
    return allTasks;
}

async function updateRandomTask() {
    const questionDiv = document.getElementById('randomQuestion');
    questionDiv.innerHTML = '<div class="loading-spinner"></div> Загрузка задания...';
    
    const allTasks = await getAllTasksLazy();
    if (!allTasks.length) return;
    
    const task = allTasks[Math.floor(Math.random() * allTasks.length)];
    currentRandomTask = task;
    
    document.getElementById('randomExamBadge').innerText = task.exam === 'oge' ? 'ОГЭ' : 'ЕГЭ';
    document.getElementById('randomNumBadge').innerHTML = `Задание №${task.num}`;
    document.getElementById('randomQuestion').innerHTML = task.text.replace(/\n/g, '<br>');
    
    const sw = document.getElementById('randomSolutionWrapper');
    const sd = document.getElementById('randomSolution');
    if (task.solution) {
        sd.innerHTML = `<strong>📖 Решение:</strong> ${task.solution}`;
        sd.style.display = 'none';
        sw.style.display = 'block';
        document.getElementById('toggleRandomSolutionBtn').onclick = () => toggleSolution('randomSolution');
    } else {
        sw.style.display = 'none';
    }
    document.getElementById('randomAnswerInput').value = '';
    document.getElementById('randomFeedback').style.display = 'none';
}

function normalizeAnswer(a){
    return String(a).trim().toLowerCase().replace(/\s+/g, '').replace(/[.,;:!?()]/g, '');
}

async function checkRandomAnswer(){
    if(!currentRandomTask){
        alert('Сначала получите задание');
        return;
    }
    let ua = normalizeAnswer(document.getElementById('randomAnswerInput').value);
    if(!ua){
        alert('Введите ответ');
        return;
    }
    let ca = normalizeAnswer(currentRandomTask.answer);
    let isCorrect = ua === ca;
    let fb = document.getElementById('randomFeedback');
    fb.style.display = 'block';
    if(isCorrect){
        fb.innerHTML = '✅ Верно! Отлично!';
        fb.style.color = '#16a34a';
        fb.style.background = '#D1FAE5';
        let tk = `${currentRandomTask.exam}_${currentRandomTask.num}`;
        if(!solvedTasks[tk]){
            solvedTasks[tk] = true;
            renderNumbersGrid();
        }
    } else {
        fb.innerHTML = `❌ Неверно. Правильный ответ: ${currentRandomTask.answer}`;
        fb.style.color = '#dc2626';
        fb.style.background = '#FEE2E2';
    }
    
    if(currentRandomTask.exam === 'oge'){
        let l = ogeCorrectHistory.length ? ogeCorrectHistory[ogeCorrectHistory.length-1] : 0;
        ogeCorrectHistory.push(l + (isCorrect ? 1 : 0));
    } else {
        let l = egeCorrectHistory.length ? egeCorrectHistory[egeCorrectHistory.length-1] : 0;
        egeCorrectHistory.push(l + (isCorrect ? 1 : 0));
    }
    answerHistory.push({exam: currentRandomTask.exam, num: currentRandomTask.num, correct: isCorrect});
    updateChart();
    updateStats();
    setTimeout(updateRandomTask, 1500);
}

async function generateVariantAndDisplay(){
    let vc = document.getElementById('variantQuestions');
    vc.innerHTML = '<div class="loading-spinner"></div> Генерация...';
    let all = [];
    let exams = (userExam === 'ege' && includeOge) ? ['ege', 'oge'] : [userExam];
    for(let exam of exams){
        let maxNum = exam === 'oge' ? 16 : 27;
        for(let num = 1; num <= maxNum; num++){
            let tasks = await loadTasks(exam, num);
            if(tasks.length){
                all.push({...tasks[Math.floor(Math.random() * tasks.length)], exam, num});
            }
        }
    }
    currentVariantTasks = all;
    vc.innerHTML = '';
    if(!all.length){
        vc.innerHTML = '<p>Нет заданий</p>';
    } else {
        all.forEach((t, i) => {
            vc.innerHTML += `
                <div class="variant-question-item">
                    <div class="question-text"><strong>${t.exam === 'oge' ? 'ОГЭ' : 'ЕГЭ'} №${t.num}</strong><br>${t.text.replace(/\n/g, '<br>')}</div>
                    <input type="text" class="answer-input" id="variantAnswer_${i}" placeholder="Введите ответ...">
                    ${t.solution ? `<div><button class="btn-solution-small" onclick="toggleSolutionById('variantSolution_${i}')">📖 Показать решение</button><div class="solution-small" id="variantSolution_${i}" style="display:none;"><strong>Решение:</strong> ${t.solution}</div></div>` : ''}
                    <div class="feedback-individual" id="variantFeedback_${i}"></div>
                </div>
            `;
        });
    }
    document.getElementById('variantSection').style.display = 'block';
    document.getElementById('variantContent').classList.add('show');
    document.getElementById('variantToggleIcon').className = 'fas fa-chevron-up';
}

function checkWholeVariant(){
    let correct = 0, total = 0;
    for(let i = 0; i < currentVariantTasks.length; i++){
        total++;
        let ua = normalizeAnswer(document.getElementById(`variantAnswer_${i}`)?.value || "");
        let isCorrect = ua === normalizeAnswer(currentVariantTasks[i].answer);
        let fd = document.getElementById(`variantFeedback_${i}`);
        if(fd){
            if(isCorrect && ua !== ""){
                fd.innerHTML = '✅ Верно!';
                fd.style.color = '#16a34a';
                fd.style.display = 'block';
                correct++;
            } else if(ua !== ""){
                fd.innerHTML = `❌ Неверно. Правильный ответ: ${currentVariantTasks[i].answer}`;
                fd.style.color = '#dc2626';
                fd.style.display = 'block';
            }
        }
    }
    let rd = document.getElementById('variantResult');
    rd.innerHTML = `🎯 Результат: ${correct} из ${total} правильно!`;
    rd.style.background = correct === total ? '#D1FAE5' : '#FEE2E2';
    rd.style.display = 'block';
}

async function renderNumbersGrid(){
    let g = document.getElementById('numbersGrid');
    let maxNum = userExam === 'oge' ? 16 : 27;
    g.innerHTML = '';
    for(let n = 1; n <= maxNum; n++){
        let tasksCount = tasksCounts[userExam]?.[n] || '?';
        let solvedCount = Object.keys(solvedTasks).filter(k => k.startsWith(`${userExam}_${n}_`)).length;
        let solvedClass = (solvedCount === tasksCount && tasksCount > 0) ? 'solved' : '';
        g.innerHTML += `<div class="number-card ${solvedClass}" data-num="${n}"><div class="num">№${n}</div><div class="count">${solvedCount}/${tasksCount}</div></div>`;
    }
    document.querySelectorAll('.number-card').forEach(c => {
        c.addEventListener('click', () => openTasksModalLazy(userExam, parseInt(c.dataset.num)));
    });
}

async function openTasksModalLazy(exam, num){
    currentModalExam = exam;
    currentModalNum = num;
    document.getElementById('modalNum').innerText = num;
    
    const container = document.getElementById('tasksListContainer');
    container.innerHTML = '<div class="loading-spinner"></div> Загрузка заданий...';
    const modal = document.getElementById('tasksModal');
    modal.classList.add('active');
    
    const tasks = await loadTasks(exam, num);
    
    container.innerHTML = '';
    tasks.forEach((t, idx) => {
        let isSolved = solvedTasks[`${exam}_${num}_${idx}`] || false;
        container.innerHTML += `
            <div class="task-item">
                <div class="task-text">${t.text.replace(/\n/g, '<br>')}</div>
                <div class="task-answer">📌 Ответ: ${t.answer}</div>
                ${t.solution ? `<div class="task-solution-wrapper"><button class="task-solution-btn" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">📖 Показать решение</button><div class="task-solution-content" style="display:none;"><strong>📝 Решение:</strong> ${t.solution}</div></div>` : ''}
                <div class="task-actions"><button class="btn-small solve-btn" data-idx="${idx}" style="background:#10B981;">${isSolved ? '✅ Решено' : '📌 Отметить решённым'}</button></div>
            </div>
        `;
    });
    
    document.querySelectorAll('.solve-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            let idx = b.dataset.idx;
            solvedTasks[`${exam}_${num}_${idx}`] = true;
            openTasksModalLazy(exam, num);
            renderNumbersGrid();
            updateRandomTask();
            updateStats();
        });
    });
}

function updateChart(){
    if(!chart) return;
    let oge = ogeCorrectHistory.slice(-15);
    let ege = egeCorrectHistory.slice(-15);
    let ml = Math.max(oge.length, ege.length);
    chart.data.labels = Array.from({length: ml}, (_, i) => `Шаг ${i+1}`);
    chart.data.datasets[0].data = oge;
    chart.data.datasets[1].data = ege;
    chart.update();
}

function updateStats(){
    let total = answerHistory.length;
    let correct = answerHistory.filter(a => a.correct).length;
    document.getElementById('percentCorrect').innerText = total ? Math.round(correct/total*100) + '%' : '0%';
    let ts = {};
    answerHistory.forEach(a => {
        let k = `${a.exam}_${a.num}`;
        if(!ts[k]) ts[k] = {total: 0, correct: 0};
        ts[k].total++;
        if(a.correct) ts[k].correct++;
    });
    let best = null, bestP = -1, worst = null, worstP = 101;
    for(let [k, s] of Object.entries(ts)){
        if(s.total < 2) continue;
        let p = s.correct / s.total * 100;
        if(p > bestP){ bestP = p; best = k; }
        if(p < worstP){ worstP = p; worst = k; }
    }
    document.getElementById('bestTask').innerText = best ? best.toUpperCase() + ` (${Math.round(bestP)}%)` : '—';
    document.getElementById('worstTask').innerText = worst ? worst.toUpperCase() + ` (${Math.round(worstP)}%)` : '—';
}

function init(){
    let ctx = document.getElementById('progressChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {label: 'ОГЭ', data: [], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3},
                {label: 'ЕГЭ', data: [], borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3}
            ]
        },
        options: {responsive: true, maintainAspectRatio: false}
    });
    renderNumbersGrid();
    updateRandomTask();
    updateStats();
}

// =====================================================
// АВТОРИЗАЦИЯ
// =====================================================
let authModal = document.getElementById('authModal');
let profileModal = document.getElementById('profileModal');
let selectedExam = 'oge';
let currentMode = 'register';

function openAuthModal(mode) {
    currentMode = mode;
    document.getElementById('modalTitleAuth').innerText = mode === 'login' ? 'Войти' : 'Создать аккаунт';
    document.getElementById('modalActionBtn').innerText = mode === 'login' ? 'Войти' : 'Создать аккаунт';
    document.getElementById('authModal').classList.add('active');
}

// Обработчики событий
document.getElementById('ogeMainBtn')?.addEventListener('click', () => {
    userExam = 'oge';
    document.getElementById('ogeMainBtn').className = 'exam-btn-main oge-active';
    document.getElementById('egeMainBtn').className = 'exam-btn-main ege-inactive';
    document.getElementById('ogeToggle').style.display = 'none';
    includeOge = false;
    document.getElementById('includeOgeCheckbox').checked = false;
    cachedRandomTasks = null;
    renderNumbersGrid();
    updateRandomTask();
});
document.getElementById('egeMainBtn')?.addEventListener('click', () => {
    userExam = 'ege';
    document.getElementById('egeMainBtn').className = 'exam-btn-main ege-active';
    document.getElementById('ogeMainBtn').className = 'exam-btn-main oge-inactive';
    document.getElementById('ogeToggle').style.display = 'flex';
    cachedRandomTasks = null;
    renderNumbersGrid();
    updateRandomTask();
});
document.getElementById('includeOgeCheckbox')?.addEventListener('change', (e) => {
    includeOge = e.target.checked;
    cachedRandomTasks = null;
    updateRandomTask();
});
document.getElementById('getRandomBtn')?.addEventListener('click', updateRandomTask);
document.getElementById('checkRandomBtn')?.addEventListener('click', checkRandomAnswer);
document.getElementById('generateVariantBtn')?.addEventListener('click', generateVariantAndDisplay);
document.getElementById('checkVariantBtn')?.addEventListener('click', checkWholeVariant);
document.getElementById('variantHeader')?.addEventListener('click', () => {
    let c = document.getElementById('variantContent');
    let i = document.getElementById('variantToggleIcon');
    c.classList.toggle('show');
    i.className = c.classList.contains('show') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
});

// Закрытие модальных окон
document.getElementById('closeTasksModalBtn')?.addEventListener('click', () => {
    document.getElementById('tasksModal').classList.remove('active');
});
document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    document.getElementById('authModal').classList.remove('active');
});
document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => {
    document.getElementById('profileModal').classList.remove('active');
});

// Закрытие по клику на overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

document.getElementById('showAddFormBtn')?.addEventListener('click', () => {
    document.getElementById('addTaskForm').style.display = 'block';
    document.getElementById('showAddFormBtn').style.display = 'none';
});
document.getElementById('submitNewTaskBtn')?.addEventListener('click', () => {
    let t = document.getElementById('newTaskText').value.trim();
    let a = document.getElementById('newTaskAnswer').value.trim();
    let s = document.getElementById('newTaskSolution').value.trim();
    if(!t || !a){ alert('Заполните поля'); return; }
    if(!tasksCache[currentModalExam][currentModalNum]) tasksCache[currentModalExam][currentModalNum] = [];
    tasksCache[currentModalExam][currentModalNum].push({text: t, answer: a, solution: s});
    document.getElementById('addTaskForm').style.display = 'none';
    document.getElementById('showAddFormBtn').style.display = 'block';
    document.getElementById('newTaskText').value = '';
    document.getElementById('newTaskAnswer').value = '';
    document.getElementById('newTaskSolution').value = '';
    openTasksModalLazy(currentModalExam, currentModalNum);
    renderNumbersGrid();
    updateRandomTask();
});

document.getElementById('accountIconBtn')?.addEventListener('click', () => {
    if(currentUser){
        document.getElementById('currentEmailDisplay').innerText = currentUser.email;
        profileModal.classList.add('active');
    } else {
        openAuthModal('login');
    }
});
document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
document.getElementById('openRegisterBtn')?.addEventListener('click', () => openAuthModal('register'));
document.getElementById('closeModalBtn')?.addEventListener('click', () => authModal.classList.remove('active'));
document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => profileModal.classList.remove('active'));

document.getElementById('modalActionBtn')?.addEventListener('click', () => {
    let e = document.getElementById('modalEmail').value.trim();
    if(!e.includes('@')){ 
        alert('Введите корректный email'); 
        return; 
    }
    currentUser = {email: e, uid: e};
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userEmail').innerText = e;
    authModal.classList.remove('active');
    alert(currentMode === 'login' ? 'Вход выполнен!' : 'Аккаунт создан!');
});

document.querySelectorAll('#authModal .exam-btn').forEach(b => {
    b.addEventListener('click', function(){
        document.querySelectorAll('#authModal .exam-btn').forEach(bb => bb.classList.remove('active'));
        this.classList.add('active');
        selectedExam = this.dataset.exam;
    });
});

document.querySelectorAll('.profile-exam-btn').forEach(b => {
    b.addEventListener('click', function(){
        document.querySelectorAll('.profile-exam-btn').forEach(bb => {
            bb.style.background = 'white';
            bb.style.color = '#034694';
        });
        this.style.background = '#034694';
        this.style.color = 'white';
        selectedExam = this.dataset.exam;
    });
});

document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    let ne = document.getElementById('newEmailInput').value.trim();
    if(ne && ne.includes('@')){
        currentUser.email = ne;
        document.getElementById('userEmail').innerText = ne;
        alert('Почта изменена!');
    }
    if(selectedExam){
        userExam = selectedExam;
        if(userExam === 'oge'){
            document.getElementById('ogeMainBtn').className = 'exam-btn-main oge-active';
            document.getElementById('egeMainBtn').className = 'exam-btn-main ege-inactive';
            document.getElementById('ogeToggle').style.display = 'none';
        } else {
            document.getElementById('egeMainBtn').className = 'exam-btn-main ege-active';
            document.getElementById('ogeMainBtn').className = 'exam-btn-main oge-inactive';
            document.getElementById('ogeToggle').style.display = 'flex';
        }
        cachedRandomTasks = null;
        renderNumbersGrid();
        updateRandomTask();
        alert(`Экзамен изменён на ${selectedExam === 'oge' ? 'ОГЭ' : 'ЕГЭ'}`);
    }
    profileModal.classList.remove('active');
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    currentUser = null;
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userInfo').style.display = 'none';
    alert('Вы вышли');
});

// Запуск приложения
init();
