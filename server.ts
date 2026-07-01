import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// System instruction for our Personal Co-Pilot
const SYSTEM_INSTRUCTION = `You are an intelligent, friendly, and highly capable Personal Workspace Assistant and Co-Pilot.
You help the user access, analyze, and coordinate their personal data, including Google Drive files, Gmail messages, Calendar events, Tasks, Contacts, and personal notes.

When the user asks questions about their personal data:
1. Use the provided tools (search_drive_files, list_gmail_messages, get_gmail_message_details, list_calendar_events, list_tasks, list_contacts) to fetch accurate information.
2. If the user's request requires Google Search for up-to-date public information, use the googleSearch tool.
3. Keep your answers clear, concise, and focused on the user's query.
4. If the user is asking about something you don't have access to, explain why and what they can do.
5. If the user mentions Keep or notes, you can refer to "Firestore Notes" (synced in their app database).
6. Respect user privacy and do not leak internal tokens or IDs unless requested.
7. Present information in beautifully structured markdown, using bullet points, bold text, or lists where appropriate.
8. If drafting emails or replies, write them clearly and ask for confirmation before sending/finalizing (since you are a read-only assistant in terms of external mutations).`;

// Function Declarations for Gemini tools
const searchDriveFilesTool: FunctionDeclaration = {
  name: "search_drive_files",
  description: "Search for files in the user's Google Drive. Use this to find specific files or documents by name, extension, or topic.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Search query. e.g. 'Project Proposal' or 'mimeType = \"application/pdf\"' or empty to list recent files.",
      },
      maxResults: {
        type: Type.INTEGER,
        description: "Maximum number of files to return (default 10, max 20).",
      },
    },
  },
};

const listGmailMessagesTool: FunctionDeclaration = {
  name: "list_gmail_messages",
  description: "Search or list messages in the user's Gmail inbox. Use this to search for emails from specific senders or regarding specific topics.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Search query. e.g. 'from:boss' or 'subject:important' or key terms like 'flight ticket'.",
      },
      maxResults: {
        type: Type.INTEGER,
        description: "Maximum number of emails to return (default 10).",
      },
    },
  },
};

const getGmailMessageDetailsTool: FunctionDeclaration = {
  name: "get_gmail_message_details",
  description: "Get the full body and details of a specific email message using its message ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      messageId: {
        type: Type.STRING,
        description: "The unique ID of the Gmail message (e.g. '18b28f...').",
      },
    },
    required: ["messageId"],
  },
};

const listCalendarEventsTool: FunctionDeclaration = {
  name: "list_calendar_events",
  description: "List the user's upcoming calendar events. Use this to check schedules, meetings, or availability.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      timeMin: {
        type: Type.STRING,
        description: "The start time in ISO format (e.g., '2026-06-30T20:00:00Z'). Defaults to current local time if empty.",
      },
      maxResults: {
        type: Type.INTEGER,
        description: "Maximum number of events to return (default 10).",
      },
    },
  },
};

const listTasksTool: FunctionDeclaration = {
  name: "list_tasks",
  description: "List the user's tasks from Google Tasks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      maxResults: {
        type: Type.INTEGER,
        description: "Maximum number of tasks to return (default 20).",
      },
    },
  },
};

const listContactsTool: FunctionDeclaration = {
  name: "list_contacts",
  description: "List the user's connections/contacts from Google Contacts (People API).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      maxResults: {
        type: Type.INTEGER,
        description: "Maximum contacts to list (default 20).",
      },
    },
  },
};

