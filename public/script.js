const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");
const retrievalDropdown = document.getElementById("retrieval-method");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const uploadedDocs = document.getElementById("uploaded-docs");
const participantDisplay = document.getElementById("participant-display");

const participantID = localStorage.getItem("participantID");

if (!participantID) {
  alert("No participant ID found. Please enter it on the homepage first.");
  window.location.href = "/";
}

participantDisplay.textContent = `Participant: ${participantID}`;

function addMessage(sender, text) {
  const message = document.createElement("div");
  const senderLower = sender.toLowerCase();

  message.classList.add("message");

  if (senderLower === "user") {
    message.classList.add("user");
  } else if (senderLower === "bot") {
    message.classList.add("bot");
  } else {
    message.classList.add("system");
  }

  message.textContent = `${sender}: ${text}`;
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function logEvent(eventType, elementName) {
  try {
    await fetch("/log-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participantID,
        eventType,
        elementName,
      }),
    });
  } catch (error) {
    console.error("Error logging event:", error);
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ participantID }),
    });

    const data = await response.json();

    if (data.history && Array.isArray(data.history)) {
      data.history.forEach((item) => {
        addMessage("User", item.userInput);
        addMessage("Bot", item.botResponse);
      });
    }
  } catch (error) {
    console.error("Error loading history:", error);
    addMessage("System", "Could not load chat history.");
  }
}

async function sendMessage() {
  const message = inputField.value.trim();
  const retrievalMethod = retrievalDropdown.value;

  if (message === "") return;

  addMessage("User", message);
  inputField.value = "";

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participantID,
        message,
        retrievalMethod,
      }),
    });

    const data = await response.json();

    if (data.botReply) {
      addMessage("Bot", data.botReply);
    } else if (data.error) {
      addMessage("Bot", `Error: ${data.error}`);
    } else {
      addMessage("Bot", "No response received.");
    }
  } catch (error) {
    console.error("Error:", error);
    addMessage("Bot", "Error connecting to server.");
  }
}

sendBtn.addEventListener("click", async () => {
  await logEvent("click", "send-btn");
  sendMessage();
});

inputField.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    await logEvent("keypress", "user-input-enter");
    sendMessage();
  }
});

inputField.addEventListener("focus", () => {
  logEvent("focus", "user-input");
});

sendBtn.addEventListener("mouseover", () => {
  logEvent("hover", "send-btn");
});

retrievalDropdown.addEventListener("focus", () => {
  logEvent("focus", "retrieval-method");
});

retrievalDropdown.addEventListener("change", (event) => {
  const method = event.target.value;
  addMessage("System", `Retrieval method changed to: ${method}`);
  logEvent("change", "retrieval-method");
});

uploadBtn.addEventListener("click", async () => {
  await logEvent("click", "upload-btn");

  const file = fileInput.files[0];

  if (!file) {
    addMessage("System", "No file selected.");
    return;
  }

  const item = document.createElement("li");
  item.textContent = file.name;
  uploadedDocs.appendChild(item);

  addMessage("System", `Selected file: ${file.name}`);
});

window.addEventListener("load", async () => {
  await logEvent("load", "chat-page");
  await loadHistory();
});