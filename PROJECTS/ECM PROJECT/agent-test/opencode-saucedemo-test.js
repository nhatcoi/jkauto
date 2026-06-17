import { createOpencode } from "@opencode-ai/sdk"

const BASE_URL = process.env.OPENCODE_BASE_URL || "http://127.0.0.1:20128/v1"
const API_KEY = process.env.OPENCODE_API_KEY || "sk-67abc7d002e1dde6-35cltj-04a78299"
const MODEL = process.env.OPENCODE_MODEL || "v1"

if (!API_KEY) {
  throw new Error("Missing OPENCODE_API_KEY")
}

console.log("Starting opencode server...")

const opencode = await createOpencode({
  config: {
    provider: {
      local: {
        npm: "@ai-sdk/openai-compatible",
        name: "Local OpenAI Compatible",
        options: {
          baseURL: BASE_URL,
          apiKey: API_KEY,
        },
        models: {
          [MODEL]: {},
        },
      },
    },
    model: `local/${MODEL}`,
  },
})

const { client, server } = opencode

console.log(`Server ready: ${server.url}`)

try {
  console.log("Creating session...")
  const session = await client.session.create({
    body: { title: "SauceDemo Playwright auto test" },
  })
  console.log(`Session created: ${session.data.id}`)

  const events = await client.event.subscribe()
  const eventReader = (async () => {
    for await (const event of events.stream) {
      console.log(`[event] ${event.type}`)
    }
  })().catch((error) => {
    console.log(`[event] stopped: ${error.message}`)
  })

  console.log("Sending prompt...")
  const result = await client.session.prompt({
    path: { id: session.data.id },
    body: {
      parts: [
        {
          type: "text",
          text: `Use playwright-skill.
Test https://www.saucedemo.com/.
Flow:
1. Open login page.
2. Login with standard_user / secret_sauce.
3. Verify Products page.
4. Add Sauce Labs Backpack to cart.
5. Open cart.
6. Verify Sauce Labs Backpack exists.
7. Save Playwright trace to /tmp/saucedemo-trace.zip.
8. Save screenshot to /tmp/saucedemo-cart.png.
9. Report pass/fail for each step.`,
        },
      ],
    },
  })

  console.log("Prompt completed.")
  console.log(JSON.stringify(result.data, null, 2))
} finally {
  console.log("Closing server...")
  server.close()
}
