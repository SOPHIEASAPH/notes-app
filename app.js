// app.js = the BEHAVIOUR of the page (what happens when you tap things).

// 1. Grab the elements from index.html so we can work with them
const noteBox    = document.getElementById("note");
const urgencyBox = document.getElementById("urgency");
const whenBox    = document.getElementById("when-box");
const whenInput  = document.getElementById("when");
const saveButton = document.getElementById("save");
const list       = document.getElementById("list");

// The urgency you picked (starts empty)
let chosenUrgency = null;

// 2. Turn an urgency into a suggested date
function suggestDate(urgency) {
  const date = new Date();                      // today
  if (urgency === "week")  date.setDate(date.getDate() + 3); // in 3 days
  if (urgency === "later") date.setDate(date.getDate() + 7); // in a week
  return date.toISOString().slice(0, 10);       // format as "2026-11-15"
}

// 3. When you tap an urgency button...
urgencyBox.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  chosenUrgency = button.dataset.urgency;

  // highlight only the tapped button
  urgencyBox.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");

  // show the date picker with a suggested date (hide it for "No deadline")
  if (chosenUrgency === "none") {
    whenBox.hidden = true;
  } else {
    whenBox.hidden = false;
    whenInput.value = suggestDate(chosenUrgency);
  }
  updateSaveButton();
});

// 4. The Save button only works once you've written something AND picked urgency
function updateSaveButton() {
  saveButton.disabled = !(noteBox.value.trim() && chosenUrgency);
}
noteBox.addEventListener("input", updateSaveButton);

// 5. Saving: tasks are kept in the phone's own storage for now
//    (in Step 3 they'll go to Google Calendar instead)
function loadTasks() {
  try { return JSON.parse(localStorage.getItem("tasks")) || []; }
  catch { return []; }
}
function storeTasks(tasks) {
  try { localStorage.setItem("tasks", JSON.stringify(tasks)); } catch {}
}

saveButton.addEventListener("click", () => {
  const task = {
    text: noteBox.value.trim(),
    urgency: chosenUrgency,
    date: chosenUrgency === "none" ? null : whenInput.value,
  };
  const tasks = loadTasks();
  tasks.unshift(task);           // newest first
  storeTasks(tasks);

  // reset the form for the next task
  noteBox.value = "";
  chosenUrgency = null;
  urgencyBox.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
  whenBox.hidden = true;
  updateSaveButton();
  showTasks();
});

// 6. Draw the list of saved tasks on screen
const urgencyNames = { today: "Today", week: "This week", later: "Later", none: "No deadline" };

function showTasks() {
  list.innerHTML = "";
  const tasks = loadTasks();
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">No tasks yet ✨</li>';
    return;
  }
  for (const task of tasks) {
    const item = document.createElement("li");
    item.dir = "auto";
    item.textContent = task.text;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = urgencyNames[task.urgency] + (task.date ? " · " + task.date : "");
    item.appendChild(meta);

    list.appendChild(item);
  }
}

showTasks(); // show saved tasks when the page opens
