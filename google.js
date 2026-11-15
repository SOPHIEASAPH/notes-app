// google.js = everything about talking to Google.
// Kept in its own file so app.js stays about the screen, and this file stays about Google.

// Your app's "passport" from Google Cloud. Safe to be public.
const GOOGLE_CLIENT_ID = "398481424069-5m5i3d8dq01vjma1054fg5g5mtk7onmf.apps.googleusercontent.com";

// The permission we ask for: "manage your Google Tasks" (and nothing else)
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/tasks";

// ---------------------------------------------------------------------------
// 1. The "access token": a temporary key Google gives us after you tap Allow.
//    It lasts about 1 hour. We remember it so you aren't asked on every save.
// ---------------------------------------------------------------------------
function getSavedToken() {
  try {
    const saved = JSON.parse(localStorage.getItem("googleToken"));
    if (saved && saved.expiresAt > Date.now()) return saved.token; // still valid
  } catch {}
  return null;
}
function saveToken(token, secondsValid) {
  const expiresAt = Date.now() + (secondsValid - 60) * 1000; // 1 minute safety margin
  try { localStorage.setItem("googleToken", JSON.stringify({ token, expiresAt })); } catch {}
}
function forgetToken() {
  try { localStorage.removeItem("googleToken"); } catch {}
}
function isGoogleConnected() {
  return getSavedToken() !== null;
}

// ---------------------------------------------------------------------------
// 2. Asking Google for permission (shows the "Allow" window)
// ---------------------------------------------------------------------------
let tokenClient = null;  // Google's sign-in helper, created once Google's script loads
let waiting = [];        // anyone waiting for the token to arrive

function finishWaiting(error, token) {
  for (const w of waiting) error ? w.reject(error) : w.resolve(token);
  waiting = [];
}

// Called automatically when Google's script (in index.html) has loaded
function initGoogle() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPE,
    callback: (response) => {
      if (response.error) return finishWaiting(new Error("Google said: " + response.error));
      saveToken(response.access_token, Number(response.expires_in));
      finishWaiting(null, response.access_token);
      onGoogleStatusChange();
    },
    error_callback: (err) => {
      // e.g. you closed the window, or the browser blocked the popup
      finishWaiting(new Error(err.type === "popup_closed" ? "Google window was closed" : "Couldn't open Google sign-in"));
    },
  });
}

// Returns a Promise of a token. If we don't have a valid one, opens the Allow window.
// IMPORTANT: call this directly inside a tap, before any "await" — otherwise
// Safari treats the window as an unwanted popup and blocks it.
function getGoogleToken() {
  const token = getSavedToken();
  if (token) return Promise.resolve(token);
  if (!tokenClient) return Promise.reject(new Error("Google is still loading, try again in a second"));
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    if (waiting.length === 1) tokenClient.requestAccessToken();
  });
}

// ---------------------------------------------------------------------------
// 3. Creating a task in Google Tasks (it shows up in Google Calendar)
//    Docs: https://developers.google.com/tasks/reference/rest/v1/tasks/insert
// ---------------------------------------------------------------------------
async function addTaskToGoogle(task, tokenPromise) {
  const token = await tokenPromise;

  const body = {
    title: task.text,
    notes: "Urgency: " + urgencyNames[task.urgency] + "\nAdded from My Tasks app",
  };
  // Google Tasks only uses the DATE part of "due" (no time of day)
  if (task.date) body.due = task.date + "T00:00:00.000Z";

  const response = await fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,     // "here's my key"
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {          // key expired or was revoked
    forgetToken();
    onGoogleStatusChange();
    throw new Error("Google connection expired — tap Retry");
  }
  if (!response.ok) throw new Error("Couldn't reach Google (error " + response.status + ") — tap Retry");
  return response.json();                  // the task Google created (includes its id)
}
