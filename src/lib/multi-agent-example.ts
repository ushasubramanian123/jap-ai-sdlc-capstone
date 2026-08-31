/**
 * MULTI-AGENT ORCHESTRATOR EXAMPLE
 * Relevant to: Claude Certified Architect Foundation Exam
 *
 * Pattern: Orchestrator + Subagents (Research → Summarize)
 * Use case: Given a topic, research it and produce a structured summary.
 *
 * EXAM CONCEPT 1 — When to use agents (all 4 criteria must hold):
 *   ✅ Complexity   — task is multi-step, hard to specify fully upfront
 *   ✅ Value        — outcome (research brief) justifies higher cost
 *   ✅ Viability    — Claude is capable at research + summarization
 *   ✅ Error cost   — errors are recoverable (just re-run, no side effects)
 *
 * EXAM CONCEPT 2 — Tiers (Single Call → Workflow → Agent):
 *   Single call  → one step, no tools
 *   Workflow     → multi-step, YOU control the loop in code       ← Summarizer
 *   Agent        → Claude controls the loop via tool use          ← Researcher (below)
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// EXAM CONCEPT 3 — Prompt caching
//   Render order: tools → system → messages
//   cache_control on system caches BOTH tools + system as one prefix.
//   Volatile content (the topic) comes after the breakpoint — never before.
// ---------------------------------------------------------------------------

const RESEARCHER_SYSTEM = `You are a precise research agent.
Use web_search to find current facts about the given topic.
Produce 3-5 factual bullet points with key data. Be concise.`;

const SUMMARIZER_SYSTEM = `You are a senior analyst.
Given research bullets, synthesize them into one clear paragraph
with a headline and a key takeaway. No fluff.`;

// ---------------------------------------------------------------------------
// SUBAGENT 1: Researcher  — AGENT TIER (Claude controls the loop)
//
// EXAM CONCEPT 4 — The agentic loop:
//   1. Claude receives the task + tools
//   2. Claude emits a tool_use block (stop_reason === "tool_use")
//   3. Your harness executes the tool and returns tool_result
//   4. Claude reasons over the result and either calls another tool OR ends
//   5. Loop exits when stop_reason === "end_turn"
//
// EXAM CONCEPT 5 — Tool placement and caching:
//   Tools render at position 0 (before system).
//   cache_control on the system block caches tools + system together.
//   Adding/removing/reordering tools invalidates the ENTIRE cache.
//   → Keep the tool list stable across calls to preserve cache hits.
//
// EXAM CONCEPT 6 — Model selection for subagents:
//   Use a cheaper model (Sonnet/Haiku) for subagents with focused tasks.
//   Reserve Opus for the orchestrator or steps requiring deep reasoning.
// ---------------------------------------------------------------------------
async function researcherAgent(topic: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Research this topic: ${topic}` },
  ];

  // tools render first → then system (with cache breakpoint) → then messages
  // This order means cache_control on system covers tools + system as one prefix.
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search" },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 5; // guard against runaway loops

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6", // cheaper than Opus; capable enough for search + bullets
      max_tokens: 2048,
      tools,
      system: [
        {
          type: "text",
          text: RESEARCHER_SYSTEM,
          // EXAM: breakpoint here caches tools + system together.
          // The topic (volatile) is in messages, safely after this point.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    console.log(
      `[Researcher] iteration=${iterations} stop_reason=${response.stop_reason} ` +
        `cache_read=${response.usage.cache_read_input_tokens} ` +
        `cache_write=${response.usage.cache_creation_input_tokens}`,
    );

    // EXAM: always append the FULL response.content (not just text).
    // tool_use blocks must be present in the assistant turn so the
    // subsequent tool_result message is valid.
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      // Claude is done — extract the final text answer
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      return textBlock?.text ?? "(no text output)";
    }

    if (response.stop_reason === "tool_use") {
      // EXAM CONCEPT 7 — Executing tool calls and feeding results back
      //   Claude may request multiple tools in one response (parallel tool use).
      //   Collect ALL results into a single "user" turn before re-calling the API.
      //   One tool_result per tool_use_id — IDs must match exactly.
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
        (tool) => {
          console.log(`[Researcher] tool called: ${tool.name}`, tool.input);

          // web_search is a SERVER-SIDE tool — Anthropic executes it automatically.
          // For server-side tools you never actually run anything here;
          // the result is already embedded in response.content as a server_tool_result.
          // For CLIENT-SIDE tools (your own functions) you'd call them here.
          // This return is unreachable for web_search but shown for illustration.
          return {
            type: "tool_result" as const,
            tool_use_id: tool.id,
            content: `[server executed ${tool.name}]`,
          };
        },
      );

      // Only append tool_results for client-side tools.
      // For server-side tools (web_search) the loop just continues —
      // the results are already in response.content from the previous turn.
      if (toolResults.some((r) => !r.content?.toString().includes("server executed"))) {
        messages.push({ role: "user", content: toolResults });
      }

      continue; // go back to the top — Claude will reason over the search results
    }

    // pause_turn means the server-side loop hit its iteration limit — resume it
    if (response.stop_reason === "pause_turn") {
      continue;
    }

    break; // unexpected stop_reason — exit safely
  }

  return "(researcher reached max iterations without end_turn)";
}

// ---------------------------------------------------------------------------
// SUBAGENT 2: Summarizer — WORKFLOW TIER (single call, no tools needed)
//
// EXAM CONCEPT 8 — Don't add tools for the sake of it.
//   The summarizer's input is fully determined (the research bullets).
//   No tool loop needed — a single call is the right choice.
//   Fewer moving parts = lower cost, lower latency, easier to debug.
// ---------------------------------------------------------------------------
async function summarizerAgent(researchBullets: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5", // simplest task → cheapest model
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SUMMARIZER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Summarize these research findings:\n\n${researchBullets}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected content type");
  return block.text;
}

// ---------------------------------------------------------------------------
// ORCHESTRATOR — code-controlled pipeline
//
// EXAM CONCEPT 9 — Orchestrator responsibilities:
//   1. Decompose the task into discrete subagent steps
//   2. Route output of one subagent as input to the next
//   3. Own the stop condition (when is the job done?)
//   4. Handle errors at the boundary — not inside subagents
//
// EXAM CONCEPT 10 — This is still a Workflow orchestrator (your code loops).
//   A "Claude-as-orchestrator" pattern would give Claude a tool called
//   `dispatch_subagent` and let IT decide the sequence. Use that only when
//   the task trajectory cannot be predetermined — it trades control for flexibility.
// ---------------------------------------------------------------------------
export async function orchestrate(topic: string): Promise<{
  research: string;
  summary: string;
}> {
  console.log(`\n=== Orchestrator: starting pipeline for "${topic}" ===\n`);

  console.log("[Orchestrator] → dispatching Researcher (agent tier)");
  const research = await researcherAgent(topic);
  console.log("\n[Researcher] output:\n", research);

  console.log("\n[Orchestrator] → dispatching Summarizer (workflow tier)");
  const summary = await summarizerAgent(research);
  console.log("\n[Summarizer] output:\n", summary);

  console.log("\n=== Orchestrator: pipeline complete ===");
  return { research, summary };
}

// ---------------------------------------------------------------------------
// EXAM QUICK REFERENCE
//
// Cache invalidation triggers (know these):
//   - Changing model                    → full cache miss
//   - Adding/removing/reordering tools  → full cache miss (tools render at pos 0)
//   - Changing system prompt text       → cache miss from that point forward
//   - Timestamps / UUIDs in system      → cache miss every request (silent!)
//   - Volatile content in messages      → fine — it's after the breakpoint
//
// stop_reason values (know what to do for each):
//   "end_turn"   → Claude finished, extract text
//   "tool_use"   → execute tools, append results, loop
//   "pause_turn" → server-side loop limit hit, re-send to continue
//   "max_tokens" → increase max_tokens or switch to streaming
//   "refusal"    → safety refusal, structured output may not match schema
//
// Model selection pattern:
//   Orchestrator        → Opus (complex reasoning, decision-making)
//   Agent subagents     → Sonnet (tool use, moderate reasoning)
//   Workflow subagents  → Haiku (classification, formatting, cheap transforms)
// ---------------------------------------------------------------------------

// Run it:
// orchestrate("the impact of AI on software engineering jobs").then(console.log);
