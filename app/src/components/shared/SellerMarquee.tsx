"use client";

// 활동중인 셀러를 가로로 자동 슬라이드(마퀴)로 보여주는 장식용 섹션.
// ※ 더미(데모) 셀러 — 실제 셀러 디렉토리 탐색이 아니라 "활동중" 분위기를 보여주는 용도(클릭 비활성).
const DUMMY = [
  { name: "민재 패션", mood: "데일리 캐주얼", fans: "4.2K" },
  { name: "유나 뷰티룸", mood: "K-뷰티 큐레이션", fans: "6.1K" },
  { name: "도현 리빙랩", mood: "감성 라이프", fans: "3.8K" },
  { name: "소연 스타일", mood: "트렌디 무드", fans: "7.5K" },
  { name: "하영 홈카페", mood: "홈카페 감성", fans: "5.6K" },
  { name: "지우 키즈", mood: "베이비&키즈", fans: "2.9K" },
  { name: "태리 스포츠", mood: "액티브 웨어", fans: "3.3K" },
  { name: "보검 그루밍", mood: "맨즈 케어", fans: "4.8K" },
];

// 남성/여성 구매회원 캐릭터 이미지 — 항목 인덱스 기반으로 남/여 교대 적용
const BUYER_MALE = Array.from({ length: 13 }, (_, i) => `/avatars/남성구매회원_${i + 1}.png`);
const BUYER_FEMALE = Array.from({ length: 13 }, (_, i) => `/avatars/여성구매회원_${i + 1}.png`);
function buyerAvatar(i: number): string {
  const arr = i % 2 === 0 ? BUYER_MALE : BUYER_FEMALE;
  return encodeURI(arr[Math.floor(i / 2) % arr.length]);
}

function Card({ s, avatar }: { s: (typeof DUMMY)[number]; avatar: string }) {
  return (
    <div className="flex-shrink-0 w-40 mr-3 rounded-2xl border border-gray-100 bg-white p-3 flex items-center gap-2.5">
      <img src={avatar} alt="" className="w-11 h-11 rounded-full ring-2 ring-brand-200 bg-brand-50 flex-shrink-0 object-cover" />
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-gray-900 truncate">{s.name}</p>
        <p className="text-[10px] text-gray-400 truncate">{s.mood}</p>
        <p className="text-[10px] text-brand-600 font-semibold mt-0.5">팬 {s.fans}</p>
      </div>
    </div>
  );
}

export default function SellerMarquee() {
  const row = [...DUMMY, ...DUMMY];
  return (
    <div className="relative overflow-hidden py-1">
      <div className="flex w-max sb-marquee">
        {row.map((s, i) => <Card key={i} s={s} avatar={buyerAvatar(i % DUMMY.length)} />)}
      </div>
      {/* 좌우 페이드 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
      <style>{`
        @keyframes sbMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .sb-marquee { animation: sbMarquee 28s linear infinite; }
        .sb-marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
