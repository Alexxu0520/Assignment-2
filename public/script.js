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

function addEvidenceBlock(retrievedDocuments) {
  if (!retrievedDocuments || retrievedDocuments.length === 0) {
    addMessage("System", "No evidence retrieved.");
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
        eventType,
        elementName
      })
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ participantID })
    });

    const data = await response.json();

    if (data.history && Array.isArray(data.history)) {
      data.history.forEach((item) => {
        addMessage("User", item.userInput);
        addMessage("Bot", item.botResponse);

        if (item.retrievedDocuments && item.retrievedDocuments.length > 0) {
          addEvidenceBlock(item.retrievedDocuments);
        }

        if (item.confidenceMetrics) {
          addConfidenceBlock(item.confidenceMetrics);
        }
      });
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

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        participantID,
        input,
        retrievalMethod
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
  await loadHistory();
});