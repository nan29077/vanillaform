import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 인플루언서 길거리 패션 느낌 이미지 (Unsplash - 세로 비율, 스트릿 패션, OOTD)
const CONTENT_IMAGES = [
  // 1. 봄 스트릿 캐주얼
  [
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=800&fit=crop&crop=center",
  ],
  // 2. 미니멀 데일리
  [
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&crop=center",
  ],
  // 3. Y2K 레트로
  [
    "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop&crop=center",
  ],
  // 4. 남성 레이어드
  [
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&crop=center",
  ],
  // 5. 데이트룩
  [
    "https://images.unsplash.com/photo-1434389677669-e08b4cda3a0b?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=800&fit=crop&crop=center",
  ],
  // 6. 애슬레저
  [
    "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1581044777550-4cfa60707998?w=600&h=800&fit=crop&crop=center",
  ],
  // 7. 빈티지 하울
  [
    "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=600&h=800&fit=crop&crop=center",
  ],
  // 8. 바캉스룩
  [
    "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1544957992-20514f595d6f?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=600&h=800&fit=crop&crop=center",
  ],
  // 9. 올블랙 시크
  [
    "https://images.unsplash.com/photo-1475180429745-13dff4d25f38?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=600&h=800&fit=crop&crop=center",
  ],
  // 10. 피크닉 캐주얼
  [
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop&crop=center",
  ],
  // 11. 워크웨어 무드
  [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&crop=center",
  ],
  // 12. 럭셔리 캐주얼
  [
    "https://images.unsplash.com/photo-1488161628813-04466f0cc7d4?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1502716119720-b23a1e3f9cd8?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=800&fit=crop&crop=center",
  ],
  // 13. 힙합 스트릿
  [
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1505022610485-0249ba5b3675?w=600&h=800&fit=crop&crop=center",
  ],
  // 14. 가을 아우터 코디
  [
    "https://images.unsplash.com/photo-1551803091-e20673f15770?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1549062572-544a64fb0c56?w=600&h=800&fit=crop&crop=center",
    "https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=600&h=800&fit=crop&crop=center",
  ],
];

const CONTENT_DATA = [
  { title: "오늘의 스트릿룩 🔥", content: "봄 시즌 캐주얼 코디 완성! 오버핏 자켓에 와이드 팬츠 조합으로 편하면서도 스타일리시하게. 홍대 카페 거리에서 스냅 찍었어요!", likeCount: 142, viewCount: 1380 },
  { title: "데일리 미니멀 코디", content: "심플한 화이트 + 데님 조합. 미니멀한 액세서리로 포인트! 성수동 골목에서.", likeCount: 98, viewCount: 845 },
  { title: "뉴진스 감성 Y2K 룩 ✨", content: "레트로 무드의 Y2K 패션! 크롭탑에 로우라이즈 데님으로 트렌디하게. 을지로 뒷골목 바이브.", likeCount: 267, viewCount: 2512 },
  { title: "남자 가을 레이어드", content: "니트 + 셔츠 레이어드로 깔끔한 남성 코디. 머플러로 마무리! 이태원 거리에서.", likeCount: 85, viewCount: 690 },
  { title: "데이트룩 추천 💕", content: "오피스룩에서 데이트룩까지! 블라우스에 미디 스커트 조합. 강남 가로수길 피팅.", likeCount: 153, viewCount: 1420 },
  { title: "스포티 캐주얼 데일리", content: "운동 후 그대로 카페 가능한 애슬레저 룩! 요가 레깅스에 오버핏 후디. 한남동 요가 끝나고.", likeCount: 71, viewCount: 498 },
  { title: "빈티지 숍 하울 🛍️", content: "홍대 빈티지 숍에서 득템한 아이템들! 90년대 감성 가득. 골목골목 탐험한 결과물.", likeCount: 189, viewCount: 1750 },
  { title: "여름 바캉스 룩북 🌊", content: "리조트 분위기 물씬! 리넨 셔츠에 쇼츠 조합으로 시원하게. 제주 해변가에서.", likeCount: 125, viewCount: 934 },
  { title: "모노톤 시크 코디", content: "올 블랙 코디의 정석. 레더 자켓으로 엣지 있게! 명동 밤거리 스냅.", likeCount: 108, viewCount: 767 },
  { title: "주말 피크닉 코디 🌿", content: "편안하면서도 예쁜 피크닉 룩! 체크 패턴으로 포인트. 한강 피크닉 준비 완료.", likeCount: 94, viewCount: 556 },
  { title: "워크웨어 무드 💼", content: "출근룩도 스타일리시하게! 오버사이즈 블레이저에 슬랙스 조합. 종로 오피스 거리.", likeCount: 76, viewCount: 423 },
  { title: "럭셔리 캐주얼 🖤", content: "하이엔드 브랜드 믹스매치! 캐시미어 니트에 데님 팬츠로 고급스러운 일상 코디.", likeCount: 234, viewCount: 2180 },
  { title: "힙합 스트릿 바이브 🎤", content: "오버사이즈 후디 + 카고팬츠로 힙한 룩 완성. 신사동 스케이트파크에서.", likeCount: 156, viewCount: 1340 },
  { title: "가을 아우터 코디 🍂", content: "트렌치코트 + 니트 조합으로 가을 감성 제대로! 북촌 한옥마을 산책길에서.", likeCount: 118, viewCount: 890 },
];

