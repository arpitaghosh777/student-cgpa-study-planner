// STUDYBUD keeps a small amount of information in this browser.
const STORAGE_KEY = "studybud-data";

let studyData = loadStudyData();

const courseRows = document.getElementById("course-rows");
const cgpaForm = document.getElementById("cgpa-form");
const taskForm = document.getElementById("task-form");
const subjectForm = document.getElementById("subject-form");

// Read saved information. If the browser has no saved data, start fresh.
function loadStudyData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (savedData) {
    try {
      const parsedData = JSON.parse(savedData);
      return {
        subjects: Array.isArray(parsedData.subjects) ? parsedData.subjects : [],
        tasks: Array.isArray(parsedData.tasks) ? parsedData.tasks : [],
        cgpa: typeof parsedData.cgpa === "number" ? parsedData.cgpa : null
      };
    } catch (error) {
      // A damaged saved value should not stop the rest of the page working.
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return { subjects: [], tasks: [], cgpa: null };
}

function saveStudyData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(studyData));
}

function makeId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

// Add one editable course row to the calculator.
function addCourseRow() {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input type="text" class="course-name" maxlength="50" placeholder="e.g. Biology" aria-label="Course name"></td>
    <td><input type="number" class="course-credit" min="0.5" step="0.5" inputmode="decimal" placeholder="3" aria-label="Course credits" required></td>
    <td><input type="number" class="course-grade" min="0" max="4" step="0.01" inputmode="decimal" placeholder="3.50" aria-label="Course grade point" required></td>
    <td><button class="remove-course" type="button" aria-label="Remove this course">×</button></td>
  `;

  row.querySelector(".remove-course").addEventListener("click", function () {
    row.remove();
    if (courseRows.children.length === 0) addCourseRow();
  });

  courseRows.appendChild(row);
}

function calculateCgpa(event) {
  event.preventDefault();

  const rows = Array.from(courseRows.querySelectorAll("tr"));
  let totalCourseCredits = 0;
  let totalCoursePoints = 0;
  let hasInvalidCourse = false;

  rows.forEach(function (row) {
    const creditInput = row.querySelector(".course-credit");
    const gradeInput = row.querySelector(".course-grade");
    const credits = Number(creditInput.value);
    const grade = Number(gradeInput.value);

    if (creditInput.value === "" || gradeInput.value === "" || credits <= 0 || grade < 0 || grade > 4) {
      hasInvalidCourse = true;
      return;
    }

    totalCourseCredits += credits;
    totalCoursePoints += credits * grade;
  });

  const oldCgpaInput = document.getElementById("previous-cgpa");
  const oldCreditsInput = document.getElementById("previous-credits");
  const oldCgpa = Number(oldCgpaInput.value);
  const oldCredits = Number(oldCreditsInput.value);
  const hasOldCgpa = oldCgpaInput.value !== "";
  const hasOldCredits = oldCreditsInput.value !== "";
  const resultMessage = document.getElementById("calculation-message");

  if (rows.length === 0 || totalCourseCredits === 0 || hasInvalidCourse) {
    resultMessage.textContent = "Enter valid credits and grade points from 0 to 4 for each course.";
    return;
  }

  if (hasOldCgpa !== hasOldCredits || (hasOldCgpa && (oldCgpa < 0 || oldCgpa > 4 || oldCredits < 0))) {
    resultMessage.textContent = "Enter both previous CGPA and completed credits, using values within the shown ranges.";
    return;
  }

  const previousPoints = hasOldCgpa ? oldCgpa * oldCredits : 0;
  const totalCredits = totalCourseCredits + (hasOldCgpa ? oldCredits : 0);
  const cgpa = (totalCoursePoints + previousPoints) / totalCredits;
  const roundedCgpa = Math.round(cgpa * 100) / 100;

  document.getElementById("calculated-cgpa").textContent = roundedCgpa.toFixed(2);
  resultMessage.textContent = hasOldCgpa
    ? "Cumulative result across " + totalCredits + " credits."
    : "Average for " + totalCourseCredits + " course credits.";

  studyData.cgpa = roundedCgpa;
  saveStudyData();
  updateDashboard();
}

function formatDate(dateString) {
  if (!dateString) return "No due date";
  const parts = dateString.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getSubjectName(subjectId) {
  const subject = studyData.subjects.find(function (item) { return item.id === subjectId; });
  return subject ? subject.name : "General study";
}

function updateDashboard() {
  document.getElementById("summary-cgpa").textContent = studyData.cgpa === null ? "—" : studyData.cgpa.toFixed(2);
  document.getElementById("summary-subjects").textContent = studyData.subjects.length;

  const completedCount = studyData.tasks.filter(function (task) { return task.completed; }).length;
  document.getElementById("summary-completed").textContent = completedCount;
  document.getElementById("summary-total").textContent = studyData.tasks.length;

  const activeTasks = studyData.tasks.filter(function (task) { return !task.completed; });
  const upcomingTasks = activeTasks
    .filter(function (task) { return !task.completed && task.dueDate; })
    .sort(function (first, second) { return first.dueDate.localeCompare(second.dueDate); });

  const nextDate = document.getElementById("summary-next");
  const nextTitle = document.getElementById("summary-next-title");
  if (upcomingTasks.length > 0) {
    nextDate.textContent = formatDate(upcomingTasks[0].dueDate);
    nextTitle.textContent = upcomingTasks[0].title;
  } else if (activeTasks.length > 0) {
    nextDate.textContent = "No due dates";
    nextTitle.textContent = activeTasks[0].title;
  } else {
    nextDate.textContent = "No tasks yet";
    nextTitle.textContent = "Add a task to get started";
  }
}

// Keep the subject dropdown in sync with the saved subject list.
function renderSubjectOptions() {
  const select = document.getElementById("task-subject");
  select.innerHTML = '<option value="">General study</option>';

  studyData.subjects.forEach(function (subject) {
    const option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.code ? subject.name + " · " + subject.code : subject.name;
    select.appendChild(option);
  });
}

function renderTasks() {
  const taskList = document.getElementById("task-list");
  const filter = document.getElementById("task-filter").value;
  taskList.innerHTML = "";

  const visibleTasks = studyData.tasks
    .filter(function (task) {
      if (filter === "pending") return !task.completed;
      if (filter === "completed") return task.completed;
      return true;
    })
    .sort(function (first, second) {
      if (!first.dueDate) return second.dueDate ? 1 : 0;
      if (!second.dueDate) return -1;
      return first.dueDate.localeCompare(second.dueDate);
    });

  document.getElementById("task-empty").hidden = visibleTasks.length > 0;

  visibleTasks.forEach(function (task) {
    const item = document.createElement("li");
    item.className = "task-item";
    if (task.completed) item.classList.add("is-complete");

    const today = new Date();
    const todayString = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    if (!task.completed && task.dueDate && task.dueDate < todayString) item.classList.add("is-overdue");

    const main = document.createElement("div");
    main.className = "task-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "Mark " + task.title + " as " + (task.completed ? "not completed" : "completed"));
    checkbox.addEventListener("change", function () {
      task.completed = checkbox.checked;
      saveStudyData();
      renderTasks();
      updateDashboard();
    });

    const copy = document.createElement("div");
    copy.className = "task-copy";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = getSubjectName(task.subjectId) + " · " + formatDate(task.dueDate);

    copy.append(title, meta);
    main.append(checkbox, copy);

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", "Delete task " + task.title);
    deleteButton.addEventListener("click", function () {
      studyData.tasks = studyData.tasks.filter(function (savedTask) { return savedTask.id !== task.id; });
      saveStudyData();
      renderTasks();
      updateDashboard();
    });

    item.append(main, deleteButton);
    taskList.appendChild(item);
  });
}

function renderSubjects() {
  const subjectList = document.getElementById("subject-list");
  subjectList.innerHTML = "";
  document.getElementById("subject-empty").hidden = studyData.subjects.length > 0;

  studyData.subjects.forEach(function (subject) {
    const item = document.createElement("li");
    item.className = "subject-item";

    const info = document.createElement("div");
    info.className = "subject-info";
    const name = document.createElement("span");
    name.className = "subject-name";
    name.textContent = subject.name;
    info.appendChild(name);

    if (subject.code) {
      const code = document.createElement("span");
      code.className = "subject-code";
      code.textContent = subject.code;
      info.appendChild(code);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Remove";
    deleteButton.setAttribute("aria-label", "Remove subject " + subject.name);
    deleteButton.addEventListener("click", function () {
      studyData.subjects = studyData.subjects.filter(function (savedSubject) { return savedSubject.id !== subject.id; });
      // Tasks stay in the planner, but become general study tasks if their subject is removed.
      studyData.tasks.forEach(function (task) {
        if (task.subjectId === subject.id) task.subjectId = "";
      });
      saveStudyData();
      renderSubjects();
      renderSubjectOptions();
      renderTasks();
      updateDashboard();
    });

    item.append(info, deleteButton);
    subjectList.appendChild(item);
  });
}

subjectForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const nameInput = document.getElementById("subject-name");
  const codeInput = document.getElementById("subject-code");
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();

  const alreadyExists = studyData.subjects.some(function (subject) {
    return subject.name.toLowerCase() === name.toLowerCase();
  });

  if (!name) return;
  if (alreadyExists) {
    document.getElementById("subject-message").textContent = "That subject is already on your list.";
    return;
  }

  studyData.subjects.push({ id: makeId(), name: name, code: code });
  saveStudyData();
  subjectForm.reset();
  document.getElementById("subject-message").textContent = "Subject saved.";
  renderSubjects();
  renderSubjectOptions();
  updateDashboard();
});

taskForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const titleInput = document.getElementById("task-title");
  const title = titleInput.value.trim();
  if (!title) return;

  studyData.tasks.push({
    id: makeId(),
    title: title,
    subjectId: document.getElementById("task-subject").value,
    dueDate: document.getElementById("task-date").value,
    completed: false
  });

  saveStudyData();
  taskForm.reset();
  document.getElementById("task-message").textContent = "Task added to your planner.";
  renderTasks();
  updateDashboard();
});

cgpaForm.addEventListener("submit", calculateCgpa);
document.getElementById("add-course").addEventListener("click", addCourseRow);
document.getElementById("clear-courses").addEventListener("click", function () {
  courseRows.innerHTML = "";
  addCourseRow();
  document.getElementById("previous-cgpa").value = "";
  document.getElementById("previous-credits").value = "";
  document.getElementById("calculated-cgpa").textContent = "—";
  document.getElementById("calculation-message").textContent = "Add your course results and calculate your CGPA.";
});
document.getElementById("task-filter").addEventListener("change", renderTasks);

// On a small screen, the menu button opens and closes the navigation links.
const menuButton = document.getElementById("menu-button");
menuButton.addEventListener("click", function () {
  const navLinks = document.getElementById("nav-links");
  const isOpen = navLinks.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", isOpen);
});

document.querySelectorAll(".nav-links a").forEach(function (link) {
  link.addEventListener("click", function () {
    document.getElementById("nav-links").classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

// Draw the page with saved information and start with one calculator row.
addCourseRow();
renderSubjects();
renderSubjectOptions();
renderTasks();
updateDashboard();
