// Конфигурация
const departments = ['SAI', 'GU', 'AF', 'IAD', 'SEB', 'K-9', 'DID', 'MED', 'SPD'];

const formTypes = [
  { id: 'department', label: 'Заявка в отдел', icon: '📋', desc: 'Подача заявления на перевод' },
  { id: 'appeal', label: 'Обжалование выговора', icon: '⚖', desc: 'Обжалование дисциплинарного взыскания' },
  { id: 'workoff', label: 'Отработка выговора', icon: '🛠', desc: 'Отработка для снятия выговора' },
  { id: 'promotion', label: 'Заявка на повышение', icon: '⭐', desc: 'Повышение в должности' },
  { id: 'leave', label: 'Заявка на отпуск', icon: '🏖', desc: 'Плановый отпуск' },
  { id: 'rest', label: 'Заявка на отдых', icon: '🌴', desc: 'Краткосрочный отдых' },
  { id: 'spec-request', label: 'Спец вооружение (заявка)', icon: '🔫', desc: 'Запрос на выдачу' },
  { id: 'spec-receive', label: 'Спец вооружение (получение)', icon: '📦', desc: 'Отчёт о получении' },
  { id: 'resignation', label: 'Рапорт на увольнение', icon: '📄', desc: 'Заявление об уходе' }
];

let currentUser = null;

// Генерация карточек
function renderFormsGrid() {
  const grid = document.getElementById('formsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  formTypes.forEach(type => {
    const card = document.createElement('div');
    card.className = 'form-card';
    card.innerHTML = `
      <div class="form-card-icon">${type.icon}</div>
      <h3>${type.label}</h3>
      <p>${type.desc}</p>
    `;
    card.addEventListener('click', () => openForm(type.id));
    grid.appendChild(card);
  });
}

// Проверка авторизации
async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      currentUser = await res.json();
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'block';
      document.getElementById('userInfo').style.display = 'flex';
      document.getElementById('userName').innerText = currentUser.username;
      const avatarEl = document.getElementById('userAvatar');
      if (avatarEl && currentUser.avatar) {
        avatarEl.src = `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`;
      }
      renderFormsGrid();
      document.getElementById('statsCount').innerText = '0';
      setInterval(checkMembership, 5 * 60 * 1000);
    } else {
      showAuthScreen();
    }
  } catch(e) { showAuthScreen(); }
}

async function checkMembership() {
  try {
    const res = await fetch('/api/check-membership');
    const data = await res.json();
    if (!data.authorized) window.location.href = '/logout';
  } catch(e) {}
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('userInfo').style.display = 'none';
}

document.getElementById('logoutBtn')?.addEventListener('click', () => window.location.href = '/logout');

// Модальное окно
function openForm(type) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = '';
  switch(type) {
    case 'department': renderDepartmentForm(modalBody); break;
    case 'appeal': renderAppealForm(modalBody); break;
    case 'workoff': renderWorkoffForm(modalBody); break;
    case 'promotion': renderPromotionForm(modalBody); break;
    case 'leave': renderLeaveForm(modalBody, 'отпуск'); break;
    case 'rest': renderLeaveForm(modalBody, 'отдых'); break;
    case 'spec-request': renderSpecRequestForm(modalBody); break;
    case 'spec-receive': renderSpecReceiveForm(modalBody); break;
    case 'resignation': renderResignationForm(modalBody); break;
  }
  modal.style.display = 'block';
}

document.querySelector('.modal-close')?.addEventListener('click', () => {
  document.getElementById('modal').style.display = 'none';
});
window.addEventListener('click', (e) => {
  const modal = document.getElementById('modal');
  if (e.target === modal) modal.style.display = 'none';
});

// ========== ВСЕ ФОРМЫ ==========

function renderDepartmentForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">📋 Заявка в отдел</h3>
    <form id="dynamicForm">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Статик *</label><input type="text" id="staticc" required></div>
      <div class="form-group"><label>Ваш ранг *</label><input type="text" id="rank" required></div>
      <div class="form-group"><label>Отдел *</label><div class="role-buttons" id="deptButtons"></div><input type="hidden" id="department" required></div>
      <div class="form-group"><label>Почему хотите в отдел *</label><textarea id="reason" rows="3" required></textarea></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить заявку</button>
    </form>
  `;
  fillDepartmentButtons(container);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticc = document.getElementById('staticc').value.trim();
    const rank = document.getElementById('rank').value.trim();
    const department = document.getElementById('department').value;
    const reason = document.getElementById('reason').value.trim();
    if (!firstName || !lastName || !staticc || !rank || !department || !reason) {
      showError(container, 'Заполните все поля');
      return;
    }
    await submitForm('/api/apply-department', { firstName, lastName, staticc, rank, department, reason }, container);
  };
}

function renderAppealForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">⚖ Обжалование выговора</h3>
    <form id="dynamicForm" enctype="multipart/form-data">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Статик *</label><input type="text" id="staticc" required></div>
      <div class="form-group"><label>Вид наказания *</label><input type="text" id="reprimandType" required></div>
      <div class="form-group"><label>Кем выдано *</label><input type="text" id="issuedBy" required></div>
      <div class="form-group"><label>Когда выдано *</label><input type="date" id="issuedDate" required></div>
      <div class="form-group"><label>Причина из выговора *</label><textarea id="reasonGiven" rows="2" required></textarea></div>
      <div class="form-group"><label>Описание ситуации *</label><textarea id="description" rows="3" required></textarea></div>
      <div class="form-group"><label>Доказательство (скрин) *</label><input type="file" id="proof" accept="image/*" required></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить</button>
    </form>
  `;
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticc = document.getElementById('staticc').value.trim();
    const reprimandType = document.getElementById('reprimandType').value.trim();
    const issuedBy = document.getElementById('issuedBy').value.trim();
    const issuedDate = document.getElementById('issuedDate').value;
    const reasonGiven = document.getElementById('reasonGiven').value.trim();
    const description = document.getElementById('description').value.trim();
    const proofFile = document.getElementById('proof').files[0];
    if (!firstName || !lastName || !staticc || !reprimandType || !issuedBy || !issuedDate || !reasonGiven || !description || !proofFile) {
      showError(container, 'Заполните все поля и прикрепите скриншот');
      return;
    }
    const formData = new FormData();
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('staticc', staticc);
    formData.append('reprimandType', reprimandType);
    formData.append('issuedBy', issuedBy);
    formData.append('issuedDate', issuedDate);
    formData.append('reasonGiven', reasonGiven);
    formData.append('description', description);
    formData.append('proof', proofFile);
    await submitFormMultipart('/api/appeal-reprimand', formData, container);
  };
}

function renderWorkoffForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">🛠 Отработка выговора</h3>
    <form id="dynamicForm">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Статик *</label><input type="text" id="staticc" required></div>
      <div class="form-group"><label>Ваш ранг *</label>
        <select id="rank" required>
          <option value="">Выберите ранг</option>
          <option value="1-4">1-4 ранг</option>
          <option value="5-8">5-8 ранг</option>
          <option value="9-11">9-11 ранг</option>
          <option value="13">13 ранг</option>
        </select>
      </div>
      <div class="form-group"><label>За что выговор *</label><textarea id="reason" rows="2" required></textarea></div>
      <div class="form-group"><label>Тип наказания *</label>
        <select id="punishmentType" required>
          <option value="">Выберите тип</option>
          <option value="Устный выговор">Устный выговор</option>
          <option value="Строгий выговор">Строгий выговор</option>
        </select>
      </div>
      <div class="notice" id="penaltyNotice">💰 Выберите ранг и тип выговора</div>
      <div class="form-group"><label>Док-ва *</label><textarea id="evidence" rows="2" required></textarea></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить</button>
    </form>
  `;
  const rankSelect = container.querySelector('#rank');
  const typeSelect = container.querySelector('#punishmentType');
  const noticeDiv = container.querySelector('#penaltyNotice');
  const updateNotice = () => {
    const rank = rankSelect.value;
    const type = typeSelect.value;
    const data = {
      '1-4': { 'Устный выговор': '15.000$ / 200 бинтов', 'Строгий выговор': '25.000$' },
      '5-8': { 'Устный выговор': '20.000$ / 350 бинтов', 'Строгий выговор': '30.000$' },
      '9-11': { 'Устный выговор': '25.000$ / 450 бинтов', 'Строгий выговор': '42.000$' },
      '13': { 'Устный выговор': '35.000$ / 600 бинтов', 'Строгий выговор': '45.000$' }
    };
    noticeDiv.textContent = data[rank]?.[type] ? `💸 Для снятия: ${data[rank][type]}` : '💰 Выберите ранг и тип выговора';
  };
  rankSelect.addEventListener('change', updateNotice);
  typeSelect.addEventListener('change', updateNotice);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticc = document.getElementById('staticc').value.trim();
    const rank = document.getElementById('rank').value;
    const reason = document.getElementById('reason').value.trim();
    const punishmentType = document.getElementById('punishmentType').value;
    const evidence = document.getElementById('evidence').value.trim();
    if (!firstName || !lastName || !staticc || !rank || !reason || !punishmentType || !evidence) {
      showError(container, 'Заполните все поля');
      return;
    }
    await submitForm('/api/workoff-reprimand', { firstName, lastName, staticc, rank, reason, punishmentType, evidence }, container);
  };
}

function renderPromotionForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">⭐ Заявка на повышение</h3>
    <form id="dynamicForm">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Статик *</label><input type="text" id="staticc" required></div>
      <div class="form-group"><label>Текущий ранг *</label><input type="text" id="currentRank" required></div>
      <div class="form-group"><label>На какой ранг *</label><input type="text" id="targetRank" required></div>
      <div class="form-group"><label>Кол-во баллов *</label><input type="number" id="points" required></div>
      <div class="form-group"><label>Док-ва баллов *</label><textarea id="proof" rows="2" required></textarea></div>
      <div class="form-group"><label>Отдел *</label><div class="role-buttons" id="deptButtons"></div><input type="hidden" id="department" required></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить</button>
    </form>
  `;
  fillDepartmentButtons(container);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticc = document.getElementById('staticc').value.trim();
    const currentRank = document.getElementById('currentRank').value.trim();
    const targetRank = document.getElementById('targetRank').value.trim();
    const points = document.getElementById('points').value;
    const proof = document.getElementById('proof').value.trim();
    const department = document.getElementById('department').value;
    if (!firstName || !lastName || !staticc || !currentRank || !targetRank || !points || !proof || !department) {
      showError(container, 'Заполните все поля');
      return;
    }
    await submitForm('/api/promotion', { firstName, lastName, staticc, currentRank, targetRank, points, proof, department }, container);
  };
}

