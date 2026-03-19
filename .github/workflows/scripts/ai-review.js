const fs = require("fs");

const diff = fs.existsSync("diff.txt")
  ? fs.readFileSync("diff.txt", "utf8").substring(0, 10000)
  : "";

const rules = fs.existsSync("AGENT_RULES.md")
  ? fs.readFileSync("AGENT_RULES.md", "utf8")
  : "";

const ui = fs.existsSync("docs/ui-standards.md")
  ? fs.readFileSync("docs/ui-standards.md", "utf8")
  : "";

const context = `
AGENT RULES:
${rules}

UI STANDARDS:
${ui}

CODE DIFF:
${diff}
`;

async function run() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are a senior software architect and code reviewer."
        },
        {
          role: "user",
          content: context
        }
      ]
    })
  });

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    console.error("Erro na API:", data);
    process.exit(1);
  }

  const review = data.choices[0].message.content;

  fs.writeFileSync("review.txt", review);

  if (review.includes("❌")) {
    console.log("Critical issues found.");
    process.exit(1);
  }
}

run();
