import { PrismaClient, Role, CampaignStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 시드 데이터 생성 시작...");

  // 비밀번호 해시
  const pw = await bcrypt.hash("password123", 12);

  // ─── 카테고리 (30개, 아이콘 포함) ───
  const categoriesData = [
    { name: "패션", slug: "fashion", icon: "Shirt", description: "의류, 트렌드 패션 아이템", sortOrder: 1 },
    { name: "뷰티", slug: "beauty", icon: "Palette", description: "메이크업, 코스메틱", sortOrder: 2 },
    { name: "스킨케어", slug: "skincare", icon: "Heart", description: "스킨케어, 기초 화장품", sortOrder: 3 },
    { name: "액세서리", slug: "accessories", icon: "Gem", description: "주얼리, 패션 소품", sortOrder: 4 },
    { name: "홈리빙", slug: "home-living", icon: "HomeIcon", description: "인테리어, 홈 데코", sortOrder: 5 },
    { name: "푸드", slug: "food", icon: "Utensils", description: "맛집, 식품, 간식", sortOrder: 6 },
    { name: "디지털", slug: "digital", icon: "Laptop", description: "전자기기, 가젯", sortOrder: 7 },
    { name: "키즈", slug: "kids", icon: "Baby", description: "유아, 아동용품", sortOrder: 8 },
    { name: "스포츠", slug: "sports", icon: "Dumbbell", description: "스포츠, 피트니스 용품", sortOrder: 9 },
    { name: "여행", slug: "travel", icon: "Plane", description: "여행용품, 캐리어", sortOrder: 10 },
    { name: "반려동물", slug: "pet", icon: "Dog", description: "펫 용품, 사료", sortOrder: 11 },
    { name: "도서", slug: "books", icon: "BookOpen", description: "도서, 문구류", sortOrder: 12 },
    { name: "음악", slug: "audio", icon: "Headphones", description: "이어폰, 스피커", sortOrder: 13 },
    { name: "카페", slug: "cafe", icon: "Coffee", description: "커피, 차, 카페 용품", sortOrder: 14 },
    { name: "건강", slug: "health", icon: "Stethoscope", description: "건강기능식품, 영양제", sortOrder: 15 },
    { name: "향수", slug: "perfume", icon: "Flower2", description: "향수, 바디미스트", sortOrder: 16 },
    { name: "신발", slug: "shoes", icon: "Footprints", description: "슈즈, 스니커즈", sortOrder: 17 },
    { name: "가방", slug: "bag", icon: "ShoppingBag", description: "핸드백, 크로스백", sortOrder: 18 },
    { name: "시계", slug: "watch", icon: "Watch", description: "손목시계, 스마트워치", sortOrder: 19 },
    { name: "주방", slug: "kitchen", icon: "Utensils", description: "주방용품, 조리기구", sortOrder: 20 },
    { name: "캠핑", slug: "camping", icon: "Tent", description: "캠핑, 아웃도어 장비", sortOrder: 21 },
    { name: "게임", slug: "game", icon: "Gamepad2", description: "게임, 완구, 피규어", sortOrder: 22 },
    { name: "자동차", slug: "car", icon: "Car", description: "차량용품, 세차용품", sortOrder: 23 },
    { name: "디저트", slug: "dessert", icon: "Cake", description: "디저트, 베이커리, 케이크", sortOrder: 24 },
    { name: "와인", slug: "wine", icon: "Wine", description: "와인, 위스키, 전통주", sortOrder: 25 },
    { name: "공예", slug: "craft", icon: "Scissors", description: "DIY, 핸드메이드 키트", sortOrder: 26 },
    { name: "영화", slug: "movie", icon: "Clapperboard", description: "영화, 드라마, 영상 콘텐츠", sortOrder: 27 },
    { name: "라이프", slug: "lifestyle", icon: "Leaf", description: "생활용품, 라이프스타일", sortOrder: 28 },
    { name: "가드닝", slug: "gardening", icon: "Flower2", description: "식물, 화분, 가드닝 용품", sortOrder: 29 },
    { name: "선물", slug: "gift", icon: "Gift", description: "선물세트, 기프트", sortOrder: 30 },
  ];

  const categories = [];
  for (const cat of categoriesData) {
    const c = await prisma.category.create({ data: cat });
    categories.push(c);
  }

  // ─── 최고관리자 ───
  const admin = await prisma.user.create({
    data: {
      email: "admin@vanillaform.local",
      name: "관리자",
      password: pw,
      role: Role.SUPER_ADMIN,
      avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&h=200&fit=crop&crop=face",
    },
  });

  // ─── 브랜드 2개 ───
  const brand1User = await prisma.user.create({
    data: {
      email: "brand1@vanillaform.local",
      name: "소르빈 매니저",
      password: pw,
      role: Role.BRAND_ADMIN,
      brandProfile: {
        create: {
          brandName: "소르빈 (SORBIN)",
          description: "미니멀 & 모던 감성의 여성 패션 브랜드. 세련된 일상복을 제안합니다.",
          isApproved: true,
        },
      },
    },
    include: { brandProfile: true },
  });

  const brand2User = await prisma.user.create({
    data: {
      email: "brand2@vanillaform.local",
      name: "루미에르 매니저",
      password: pw,
      role: Role.BRAND_ADMIN,
      brandProfile: {
        create: {
          brandName: "루미에르 (Lumière)",
          description: "프렌치 감성 뷰티 & 라이프스타일 브랜드. 자연에서 영감을 받은 제품을 선보입니다.",
          isApproved: true,
        },
      },
    },
    include: { brandProfile: true },
  });

  // ─── 셀러 3명 ───
  const seller1User = await prisma.user.create({
    data: {
      email: "seller1@vanillaform.local",
      name: "김하늘",
      password: pw,
      role: Role.SELLER,
      sellerProfile: {
        create: {
          slug: "haneul-pick",
          shopName: "하늘 Pick",
          shopDescription: "패션 인플루언서 하늘이 엄선한 데일리 룩 큐레이션. 미니멀하지만 트렌디한 스타일을 제안합니다.",
          category: "패션",
          mood: "미니멀 · 모던 · 시크",
          isApproved: true,
          commissionRate: 12,
          totalFans: 15420,
          shopLogo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
          shopBanner: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop",
          instagramUrl: "https://instagram.com/haneul_pick",
        },
      },
    },
    include: { sellerProfile: true },
  });

  const seller2User = await prisma.user.create({
    data: {
      email: "seller2@vanillaform.local",
      name: "이수아",
      password: pw,
      role: Role.SELLER,
      sellerProfile: {
        create: {
          slug: "sua-beauty",
          shopName: "수아 뷰티랩",
          shopDescription: "뷰티 크리에이터 수아의 스킨케어 & 메이크업 큐레이션. 진짜 써보고 추천하는 제품만 엄선합니다.",
          category: "뷰티",
          mood: "글로우 · 내추럴 · 데일리",
          isApproved: true,
          commissionRate: 10,
          totalFans: 23100,
          shopLogo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
          shopBanner: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=400&fit=crop",
          instagramUrl: "https://instagram.com/sua_beauty",
          youtubeUrl: "https://youtube.com/@sua_beauty",
        },
      },
    },
    include: { sellerProfile: true },
  });

  const seller3User = await prisma.user.create({
    data: {
      email: "seller3@vanillaform.local",
      name: "박지은",
      password: pw,
      role: Role.SELLER,
      sellerProfile: {
        create: {
          slug: "jieun-lifestyle",
          shopName: "지은의 라이프로그",
          shopDescription: "라이프스타일 디렉터 지은의 취향 셀렉트. 옷, 소품, 홈 데코까지 감성 있는 일상을 제안합니다.",
          category: "라이프스타일",
          mood: "빈티지 · 내추럴 · 웜톤",
          isApproved: true,
          commissionRate: 11,
          totalFans: 8750,
          shopLogo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face",
          shopBanner: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=400&fit=crop",
          instagramUrl: "https://instagram.com/jieun_lifestyle",
        },
      },
    },
    include: { sellerProfile: true },
  });

  // ─── 셀러4: 김혜선 (테스트 수수료율 7%) ───
  const seller4User = await prisma.user.create({
    data: {
      email: "seller4@vanillaform.local",
      name: "김혜선",
      password: pw,
      role: Role.SELLER,
      sellerProfile: {
        create: {
          slug: "hyesun-picks",
          shopName: "혜선 Picks",
          shopDescription: "트렌드 셀러 혜선의 감성 큐레이션. 뷰티부터 라이프까지 혜선이 직접 써보고 고른 아이템.",
          category: "뷰티",
          mood: "감성 · 시크 · 트렌디",
          isApproved: true,
          commissionRate: 7,
          totalFans: 5300,
          shopLogo: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=face",
          shopBanner: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&h=400&fit=crop",
          instagramUrl: "https://instagram.com/hyesun_picks",
        },
      },
    },
    include: { sellerProfile: true },
  });

  const seller1 = seller1User.sellerProfile!;
  const seller2 = seller2User.sellerProfile!;
  const seller3 = seller3User.sellerProfile!;
  const brand1 = brand1User.brandProfile!;
  const brand2 = brand2User.brandProfile!;

  // ─── 상품 22개 (실제 상품 이미지 적용) ───
  const productsData = [
    // 소르빈 패션 (10개)
    { name: "오버핏 코튼 블레이저", slug: "overfit-cotton-blazer", basePrice: 89000, category: categories[0].id, brand: brand1.id, desc: "가볍고 편안한 오버핏 코튼 블레이저. 데일리부터 오피스까지 다양하게 활용 가능합니다.", thumbnail: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=1000&fit=crop" },
    { name: "와이드 하이웨이스트 슬랙스", slug: "wide-high-waist-slacks", basePrice: 59000, category: categories[0].id, brand: brand1.id, desc: "깔끔한 핏의 와이드 하이웨이스트 슬랙스. 다리 라인을 길어 보이게 해줍니다.", thumbnail: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&h=1000&fit=crop" },
    { name: "린넨 블렌드 셔츠 원피스", slug: "linen-blend-shirt-dress", basePrice: 78000, category: categories[0].id, brand: brand1.id, desc: "시원한 린넨 블렌드 소재의 셔츠 원피스. 여름 데일리 아이템으로 딱입니다.", thumbnail: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=1000&fit=crop" },
    { name: "미니멀 레더 토트백", slug: "minimal-leather-tote", basePrice: 128000, category: categories[3].id, brand: brand1.id, desc: "심플한 디자인의 레더 토트백. 넉넉한 수납과 고급스러운 질감이 특징입니다.", thumbnail: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=1000&fit=crop" },
    { name: "소프트 니트 카디건", slug: "soft-knit-cardigan", basePrice: 65000, category: categories[0].id, brand: brand1.id, desc: "부드러운 캐시미어 블렌드 니트 카디건. 간절기 필수 아이템.", thumbnail: "https://images.unsplash.com/photo-1434389677669-e08b4cda3a13?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1434389677669-e08b4cda3a13?w=800&h=1000&fit=crop" },
    { name: "스트레이트 데님 팬츠", slug: "straight-denim-pants", basePrice: 72000, category: categories[0].id, brand: brand1.id, desc: "빈티지 워싱의 스트레이트 데님. 어떤 상의와도 잘 어울립니다.", thumbnail: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&h=1000&fit=crop" },
    { name: "크롭 트위드 자켓", slug: "crop-tweed-jacket", basePrice: 115000, category: categories[0].id, brand: brand1.id, desc: "클래식한 트위드 소재의 크롭 자켓. 격식있는 자리에도 데일리에도 좋습니다.", thumbnail: "https://images.unsplash.com/photo-1608234807905-4466023792f5?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1608234807905-4466023792f5?w=800&h=1000&fit=crop" },
    { name: "실크 블라우스", slug: "silk-blouse", basePrice: 95000, category: categories[0].id, brand: brand1.id, desc: "광택감 있는 실크 블라우스. 페미닌한 무드를 연출할 수 있습니다.", thumbnail: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=800&h=1000&fit=crop" },
    { name: "캐시미어 머플러", slug: "cashmere-muffler", basePrice: 85000, category: categories[3].id, brand: brand1.id, desc: "100% 캐시미어 머플러. 포근하고 가벼운 겨울 필수 아이템.", thumbnail: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&h=1000&fit=crop" },
    { name: "미니멀 골드 이어링 세트", slug: "minimal-gold-earring-set", basePrice: 38000, category: categories[3].id, brand: brand1.id, desc: "데일리로 착용하기 좋은 미니멀 골드 이어링 3종 세트.", thumbnail: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=1000&fit=crop" },
    // 루미에르 뷰티/라이프 (12개)
    { name: "글로우 세럼 파운데이션", slug: "glow-serum-foundation", basePrice: 42000, category: categories[1].id, brand: brand2.id, desc: "촉촉한 세럼 타입 파운데이션. 피부에 자연스러운 광택을 부여합니다.", thumbnail: "https://images.unsplash.com/photo-1631730486784-5b7a7da54405?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1631730486784-5b7a7da54405?w=800&h=1000&fit=crop" },
    { name: "비타민C 브라이트닝 앰플", slug: "vitamin-c-brightening-ampoule", basePrice: 35000, category: categories[1].id, brand: brand2.id, desc: "순수 비타민C 15% 함유 브라이트닝 앰플. 칙칙한 피부톤을 환하게.", thumbnail: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&h=1000&fit=crop" },
    { name: "히알루론산 수분크림", slug: "hyaluronic-moisture-cream", basePrice: 48000, category: categories[1].id, brand: brand2.id, desc: "3중 히알루론산 수분크림. 24시간 촉촉한 피부를 유지해줍니다.", thumbnail: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=800&h=1000&fit=crop" },
    { name: "내추럴 립 틴트 세트", slug: "natural-lip-tint-set", basePrice: 28000, category: categories[1].id, brand: brand2.id, desc: "자연스러운 발색의 립 틴트 3색 세트. MLBB 컬러 구성.", thumbnail: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&h=1000&fit=crop" },
    { name: "로즈힙 클렌징 오일", slug: "rosehip-cleansing-oil", basePrice: 32000, category: categories[1].id, brand: brand2.id, desc: "로즈힙 오일 베이스 클렌징 오일. 메이크업을 부드럽게 녹여냅니다.", thumbnail: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&h=1000&fit=crop" },
    { name: "아로마 디퓨저 세트", slug: "aroma-diffuser-set", basePrice: 55000, category: categories[4].id, brand: brand2.id, desc: "프렌치 감성 아로마 디퓨저. 은은한 향으로 공간을 채워줍니다.", thumbnail: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800&h=1000&fit=crop" },
    { name: "오가닉 코튼 파자마 세트", slug: "organic-cotton-pajama-set", basePrice: 68000, category: categories[27].id, brand: brand2.id, desc: "100% 오가닉 코튼 파자마 세트. 편안하고 포근한 수면을 선사합니다.", thumbnail: "https://images.unsplash.com/photo-1617331721458-bd3bd3f9c7f8?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1617331721458-bd3bd3f9c7f8?w=800&h=1000&fit=crop" },
    { name: "핸드메이드 캔들 3종", slug: "handmade-candle-set", basePrice: 45000, category: categories[4].id, brand: brand2.id, desc: "천연 소이왁스 핸드메이드 캔들 3종 세트. 각기 다른 계절의 향.", thumbnail: "https://images.unsplash.com/photo-1602607742916-8f2aeee3e4cd?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1602607742916-8f2aeee3e4cd?w=800&h=1000&fit=crop" },
    { name: "실크 스크런치 세트", slug: "silk-scrunchie-set", basePrice: 22000, category: categories[3].id, brand: brand2.id, desc: "100% 실크 스크런치 5종 세트. 머리카락 손상을 줄여줍니다.", thumbnail: "https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?w=800&h=1000&fit=crop" },
    { name: "시어버터 핸드크림 듀오", slug: "shea-butter-hand-cream-duo", basePrice: 25000, category: categories[1].id, brand: brand2.id, desc: "고농축 시어버터 핸드크림 2종. 건조한 손을 촉촉하게.", thumbnail: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&h=1000&fit=crop" },
    { name: "미니멀 데스크 오거나이저", slug: "minimal-desk-organizer", basePrice: 42000, category: categories[4].id, brand: brand2.id, desc: "원목 소재 미니멀 데스크 오거나이저. 깔끔한 작업 공간을 만들어줍니다.", thumbnail: "https://images.unsplash.com/photo-1618220179428-22790b461013?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&h=1000&fit=crop" },
    { name: "린넨 앞치마", slug: "linen-apron", basePrice: 35000, category: categories[27].id, brand: brand2.id, desc: "내추럴 린넨 앞치마. 요리하는 시간을 더 특별하게.", thumbnail: "https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=400&h=500&fit=crop", detailImg: "https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=800&h=1000&fit=crop" },
  ];

  const products = [];
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.desc,
        detailContent: `<h2>${p.name}</h2><p>${p.desc}</p><p>소재: 최고급 소재 사용</p><p>사이즈: 상세 사이즈표 참고</p>`,
        basePrice: p.basePrice,
        comparePrice: Math.round(p.basePrice * 1.3),
        categoryId: p.category,
        brandId: p.brand,
        isActive: true,
        isApproved: true,
        totalStock: 500,
        thumbnail: p.thumbnail,
        variants: {
          create: [
            { name: "FREE", price: p.basePrice, stock: 200, sortOrder: 0 },
          ],
        },
        images: {
          create: [
            { url: p.detailImg, alt: p.name, sortOrder: 0 },
            { url: p.thumbnail, alt: `${p.name} 상세`, sortOrder: 1 },
          ],
        },
      },
    });
    products.push(product);
  }

  // ─── 셀러 샵 상품 추가 ───
  // 셀러1 (하늘 Pick) - 패션 위주 8개
  for (let i = 0; i < 8; i++) {
    await prisma.sellerShopProduct.create({
      data: { sellerId: seller1.id, productId: products[i].id, displayOrder: i },
    });
  }
  // 셀러2 (수아 뷰티랩) - 뷰티 위주 8개
  for (let i = 10; i < 18; i++) {
    await prisma.sellerShopProduct.create({
      data: { sellerId: seller2.id, productId: products[i].id, displayOrder: i - 10 },
    });
  }
  // 셀러3 (지은의 라이프로그) - 라이프스타일 mix 8개
  const seller3Products = [2, 5, 9, 15, 16, 17, 18, 20];
  for (let i = 0; i < seller3Products.length; i++) {
    await prisma.sellerShopProduct.create({
      data: { sellerId: seller3.id, productId: products[seller3Products[i]].id, displayOrder: i },
    });
  }

  // ─── 공동구매 캠페인 ───
  const now = new Date();
  const campaignsData = [
    {
      title: "[하늘 PICK] 소르빈 오버핏 블레이저 단독 특가",
      sellerId: seller1.id,
      productId: products[0].id,
      status: CampaignStatus.ACTIVE,
      campaignPrice: 62000,
      originalPrice: 89000,
      startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      goalQuantity: 100,
      currentQuantity: 67,
      participantCount: 67,
      commissionRate: 12,
      totalRevenue: 67 * 62000,
      bannerImage: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=375&fit=crop",
      description: "하늘이 직접 스타일링한 소르빈 오버핏 블레이저를 특별 가격에 만나보세요!",
    },
    {
      title: "[수아 추천] 글로우 세럼 파운데이션 공구",
      sellerId: seller2.id,
      productId: products[10].id,
      status: CampaignStatus.ACTIVE,
      campaignPrice: 29900,
      originalPrice: 42000,
      startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      goalQuantity: 200,
      currentQuantity: 142,
      participantCount: 142,
      commissionRate: 10,
      totalRevenue: 142 * 29900,
      bannerImage: "https://images.unsplash.com/photo-1631730486784-5b7a7da54405?w=600&h=375&fit=crop",
      description: "수아가 6개월 동안 사용 후 자신 있게 추천하는 파운데이션!",
    },
    {
      title: "[지은 셀렉트] 아로마 디퓨저 세트 공동구매",
      sellerId: seller3.id,
      productId: products[15].id,
      status: CampaignStatus.ACTIVE,
      campaignPrice: 39000,
      originalPrice: 55000,
      startDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      goalQuantity: 80,
      currentQuantity: 32,
      participantCount: 32,
      commissionRate: 11,
      totalRevenue: 32 * 39000,
      bannerImage: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=600&h=375&fit=crop",
      description: "지은이 집에서 매일 사용하는 프렌치 감성 디퓨저를 특별가에!",
    },
    {
      title: "[하늘 PICK] 와이드 하이웨이스트 슬랙스",
      sellerId: seller1.id,
      productId: products[1].id,
      status: CampaignStatus.ACTIVE,
      campaignPrice: 42000,
      originalPrice: 59000,
      startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      goalQuantity: 150,
      currentQuantity: 89,
      participantCount: 89,
      commissionRate: 12,
      totalRevenue: 89 * 42000,
      bannerImage: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=375&fit=crop",
      description: "키 작은 분들도 다리가 길어보이는 마법의 슬랙스!",
    },
    {
      title: "[수아 추천] 비타민C 앰플 + 수분크림 세트",
      sellerId: seller2.id,
      productId: products[11].id,
      status: CampaignStatus.ACTIVE,
      campaignPrice: 55000,
      originalPrice: 83000,
      startDate: now,
      endDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
      goalQuantity: 120,
      currentQuantity: 28,
      participantCount: 28,
      commissionRate: 10,
      totalRevenue: 28 * 55000,
      bannerImage: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&h=375&fit=crop",
      description: "수아 뷰티랩 최고 인기 조합! 앰플과 크림을 세트 특가로!",
    },
    {
      title: "[지은 셀렉트] 린넨 셔츠 원피스 여름 공구",
      sellerId: seller3.id,
      productId: products[2].id,
      status: CampaignStatus.SCHEDULED,
      campaignPrice: 55000,
      originalPrice: 78000,
      startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      goalQuantity: 60,
      currentQuantity: 0,
      participantCount: 0,
      commissionRate: 11,
      totalRevenue: 0,
      bannerImage: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=375&fit=crop",
      description: "올 여름 준비하세요! 시원한 린넨 원피스 공동구매 예고!",
    },
    {
      title: "[하늘 PICK] 미니멀 레더 토트백 공구 (완판!)",
      sellerId: seller1.id,
      productId: products[3].id,
      status: CampaignStatus.SUCCESS,
      campaignPrice: 89000,
      originalPrice: 128000,
      startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      goalQuantity: 50,
      currentQuantity: 50,
      participantCount: 50,
      commissionRate: 12,
      totalRevenue: 50 * 89000,
      bannerImage: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=375&fit=crop",
      description: "이미 완판된 인기 토트백!",
    },
    {
      title: "[수아 추천] 핸드크림 듀오 한정판",
      sellerId: seller2.id,
      productId: products[19].id,
      status: CampaignStatus.SUCCESS,
      campaignPrice: 18000,
      originalPrice: 25000,
      startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      goalQuantity: 300,
      currentQuantity: 287,
      participantCount: 287,
      commissionRate: 10,
      totalRevenue: 287 * 18000,
      bannerImage: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=375&fit=crop",
      description: "한정판 크리스마스 에디션 핸드크림",
    },
  ];

  for (const c of campaignsData) {
    await prisma.groupBuyCampaign.create({ data: c });
  }

  // ─── 구매회원 5명 ───
  const buyers = [];
  const buyerNames = ["최유진", "정서윤", "한다인", "오채원", "문예린"];
  const buyerAvatars = [
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
  ];
  for (let i = 0; i < 5; i++) {
    const seller = i < 2 ? seller1 : i < 4 ? seller2 : seller3;
    const u = await prisma.user.create({
      data: {
        email: `buyer${i + 1}@example.com`,
        name: buyerNames[i],
        password: pw,
        role: Role.BUYER,
        avatar: buyerAvatars[i],
        buyerProfile: {
          create: {
            primarySellerId: seller.id,
          },
        },
      },
    });
    buyers.push(u);
  }

  // ─── 배너 (실제 이미지) ───
  await prisma.banner.createMany({
    data: [
      {
        title: "셀러가 직접 고른 오늘의 추천",
        subtitle: "인플루언서가 직접 큐레이션한 특별한 딜",
        imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=900&fit=crop",
        linkUrl: "/search",
        position: "hero",
        sortOrder: 0,
        isActive: true,
      },
      {
        title: "이번 주 베스트 상품",
        subtitle: "놓치면 후회할 역대급 특가",
        imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=900&fit=crop",
        linkUrl: "/search",
        position: "hero",
        sortOrder: 1,
        isActive: true,
      },
      {
        title: "셀러 입점 안내",
        subtitle: "나만의 샵을 오픈하고 팬과 함께 성장하세요",
        imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=900&fit=crop",
        linkUrl: "/auth/register",
        position: "hero",
        sortOrder: 2,
        isActive: true,
      },
    ],
  });

  // ─── 콘텐츠 포스트 (실제 이미지) + 쇼핑 태그 10개 ───
  // 하늘 Pick - 스트릿 패션 콘텐츠 4개
  const content1 = await prisma.contentPost.create({
    data: {
      sellerId: seller1.id,
      title: "봄 오피스룩 스타일링 3가지",
      content: "미니멀하면서도 세련된 봄 오피스룩을 소개합니다. 블레이저 하나로 완성하는 데일리 룩!",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[0].id, products[1].id]),
      hashtags: JSON.stringify(["#봄코디", "#오피스룩", "#블레이저", "#데일리룩"]),
      isPublished: true,
      isApproved: true,
      viewCount: 1240,
      likeCount: 89,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content1.id, productId: products[0].id, imageIndex: 0, posX: 45, posY: 35, label: "오버핏 블레이저" },
      { contentId: content1.id, productId: products[1].id, imageIndex: 0, posX: 50, posY: 72, label: "와이드 슬랙스" },
    ],
  });

  const content2 = await prisma.contentPost.create({
    data: {
      sellerId: seller1.id,
      title: "캐주얼 데님 스트릿 룩 🔥",
      content: "스트릿 감성의 데님 코디. 빈티지 워싱 데님에 크롭 자켓 매치!",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[5].id, products[6].id]),
      hashtags: JSON.stringify(["#스트릿룩", "#데님코디", "#빈티지", "#크롭자켓"]),
      isPublished: true,
      isApproved: true,
      viewCount: 2340,
      likeCount: 176,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content2.id, productId: products[5].id, imageIndex: 0, posX: 48, posY: 65, label: "스트레이트 데님" },
      { contentId: content2.id, productId: products[6].id, imageIndex: 0, posX: 42, posY: 30, label: "크롭 트위드 자켓" },
      { contentId: content2.id, productId: products[9].id, imageIndex: 1, posX: 55, posY: 25, label: "골드 이어링 세트" },
    ],
  });

  const content3 = await prisma.contentPost.create({
    data: {
      sellerId: seller1.id,
      title: "모자 코디 완전정복 🧢",
      content: "모자 하나로 분위기 전환! 캡, 버킷햇, 비니 등 다양한 스타일링 팁.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1556306535-0f09a537f0a3?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[4].id, products[7].id]),
      hashtags: JSON.stringify(["#모자코디", "#액세서리", "#캡모자", "#스타일링팁"]),
      isPublished: true,
      isApproved: true,
      viewCount: 890,
      likeCount: 67,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content3.id, productId: products[4].id, imageIndex: 0, posX: 50, posY: 40, label: "니트 카디건" },
      { contentId: content3.id, productId: products[7].id, imageIndex: 1, posX: 40, posY: 35, label: "실크 블라우스" },
    ],
  });

  const content4 = await prisma.contentPost.create({
    data: {
      sellerId: seller1.id,
      title: "미니멀 액세서리 레이어링",
      content: "심플한 골드 액세서리로 완성하는 세련된 레이어링 스타일링.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[9].id, products[8].id]),
      hashtags: JSON.stringify(["#액세서리", "#골드주얼리", "#레이어링", "#미니멀"]),
      isPublished: true,
      isApproved: true,
      viewCount: 560,
      likeCount: 45,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content4.id, productId: products[9].id, imageIndex: 0, posX: 35, posY: 30, label: "골드 이어링 세트" },
      { contentId: content4.id, productId: products[8].id, imageIndex: 0, posX: 55, posY: 55, label: "캐시미어 머플러" },
    ],
  });

  // 수아 뷰티랩 - 뷰티 콘텐츠 3개
  const content5 = await prisma.contentPost.create({
    data: {
      sellerId: seller2.id,
      title: "피부 타입별 스킨케어 루틴 ✨",
      content: "건성, 지성, 복합성 피부별 최적의 스킨케어 루틴을 소개합니다.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[10].id, products[11].id, products[12].id]),
      hashtags: JSON.stringify(["#스킨케어", "#루틴", "#뷰티팁", "#피부관리"]),
      isPublished: true,
      isApproved: true,
      viewCount: 3450,
      likeCount: 234,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content5.id, productId: products[10].id, imageIndex: 0, posX: 30, posY: 45, label: "글로우 세럼 파운데이션" },
      { contentId: content5.id, productId: products[11].id, imageIndex: 0, posX: 65, posY: 50, label: "비타민C 앰플" },
      { contentId: content5.id, productId: products[12].id, imageIndex: 1, posX: 50, posY: 40, label: "수분크림" },
    ],
  });

  const content6 = await prisma.contentPost.create({
    data: {
      sellerId: seller2.id,
      title: "데일리 립 메이크업 팁 💄",
      content: "MLBB 컬러로 자연스럽게! 데일리 립 메이크업 3가지 방법.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1583241800698-e8ab01830e10?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[13].id]),
      hashtags: JSON.stringify(["#립메이크업", "#MLBB", "#데일리메이크업", "#틴트"]),
      isPublished: true,
      isApproved: true,
      viewCount: 1780,
      likeCount: 156,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content6.id, productId: products[13].id, imageIndex: 0, posX: 50, posY: 60, label: "내추럴 립 틴트 세트" },
    ],
  });

  const content7 = await prisma.contentPost.create({
    data: {
      sellerId: seller2.id,
      title: "클렌징 & 세럼 나잇 루틴 🌙",
      content: "잠들기 전 꼭 해야 할 스킨케어 루틴. 클렌징부터 세럼까지!",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[14].id, products[11].id]),
      hashtags: JSON.stringify(["#나잇루틴", "#클렌징", "#세럼", "#스킨케어루틴"]),
      isPublished: true,
      isApproved: true,
      viewCount: 2100,
      likeCount: 189,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content7.id, productId: products[14].id, imageIndex: 0, posX: 40, posY: 50, label: "로즈힙 클렌징 오일" },
      { contentId: content7.id, productId: products[11].id, imageIndex: 1, posX: 55, posY: 45, label: "비타민C 앰플" },
    ],
  });

  // 지은의 라이프로그 - 라이프스타일 콘텐츠 3개
  const content8 = await prisma.contentPost.create({
    data: {
      sellerId: seller3.id,
      title: "집에서 즐기는 코지 라이프 🕯️",
      content: "향초와 디퓨저로 만드는 나만의 아늑한 공간. 겨울 집콕 필수템!",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[15].id, products[17].id]),
      hashtags: JSON.stringify(["#홈리빙", "#향초", "#디퓨저", "#코지라이프"]),
      isPublished: true,
      isApproved: true,
      viewCount: 1560,
      likeCount: 98,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content8.id, productId: products[15].id, imageIndex: 0, posX: 35, posY: 55, label: "아로마 디퓨저" },
      { contentId: content8.id, productId: products[17].id, imageIndex: 0, posX: 65, posY: 40, label: "핸드메이드 캔들" },
    ],
  });

  const content9 = await prisma.contentPost.create({
    data: {
      sellerId: seller3.id,
      title: "내추럴 홈 데스크 셋업 🏠",
      content: "미니멀하고 감성적인 홈 오피스 데스크 셋업. 작업 효율도 올리고 인테리어도 살리고!",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[20].id]),
      hashtags: JSON.stringify(["#데스크셋업", "#홈오피스", "#인테리어", "#미니멀라이프"]),
      isPublished: true,
      isApproved: true,
      viewCount: 780,
      likeCount: 56,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content9.id, productId: products[20].id, imageIndex: 0, posX: 50, posY: 50, label: "데스크 오거나이저" },
    ],
  });

  const content10 = await prisma.contentPost.create({
    data: {
      sellerId: seller3.id,
      title: "주말 브런치 테이블 세팅 🥐",
      content: "린넨 앞치마와 함께하는 감성 브런치 타임. 소소한 행복이 가득한 주말 아침!",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=800&fit=crop",
      ]),
      productTags: JSON.stringify([products[21].id, products[16].id]),
      hashtags: JSON.stringify(["#브런치", "#홈카페", "#주말루틴", "#테이블세팅"]),
      isPublished: true,
      isApproved: true,
      viewCount: 430,
      likeCount: 34,
    },
  });
  await prisma.shoppingTag.createMany({
    data: [
      { contentId: content10.id, productId: products[21].id, imageIndex: 0, posX: 50, posY: 45, label: "린넨 앞치마" },
      { contentId: content10.id, productId: products[16].id, imageIndex: 1, posX: 45, posY: 55, label: "오가닉 코튼 파자마" },
    ],
  });

  // ─── 리뷰 ───
  const reviewData = [
    { userId: buyers[0].id, productId: products[0].id, rating: 5, content: "핏이 정말 예뻐요! 하늘님 추천대로 사길 잘했습니다. 소재도 좋고 어디에나 매치하기 좋아요." },
    { userId: buyers[1].id, productId: products[1].id, rating: 4, content: "다리가 길어보여요! 웨이스트 핏이 딱 좋고 편안합니다. 한 사이즈 업 추천!" },
    { userId: buyers[2].id, productId: products[10].id, rating: 5, content: "수아님 말대로 정말 촉촉하고 커버력 최고입니다. 이 가격에 이 퀄리티라니!" },
    { userId: buyers[3].id, productId: products[15].id, rating: 5, content: "향이 은은하고 오래 갑니다. 거실에 두니까 분위기가 확 달라져요." },
    { userId: buyers[4].id, productId: products[11].id, rating: 4, content: "꾸준히 쓰니까 피부톤이 밝아진 느낌! 향이 조금 있지만 금방 사라져요." },
  ];
  for (const r of reviewData) {
    await prisma.review.create({ data: r });
  }

  console.log("✅ 시드 데이터 생성 완료!");
  console.log("  - 관리자: admin@vanillaform.local / password123");
  console.log("  - 브랜드1: brand1@vanillaform.local / password123");
  console.log("  - 브랜드2: brand2@vanillaform.local / password123");
  console.log("  - 셀러1: seller1@vanillaform.local / password123 (하늘 Pick)");
  console.log("  - 셀러2: seller2@vanillaform.local / password123 (수아 뷰티랩)");
  console.log("  - 셀러3: seller3@vanillaform.local / password123 (지은의 라이프로그)");
  console.log("  - 셀러4: seller4@vanillaform.local / password123 (혜선 Picks, 수수료율 7%)");
  console.log("  - 구매회원: buyer1~5@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
