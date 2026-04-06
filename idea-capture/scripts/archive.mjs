#!/usr/bin/env node
/**
 * Idea Archive Script - 每日归档脚本
 * 将 inbox 中的想法归档到 Obsidian Vault
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.json');
const INBOX_PATH = join(__dirname, '..', 'data', 'inbox.json');

// 读取配置
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

// 格式化日期
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

// 生成每日 Markdown 内容
function generateDailyMarkdown(inbox) {
  const date = inbox.date;
  const ideas = inbox.ideas;
  const ideaCount = ideas.length;
  const wordCount = ideas.reduce((sum, idea) => sum + (idea.word_count || idea.content.length), 0);
  
  // 收集所有标签
  const allTags = new Set();
  ideas.forEach(idea => {
    idea.tags?.forEach(tag => allTags.add(tag));
  });
  
  // 生成想法内容
  const ideasContent = ideas.map((idea, index) => {
    const time = new Date(idea.created_at).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const tagsStr = idea.tags?.map(t => `#${t}`).join(' ') || '';
    
    return `## ${time} - 想法 ${index + 1} 💡

**内容**：
${idea.content}

**标签**：${tagsStr}
**来源**：${idea.source || 'cli'}

---
`;
  }).join('\n');
  
  // 生成 Markdown
  return `---
created: ${date}T21:00:00+08:00
tags: [daily-ideas, ${date.substring(0, 7)}]
word_count: ${wordCount}
idea_count: ${ideaCount}
---

# ${date} 想法记录

> 今日共记录 ${ideaCount} 条想法，总计 ${wordCount} 字

---

${ideasContent}

## 今日标签云

${Array.from(allTags).map(t => `#${t}`).join(' ')}

---

*自动归档于 ${formatDateTime(new Date())} by 虾宝 🦐*
`;
}

// 归档到 Vault
function archiveToVault() {
  // 检查 inbox 是否存在
  if (!existsSync(INBOX_PATH)) {
    console.log('📭 没有待归档的想法');
    return false;
  }
  
  const inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
  
  if (inbox.ideas.length === 0) {
    console.log('📭 今日没有记录任何想法');
    return false;
  }
  
  console.log(`📦 正在归档 ${inbox.ideas.length} 条想法...`);
  
  // 生成 Markdown
  const markdown = generateDailyMarkdown(inbox);
  
  // 写入 Vault
  const dailyFilePath = join(config.vault_path, config.daily_folder, `${inbox.date}.md`);
  writeFileSync(dailyFilePath, markdown, 'utf-8');
  
  console.log(`✅ 已保存到: ${dailyFilePath}`);
  
  // 收集今日所有标签
  const todayTags = new Set();
  inbox.ideas.forEach(idea => {
    idea.tags?.forEach(tag => todayTags.add(tag));
  });
  
  // 计算统计
  const ideaCount = inbox.ideas.length;
  const wordCount = inbox.ideas.reduce((sum, idea) => sum + (idea.word_count || idea.content.length), 0);
  
  // 发送归档通知（用于 OpenClaw 调用时返回）
  const archiveSummary = {
    date: inbox.date,
    ideaCount: ideaCount,
    wordCount: wordCount,
    tags: Array.from(todayTags)
  };
  
  console.log('\n📊 归档摘要：');
  console.log(`   日期: ${archiveSummary.date}`);
  console.log(`   想法: ${archiveSummary.ideaCount} 条`);
  console.log(`   字数: ${archiveSummary.wordCount} 字`);
  if (archiveSummary.tags.length > 0) {
    console.log(`   标签: ${archiveSummary.tags.map(t => '#'+t).join(' ')}`);
  }
  
  // Git 操作
  try {
    process.chdir(config.vault_path);
    
    // 配置 git 用户信息（如果未设置）
    try {
      execSync('git config user.name "虾宝"', { stdio: 'ignore' });
      execSync('git config user.email "xiaobao@openclaw.ai"', { stdio: 'ignore' });
    } catch (e) {
      // 已配置则忽略
    }
    
    // 添加文件
    execSync(`git add "${config.daily_folder}/${inbox.date}.md"`);
    
    // 提交
    execSync(`git commit -m "Daily ideas archive: ${inbox.date} (${inbox.ideas.length} ideas)"`);
    
    // 推送（如果有远程仓库）
    try {
      execSync('git push origin main');
      console.log('☁️ 已推送到 GitHub');
    } catch (e) {
      console.log('⚠️ 未配置远程仓库，跳过推送');
    }
    
  } catch (error) {
    console.error('❌ Git 操作失败:', error.message);
  }
  
  // 清空 inbox，设置为明天
  const now = new Date();
  const currentHour = now.getHours();
  
  // 如果当前时间已经过了归档时间（23:50），则设置为明天
  // 否则保持今天（允许同一天多次归档，追加模式）
  const archiveHour = 23;
  const archiveMinute = 50;
  let nextDate;
  if (currentHour > archiveHour || (currentHour === archiveHour && now.getMinutes() >= archiveMinute)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextDate = formatDate(tomorrow);
  } else {
    // 还没到归档时间，保持今天（但清空已归档的想法）
    nextDate = inbox.date;
  }
  
  const emptyInbox = {
    date: nextDate,
    ideas: [],
    last_updated: new Date().toISOString()
  };
  
  writeFileSync(INBOX_PATH, JSON.stringify(emptyInbox, null, 2));
  console.log(`📝 已重置 inbox，准备记录 ${nextDate} 的想法`);
  
  return true;
}

// 查看今日想法
function showToday() {
  if (!existsSync(INBOX_PATH)) {
    console.log('📭 今日还没有记录想法');
    return;
  }
  
  const inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
  const today = formatDate(new Date());
  
  if (inbox.date !== today) {
    console.log(`📭 当前 inbox 是 ${inbox.date} 的，请先归档`);
    return;
  }
  
  console.log(`📊 今日 (${today}) 已记录 ${inbox.ideas.length} 条想法:\n`);
  
  inbox.ideas.forEach((idea, index) => {
    const time = new Date(idea.created_at).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    console.log(`${index + 1}. [${time}] ${idea.content.substring(0, 40)}${idea.content.length > 40 ? '...' : ''}`);
    if (idea.tags?.length) {
      console.log(`   标签: ${idea.tags.join(', ')}`);
    }
    console.log('');
  });
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case '--today':
      showToday();
      break;
    case '--archive':
    default:
      archiveToVault();
      break;
  }
}

main();