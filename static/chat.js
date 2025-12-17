// ----------------------------
// SIDEBAR TOGGLE
// ----------------------------
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("-translate-x-full");
}

// ----------------------------
// SOCKET.IO SETUP
// ----------------------------
const socket = io();
let currentReceiver = null;
const unreadCount = {};
let lastRenderedDate = null;

// Username
const username = document.getElementById("username").value.trim().toLowerCase();

// ----------------------------
// INITIAL LOAD
// ----------------------------
window.addEventListener("load", () => {
  if (username) socket.emit("user_connected", username);

  const savedTheme = localStorage.getItem("theme") || "blue";
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) themeSelect.value = savedTheme;
  applyTheme(savedTheme);
});

// ----------------------------
// SEND MESSAGE
// ----------------------------
const messageInput = document.getElementById("messageInput");
document.getElementById("sendBtn").addEventListener("click", sendMessage);

function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !currentReceiver) return;

  socket.emit("private_message", {
    username,
    receiver: currentReceiver,
    message,
  });

  messageInput.value = "";
}

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// ----------------------------
// TYPING INDICATOR (SEND)
// ----------------------------
let typingTimeout;
messageInput.addEventListener("input", () => {
  if (!currentReceiver) return;

  socket.emit("typing", { sender: username, receiver: currentReceiver });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing", {
      sender: username,
      receiver: currentReceiver,
      stop: true,
    });
  }, 800);
});

// ----------------------------
// RECEIVE MESSAGE
// ----------------------------
socket.on("private_message", (data) => {
  if (currentReceiver === data.sender) {
    addMessageToChat(data.sender, data.message, false, data.timestamp);
  } else {
    unreadCount[data.sender] = (unreadCount[data.sender] || 0) + 1;
    updateUnreadBadge(data.sender);
  }

  updatePreview(data.sender, data.message);
});

// ----------------------------
// TYPING INDICATOR (RECEIVE)
// ----------------------------
socket.on("typing", (data) => {
  const indicator = document.getElementById("typingIndicator");
  if (!indicator) return;

  if (data.stop) {
    indicator.innerText = "";
    return;
  }

  if (currentReceiver === data.sender) {
    indicator.innerText = `${data.sender} is typing...`;
  }
});

// ----------------------------
// USER LIST
// ----------------------------
socket.on("user_list", (users) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  users.forEach((user) => {
    if (user !== username) {
      const item = document.createElement("div");
      item.className =
        "chat-item flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-200";

      item.innerHTML = `
        <img 
          src="https://ui-avatars.com/api/?name=${user}&background=random&color=fff&rounded=true"
          class="w-10 h-10 rounded-full"
        />

        <div class="flex-1">
          <h3 class="font-semibold">${user}</h3>
          <p class="chat-preview text-xs text-gray-500">No messages yet</p>
        </div>
      `;

      item.onclick = async () => {
        currentReceiver = user.toLowerCase();
        document.getElementById("chatHeader").innerText = user;

        lastRenderedDate = null; // reset date separators

        fetch(`/mark-read/${user}`, { method: "POST" });

        unreadCount[user] = 0;
        const badge = item.querySelector(".unread-badge");
        if (badge) badge.remove();

        const chatBox = document.querySelector(".chat-messages");
        chatBox.innerHTML = "";

        const res = await fetch(`/history/${user}`);
        const messages = await res.json();

        messages.forEach(([sender, msg, time]) => {
          addMessageToChat(sender, msg, sender === username, time);
        });

        delete unreadCount[user];
      };

      userList.appendChild(item);
    }
  });
});

// ----------------------------
// TIME + DATE HELPERS
// ----------------------------
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateLabel(date) {
  const today = new Date();
  const msgDate = new Date(date);

  if (msgDate.toDateString() === today.toDateString()) return "Today";

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";

  return msgDate.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ----------------------------
// ADD MESSAGE TO CHAT
// ----------------------------
function addMessageToChat(sender, message, isSelf, timestamp) {
  const chatBox = document.querySelector(".chat-messages");
  const msgDiv = document.createElement("div");

  const isDark = document.body.classList.contains("bg-slate-900");
  const msgDate = timestamp ? new Date(timestamp) : new Date();
  const time = formatTime(msgDate);
  const dateLabel = getDateLabel(msgDate);

  if (lastRenderedDate !== dateLabel) {
    const dateDiv = document.createElement("div");
    dateDiv.className = "text-center text-xs text-gray-400 my-3";
    dateDiv.innerText = `— ${dateLabel} —`;
    chatBox.appendChild(dateDiv);
    lastRenderedDate = dateLabel;
  }

  msgDiv.className = `
    ${isSelf ? "self-end" : "self-start"}
    px-4 py-2 rounded-xl shadow max-w-xs mt-2
    ${
      isSelf
        ? isDark
          ? "bg-blue-600 text-white"
          : "bg-green-200 text-black"
        : isDark
        ? "bg-slate-700 text-white"
        : "bg-white text-black"
    }
  `;

  msgDiv.innerHTML = `
    <div>${message}</div>
    <div class="text-xs opacity-60 text-right mt-1">${time}</div>
  `;

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ----------------------------
// UNREAD BADGE
// ----------------------------
function updateUnreadBadge(user) {
  document.querySelectorAll(".chat-item").forEach((item) => {
    if (item.querySelector("h3")?.innerText === user) {
      let badge = item.querySelector(".unread-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className =
          "unread-badge ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full";
        item.appendChild(badge);
      }
      badge.innerText = unreadCount[user];
    }
  });
}

// ----------------------------
// SEARCH
// ----------------------------
document.getElementById("searchBar").addEventListener("input", function () {
  const query = this.value.toLowerCase();
  document.querySelectorAll(".chat-item").forEach((item) => {
    const name = item.querySelector("h3").innerText.toLowerCase();
    item.style.display = name.includes(query) ? "flex" : "none";
  });
});

function updatePreview(user, message) {
  document.querySelectorAll(".chat-item").forEach((item) => {
    if (item.querySelector("h3")?.innerText === user) {
      item.querySelector(".chat-preview").innerText = message;
    }
  });
}

// ----------------------------
// THEMES
// ----------------------------
const themes = {
  blue: { body: "bg-gray-100", header: "from-indigo-500 to-blue-500" },
  green: { body: "bg-emerald-50", header: "from-emerald-500 to-green-500" },
  purple: { body: "bg-purple-50", header: "from-purple-500 to-fuchsia-500" },
  light: { body: "bg-gray-100", header: "from-slate-500 to-slate-700" },
  dark: { body: "bg-slate-900", header: "from-slate-800 to-slate-700" },
};

function applyTheme(theme) {
  Object.values(themes).forEach((t) => document.body.classList.remove(t.body));
  document.body.classList.add(themes[theme].body);

  const header = document.querySelector(".bg-gradient-to-r");
  if (header) {
    header.className =
      "flex items-center gap-3 p-4 text-white shadow bg-gradient-to-r";
    header.classList.add(...themes[theme].header.split(" "));
  }

  localStorage.setItem("theme", theme);
  updateModeButton(theme);

  fetch("/save-theme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme }),
  });
}

function toggleDarkLight() {
  applyTheme(localStorage.getItem("theme") === "dark" ? "light" : "dark");
}

function updateModeButton(theme) {
  const btn = document.getElementById("modeToggleBtn");
  if (!btn) return;
  btn.innerText =
    theme === "dark" ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode";
}
