// seed-node.ts - idempotent (raw SQL for new fields/models)
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NODES = [
  { email: "node@vanillaform.local",  password: "Node1234!", name: "노드관리A" },
  { email: "node2@vanillaform.local", password: "Node1234!", name: "노드관리B" },
];

const MIDDLES = [
  { email: "middle1@vanillaform.local", password: "Middle1234!", name: "중간관리자1", nodeIdx: 0 },
  { email: "middle2@vanillaform.local", password: "Middle1234!", name: "중간관리자2", nodeIdx: 0 },
  { email: "middle3@vanillaform.local", password: "Middle1234!", name: "중간관리자3", nodeIdx: 0 },
  { email: "middle4@vanillaform.local", password: "Middle1234!", name: "중간관리자4", nodeIdx: 1 },
  { email: "middle5@vanillaform.local", password: "Middle1234!", name: "중간관리자5", nodeIdx: 1 },
];

function cuid() {
  return "c" + Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
}

async function main() {
  console.log("🟡 노드 시스템 시드 시작...");

  const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true, email: true } });
  if (!adminUser) console.warn("  SUPER_ADMIN 없음 -- ManualSettlement 건너뜀");
  else console.log("  SUPER_ADMIN:", adminUser.email);

  // 1) NODE upsert
  const nodeUsers: { id: string; email: string }[] = [];
  for (const n of NODES) {
    const hashed = await bcrypt.hash(n.password, 10);
    const u = await prisma.user.upsert({
      where: { email: n.email },
      update: { name: n.name, role: "NODE", isActive: true },
      create: { email: n.email, name: n.name, password: hashed, role: "NODE", isActive: true },
    });
    nodeUsers.push({ id: u.id, email: u.email });
    console.log("  NODE:", u.email, u.id);
  }

  // 2) MIDDLE_ADMIN + MiddleAdminProfile (camelCase columns)
  const middleProfiles: { id: string; name: string }[] = [];
  for (const m of MIDDLES) {
    const hashed = await bcrypt.hash(m.password, 10);
    const assignedNodeId = nodeUsers[m.nodeIdx]?.id ?? null;
    const u = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name, role: "MIDDLE_ADMIN", isActive: true },
      create: { email: m.email, name: m.name, password: hashed, role: "MIDDLE_ADMIN", isActive: true },
    });

    const existing = await prisma.middleAdminProfile.findUnique({ where: { userId: u.id } });
    let profileId: string;
    if (existing) {
      profileId = existing.id;
      await prisma.$executeRaw`UPDATE middle_admin_profiles SET name=${m.name}, assignedNodeId=${assignedNodeId}, isActive=1, isApproved=1 WHERE id=${profileId}`;
    } else {
      profileId = cuid();
      const now = new Date();
      await prisma.$executeRaw`INSERT INTO middle_admin_profiles (id, userId, name, assignedNodeId, isActive, isApproved, commissionRate, createdAt, updatedAt) VALUES (${profileId}, ${u.id}, ${m.name}, ${assignedNodeId}, 1, 1, 5.00, ${now}, ${now})`;
    }
    middleProfiles.push({ id: profileId, name: m.name });
    console.log("  MIDDLE:", u.email, "->", assignedNodeId, "profileId=", profileId);
  }

  // 3) NodeSettlement
  const nodeSettle = [
    { nodeIdx: 0, periodLabel: "2025년 11월", totalAmount: 350000, status: "PAID",     memo: "11월 완료",  paidAt: new Date("2025-12-05") },
    { nodeIdx: 0, periodLabel: "2025년 12월", totalAmount: 480000, status: "APPROVED", memo: "12월 승인",  paidAt: null },
    { nodeIdx: 1, periodLabel: "2025년 11월", totalAmount: 220000, status: "PAID",     memo: null,         paidAt: new Date("2025-12-05") },
    { nodeIdx: 1, periodLabel: "2025년 12월", totalAmount: 310000, status: "PENDING",  memo: "확인 필요", paidAt: null },
    { nodeIdx: 0, periodLabel: "2026년 1월",  totalAmount: 520000, status: "PENDING",  memo: null,         paidAt: null },
  ];
  for (const d of nodeSettle) {
    const nodeUserId = nodeUsers[d.nodeIdx]?.id;
    if (!nodeUserId) continue;
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM node_settlements WHERE nodeUserId=${nodeUserId} AND periodLabel=${d.periodLabel}`;
    if (rows.length === 0) {
      const id = cuid();
      const now = new Date();
      await prisma.$executeRaw`INSERT INTO node_settlements (id, nodeUserId, periodLabel, totalAmount, status, memo, paidAt, createdAt, updatedAt) VALUES (${id}, ${nodeUserId}, ${d.periodLabel}, ${d.totalAmount}, ${d.status}, ${d.memo}, ${d.paidAt}, ${now}, ${now})`;
      console.log("  NodeSettlement:", d.periodLabel, d.totalAmount, d.status);
    } else {
      console.log("  (존재) NodeSettlement:", d.periodLabel);
    }
  }

  // 4) MiddleManagerSettlement
  const mmSettle = [
    { profileIdx: 0, periodLabel: "2025년 11월", totalAmount: 120000, status: "PAID",     paidAt: new Date("2025-12-10") },
    { profileIdx: 1, periodLabel: "2025년 11월", totalAmount:  95000, status: "PAID",     paidAt: new Date("2025-12-10") },
    { profileIdx: 2, periodLabel: "2025년 12월", totalAmount: 150000, status: "APPROVED", paidAt: null },
    { profileIdx: 3, periodLabel: "2025년 11월", totalAmount:  75000, status: "PAID",     paidAt: new Date("2025-12-10") },
    { profileIdx: 4, periodLabel: "2025년 12월", totalAmount:  88000, status: "PENDING",  paidAt: null },
  ];
  for (const d of mmSettle) {
    const profile = middleProfiles[d.profileIdx];
    if (!profile) continue;
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM middle_manager_settlements WHERE middleAdminId=${profile.id} AND periodLabel=${d.periodLabel}`;
    if (rows.length === 0) {
      const id = cuid();
      const now = new Date();
      await prisma.$executeRaw`INSERT INTO middle_manager_settlements (id, middleAdminId, periodLabel, totalAmount, status, paidAt, createdAt, updatedAt) VALUES (${id}, ${profile.id}, ${d.periodLabel}, ${d.totalAmount}, ${d.status}, ${d.paidAt}, ${now}, ${now})`;
      console.log("  MiddleManagerSettlement:", profile.name, d.periodLabel, d.totalAmount);
    } else {
      console.log("  (존재) MiddleManagerSettlement:", profile.name, d.periodLabel);
    }
  }

  // 5) ManualSettlement
  if (adminUser) {
    const manual = [
      { recipientType: "NODE",         recipientId: nodeUsers[0]?.id,      amount: 100000, memo: "노드A 수기 정산" },
      { recipientType: "MIDDLE_ADMIN", recipientId: middleProfiles[0]?.id,  amount:  50000, memo: "중간관리자1 수기 정산" },
      { recipientType: "NODE",         recipientId: nodeUsers[1]?.id,      amount:  80000, memo: "노드B 수기 정산" },
    ];
    for (const d of manual) {
      if (!d.recipientId) continue;
      const rows = await prisma.$queryRaw<any[]>`SELECT id FROM manual_settlements WHERE recipientId=${d.recipientId} AND memo=${d.memo}`;
      if (rows.length === 0) {
        const id = cuid();
        const now = new Date();
        await prisma.$executeRaw`INSERT INTO manual_settlements (id, recipientType, recipientId, amount, memo, status, paidAt, adminId, createdAt) VALUES (${id}, ${d.recipientType}, ${d.recipientId}, ${d.amount}, ${d.memo}, 'PAID', ${now}, ${adminUser.id}, ${now})`;
        console.log("  ManualSettlement:", d.recipientType, d.amount);
      } else {
        console.log("  (존재) ManualSettlement:", d.memo);
      }
    }
  }

  // 6) SystemConfig
  await prisma.systemConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1, nodeEnabled: true } });
  console.log("  SystemConfig OK");
  console.log("✅ 노드 시스템 시드 완료");
}

main().catch((e) => { console.error("❌", e.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