async function seedContentPosts() {
  console.log("🌱 콘텐츠 시드 데이터 생성 시작...");

  // Get sellers
  const sellers = await prisma.sellerProfile.findMany({
    select: { id: true, shopName: true },
  });

  if (sellers.length === 0) {
    console.log("❌ 셀러가 없습니다. 먼저 기본 seed를 실행하세요.");
    return;
  }

  // Get products
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
    take: 30,
  });

  if (products.length === 0) {
    console.log("❌ 상품이 없습니다. 먼저 기본 seed를 실행하세요.");
    return;
  }

  // Delete existing content posts
  await prisma.shoppingTag.deleteMany();
  await prisma.contentComment.deleteMany();
  await prisma.contentLike.deleteMany();
  await prisma.contentPost.deleteMany();

  const createdPosts: { id: string; title: string }[] = [];

  for (let i = 0; i < CONTENT_DATA.length; i++) {
    const seller = sellers[i % sellers.length];
    const data = CONTENT_DATA[i];
    const images = CONTENT_IMAGES[i];

    // Create content post
    const post = await prisma.contentPost.create({
      data: {
        sellerId: seller.id,
        title: data.title,
        content: data.content,
        images: JSON.stringify(images),
        productTags: JSON.stringify([]),
        isPublished: true,
        isApproved: true,
        likeCount: data.likeCount,
        viewCount: data.viewCount,
      },
    });

    createdPosts.push({ id: post.id, title: data.title });

    // Add 2-4 shopping tags per post with realistic positions
    // Tags are positioned where clothing items would typically be in street fashion photos
    const tagPositions = [
      // 상체 영역 (상의, 자켓)
      { posX: 45, posY: 30 },
      { posX: 55, posY: 35 },
      // 중간 영역 (벨트, 가방, 액세서리)
      { posX: 35, posY: 50 },
      { posX: 65, posY: 48 },
      // 하체 영역 (하의, 신발)
      { posX: 40, posY: 70 },
      { posX: 50, posY: 85 },
    ];

    const tagCount = 2 + Math.floor(Math.random() * 3); // 2~4개
    for (let j = 0; j < tagCount && j < products.length; j++) {
      const product = products[(i * 3 + j) % products.length];
      const pos = tagPositions[j % tagPositions.length];
      // Add some randomness to positions
      const jitterX = (Math.random() - 0.5) * 10;
      const jitterY = (Math.random() - 0.5) * 8;

      await prisma.shoppingTag.create({
        data: {
          contentId: post.id,
          productId: product.id,
          imageIndex: j % images.length,
          posX: Math.max(10, Math.min(90, pos.posX + jitterX)),
          posY: Math.max(10, Math.min(90, pos.posY + jitterY)),
          label: null,
        },
      });
    }

    console.log(`  ✅ 콘텐츠 ${i + 1}: "${data.title}" (${seller.shopName}) - ${tagCount}개 태그`);
  }

  // Add dummy comments
  const buyers = await prisma.user.findMany({
    where: { role: "BUYER" },
    select: { id: true },
    take: 5,
  });

  const commentTexts = [
    "너무 이쁘다!! 어디서 샀어요?",
    "이거 완전 내 스타일 💕",
    "사이즈 추천 부탁드려요~",
    "가격 대비 퀄리티 좋아보여요",
    "색감 실물이 더 예쁠 것 같아요!",
    "코디 참고할게요 😊",
    "매장에서도 볼 수 있나요?",
    "품절 전에 빨리 사야겠다",
    "남친한테 선물하기 좋겠다",
    "이 조합 진짜 센스있다!",
    "와 이 코디 진짜 대박 🔥",
    "착용감 어떠세요?",
    "다음 콘텐츠도 기대할게요!",
    "이런 스타일 너무 좋아요",
    "배송 얼마나 걸려요?",
  ];

  for (let i = 0; i < createdPosts.length; i++) {
    const postId = createdPosts[i].id;
    const numComments = 1 + Math.floor(Math.random() * 4);
    for (let j = 0; j < numComments && j < buyers.length; j++) {
      await prisma.contentComment.create({
        data: {
          userId: buyers[j % buyers.length].id,
          contentId: postId,
          text: commentTexts[(i * 2 + j) % commentTexts.length],
        },
      });
    }
  }

  console.log("\n✅ 콘텐츠 시드 데이터 생성 완료!");
  console.log(`  - 콘텐츠 포스트: ${CONTENT_DATA.length}개`);
  console.log(`  - 쇼핑 태그: 각 포스트당 2~4개 (실제 의류 위치에 배치)`);
  console.log(`  - 댓글: 더미 댓글 추가 완료`);
}

seedContentPosts()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
