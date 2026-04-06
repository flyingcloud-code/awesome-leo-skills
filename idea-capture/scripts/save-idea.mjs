#!/usr/bin/env node
/**
 * Save Idea - 自然语言触发保存想法
 * 用于 OpenClaw 内部调用
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INBOX_PATH = join(__dirname, '..', 'data', 'inbox.json');

// 自动提取标签
function autoExtractTags(content) {
  const tags = [];
  const keywords = {
    '技术': ['技术', '代码', '编程', '架构', 'AI', '算法', '开发', '系统', '功能', '优化'],
    '投资': ['股票', '投资', '理财', '基金', '赚钱', '商业', '策略'],
    '生活': ['生活', '习惯', '健康', '家庭', '孩子', '感悟'],
    '创作': ['写作', '文章', '内容', '创意', '设计', '记录'],
    '学习': ['读书', '学习', '课程', '知识', '方法', 'Skill'],
    '需求': ['需求', '想法', '建议', '改进']
  };
  
  for (const [tag, words] of Object.entries(keywords)) {
    if (words.some(word => content.includes(word))) {
      tags.push(tag);
    }
  }
  
  return tags;
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 保存想法
export function saveIdea(content, source = 'feishu') {
  const today = new Date().toISOString().split('T')[0];
  
  // 读取或创建 inbox
  let inbox = { date: today, ideas: [], last_updated: new Date().toISOString() };
  if (existsSync(INBOX_PATH)) {
    inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
    // 如果日期变了，创建新的 inbox
    if (inbox.date !== today) {
      inbox = { date: today, ideas: [], last_updated: new Date().toISOString() };
    }
  }
  
  // 自动提取标签
  const autoTags = autoExtractTags(content);
  
  // 创建想法对象
  const idea = {
    id: generateId(),
    content: content,
    tags: autoTags,
    created_at: new Date().toISOString(),
    source: source,
    word_count: content.length
  };
  
  // 添加到 inbox
  inbox.ideas.push(idea);
  inbox.last_updated = new Date().toISOString();
  
  // 保存
  writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2));
  
  return idea;
}

// 获取今日统计
export function getTodayStats() {
  if (!existsSync(INBOX_PATH)) {
    return { count: 0, tags: [] };
  }
  
  const inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
  const today = new Date().toISOString().split('T')[0];
  
  if (inbox.date !== today) {
    return { count: 0, tags: [] };
  }
  
  const allTags = new Set();
  inbox.ideas.forEach(idea => {
    idea.tags?.forEach(tag => allTags.add(tag));
  });
  
  return {
    count: inbox.ideas.length,
    tags: Array.from(allTags)
  };
}

// 主函数（CLI 调用）
function main() {
  const content = process.argv.slice(2).join(' ');
  
  if (!content) {
    console.log('Usage: node save-idea.mjs "想法内容"');
    process.exit(1);
  }
  
  const idea = saveIdea(content, 'cli');
  const stats = getTodayStats();
  
  console.log('✅ 已保存');
  console.log(`🏷️ 标签: ${idea.tags.join(', ') || '无'}`);
  console.log(`📊 今日: ${stats.count} 条想法`);
  if (stats.tags.length > 0) {
    console.log(`🏷️ 今日标签: ${stats.tags.map(t => '#'+t).join(' ')}`);
  }
}

main();