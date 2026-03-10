const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");
const retrievalDropdown = document.getElementById("retrieval-method");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

function addMessage(sender, text) {
  const message = document.createElement("div");
  message.textContent = `${sender}: ${text}`;
  messagesContainer.appendChild(message);
}

async function sendMessage() {
  const message = inputField.value.trim();
  const retrievalMethod = retrievalDropdown.value;

  if (message === "") {
    return;
  }

  addMessage("User", message);

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        retrievalMethod: retrievalMethod
      })
    });

    const data = await response.json();

    console.log("Server response:", data);

    addMessage("Bot", data.botReply);
    inputField.value = "";
  } catch (error) {
    console.error("Error:", error);
    addMessage("Bot", "Error connecting to server.");
  }
}

sendBtn.addEventListener("click", sendMessage);

inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

retrievalDropdown.addEventListener("change", (event) => {
  const method = event.target.value;
  console.log(`Retrieval method: ${method}`);
  addMessage("System", `Retrieval method: ${method}`);
});

uploadBtn.addEventListener("click", () => {
  const file = fileInput.files[0];

  if (!file) {
    console.log("No file selected.");
    addMessage("System", "No file selected.");
    return;
  }

  console.log(`Selected file: ${file.name}`);
  addMessage("System", `Selected file: ${file.name}`);
});