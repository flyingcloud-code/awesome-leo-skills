#!/usr/bin/env node
/**
 * Idea Search Script - 搜索想法
 * Usage: node search.mjs [options]
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.json');
const INBOX_PATH = join(__dirname, '..', 'data', 'inbox.json');

// 读取配置
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

// 搜索 inbox 中的想法
function searchInbox(keyword) {
  if (!readFileSync(INBOX_PATH, 'utf-8')) {
    return [];
  }
  
  const inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
  
  return inbox.ideas.filter(idea => 
    idea.content.toLowerCase().includes(keyword.toLowerCase()) ||
    idea.tags?.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))
  );
}

// 搜索已归档的每日文件
function searchArchived(keyword) {
  const dailyFolder = join(config.vault_path, config.daily_folder);
  const results = [];
  
  try {
    const files = readdirSync(dailyFolder).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const content = readFileSync(join(dailyFolder, file), 'utf-8');
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        // 提取匹配的片段
        const lines = content.split('\n');
        const matches = [];
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
            const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
            matches.push(context);
          }
        }
        
        if (matches.length > 0) {
          results.push({
            file: file,
            matches: matches.slice(0, 3) // 最多显示3个匹配
          });
        }
      }
    }
  } catch (e) {
    // 文件夹不存在或为空
  }
  
  return results;
}

// 显示统计
function showStats() {
  // 读取 inbox
  let inboxCount = 0;
  try {
    const inbox = JSON.parse(readFileSync(INBOX_PATH, 'utf-8'));
    inboxCount = inbox.ideas.length;
  } catch (e) {}
  
  // 读取归档
  let archivedCount = 0;
  let totalWords = 0;
  try {
    const dailyFolder = join(config.vault_path, config.daily_folder);
    const files = readdirSync(dailyFolder).filter(f => f.endsWith('.md'));
    archivedCount = files.length;
    
    for (const file of files) {
      const content = readFileSync(join(dailyFolder, file), 'utf-8');
      // 简单统计字数
      totalWords += content.length;
    }
  } catch (e) {}
  
  console.log('📊 想法记录统计\n');
  console.log(`今日待归档: ${inboxCount} 条`);
  console.log(`已归档天数: ${archivedCount} 天`);
  console.log(`总字数: ${totalWords.toLocaleString()} 字`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--stats') {
    showStats();
    return;
  }
  
  const keyword = args[0];
  console.log(`🔍 搜索: "${keyword}"\n`);
  
  // 搜索 inbox
  const inboxResults = searchInbox(keyword);
  if (inboxResults.length > 0) {
    console.log(`📥 Inbox (${inboxResults.length} 条):`);
    inboxResults.forEach((idea, i) => {
      console.log(`  ${i + 1}. ${idea.content.substring(0, 60)}${idea.content.length > 60 ? '...' : ''}`);
    });
    console.log('');
  }
  
  // 搜索归档
  const archivedResults = searchArchived(keyword);
  if (archivedResults.length > 0) {
    console.log(`📁 归档文件 (${archivedResults.length} 个):`);
    archivedResults.forEach(result => {
      console.log(`\n  📄 ${result.file}:`);
      result.matches.forEach(match => {
        console.log(`    ${match.substring(0, 100)}${match.length > 100 ? '...' : ''}`);
      });
    });
  }
  
  if (inboxResults.length === 0 && archivedResults.length === 0) {
    console.log('❌ 没有找到匹配的想法');
  }
}

main();