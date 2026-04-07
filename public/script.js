const inputField = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");
const retrievalDropdown = document.getElementById("retrieval-method");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const uploadedDocs = document.getElementById("uploaded-docs");
const participantDisplay = document.getElementById("participant-display");
const systemDisplay = document.getElementById("system-display");

const MAX_HISTORY = 5;
let conversationHistory = [];

const urlParams = new URLSearchParams(window.location.search);

let participantID = urlParams.get("participantID");
let systemID = urlParams.get("systemID");

if (!participantID) {
  participantID = localStorage.getItem("participantID");
}

if (!systemID) {
  systemID = localStorage.getItem("systemID");
}

if (!participantID) {
  alert("No participant ID found. Please enter it on the homepage first.");
  window.location.href = "/";
}

if (!systemID) {
  const numericID = parseInt(participantID, 10);
  systemID = !Number.isNaN(numericID) && numericID % 2 === 0 ? 2 : 1;
}

localStorage.setItem("participantID", participantID);
localStorage.setItem("systemID", String(systemID));

participantDisplay.textContent = `Participant: ${participantID}`;
systemDisplay.textContent =
  Number(systemID) === 1
    ? "System: 1 (Baseline)"
    : "System: 2 (Alternate Placeholder)";

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

function addEvidenceBlock(retrievedDocuments) {
  if (!retrievedDocuments || retrievedDocuments.length === 0) {
    return;
  }

  retrievedDocuments.forEach((doc, index) => {
    addMessage(
      "System",
      `Evidence ${index + 1} | Doc: ${doc.docName} | Chunk: ${doc.chunkIndex} | Score: ${Number(doc.relevanceScore).toFixed(4)}`
    );
    addMessage("System", doc.chunkText);
  });
}

function addConfidenceBlock(confidenceMetrics) {
  if (!confidenceMetrics) return;

  const overall =
    confidenceMetrics.overallConfidence !== undefined
      ? confidenceMetrics.overallConfidence
      : "N/A";

  const evidenceStrength =
    confidenceMetrics.evidenceStrength !== undefined
      ? confidenceMetrics.evidenceStrength
      : "N/A";

  const method = confidenceMetrics.retrievalMethod || "N/A";

  addMessage(
    "System",
    `Confidence | overall: ${overall} | evidence strength: ${evidenceStrength} | method: ${method}`
  );
}

async function logEvent(eventType, elementName) {
  try {
    await fetch("/log-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        participantID,
        systemID: Number(systemID),
        eventType,
        elementName
      })
    });
  } catch (error) {
    console.error("Error logging event:", error);
  }
}

async function loadConversationHistory() {
  try {
    const response = await fetch("/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        participantID,
        limit: MAX_HISTORY
      })
    });

    const data = await response.json();

    if (data.history && Array.isArray(data.history)) {
      conversationHistory = [];

      data.history.forEach((item) => {
        addMessage("User", item.userInput);
        addMessage("Bot", item.botResponse);

        if (item.retrievedDocuments && item.retrievedDocuments.length > 0) {
          addEvidenceBlock(item.retrievedDocuments);
        }

        if (item.confidenceMetrics) {
          addConfidenceBlock(item.confidenceMetrics);
        }

        conversationHistory.push({
          role: "user",
          content: item.userInput
        });

        conversationHistory.push({
          role: "assistant",
          content: item.botResponse
        });
      });

      conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }
  } catch (error) {
    console.error("Error loading history:", error);
    addMessage("System", "Could not load chat history.");
  }
}

async function loadDocuments() {
  try {
    const response = await fetch("/documents");
    const docs = await response.json();

    uploadedDocs.innerHTML = "";

    docs.forEach((doc) => {
      const item = document.createElement("li");
      item.textContent = `${doc.filename} (${doc.processingStatus})`;
      uploadedDocs.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading documents:", error);
    addMessage("System", "Could not load document list.");
  }
}

async function uploadDocument() {
  const file = fileInput.files[0];

  if (!file) {
    addMessage("System", "No file selected.");
    return;
  }

  const formData = new FormData();
  formData.append("document", file);

  try {
    addMessage("System", `Uploading document: ${file.name}`);

    const response = await fetch("/upload-document", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      addMessage("System", `Upload failed: ${data.error || "Unknown error"}`);
      return;
    }

    addMessage(
      "System",
      `Upload complete: ${data.filename} (${data.chunkCount} chunks)`
    );

    fileInput.value = "";
    await loadDocuments();
  } catch (error) {
    console.error("Error uploading document:", error);
    addMessage("System", "Error uploading document.");
  }
}

async function sendMessage() {
  const input = inputField.value.trim();
  const retrievalMethod = retrievalDropdown.value;

  if (input === "") return;

  addMessage("User", input);
  inputField.value = "";

  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY * 2);

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        participantID,
        systemID: Number(systemID),
        input,
        retrievalMethod,
        conversationHistory: trimmedHistory
      })
    });

    const data = await response.json();

    if (!response.ok) {
      addMessage("Bot", `Error: ${data.error || "Unknown server error."}`);
      return;
    }

    addMessage("Bot", data.botResponse || "No response received.");

    if (data.retrievedDocuments) {
      addEvidenceBlock(data.retrievedDocuments);
    }

    if (data.confidenceMetrics) {
      addConfidenceBlock(data.confidenceMetrics);
    }

    conversationHistory.push({
      role: "user",
      content: input
    });

    conversationHistory.push({
      role: "assistant",
      content: data.botResponse || "No response received."
    });

    conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
  } catch (error) {
    console.error("Error:", error);
    addMessage("Bot", "Error connecting to server.");
  }
}

sendBtn.addEventListener("click", async () => {
  await logEvent("click", "send-btn");
  await sendMessage();
});

inputField.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await logEvent("keypress", "user-input-enter");
    await sendMessage();
  }
});

inputField.addEventListener("focus", () => {
  logEvent("focus", "user-input");
});

sendBtn.addEventListener("mouseenter", () => {
  logEvent("hover", "send-btn");
});

retrievalDropdown.addEventListener("focus", () => {
  logEvent("focus", "retrieval-method");
});

retrievalDropdown.addEventListener("change", async (event) => {
  const method = event.target.value;
  addMessage("System", `Retrieval method changed to: ${method}`);
  await logEvent("change", "retrieval-method");
});

uploadBtn.addEventListener("click", async () => {
  await logEvent("click", "upload-btn");
  await uploadDocument();
});

window.addEventListener("load", async () => {
  await logEvent("load", "chat-page");
  await loadDocuments();
  await loadConversationHistory();
});