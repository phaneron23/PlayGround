const STORAGE_KEY = "todo-list-items-v1";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const count = document.getElementById("todo-count");
const emptyState = document.getElementById("empty-state");
const clearCompletedBtn = document.getElementById("clear-completed");
const filterButtons = document.querySelectorAll(".filter");

let todos = loadTodos();
let filter = "all";

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text: trimmed,
    completed: false,
    createdAt: Date.now(),
  });
  saveTodos();
  render();
}

function toggleTodo(id) {
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  );
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  saveTodos();
  render();
}

function editTodo(id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) {
    deleteTodo(id);
    return;
  }
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, text: trimmed } : todo
  );
  saveTodos();
  render();
}

function clearCompleted() {
  todos = todos.filter((todo) => !todo.completed);
  saveTodos();
  render();
}

function visibleTodos() {
  if (filter === "active") return todos.filter((t) => !t.completed);
  if (filter === "completed") return todos.filter((t) => t.completed);
  return todos;
}

function render() {
  const visible = visibleTodos();
  list.innerHTML = "";

  for (const todo of visible) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.setAttribute("aria-label", `Mark "${todo.text}" as ${todo.completed ? "active" : "completed"}`);
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const textBtn = document.createElement("button");
    textBtn.type = "button";
    textBtn.className = "todo-text";
    textBtn.textContent = todo.text;
    textBtn.title = "Double-click to edit";
    textBtn.addEventListener("dblclick", () => startEditing(li, todo));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", `Edit "${todo.text}"`);
    editBtn.addEventListener("click", () => startEditing(li, todo));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete "${todo.text}"`);
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    li.append(checkbox, textBtn, editBtn, deleteBtn);
    list.appendChild(li);
  }

  const activeCount = todos.filter((t) => !t.completed).length;
  count.textContent =
    todos.length === 0
      ? "Nothing to do."
      : `${activeCount} active, ${todos.length - activeCount} completed`;

  emptyState.style.display = visible.length === 0 ? "block" : "none";
  emptyState.textContent =
    todos.length === 0
      ? "No todos yet. Add your first one above."
      : "No todos match this filter.";
}

function startEditing(li, todo) {
  const textEl = li.querySelector(".todo-text");
  const editor = document.createElement("input");
  editor.type = "text";
  editor.value = todo.text;
  editor.maxLength = 200;
  editor.className = "todo-text editing-input";
  editor.setAttribute("aria-label", "Edit todo");

  let committed = false;
  const commit = (save) => {
    if (committed) return;
    committed = true;
    if (save) editTodo(todo.id, editor.value);
    else render();
  };

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit(true);
    if (e.key === "Escape") commit(false);
  });
  editor.addEventListener("blur", () => commit(true));

  li.replaceChild(editor, textEl);
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(input.value);
  input.value = "";
  input.focus();
});

clearCompletedBtn.addEventListener("click", clearCompleted);

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterButtons.forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });
});

render();