// Helper to make Google API requests with user access token
async function callGoogleApi(endpoint: string, accessToken: string, method = "GET", body: any = null) {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Google API Error on ${endpoint}: ${response.status} - ${errText}`);
      return { error: `API responded with status ${response.status}`, details: errText };
    }
    return await response.json();
  } catch (error: any) {
    console.error(`Network error calling Google API: ${error.message}`);
    return { error: `Network error: ${error.message}` };
  }
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is healthy" });
});

// Chat endpoint with recursive tool call resolution
app.post("/api/chat", async (req, res) => {
  const { messages, googleToken, localTime } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid messages format" });
  }

  try {
    const ai = getGeminiClient();

    // Map message history to Gemini contents format
    // Filter out temporary loading messages or invalid formats
    const contents = messages
      .filter((m) => m && (m.sender === "user" || m.sender === "ai"))
      .map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

    if (contents.length === 0) {
      return res.status(400).json({ error: "No valid messages provided" });
    }

    // Set up tools. Only add Workspace tools if Google Token is provided
    const toolDeclarations: any[] = [{ googleSearch: {} }];
    const workspaceTools = [
      searchDriveFilesTool,
      listGmailMessagesTool,
      getGmailMessageDetailsTool,
      listCalendarEventsTool,
      listTasksTool,
      listContactsTool,
    ];

    if (googleToken) {
      toolDeclarations.push({ functionDeclarations: workspaceTools });
    }

    const timeContext = localTime ? `\nThe current local time is: ${localTime}.` : "";

    // Generate response
    let response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + timeContext,
        tools: toolDeclarations,
        toolConfig: { includeServerSideToolInvocations: true },
      },
    });

    // Execute Function Calls Loop (up to 5 iterations to avoid infinite loops)
    let loopCount = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 5) {
      loopCount++;
      const functionCalls = response.functionCalls;
      console.log(`Gemini requested ${functionCalls.length} function call(s):`, JSON.stringify(functionCalls));

      // Array to accumulate function execution results
      const functionResponses: any[] = [];

      for (const call of functionCalls) {
        const { name, args, id } = call;
        let result: any;

        if (!googleToken) {
          result = { error: "Google OAuth Token is missing. Please sign in with Google to retrieve personal workspace data." };
        } else {
          // Route the call to the appropriate Google Workspace API
          switch (name) {
            case "search_drive_files": {
              const queryArg = (args as any).query || "";
              let q = "";
              if (queryArg) {
                // If query is a plain search term and doesn't look like formal query syntax, search by name
                if (!queryArg.includes("=") && !queryArg.includes("name") && !queryArg.includes("mimeType")) {
                  q = `name contains '${queryArg.replace(/'/g, "\\'")}' and trashed = false`;
                } else {
                  q = queryArg;
                }
              } else {
                q = "trashed = false";
              }
              const maxResults = (args as any).maxResults || 10;
              const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${maxResults}&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)`;
              result = await callGoogleApi(url, googleToken);
              break;
            }
            case "list_gmail_messages": {
              const queryArg = (args as any).query || "";
              const maxResults = (args as any).maxResults || 10;
              let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
              if (queryArg) {
                url += `&q=${encodeURIComponent(queryArg)}`;
              }
              result = await callGoogleApi(url, googleToken);
              break;
            }
            case "get_gmail_message_details": {
              const messageId = (args as any).messageId;
              const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
              const fullMsg = await callGoogleApi(url, googleToken);
              if (fullMsg && !fullMsg.error) {
                // Extract headers and a snippet/body for context optimization
                const headers = fullMsg.payload?.headers || [];
                const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject";
                const from = headers.find((h: any) => h.name === "From")?.value || "Unknown Sender";
                const date = headers.find((h: any) => h.name === "Date")?.value || "";
                
                // Extract text body
                let bodyText = "";
                if (fullMsg.payload?.body?.data) {
                  bodyText = Buffer.from(fullMsg.payload.body.data, 'base64').toString('utf-8');
                } else if (fullMsg.payload?.parts) {
                  // DFS check for text/plain or text/html
                  const findTextPart = (parts: any[]): string => {
                    for (const p of parts) {
                      if (p.mimeType === "text/plain" && p.body?.data) {
                        return Buffer.from(p.body.data, 'base64').toString('utf-8');
                      }
                      if (p.parts) {
                        const sub = findTextPart(p.parts);
                        if (sub) return sub;
                      }
                    }
                    return "";
                  };
                  bodyText = findTextPart(fullMsg.payload.parts);
                }

                result = {
                  id: fullMsg.id,
                  subject,
                  from,
                  date,
                  snippet: fullMsg.snippet,
                  body: bodyText.slice(0, 1500), // slice to keep within context limits
                };
              } else {
                result = fullMsg;
              }
              break;
            }
            case "list_calendar_events": {
              const timeMinArg = (args as any).timeMin || new Date().toISOString();
              const maxResults = (args as any).maxResults || 10;
              const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMinArg)}&maxResults=${maxResults}`;
              result = await callGoogleApi(url, googleToken);
              break;
            }
            case "list_tasks": {
              const maxResults = (args as any).maxResults || 20;
              const url = `https://tasks.googleapis.com/v1/lists/@default/tasks?maxResults=${maxResults}`;
              result = await callGoogleApi(url, googleToken);
              break;
            }
            case "list_contacts": {
              const maxResults = (args as any).maxResults || 20;
              const url = `https://people.googleapis.com/v1/people/me/connections?pageSize=${maxResults}&personFields=names,emailAddresses,phoneNumbers`;
              result = await callGoogleApi(url, googleToken);
              break;
            }
            default:
              result = { error: `Function ${name} not found or not supported` };
          }
        }

        functionResponses.push({
          response: { output: result },
          name: name,
        });
      }

      // Add the model's tool calls and our execution results to contents
      const lastModelTurn = response.candidates?.[0]?.content;
      if (lastModelTurn) {
        contents.push(lastModelTurn as any);
      }

      contents.push({
        role: "user",
        parts: functionResponses.map((res) => ({
          functionResponse: res,
        })),
      } as any);

      // Call generateContent again with the executed tool outputs
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION + timeContext,
          tools: toolDeclarations,
          toolConfig: { includeServerSideToolInvocations: true },
        },
      });
    }

    res.json({
      text: response.text,
    });
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error);
    res.status(500).json({ error: error.message || "Something went wrong in the Gemini AI Engine" });
  }
});

// Setup Vite & Static Assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
