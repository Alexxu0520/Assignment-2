const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.post("/chat", (req, res) => {
  const { message, retrievalMethod } = req.body;

  console.log("User message:", message);
  console.log("Retrieval method:", retrievalMethod);

  res.json({
    userMessage: message,
    botReply: "Message Received!"
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});