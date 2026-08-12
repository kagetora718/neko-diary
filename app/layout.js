import './globals.css';

export const metadata = {
  title: 'ねこ日記',
  description: '猫との大切な日常を、写真と言葉で残す',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
