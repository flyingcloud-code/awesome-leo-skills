#!/usr/bin/env node
/**
 * Idea Capture Skill - 捕获想法主脚本
 * Usage: node capture.mjs "想法内容" [--tags "标签1,标签2"]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.json');
const INBOX_PATH = join(__dirname, '..', 'data', 'inbox.json');

// 读取配置
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const content = args[0];
  const tags = [];
  
  // 解析 --tags 参数
  const tagsIndex = args.indexOf('--tags');
  if (tagsIndex !== -1 && args[tagsIndex + 1]) {
    tags.push(...args[tagsIndex + 1].split(',').map(t => t.trim()));
  }
  
  return { content, tags };
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 自动提取标签（简单规则）
function autoExtractTags(content) {
  const tags = [];
  const keywords = {
    '技术': ['技术', '代码', '编程', '架构', 'AI', '算法', '开发'],
    '投资': ['股票', '投资', '理财', '基金', '赚钱', '商业'],
    '生活': ['生活', '习惯', '健康', '家庭', '孩子'],
    '创作': ['写作', '文章', '内容', '创意', '设计'],
    '学习': ['读书', '学习', '课程', '知识', '方法']
  };
  
  for (const [tag, words] of Object.entries(keywords)) {
    if (words.some(word => content.includes(word))) {
      tags.push(tag);
    }
  }
  
  return tags;
}

// 保存想法到 inbox
function saveIdea(content, manualTags = []) {
  const today = new Date().toISOString().split('T')[0];
  
  // 读取或创建 inbox
  let inbox = { date: today, ideas: [], last_updated: new Date().toISOString() };
  if (existsSync(INBOX_PATH)) {
    inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
    // 如果日期变了，归档旧数据
    if (inbox.date !== today) {
      console.log(`📦 检测到日期变化，请先归档 ${inbox.date} 的想法`);
      // 这里可以自动调用归档脚本
      inbox = { date: today, ideas: [], last_updated: new Date().toISOString() };
    }
  }
  
  // 自动提取标签
  const autoTags = autoExtractTags(content);
  const allTags = [...new Set([...autoTags, ...manualTags])];
  
  // 创建想法对象
  const idea = {
    id: generateId(),
    content: content,
    tags: allTags,
    created_at: new Date().toISOString(),
    source: 'cli',
    word_count: content.length
  };
  
  // 添加到 inbox
  inbox.ideas.push(idea);
  inbox.last_updated = new Date().toISOString();
  
  // 保存
  writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2));
  
  return idea;
}

// 主函数
function main() {
  const { content, tags } = parseArgs();
  
  if (!content) {
    console.log('Usage: node capture.mjs "想法内容" [--tags "标签1,标签2"]');
    console.log('');
    console.log('Examples:');
    console.log('  node capture.mjs "想到一个新功能"');
    console.log('  node capture.mjs "股票策略优化" --tags "投资,股票"');
    process.exit(1);
  }
  
  console.log('🦐 虾宝正在记录你的想法...');
  
  const idea = saveIdea(content, tags);
  
  console.log('✅ 想法已保存！');
  console.log(`📌 ID: ${idea.id}`);
  console.log(`🏷️ 标签: ${idea.tags.join(', ') || '无'}`);
  console.log(`📝 预览: ${idea.content.substring(0, 50)}${idea.content.length > 50 ? '...' : ''}`);
  console.log(`📊 今日已记录 ${idea.id ? '1' : '0'} 条想法`);
}

main();