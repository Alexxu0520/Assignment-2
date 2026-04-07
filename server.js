require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
console.log("Node DNS servers:", dns.getServers());

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");

const Interaction = require("./models/Interaction");
const EventLog = require("./models/EventLog");
const Document = require("./models/Document");

const documentProcessor = require("./services/documentProcessor");
const embeddingService = require("./services/embeddingService");
const retrievalService = require("./services/retrievalService");
const confidenceCalculator = require("./services/confidenceCalculator");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_HISTORY = 5;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: uploadsDir });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/chat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.post("/log-event", async (req, res) => {
  try {
    const { participantID, systemID, eventType, elementName } = req.body;

    if (!participantID || !eventType || !elementName) {
      return res.status(400).json({
        error: "participantID, eventType, and elementName are required."
      });
    }

    const eventLog = new EventLog({
      participantID,
      systemID: Number(systemID) || 1,
      eventType,
      elementName,
      timestamp: new Date()
    });

    await eventLog.save();

    res.json({
      success: true,
      message: "Event logged successfully."
    });
  } catch (error) {
    console.error("Error in /log-event:", error);
    res.status(500).json({
      error: "Failed to log event."
    });
  }
});

app.post("/upload-document", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const processed = await documentProcessor.processDocument(req.file);

    const chunksWithEmbeddings = await embeddingService.generateEmbeddings(
      processed.chunks
    );

    const newDocument = new Document({
      filename: req.file.originalname,
      text: processed.fullText,
      chunks: chunksWithEmbeddings,
      processingStatus: "completed",
      processedAt: new Date()
    });

    await newDocument.save();

    await retrievalService.rebuildIndex();

    res.json({
      status: "success",
      filename: req.file.originalname,
      chunkCount: chunksWithEmbeddings.length
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: error.message || "Failed to upload document." });
  }
});

app.get("/documents", async (req, res) => {
  try {
    const docs = await Document.find(
      {},
      "_id filename processingStatus processedAt"
    ).sort({ processedAt: -1 });

    res.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents." });
  }
});

app.post("/history", async (req, res) => {
  try {
    const { participantID, limit = MAX_HISTORY } = req.body;

    if (!participantID) {
      return res.status(400).json({
        error: "participantID is required."
      });
    }

    const history = await Interaction.find({ participantID })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ history: history.reverse() });
  } catch (error) {
    console.error("Error in /history:", error);
    res.status(500).json({
      error: "Failed to load history."
    });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const {
      participantID,
      systemID,
      input,
      retrievalMethod,
      conversationHistory = []
    } = req.body;

    if (!participantID || !input || !input.trim()) {
      return res.status(400).json({
        error: "participantID and input are required."
      });
    }

    const normalizedSystemID = Number(systemID) || 1;
    const method = retrievalMethod || "semantic";

    let botResponse = "";
    let retrievedDocuments = [];
    let confidenceMetrics = {
      overallConfidence: 0,
      evidenceStrength: 0,
      retrievalMethod: method
    };

    if (normalizedSystemID === 2) {
      botResponse =
        `System 2 placeholder active. ` +
        `Participant ${participantID} is routed correctly to the alternate system. ` +
        `You said: "${input}"`;

      const interaction = new Interaction({
        participantID,
        systemID: normalizedSystemID,
        userInput: input,
        botResponse,
        retrievalMethod: method,
        retrievedDocuments: [],
        confidenceMetrics
      });

      await interaction.save();

      return res.json({
        botResponse,
        retrievedDocuments: [],
        confidenceMetrics,
        systemID: normalizedSystemID
      });
    }

    retrievedDocuments = await retrievalService.retrieve(input, {
      method,
      topK: 3,
      minScore: 0
    });

    const evidenceText = retrievedDocuments.length
      ? retrievedDocuments
          .map(
            (doc, i) =>
              `[Evidence ${i + 1} | ${doc.documentName} | chunk ${doc.chunkIndex} | score ${doc.relevanceScore}]\n${doc.chunkText}`
          )
          .join("\n\n")
      : "No relevant evidence retrieved.";

    const historyText =
      Array.isArray(conversationHistory) && conversationHistory.length > 0
        ? conversationHistory
            .slice(-MAX_HISTORY * 2)
            .map((msg) => `${msg.role === "assistant" ? "Assistant" : "User"}: ${msg.content}`)
            .join("\n")
        : "No prior conversation history.";

    const augmentedPrompt = `
You are a helpful AI chatbot for a class project.

Use the retrieved evidence below whenever possible.
Use the conversation history to maintain continuity.
If the evidence is insufficient, say so clearly.
Keep the answer clear, short, and grounded.

Conversation History:
${historyText}

Retrieved Evidence:
${evidenceText}

Current User Question:
${input}
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: augmentedPrompt
    });

    botResponse =
      response.output_text || "Sorry, I could not generate a response.";

    confidenceMetrics = confidenceCalculator.calculate({
      retrievedDocs: retrievedDocuments,
      retrievalMethod: method,
      responseLogprobs: null
    });

    const interaction = new Interaction({
      participantID,
      systemID: normalizedSystemID,
      userInput: input,
      botResponse,
      retrievalMethod: method,
      retrievedDocuments: retrievedDocuments.map((doc) => ({
        docName: doc.documentName,
        chunkIndex: doc.chunkIndex,
        chunkText: doc.chunkText,
        relevanceScore: doc.relevanceScore
      })),
      confidenceMetrics
    });

    await interaction.save();

    res.json({
      botResponse,
      retrievedDocuments: retrievedDocuments.map((doc) => ({
        docName: doc.documentName,
        chunkIndex: doc.chunkIndex,
        chunkText: doc.chunkText,
        relevanceScore: doc.relevanceScore
      })),
      confidenceMetrics,
      systemID: normalizedSystemID
    });
  } catch (error) {
    console.error("Error in /chat:", error);
    res.status(500).json({
      error: "Server error while processing chat."
    });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await retrievalService.initialize();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });