// GitHub Pages 用の設定。
// - output: 'export'  → サーバー不要の静的HTMLとして書き出す
// - basePath          → 公開URLが /neko-diary 配下になるため（開発時は不要）
const isProd = process.env.NODE_ENV === 'production';

export default {
  output: 'export',
  basePath: isProd ? '/neko-diary' : '',
  images: { unoptimized: true },
  // Next.jsがAGENTS.md/CLAUDE.mdを自動生成しないようにする
  agentRules: false,
};
