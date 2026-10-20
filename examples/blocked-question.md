# Example: a blocked child, answered by a human

**Goal:** handle an approval/question without the plugin ever approving on its own.

## 1. The spawn returns blocked

```text
[herdr] worker pi (xai/grok-4.7) → blocked
agent: worker-grok4-7-a1b2 · pane wV:p14
summary: agent is blocked and needs an answer
blocked — the agent is waiting for an answer. Ask the user, then call herdr_message_agent:
Allow network access to registry.npmjs.org for `pnpm install`?
  1. Allow once
  2. Allow always
  3. Deny
```

The result also has `status: "blocked"`, `nextAction: "answer"`, and a `blocked.question` with the cleaned pane tail.

## 2. DSH asks the user

DSH calls `ask_user_question` with the question and the options. The plugin does nothing here — the decision is the user's.

## 3. DSH answers

For a free-form question:

```json
{
  "tool": "herdr_message_agent",
  "args": {
    "target": "worker-grok4-7-a1b2",
    "kind": "ANSWER",
    "message": "Allow once. Do not install anything outside the repo."
  }
}
```

For an option-list prompt, Herdr may require keys rather than text; that is a future `herdr_send_keys` surface. Today, phrase the answer as the CLI would accept it or answer in the pane yourself.

## 4. Continue

```json
{ "tool": "herdr_get_agent_result", "args": { "target": "worker-grok4-7-a1b2", "wait": true } }
```

## Rules

- Never answer a `blocked` agent unless the user answered you.
- Do not close a blocked pane to "unblock" it; that loses the turn.
- If the question is ambiguous, say what you know and ask the user again. Guessing here is how an agent gets permissions it should not have.
