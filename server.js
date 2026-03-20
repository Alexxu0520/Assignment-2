const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
console.log("Node DNS servers:", dns.getServers());
require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const OpenAI = require("openai");

const Interaction = require("./models/Interaction");
const EventLog = require("./models/EventLog");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/chat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.post("/chat", async (req, res) => {
  try {
    const { participantID, message, retrievalMethod } = req.body;

    if (!participantID || !message) {
      return res.status(400).json({
        error: "participantID and message are required.",
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI chatbot for a class project. Give clear, short, friendly answers.",
        },
        {
          role: "user",
          content: `Retrieval method: ${retrievalMethod || "semantic"}\nUser message: ${message}`,
        },
      ],
    });

    const botReply =
      completion.choices?.[0]?.message?.content ||
      "Sorry, I could not generate a response.";

    const interaction = new Interaction({
      participantID,
      userInput: message,
      botResponse: botReply,
      timestamp: new Date(),
    });

    await interaction.save();

    res.json({
      userMessage: message,
      botReply,
    });
  } catch (error) {
    console.error("Error in /chat:", error);
    res.status(500).json({
      error: "Failed to process chat request.",
    });
  }
});

app.post("/log-event", async (req, res) => {
  try {
    const { participantID, eventType, elementName } = req.body;

    if (!participantID || !eventType || !elementName) {
      return res.status(400).json({
        error: "participantID, eventType, and elementName are required.",
      });
    }

    const eventLog = new EventLog({
      participantID,
      eventType,
      elementName,
      timestamp: new Date(),
    });

    await eventLog.save();

    res.json({
      success: true,
      message: "Event logged successfully.",
    });
  } catch (error) {
    console.error("Error in /log-event:", error);
    res.status(500).json({
      error: "Failed to log event.",
    });
  }
});

app.post("/history", async (req, res) => {
  try {
    const { participantID } = req.body;

    if (!participantID) {
      return res.status(400).json({
        error: "participantID is required.",
      });
    }

    const history = await Interaction.find({ participantID }).sort({
      timestamp: 1,
    });

    res.json({ history });
  } catch (error) {
    console.error("Error in /history:", error);
    res.status(500).json({
      error: "Failed to load history.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});