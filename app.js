// app.js = the BEHAVIOUR of the page (what happens when you tap things).

// 1. Grab the elements from index.html so we can work with them
const noteBox       = document.getElementById("note");
const urgencyBox    = document.getElementById("urgency");
const whenBox       = document.getElementById("when-box");
const whenInput     = document.getElementById("when");
const saveButton    = document.getElementById("save");
const list          = document.getElementById("list");
const googleButton  = document.getElementById("google-status");
const messageBox    = document.getElementById("message");

const urgencyNames = { today: "Today", week: "This week", later: "Later", none: "No deadline" };

// The urgency you picked (starts empty)
let chosenUrgency = null;

// 2. Turn an urgency into a suggested date
function suggestDate(urgency) {
  const date = new Date();                                   // today
  if (urgency === "week")  date.setDate(date.getDate() + 3); // in 3 days
  if (urgency === "later") date.setDate(date.getDate() + 7); // in a week
  return toDateText(date);
}
// Format a date as "2026-11-15" using YOUR time zone (Israel), not London's
function toDateText(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
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

// 5. The phone keeps a copy of every task, plus whether it reached Google
function loadTasks() {
  try { return JSON.parse(localStorage.getItem("tasks")) || []; }
  catch { return []; }
}
function storeTasks(tasks) {
  try { localStorage.setItem("tasks", JSON.stringify(tasks)); } catch {}
}
function updateTask(id, changes) {
  const tasks = loadTasks().map((t) => (t.id === id ? { ...t, ...changes } : t));
  storeTasks(tasks);
  showTasks();
}

// 6. Send one task to Google, and remember whether it worked
//    ("async" = this takes a moment; "await" = wait for Google to answer)
async function sendToGoogle(task) {
  const tokenPromise = getGoogleToken(); // must run first, while the tap is still "fresh"
  updateTask(task.id, { status: "sending" });
  try {
    await addTaskToGoogle(task, tokenPromise);
    updateTask(task.id, { status: "synced" });
    showMessage("Added to Google Calendar ✓");
  } catch (error) {
    updateTask(task.id, { status: "failed" });
    showMessage(error.message, true);
  }
}

saveButton.addEventListener("click", () => {
  const task = {
    id: Date.now(),                // a unique number for this task
    text: noteBox.value.trim(),
    urgency: chosenUrgency,
    date: chosenUrgency === "none" ? null : whenInput.value,
    status: "sending",
  };
  const tasks = loadTasks();
  tasks.unshift(task);             // newest first
  storeTasks(tasks);

  // reset the form for the next task
  noteBox.value = "";
  chosenUrgency = null;
  urgencyBox.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
  whenBox.hidden = true;
  updateSaveButton();

  sendToGoogle(task);
});

// 7. Draw the list of saved tasks on screen
const statusText = {
  sending: "Sending…",
  synced:  "✓ In Google Calendar",
  failed:  "⚠ Not sent",
};

function showTasks() {
  list.innerHTML = "";
  const tasks = loadTasks();
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">No tasks yet ✨</li>';
    return;
  }
  for (const task of tasks) {
    const item = document.createElement("li");

    const text = document.createElement("div");
    text.dir = "auto";
    text.textContent = task.text;
    item.appendChild(text);

    const meta = document.createElement("div");
    meta.className = "meta";
    const parts = [urgencyNames[task.urgency]];
    if (task.date) parts.push(task.date);
    if (task.status) parts.push(statusText[task.status]);
    meta.textContent = parts.join(" · ");
    item.appendChild(meta);

    // A Retry button for tasks that didn't reach Google
    if (task.status === "failed") {
      const retry = document.createElement("button");
      retry.className = "retry";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => sendToGoogle(task));
      item.appendChild(retry);
    }

    list.appendChild(item);
  }
}

// 8. The little "Google" button at the top
function onGoogleStatusChange() {
  const connected = isGoogleConnected();
  googleButton.textContent = connected ? "Google connected ✓" : "Connect Google";
  googleButton.classList.toggle("connected", connected);
}
googleButton.addEventListener("click", () => {
  if (isGoogleConnected()) return;
  getGoogleToken()
    .then(() => showMessage("Google connected ✓"))
    .catch((error) => showMessage(error.message, true));
});

// 9. A short message that appears for a few seconds
let messageTimer;
function showMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.classList.toggle("error", isError);
  messageBox.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (messageBox.hidden = true), 3500);
}

// Tasks stuck on "Sending…" (e.g. the app was closed mid-send) become "Not sent"
storeTasks(loadTasks().map((t) => (t.status === "sending" ? { ...t, status: "failed" } : t)));

showTasks();            // show saved tasks when the page opens
onGoogleStatusChange(); // show whether Google is connected
