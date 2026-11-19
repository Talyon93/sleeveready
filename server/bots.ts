// Crawlers that train AI models, feed AI/SEO data products or ignore crawl limits: they bring no visitors and every
// page they open costs a function run. robots.txt asks them to stay out and the server turns them away at once,
// because some (Amazonbot, Amzn-SearchBot, ExaSearchBot) keep crawling regardless.
export const blockedBots = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Amzn-SearchBot',
  'ExaSearchBot',
  'meta-externalagent',
  'FacebookBot',
  'Google-Extended',
  'Applebot-Extended',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'Timpibot',
  'omgili',
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'PetalBot',
  'DataForSeoBot',
  'BLEXBot',
  'Barkrowler',
  'SeekportBot',
  'serpstatbot',
  'AwarioBot',
  'magpie-crawler',
];

// Names are matched literally: any regex character in them is escaped.
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockedPattern = new RegExp(blockedBots.map(escapeRegExp).join('|'), 'i');
export const isBlockedBot = (userAgent: string) => blockedPattern.test(userAgent);
