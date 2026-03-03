// Step 1: constants retrieved by ID
const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");

// Extra elements for steps 5 and 6
const retrievalDropdown = document.getElementById("retrieval-method");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.classList.add("message", type);
  msg.textContent = text;
  messagesContainer.appendChild(msg);

  // keep newest message visible
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Step 2: sendMessage() function
function sendMessage() {
  const userText = inputField.value.trim();

  // validation: not empty
  if (userText.length === 0) {
    alert("Please type a message before sending.");
    return;
  }

  // display user's message
  addMessage(userText, "user");

  // clear input
  inputField.value = "";
  inputField.focus();
}

// Step 3: click button sends message
sendBtn.addEventListener("click", sendMessage);

// Step 4: Enter key sends message
inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

// Step 5: retrieval dropdown change listener
retrievalDropdown.addEventListener("change", (event) => {
  const method = event.target.value;
  addMessage(`Retrieval method: ${method}`, "system");
  console.log(`Retrieval method: ${method}`);
});

// Step 6: upload button logs selected file
uploadBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (!file) {
    console.log("No file selected.");
    addMessage("No file selected.", "system");
    return;
  }
  console.log(`Selected file: ${file.name}`);
  addMessage(`Selected file: ${file.name}`, "system");
});