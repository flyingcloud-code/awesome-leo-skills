/**
 * Idea Capture - 快速保存想法模块
 * 供 OpenClaw 主会话调用
 */

import { saveIdea, getTodayStats } from './scripts/save-idea.mjs';

/**
 * 保存想法（主入口）
 * @param {string} content - 想法内容
 * @returns {object} - 保存结果
 */
export function capture(content) {
  if (!content || content.trim().length === 0) {
    return { success: false, error: '内容为空' };
  }
  
  const idea = saveIdea(content.trim(), 'feishu');
  const stats = getTodayStats();
  
  return {
    success: true,
    idea: idea,
    stats: stats,
    message: formatCaptureMessage(idea, stats)
  };
}

/**
 * 格式化保存成功消息
 */
function formatCaptureMessage(idea, stats) {
  const tagsStr = idea.tags?.length > 0 
    ? `🏷️ 标签: ${idea.tags.join(', ')}\n` 
    : '';
  
  const todayTagsStr = stats.tags?.length > 0
    ? `🏷️ 今日标签: ${stats.tags.map(t => '#'+t).join(' ')}\n`
    : '';
  
  return `✅ 想法已保存
${tagsStr}📊 今日: ${stats.count} 条想法
${todayTagsStr}📝 ${idea.content.substring(0, 50)}${idea.content.length > 50 ? '...' : ''}`;
}

/**
 * 获取今日统计
 */
export function today() {
  const stats = getTodayStats();
  return {
    count: stats.count,
    tags: stats.tags,
    message: formatStatsMessage(stats)
  };
}

/**
 * 格式化统计消息
 */
function formatStatsMessage(stats) {
  if (stats.count === 0) {
    return '📭 今日还没有记录想法';
  }
  
  const tagsStr = stats.tags?.length > 0
    ? `🏷️ 今日标签: ${stats.tags.map(t => '#'+t).join(' ')}`
    : '';
  
  return `📊 今日已记录 ${stats.count} 条想法\n${tagsStr}`;
}

/**
 * 检查是否是想法记录请求
 */
export function isIdeaRequest(text) {
  const triggers = [
    /^idea\s+/i,
    /^记录[:：]\s*/,
    /^存[:：]\s*/,
    /^想法[:：]\s*/,
    /^笔记[:：]\s*/,
    /^(有个)?想法[:：]/,
    /^(记录一下|记一下)[:：]?/
  ];
  
  return triggers.some(pattern => pattern.test(text.trim()));
}

/**
 * 提取想法内容
 */
export function extractIdeaContent(text) {
  const patterns = [
    /^idea\s+/i,
    /^记录[:：]\s*/,
    /^存[:：]\s*/,
    /^想法[:：]\s*/,
    /^笔记[:：]\s*/,
    /^(有个)?想法[:：]/,
    /^(记录一下|记一下)[:：]?\s*/
  ];
  
  let content = text.trim();
  for (const pattern of patterns) {
    content = content.replace(pattern, '');
  }
  
  return content.trim();
}