function renderLeaveForm(container, type) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">${type === 'отпуск' ? '🏖 Заявка на отпуск' : '🌴 Заявка на отдых'}</h3>
    <form id="dynamicForm">
      <div class="form-group"><label>Отдел *</label><div class="role-buttons" id="deptButtons"></div><input type="hidden" id="department" required></div>
      <div class="form-group"><label>Причина *</label><textarea id="reason" rows="2" required></textarea></div>
      <div class="form-group"><label>С какой даты *</label><input type="datetime-local" id="from" required></div>
      <div class="form-group"><label>По какую дату *</label><input type="datetime-local" id="to" required></div>
      <div class="form-group"><label>Примечание</label><textarea id="note" rows="2"></textarea></div>
      <div class="notice">⚠️ Максимум две недели, запрещено быть в игре</div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить</button>
    </form>
  `;
  fillDepartmentButtons(container);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const department = document.getElementById('department').value;
    const reason = document.getElementById('reason').value.trim();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const note = document.getElementById('note').value.trim();
    if (!department || !reason || !from || !to) {
      showError(container, 'Заполните обязательные поля');
      return;
    }
    await submitForm('/api/leave', { type, department, reason, from, to, note }, container);
  };
}

function renderSpecRequestForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">🔫 Заявка на спец вооружение</h3>
    <form id="dynamicForm">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Статик *</label><input type="text" id="staticc" required></div>
      <div class="form-group"><label>Ранг *</label><input type="text" id="rank" required></div>
      <div class="form-group"><label>Отдел *</label><div class="role-buttons" id="deptButtons"></div><input type="hidden" id="department" required></div>
      <div class="form-group"><label>Какое спец вооружение? *</label><input type="text" id="weapon" required></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить</button>
    </form>
  `;
  fillDepartmentButtons(container);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticc = document.getElementById('staticc').value.trim();
    const rank = document.getElementById('rank').value.trim();
    const department = document.getElementById('department').value;
    const weapon = document.getElementById('weapon').value.trim();
    if (!firstName || !lastName || !staticc || !rank || !department || !weapon) {
      showError(container, 'Заполните все поля');
      return;
    }
    await submitForm('/api/spec-weapon-request', { firstName, lastName, staticc, rank, department, weapon }, container);
  };
}

function renderSpecReceiveForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">📦 Получение спец вооружения</h3>
    <form id="dynamicForm" enctype="multipart/form-data">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Статик *</label><input type="text" id="staticc" required></div>
      <div class="form-group"><label>Ранг *</label><input type="text" id="rank" required></div>
      <div class="form-group"><label>Отдел *</label><div class="role-buttons" id="deptButtons"></div><input type="hidden" id="department" required></div>
      <div class="form-group"><label>Какое спец вооружение? *</label><input type="text" id="weapon" required></div>
      <div class="form-group"><label>Номер спецухи *</label><input type="text" id="weaponNumber" placeholder="SHPD-xxx-xxx-xxx" required></div>
      <div class="form-group"><label>Кто выдал? *</label><input type="text" id="issuedBy" required></div>
      <div class="form-group"><label>Скрин из инвентаря *</label><input type="file" id="inventoryScreenshot" accept="image/*" required></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить</button>
    </form>
  `;
  fillDepartmentButtons(container);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticc = document.getElementById('staticc').value.trim();
    const rank = document.getElementById('rank').value.trim();
    const department = document.getElementById('department').value;
    const weapon = document.getElementById('weapon').value.trim();
    const weaponNumber = document.getElementById('weaponNumber').value.trim();
    const issuedBy = document.getElementById('issuedBy').value.trim();
    const file = document.getElementById('inventoryScreenshot').files[0];
    if (!firstName || !lastName || !staticc || !rank || !department || !weapon || !weaponNumber || !issuedBy || !file) {
      showError(container, 'Заполните все поля');
      return;
    }
    const formData = new FormData();
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('staticc', staticc);
    formData.append('rank', rank);
    formData.append('department', department);
    formData.append('weapon', weapon);
    formData.append('weaponNumber', weaponNumber);
    formData.append('issuedBy', issuedBy);
    formData.append('inventoryScreenshot', file);
    await submitFormMultipart('/api/spec-weapon-receive', formData, container);
  };
}

function renderResignationForm(container) {
  container.innerHTML = `
    <h3 style="color:#ecd67a; margin-bottom:20px;">📄 Рапорт на увольнение</h3>
    <form id="dynamicForm">
      <div class="form-group"><label>Имя *</label><input type="text" id="firstName" required></div>
      <div class="form-group"><label>Фамилия *</label><input type="text" id="lastName" required></div>
      <div class="form-group"><label>Static ID *</label><input type="text" id="staticId" required></div>
      <div class="form-group"><label>Отдел *</label><div class="role-buttons" id="deptButtons"></div><input type="hidden" id="department" required></div>
      <div class="form-group"><label>Планшет *</label><input type="text" id="tablet" required></div>
      <div class="form-group"><label>Инвентарь *</label><input type="text" id="inventory" required></div>
      <div class="form-group"><label>Причина *</label><textarea id="reason" rows="3" required></textarea></div>
      <div class="form-group"><label>Discord ID (опционально)</label><input type="text" id="discordId"></div>
      <div class="error-message" id="formError" style="display:none"></div>
      <button type="submit">Отправить рапорт</button>
    </form>
  `;
  fillDepartmentButtons(container);
  const form = container.querySelector('#dynamicForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const staticId = document.getElementById('staticId').value.trim();
    const department = document.getElementById('department').value;
    const tablet = document.getElementById('tablet').value.trim();
    const inventory = document.getElementById('inventory').value.trim();
    const reason = document.getElementById('reason').value.trim();
    const discordId = document.getElementById('discordId').value.trim();
    if (!firstName || !lastName || !staticId || !department || !tablet || !inventory || !reason) {
      showError(container, 'Заполните все поля');
      return;
    }
    await submitForm('/api/resignation', { firstName, lastName, staticId, department, tablet, inventory, reason, discordId }, container);
  };
}

// Вспомогательные функции
function fillDepartmentButtons(container) {
  const btnContainer = container.querySelector('#deptButtons');
  if (!btnContainer) return;
  departments.forEach(dept => {
    const btn = document.createElement('div');
    btn.className = 'role-btn';
    btn.textContent = dept;
    btn.onclick = () => {
      document.querySelectorAll('#deptButtons .role-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const hidden = document.getElementById('department');
      if (hidden) hidden.value = dept;
    };
    btnContainer.appendChild(btn);
  });
}

function showError(container, message) {
  const errDiv = container.querySelector('#formError');
  if (errDiv) {
    errDiv.textContent = message;
    errDiv.style.display = 'block';
    setTimeout(() => errDiv.style.display = 'none', 4000);
  } else alert(message);
}

async function submitForm(url, data, container) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      alert('✅ Заявка успешно отправлена!');
      document.getElementById('modal').style.display = 'none';
    } else {
      showError(container, result.error || 'Ошибка');
    }
  } catch (err) {
    showError(container, 'Ошибка сети');
  }
}

async function submitFormMultipart(url, formData, container) {
  try {
    const res = await fetch(url, { method: 'POST', body: formData });
    const result = await res.json();
    if (result.success) {
      alert('✅ Заявка успешно отправлена!');
      document.getElementById('modal').style.display = 'none';
    } else {
      showError(container, result.error || 'Ошибка');
    }
  } catch (err) {
    showError(container, 'Ошибка сети');
  }
}

// Запуск
checkAuth();