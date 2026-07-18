const PROTOCOL_VERSION = 2;

const MESSAGE_SCHEMAS = {
  input: {
    fields: {
      type: { required: true, type: 'string', value: 'input' },
      text: { required: true, type: 'string' },
      sessionId: { required: false, type: 'string' },
    },
  },
  resize: {
    fields: {
      type: { required: true, type: 'string', value: 'resize' },
      cols: { required: true, type: 'number', min: 10, max: 500 },
      rows: { required: true, type: 'number', min: 1, max: 200 },
      sessionId: { required: false, type: 'string' },
    },
  },
  create: {
    fields: {
      type: { required: true, type: 'string', value: 'create' },
      sessionId: { required: false, type: 'string' },
    },
  },
  list: {
    fields: {
      type: { required: true, type: 'string', value: 'list' },
    },
  },
  destroy: {
    fields: {
      type: { required: true, type: 'string', value: 'destroy' },
      sessionId: { required: true, type: 'string' },
    },
  },
};

function validateMessage(raw) {
  if (typeof raw !== 'string') return { valid: false, error: '消息必须是字符串' };
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) { return { valid: false, error: 'JSON 解析失败: ' + err.message }; }
  if (!parsed || typeof parsed !== 'object') return { valid: false, error: '消息必须是对象' };
  const schema = MESSAGE_SCHEMAS[parsed.type];
  if (!schema) return { valid: false, error: '未知消息类型: ' + parsed.type };
  for (const [field, rules] of Object.entries(schema.fields)) {
    const value = parsed[field];
    if (rules.required && (value === undefined || value === null)) return { valid: false, error: '缺少必需字段: ' + field };
    if (value === undefined || value === null) continue;
    if (rules.type === 'string' && typeof value !== 'string') return { valid: false, error: '字段类型错误: ' + field + ' 应为 string' };
    if (rules.type === 'number' && typeof value !== 'number') return { valid: false, error: '字段类型错误: ' + field + ' 应为 number' };
    if (rules.value !== undefined && value !== rules.value) return { valid: false, error: '字段值错误: ' + field + ' 应为 ' + rules.value };
    if (rules.min !== undefined && value < rules.min) return { valid: false, error: '字段值过小: ' + field };
    if (rules.max !== undefined && value > rules.max) return { valid: false, error: '字段值过大: ' + field };
  }
  return { valid: true, message: parsed };
}

module.exports = { PROTOCOL_VERSION, MESSAGE_SCHEMAS, validateMessage };
