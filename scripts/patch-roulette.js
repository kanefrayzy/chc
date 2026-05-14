const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../apps/api/src/modules/roulette/roulette.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: ROLLING_DURATION_MS default value
content = content.replace(
  /const ROLLING_DURATION_MS = Number\(process\.env\.ROULETTE_ROLLING_MS \|\| 1_500\);/,
  'const ROLLING_DURATION_MS = Number(process.env.ROULETTE_ROLLING_MS || 10_500);'
);

// Fix 2: Calculate winningSlot at ROLLING start
const oldRollingTransition = `      const rolling = await this.prisma.rouletteRound.update({
        where: { id: round.id },
        data: { status: 'ROLLING', publicSeed: generatePublicSeed() },
      });`;

const newRollingTransition = `      // Рассчитываем результат сразу при старте ROLLING, чтобы клиент мог
      // анимировать барабан с реальным winningSlot, не дожидаясь COMPLETED.
      // Выплаты происходят только при COMPLETED (после анимации).
      const publicSeed = generatePublicSeed();
      const serverSeed = round.serverSeed!;
      const slot = pickSlot(serverSeed, publicSeed, ROULETTE_TOTAL_SLOTS);
      const color = slotToColor(slot);
      const rolling = await this.prisma.rouletteRound.update({
        where: { id: round.id },
        data: { status: 'ROLLING', publicSeed, winningSlot: slot, winningColor: color },
      });`;

if (content.includes(oldRollingTransition)) {
  content = content.replace(oldRollingTransition, newRollingTransition);
  console.log('Fix 2 applied successfully');
} else {
  console.log('Fix 2: pattern not found!');
}

// Fix 3: In settleRound, use already-stored winningSlot instead of recalculating
const oldSettle = `    if (!round.serverSeed || !round.publicSeed) {
      this.logger.error(\`Round \${round.id} missing seeds; cancelling\`);
      await this.cancelRound(round.id);
      return;
    }
    const slot = pickSlot(round.serverSeed, round.publicSeed, ROULETTE_TOTAL_SLOTS);
    const color = slotToColor(slot);`;

const newSettle = `    // winningSlot и winningColor уже были рассчитаны и сохранены при переходе в ROLLING.
    // Здесь только обрабатываем выплаты.
    if (round.winningSlot === null || round.winningSlot === undefined || !round.winningColor) {
      this.logger.error(\`Round \${round.id} missing winningSlot/winningColor; cancelling\`);
      await this.cancelRound(round.id);
      return;
    }
    const slot = round.winningSlot;
    const color = round.winningColor;`;

if (content.includes(oldSettle)) {
  content = content.replace(oldSettle, newSettle);
  console.log('Fix 3 applied successfully');
} else {
  console.log('Fix 3: pattern not found - checking partial...');
  if (content.includes('pickSlot(round.serverSeed, round.publicSeed')) {
    console.log('pickSlot line found, manual fix needed');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done! Roulette service patched.');
