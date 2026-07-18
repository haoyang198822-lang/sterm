const fs = require('fs');
const os = require('os');
const path = require('path');

const { SEARCH_COMMANDS_TOOL, searchCommands } = require('./agent-tools');

const AGICTO_URL = 'https://api.agicto.cn/v1/chat/completions';
const MODEL = 'deepseek-v4-flash';

function getApiKey() {
  const zshrcPath = path.join(os.homedir(), '.zshrc');
  const zshrc = fs.readFileSync(zshrcPath, 'utf-8');
  const match = zshrc.match(/export\s+AGICTO_API_KEY=(?:"([^"]+)"|'([^']+)'|([^\s#]+))/);
  const apiKey = match && (match[1] || match[2] || match[3]);
  if (!apiKey) {
    throw new Error('AGICTO_API_KEY not found in ~/.zshrc');
  }
  return apiKey;
}

const SYSTEM_PROMPT = `你是 sterm 命令速查助手。你的任务是理解用户想要做什么操作，然后通过 search_commands 工具查找对应的命令。

规则：
- 当用户问命令时，优先用工具搜索，不要凭自己的知识回答
- 将用户的中文意图翻译为英文关键词传给 search_commands
- 如果工具返回了匹配结果，整理后清晰呈现给用户（含命令代码块）
- 如果工具没有返回结果，告知用户没找到，再用自己的知识提供相近建议
- 只回答与命令速查相关的问题，不相关时礼貌拒绝`;

async function callAgicto(messages) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const body = {
    model: MODEL,
    messages,
    tools: [SEARCH_COMMANDS_TOOL],
    tool_choice: 'auto',
    max_tokens: 1024,
    temperature: 0.1,
  };

  try {
    const res = await fetch(AGICTO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AGICTO API error ${res.status}: ${text}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractEnglishTerms(query) {
  const matches = query.match(/[a-zA-Z]+/g);
  return matches ? [...new Set(matches.map((w) => w.toLowerCase()))] : [];
}

function formatLocalResults(query) {
  // Try exact query first
  let results = searchCommands(query);
  // If empty and query has English words, try those
  if (!results.length) {
    const terms = extractEnglishTerms(query);
    if (terms.length > 0) {
      results = searchCommands(terms.join(' '));
    }
  }

  if (!results.length) {
    return `未找到与「${query}」相关的命令。你可以尝试更具体的英文关键词，或者告诉我你想完成的操作，我帮你继续查。`;
  }

  return results.map((item, index) => {
    const lines = [
      `${index + 1}. ${item.name}`,
    ];

    if (item.description) {
      lines.push(item.description);
    }

    lines.push('```bash');
    lines.push(item.command);
    lines.push('```');

    return lines.join('\n');
  }).join('\n\n');
}

async function agentLoop(userInput) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userInput },
    ];

    for (let turn = 0; turn < 3; turn += 1) {
      const response = await callAgicto(messages);
      const message = response?.choices?.[0]?.message;

      if (!message) {
        return formatLocalResults(userInput);
      }

      messages.push(message);

      if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
        const content = (message.content || '').trim();
        // 如果 LLM 返回了原始 JSON 结果（工具数据未格式化），改用本地格式化
        if (content.startsWith('[') || content.startsWith('{')) {
          try {
            JSON.parse(content);
            return formatLocalResults(userInput);
          } catch {}
        }
        return content || formatLocalResults(userInput);
      }

      for (const call of message.tool_calls) {
        if (call?.function?.name !== 'search_commands') {
          continue;
        }

        let args = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch (error) {
          args = {};
        }

        const result = searchCommands(args.query);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    const fallback = messages[messages.length - 1];
    const content = (fallback?.content || '').trim();
    // 同样检查 LLM 3 轮后返回的是否是原始 JSON
    if (content.startsWith('[') || content.startsWith('{')) {
      try {
        JSON.parse(content);
        return formatLocalResults(userInput);
      } catch {}
    }
    return content || formatLocalResults(userInput);
  } catch (error) {
    return formatLocalResults(userInput);
  }
}

if (require.main === module) {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('用法: node scripts/agent.js <查询内容>');
    console.error('示例: node scripts/agent.js "git怎么撤销上一次commit"');
    process.exit(1);
  }

  agentLoop(query)
    .then((result) => {
      process.stdout.write(`${result}\n`);
    })
    .catch((error) => {
      console.error('Agent 错误:', error.message);
      process.exit(1);
    });
}

module.exports = { agentLoop, callAgicto };
