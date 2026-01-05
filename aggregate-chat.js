/**
 * Aggregates chat data from VSCode Copilot session export.
 */

const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "chat.json");
const OUTPUT_FILE = path.join(__dirname, "aggregated-chat.json");

/**
 * Extracts the final response text, excluding thinking blocks.
 */
function extractFinalResponse(responseArray) {
  if (!responseArray || !Array.isArray(responseArray)) {
    return "";
  }

  const textParts = [];
  for (const item of responseArray) {
    if (item.kind === "thinking") {
      continue;
    }
    if (item.value && typeof item.value === "string") {
      textParts.push(item.value);
    }
  }

  return textParts.join("").trim();
}

/**
 * Gets the timestamp when the response was completed from modelState.
 */
function getResponseCompletedTimestamp(request) {
  if (!request || !request.modelState) {
    return null;
  }

  return request.modelState.completedAt || null;
}

/**
 * Counts the number of context references (variables) attached to a request.
 */
function countContextReferences(request) {
  if (!request.variableData || !request.variableData.variables) {
    return 0;
  }

  return request.variableData.variables.length;
}

/**
 * Processes the chat export and creates a structured dataset.
 */
function aggregateChatData(chatData) {
  const conversations = [];

  if (!chatData.requests || !Array.isArray(chatData.requests)) {
    console.error("Invalid chat data structure: missing or invalid requests array");
    return conversations;
  }

  for (const request of chatData.requests) {
    const userPrompt = request.message?.text || "";
    const promptTimestamp = request.timestamp || null;
    const finalResponse = extractFinalResponse(request.response);
    const responseCompletedTimestamp = getResponseCompletedTimestamp(request);
    const contextReferencesCount = countContextReferences(request);

    // Extract additional metrics from result
    const firstProgressTime = request.result?.timings?.firstProgress || null;
    const totalElapsedTime = request.result?.timings?.totalElapsed || null;
    const timeSpentWaiting = request.timeSpentWaiting || 0;
    const modelId = request.modelId || null;
    const contentReferencesCount = request.contentReferences?.length || 0;
    const codeCitationsCount = request.codeCitations?.length || 0;

    conversations.push({
      requestId: request.requestId,
      userPrompt: userPrompt,
      promptTimestamp: promptTimestamp,
      finalResponse: finalResponse,
      responseCompletedTimestamp: responseCompletedTimestamp,
      contextReferencesCount: contextReferencesCount,
      firstProgressTime: firstProgressTime,
      totalElapsedTime: totalElapsedTime,
      timeSpentWaiting: timeSpentWaiting,
      modelId: modelId,
      contentReferencesCount: contentReferencesCount,
      codeCitationsCount: codeCitationsCount,
    });
  }

  return conversations;
}

/**
 * Main execution function.
 */
function main() {
  try {
    console.log(`Reading chat data from: ${INPUT_FILE}`);
    const rawData = fs.readFileSync(INPUT_FILE, "utf-8");
    const chatData = JSON.parse(rawData);

    console.log("Aggregating chat data...");
    const aggregatedData = aggregateChatData(chatData);

    console.log(`Writing aggregated data to: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(aggregatedData, null, 2), "utf-8");

    console.log(`Success! Processed ${aggregatedData.length} conversations.`);
  } catch (error) {
    console.error("Error processing chat data:", error.message);
    process.exit(1);
  }
}

main();
