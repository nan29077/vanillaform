import { Icon } from '@/components/shared/Icon';
import { sanitizeHtmlServer } from "@/lib/sanitizeServer";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Link from "next/link";
import { Download} from 'lucide-react';

export const dynamic = "force-dynamic";

// Simple markdown to HTML converter (no external deps)
function mdToHtml(md: string): string {
  let html = md
    // Code blocks (```...```)
    .replace(/```([^`]*?)```/g, '<pre class="bg-gray-50 p-4 rounded-xl text-sm overflow-x-auto my-3 border border-gray-100"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-red-600">$1</code>')
    // Tables (basic)
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n)*)/g, (_, header, body) => {
      const ths = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th class="px-3 py-2 text-left text-xs font-bold text-gray-700 bg-gray-50 border-b border-gray-200">${c.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map((row: string) => {
        const tds = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td class="px-3 py-2 text-sm text-gray-600 border-b border-gray-100">${c.trim()}</td>`).join('');
        return `<tr class="hover:bg-gray-50">${tds}</tr>`;
      }).join('');
      return `<div class="overflow-x-auto my-3"><table class="w-full border border-gray-200 rounded-lg overflow-hidden"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-gray-900 mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-6 border-gray-200" />')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="text-sm text-gray-600 ml-4 list-disc mb-1">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-brand-300 bg-brand-50 px-4 py-2 my-3 text-sm text-brand-700 rounded-r-lg">$1</blockquote>')
    // Paragraphs (wrap remaining lines)
    .replace(/^(?!<[hblutdp]|<\/|<hr|<pre|<code|<block|<div|<li)(.+)$/gm, '<p class="text-sm text-gray-600 leading-relaxed mb-2">$1</p>');

  return html;
}

export default async function DocsPage() {
  let content = "";
  try {
    // Try multiple paths
    const paths = [
      join(process.cwd(), "..", "docs", "BUSINESS_LOGIC.md"),
      join(process.cwd(), "docs", "BUSINESS_LOGIC.md"),
      "/home/user/webapp/docs/BUSINESS_LOGIC.md",
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        content = readFileSync(p, "utf-8");
        break;
      }
    }
  } catch (e) {
    content = "# 문서를 로드할 수 없습니다\n\n파일 경로를 확인해 주세요.";
  }

  const html = mdToHtml(content);

  return (
    <div className="animate-fade-in max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/" className="text-gray-900 hover:opacity-60 transition-opacity">
            <Icon name="ArrowRight" size={22} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <div className="flex items-center gap-2">
            <Icon name="File" size={16} className="text-brand-500" />
            <span className="text-sm font-bold text-gray-900">비즈니스 로직 문서</span>
          </div>
          <div className="w-6" />
        </div>
      </div>

      {/* Document Content */}
      <div className="px-4 py-6">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtmlServer(html) }}
        />
      </div>

      {/* Document Info */}
      <div className="px-4 mt-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">
            파일 경로: <code className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">/docs/BUSINESS_LOGIC.md</code>
          </p>
          <p className="text-[10px] text-gray-400 mt-1">마지막 업데이트: 2026-04-04</p>
        </div>
      </div>
    </div>
  );
}
