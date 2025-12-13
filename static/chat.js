// ----------------------------
// SIDEBAR TOGGLE
// ----------------------------
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("-translate-x-full");
}

// ----------------------------
// SOCKET.IO SETUP
// ----------------------------
const socket = io();
let currentReceiver = null;

// Get username from hidden input
const username = document.getElementById("username").value.trim();

window.addEventListener("load", () => {
  if (username) {
    socket.emit("user_connected", username);
  }
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
    username: username,
    receiver: currentReceiver,
    message: message,
  });

  addMessageToChat(username, message, true);
  messageInput.value = "";
}

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// ----------------------------
// RECEIVE MESSAGE
// ----------------------------
socket.on("private_message", (data) => {
  addMessageToChat(data.sender, data.message, false);
});

// ----------------------------
// UPDATE USER LIST
// ----------------------------
socket.on("user_list", (users) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  users.forEach((user) => {
    if (user !== username) {
      const item = document.createElement("div");
      item.className =
        "chat-item flex items-center gap-3 px-4 py-3 hover:bg-blue-200 cursor-pointer";
      item.innerHTML = `
        <img src="/static/images/user.png" class="w-10 h-10 rounded-full"/>
        <h3>${user}</h3>
      `;
      item.onclick = () => {
        currentReceiver = user;
        document.getElementById("chatHeader").innerText = user;
        document.querySelector(".chat-messages").innerHTML = "";
      };
      userList.appendChild(item);
    }
  });
});

// ----------------------------
// ADD MESSAGE TO CHAT UI
// ----------------------------
function addMessageToChat(sender, message, isSelf) {
  const chatBox = document.querySelector(".chat-messages");
  const msgDiv = document.createElement("div");

  msgDiv.className =
    (isSelf ? "bg-green-200 self-end" : "bg-white") +
    " p-3 rounded-xl shadow max-w-xs mt-2";

  msgDiv.textContent = `${sender}: ${message}`;
  chatBox.appendChild(msgDiv);

  chatBox.scrollTop = chatBox.scrollHeight;
}

// ----------------------------
// SEARCH USERS
// ----------------------------
const searchBar = document.getElementById("searchBar");

searchBar.addEventListener("input", function () {
  const query = searchBar.value.toLowerCase();
  const chatItems = document.querySelectorAll(".chat-item");

  chatItems.forEach((item) => {
    const name = item.querySelector("h3").textContent.toLowerCase();
    item.style.display = name.includes(query) ? "flex" : "none";
  });
});
