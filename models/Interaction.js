const mongoose = require("mongoose");

const RetrievedDocumentSchema = new mongoose.Schema(
  {
    docName: {
      type: String,
      required: true
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    chunkText: {
      type: String,
      required: true
    },
    relevanceScore: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const ConfidenceMetricsSchema = new mongoose.Schema(
  {
    overallConfidence: {
      type: Number,
      default: 0
    },
    evidenceStrength: {
      type: Number,
      default: 0
    },
    retrievalMethod: {
      type: String,
      default: "semantic"
    }
  },
  { _id: false }
);

const interactionSchema = new mongoose.Schema({
  participantID: {
    type: String,
    required: true
  },
  userInput: {
    type: String,
    required: true
  },
  botResponse: {
    type: String,
    required: true
  },
  retrievalMethod: {
    type: String,
    enum: ["semantic", "tfidf"],
    default: "semantic"
  },
  retrievedDocuments: {
    type: [RetrievedDocumentSchema],
    default: []
  },
  confidenceMetrics: {
    type: ConfidenceMetricsSchema,
    default: () => ({})
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Interaction", interactionSchema);