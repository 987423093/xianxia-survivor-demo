import { ENEMY_SPRITE_SCALE, PLAYER_SPRITE_SCALE } from "../resources/assets.js";

export function createRenderer({
  canvas,
  ctx,
  game,
  theme,
  pointer,
  clamp,
  rand,
  positiveModulo,
  realmIndex,
  currencyConfig,
  effectiveBossSkill,
  getBossEnemy,
  getAsset,
  loadImageAsset,
  drawImageCentered,
  drawSpriteFitted,
  canUseGeometryFallback,
}) {
  function drawGrid(rect) {
    const bg = getAsset("background");
    const fallbackBg = getAsset("background:fallback");
    const background = bg || fallbackBg;
    ctx.fillStyle = theme.background?.tint || "#202832";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (background) {
      drawTiledBackground(background, rect, bg ? 0.7 : 0.38);
    }
    drawGroundMotifs(rect);
  }

  function drawTiledBackground(background, rect, alpha) {
    const configuredScale = theme.background?.tileScale;
    const scale = configuredScale ?? clamp(rect.height / background.height, 0.58, 0.78);
    const width = Math.max(1, background.width * scale);
    const height = Math.max(1, background.height * scale);
    const offsetX = rect.width / 2 - width / 2 - positiveModulo(game.camera.x, width);
    const offsetY = rect.height / 2 - height / 2 - positiveModulo(game.camera.y, height);

    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = offsetX; x < rect.width; x += width) {
      for (let y = offsetY; y < rect.height; y += height) {
        ctx.drawImage(background, x, y, width, height);
      }
    }
    ctx.restore();
  }

  function drawWorldReferenceTexture(rect) {
    const minor = 160;
    const major = 320;
    const offsetX = positiveModulo(-game.camera.x + rect.width / 2, minor);
    const offsetY = positiveModulo(-game.camera.y + rect.height / 2, minor);
    ctx.save();
    ctx.lineWidth = 1;
    for (let x = offsetX - minor; x < rect.width + minor; x += minor) {
      const worldX = Math.round(game.camera.x - rect.width / 2 + x);
      const isMajor = Math.abs(positiveModulo(worldX, major)) < 2;
      ctx.strokeStyle = isMajor ? "rgba(185, 231, 255, 0.12)" : "rgba(185, 231, 255, 0.055)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = offsetY - minor; y < rect.height + minor; y += minor) {
      const worldY = Math.round(game.camera.y - rect.height / 2 + y);
      const isMajor = Math.abs(positiveModulo(worldY, major)) < 2;
      ctx.strokeStyle = isMajor ? "rgba(244, 215, 120, 0.105)" : "rgba(244, 215, 120, 0.05)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function motifHash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function drawGroundMotifs(rect) {
    const cell = 280;
    const left = game.camera.x - rect.width / 2;
    const top = game.camera.y - rect.height / 2;
    const startX = Math.floor(left / cell) - 1;
    const endX = Math.floor((game.camera.x + rect.width / 2) / cell) + 1;
    const startY = Math.floor(top / cell) - 1;
    const endY = Math.floor((game.camera.y + rect.height / 2) / cell) + 1;

    for (let gx = startX; gx <= endX; gx += 1) {
      for (let gy = startY; gy <= endY; gy += 1) {
        const h = motifHash(gx, gy);
        if (h < 0.34) continue;
        const worldX = gx * cell + cell * (0.18 + motifHash(gx + 13, gy) * 0.64);
        const worldY = gy * cell + cell * (0.2 + motifHash(gx, gy + 17) * 0.6);
        const screenX = worldX - game.camera.x + rect.width / 2;
        const screenY = worldY - game.camera.y + rect.height / 2;
        const radius = 5 + h * 9;
        ctx.strokeStyle = h > 0.72 ? "rgba(142, 247, 255, 0.16)" : "rgba(255, 238, 188, 0.12)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, radius * 1.6, radius * 0.58, h * Math.PI, 0, Math.PI * 2);
        ctx.stroke();
        if (h > 0.82) {
          ctx.fillStyle = "rgba(255, 238, 188, 0.16)";
          ctx.beginPath();
          ctx.arc(screenX, screenY, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function toScreen(entity, rect) {
    return {
      x: entity.x - game.camera.x + rect.width / 2,
      y: entity.y - game.camera.y + rect.height / 2,
    };
  }

  function colorToRgb(color) {
    const fallback = { r: 142, g: 247, b: 255 };
    if (!color || !color.startsWith("#")) return fallback;
    const hex = color.slice(1);
    if (hex.length !== 6) return fallback;
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  function rgba(color, alpha) {
    const { r, g, b } = colorToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawRealmAura(p, realm, size) {
    if (!theme.heroRealms) return;
    const color = realm?.auraColor || "#8ef7ff";
    const pulse = Math.sin(performance.now() / 240) * 0.5 + 0.5;
    const fx = game.breakthroughFx;
    const fxProgress = fx ? clamp(fx.age / fx.life, 0, 1) : 1;
    const fxBoost = fx ? (1 - fxProgress) : 0;
    const base = size * (0.42 + fxBoost * 0.08);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + fxBoost * 18;

    const gradient = ctx.createRadialGradient(0, size * 0.18, base * 0.2, 0, size * 0.2, base * 1.35);
    gradient.addColorStop(0, rgba(color, 0.24 + pulse * 0.08));
    gradient.addColorStop(0.58, rgba(color, 0.09));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.24, base * 1.35, base * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(color, 0.42 + pulse * 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.24, base * 1.02, base * 0.27, 0, 0, Math.PI * 2);
    ctx.stroke();

    const style = realm?.auraStyle;
    if (style === "golden-core" || style === "double-ring" || style === "dharma") {
      ctx.rotate(performance.now() / 1400);
      ctx.strokeStyle = rgba(color, 0.34);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.46, size * 0.62, -0.58, 0, Math.PI * 2);
      ctx.stroke();
      if (style === "double-ring" || style === "dharma") {
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.58, size * 0.42, 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (style === "thunder") {
      ctx.strokeStyle = rgba(color, 0.55);
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i += 1) {
        const angle = performance.now() / 380 + i * Math.PI * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * size * 0.24, Math.sin(angle) * size * 0.24);
        ctx.lineTo(Math.cos(angle + 0.24) * size * 0.52, Math.sin(angle + 0.24) * size * 0.52);
        ctx.lineTo(Math.cos(angle - 0.18) * size * 0.68, Math.sin(angle - 0.18) * size * 0.68);
        ctx.stroke();
      }
    }
    if (style === "ascension") {
      ctx.strokeStyle = rgba(color, 0.42);
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * size * 0.18, size * 0.14);
        ctx.quadraticCurveTo(side * size * 0.55, -size * 0.22, side * size * 0.36, -size * 0.58);
        ctx.stroke();
      }
    }
    if (fx) {
      ctx.shadowBlur = 22;
      ctx.strokeStyle = rgba(color, 0.68 * (1 - fxProgress));
      ctx.lineWidth = 4 * (1 - fxProgress) + 1;
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.42 + fxProgress * 0.92), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    if (fx) {
      ctx.save();
      ctx.globalAlpha = 1 - fxProgress;
      ctx.font = `700 ${Math.round(15 + 6 * (1 - fxProgress))}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.lineWidth = 4;
      ctx.fillStyle = color;
      ctx.strokeText(fx.label, p.x, p.y - size * (0.74 + fxProgress * 0.28));
      ctx.fillText(fx.label, p.x, p.y - size * (0.74 + fxProgress * 0.28));
      ctx.restore();
    }
  }

  function drawPlayer(rect) {
    const p = toScreen(game.player, rect);
    const pulse = game.player.invincible > 0 ? Math.sin(performance.now() / 40) * 0.28 + 0.72 : 1;
    const heroIndex = realmIndex(game.player.level);
    const realm = theme.heroRealms?.[heroIndex];
    if (realm?.asset) loadImageAsset(`hero:${heroIndex}`, realm.asset);
    const fxProgress = game.breakthroughFx ? clamp(game.breakthroughFx.age / game.breakthroughFx.life, 0, 1) : 1;
    const fxScale = game.breakthroughFx ? 1 + Math.sin((1 - fxProgress) * Math.PI) * 0.18 : 1;
    const heroSize = game.player.radius * PLAYER_SPRITE_SCALE * fxScale;
    drawRealmAura(p, realm, heroSize);
    if (game.player.dashDuration > 0) {
      const progress = clamp(game.player.dashDuration / game.player.dashDurationMax, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = rgba("#b9f3ff", 0.22 + progress * 0.36);
      ctx.fillStyle = rgba("#b9f3ff", 0.08 + progress * 0.12);
      ctx.lineWidth = 2;
      ctx.shadowColor = "#b9f3ff";
      ctx.shadowBlur = 18;
      for (let i = 1; i <= 3; i += 1) {
        const x = p.x - game.player.dashDir.x * i * 20;
        const y = p.y - game.player.dashDir.y * i * 20;
        ctx.beginPath();
        ctx.ellipse(x, y, game.player.radius * (1.25 - i * 0.16), game.player.radius * (0.62 - i * 0.08), Math.atan2(game.player.dashDir.y, game.player.dashDir.x), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    drawPlayerEquipmentLayers(p, "under");
    const sprite = getAsset(`hero:${heroIndex}`) || getAsset("player");
    if (sprite) {
      drawSpriteFitted(getAsset(`hero:${heroIndex}`) ? `hero:${heroIndex}` : "player", p.x, p.y, heroSize, {
        alpha: pulse,
        shadowColor: realm?.auraColor || "#8ef7ff",
        shadowBlur: 12,
      });
    } else if (canUseGeometryFallback(theme.player.asset)) {
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = theme.player.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, game.player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1d1f26";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = theme.player.tieColor;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 2);
    ctx.lineTo(p.x - 5, p.y + 16);
    ctx.lineTo(p.x + 5, p.y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1d1f26";
    ctx.fillRect(p.x - 16, p.y - 26, 32, 8);
    ctx.restore();
    }
    drawPlayerEquipmentLayers(p, "over");

    if (game.player.dashCooldown <= 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(185, 243, 255, 0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, game.player.radius + 10 + Math.sin(performance.now() / 220) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = "rgba(85, 200, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, game.player.pickupRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPlayerEquipmentLayers(p, layer) {
    if (!theme.equipmentSlots) return;
    const order = Object.keys(theme.equipmentSlots).filter((slot) => (theme.equipmentSlots[slot].layer || "over") === layer);
    const time = performance.now();
    for (const slot of order) {
      const slotConfig = theme.equipmentSlots[slot];
      const tier = game.equipment?.[slot]?.tier || 0;
      if (!tier) continue;
      const key = `equip:${slot}:${tier}`;
      const asset = slotConfig.assets?.[tier - 1];
      if (asset) loadImageAsset(key, asset);
      const image = getAsset(key);
      if (!image) continue;
      const strength = 0.72 + tier * 0.16;
      const anchor = slotConfig.anchor || { x: 0, y: 0 };
      const bob = slot === "artifact" || slot === "talisman" ? Math.sin(time / 360 + tier) * (2 + tier) : 0;
      const orbit = slot === "artifact" ? Math.sin(time / 520) * 6 : 0;
      const x = p.x + anchor.x + orbit;
      const y = p.y + anchor.y + bob;
      const size = game.player.radius * PLAYER_SPRITE_SCALE * (slotConfig.renderScale || 0.65) * strength;
      const color = tier >= 3 ? "#fff6bf" : tier === 2 ? "#b9f3ff" : "#8dffba";

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = rgba(color, 0.34 + tier * 0.08);
      ctx.lineWidth = 1.4 + tier * 0.45;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + tier * 4;
      if (slot === "boots") {
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.14, size * 0.62, size * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (slot === "crown") {
        ctx.beginPath();
        ctx.arc(x, y - size * 0.1, size * 0.46, 0, Math.PI * 2);
        ctx.stroke();
      } else if (slot === "artifact" || slot === "talisman") {
        ctx.beginPath();
        ctx.arc(x, y, size * (slot === "artifact" ? 0.5 : 0.42), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (tier >= 3) {
        ctx.globalAlpha = 0.34 + Math.sin(time / 180) * 0.12;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.58, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      drawSpriteFitted(key, x, y, size, {
        rotation: slot === "artifact" ? Math.sin(time / 650) * 0.18 : 0,
        shadowColor: color,
        shadowBlur: 12 + tier * 3,
        alpha: slot === "robe" ? 0.54 + tier * 0.08 : 0.95,
        clip: true,
        clipScaleX: slot === "robe" ? 0.42 : slot === "boots" ? 0.48 : 0.5,
        clipScaleY: slot === "robe" ? 0.46 : slot === "boots" ? 0.34 : 0.5,
      });
    }
  }

  function drawBossAura(enemy, p) {
    const mechanics = enemy.type === "boss" ? game.chapter?.bossMechanics : null;
    if (!mechanics) return;
    const color = mechanics.auraColor || enemy.color || "#f4d778";
    const phase = game.bossRuntime?.enemyId === enemy.id ? game.bossRuntime.phase : 0;
    const time = performance.now();
    const pulse = Math.sin(time / 240) * 0.5 + 0.5;
    const base = enemy.radius * (2.0 + phase * 0.26);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 + phase * 7;

    const gradient = ctx.createRadialGradient(p.x, p.y + enemy.radius * 0.55, base * 0.18, p.x, p.y + enemy.radius * 0.55, base * 1.12);
    gradient.addColorStop(0, rgba(color, 0.25 + pulse * 0.08));
    gradient.addColorStop(0.58, rgba(color, 0.1));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + enemy.radius * 0.72, base * 1.08, base * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(color, 0.44 + pulse * 0.16);
    ctx.lineWidth = 2.4 + phase * 0.8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + enemy.radius * 0.72, base * 0.82, base * 0.24, time / 900, 0, Math.PI * 2);
    ctx.stroke();

    ctx.translate(p.x, p.y + enemy.radius * 0.72);
    ctx.rotate(time / (mechanics.sigil === "thunder" ? 620 : 1200));
    ctx.strokeStyle = rgba(color, 0.4 + phase * 0.08);
    ctx.lineWidth = 1.6 + phase * 0.5;
    const spokes = mechanics.sigil === "claw" ? 5 : mechanics.sigil === "array" ? 8 : mechanics.sigil === "blood" ? 6 : 9;
    for (let i = 0; i < spokes; i += 1) {
      const angle = (Math.PI * 2 * i) / spokes;
      const inner = base * (mechanics.sigil === "blood" ? 0.16 : 0.24);
      const outer = base * (mechanics.sigil === "thunder" ? 0.74 : 0.62);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.42);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.42);
      ctx.stroke();
    }
    if (mechanics.sigil === "thunder") {
      ctx.strokeStyle = rgba("#ffffff", 0.32 + pulse * 0.18);
      for (let i = 0; i < 4; i += 1) {
        const angle = time / 260 + i * Math.PI * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * base * 0.18, Math.sin(angle) * base * 0.08);
        ctx.lineTo(Math.cos(angle + 0.18) * base * 0.42, Math.sin(angle + 0.18) * base * 0.2);
        ctx.lineTo(Math.cos(angle - 0.16) * base * 0.7, Math.sin(angle - 0.16) * base * 0.33);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBossNameplate(enemy, p) {
    if (enemy.type !== "boss") return;
    const mechanics = game.chapter?.bossMechanics || {};
    const color = mechanics.auraColor || enemy.color || "#f4d778";
    const phase = game.bossRuntime?.enemyId === enemy.id ? game.bossRuntime.phase : 0;
    const y = p.y - enemy.radius * 2.24;
    const width = Math.max(116, enemy.name.length * 17 + 46);
    ctx.save();
    ctx.fillStyle = "rgba(12, 13, 18, 0.72)";
    ctx.strokeStyle = rgba(color, 0.62);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(p.x - width / 2, y - 15, width, 30, 7);
    ctx.fill();
    ctx.stroke();
    ctx.font = "800 15px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.78)";
    ctx.lineWidth = 4;
    ctx.fillStyle = color;
    const label = phase ? `${enemy.name} · ${phase + 1}相` : enemy.name;
    ctx.strokeText(label, p.x, y);
    ctx.fillText(label, p.x, y);
    ctx.restore();
  }

  function drawEnemy(enemy, rect) {
    const p = toScreen(enemy, rect);
    drawBossAura(enemy, p);
    if (enemy.affix) {
      const pulse = Math.sin(performance.now() / 180 + enemy.id) * 0.5 + 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = rgba(enemy.affix.color, 0.36 + pulse * 0.24);
      ctx.lineWidth = 2;
      ctx.shadowColor = enemy.affix.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, enemy.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const sprite = getAsset(enemy.assetKey || `enemy:${enemy.type}`) || getAsset(`enemy:${enemy.type}`);
    const bossScale = enemy.type === "boss" ? game.chapter?.bossMechanics?.displayScale || 1.28 : 1;
    if (sprite) {
      const key = enemy.assetKey || `enemy:${enemy.type}`;
      drawSpriteFitted(key, p.x, p.y, enemy.radius * ENEMY_SPRITE_SCALE * bossScale, {
        alpha: enemy.hitFlash > 0 ? 0.72 : 1,
        shadowColor: enemy.type === "boss" ? game.chapter?.bossMechanics?.auraColor || enemy.color : undefined,
        shadowBlur: enemy.type === "boss" ? 18 : 0,
      });
    } else if (canUseGeometryFallback(theme.enemies[enemy.type]?.asset)) {
      ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, enemy.radius * bossScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1d1f26";
      ctx.lineWidth = enemy.type === "boss" ? 5 : 3;
      ctx.stroke();
      ctx.fillStyle = "#1d1f26";
      ctx.fillRect(p.x - enemy.radius * 0.45, p.y - enemy.radius * 0.22, enemy.radius * 0.3, 4);
      ctx.fillRect(p.x + enemy.radius * 0.15, p.y - enemy.radius * 0.22, enemy.radius * 0.3, 4);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y + enemy.radius * 0.2, enemy.radius * 0.35, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    const hpWidth = enemy.type === "boss" ? enemy.radius * 3.25 : enemy.radius * 2;
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(p.x - hpWidth / 2, p.y - enemy.radius - 11, hpWidth, 4);
    ctx.fillStyle = "#f6e36b";
    ctx.fillRect(p.x - hpWidth / 2, p.y - enemy.radius - 11, hpWidth * clamp(enemy.hp / enemy.maxHp, 0, 1), 4);
    if (enemy.affix) {
      ctx.save();
      ctx.font = "800 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelWidth = Math.max(32, enemy.affix.name.length * 13);
      const labelY = p.y - enemy.radius - 24;
      ctx.fillStyle = "rgba(8, 13, 16, 0.72)";
      ctx.strokeStyle = rgba(enemy.affix.color, 0.72);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(p.x - labelWidth / 2, labelY - 9, labelWidth, 18, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = enemy.affix.color;
      ctx.fillText(enemy.affix.name, p.x, labelY);
      ctx.restore();
    }
    drawBossNameplate(enemy, p);
  }

  function drawProjectile(projectile, rect) {
    const p = toScreen(projectile, rect);
    const sprite = getAsset(`weapon:${projectile.type}`);
    if (sprite) {
      drawImageCentered(sprite, p.x, p.y, projectile.radius * 5.4, projectile.radius * 5.4, projectile.rotation);
      return;
    }
    if (!canUseGeometryFallback(theme.weapons[projectile.type]?.asset)) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(projectile.rotation);
    if (projectile.type === "invoice") {
      ctx.fillStyle = projectile.color || "#64d5ff";
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = "#f7f3e8";
      ctx.fillRect(-8, -4, 16, 3);
      ctx.fillRect(-8, 2, 12, 3);
    } else {
      ctx.fillStyle = "#f6f1d2";
      ctx.fillRect(-14, -5, 28, 10);
      ctx.fillStyle = "#8d9cff";
      ctx.fillRect(-10, -3, 18, 6);
    }
    ctx.restore();
  }

  function drawPickup(pickup, rect) {
    const p = toScreen(pickup, rect);
    if (pickup.type === "event") {
      const color = pickup.color || (pickup.eventType === "spring" ? "#8dffba" : "#f4d778");
      const pulse = 0.78 + Math.sin(performance.now() / 180 + pickup.id) * 0.14;
      const ttl = pickup.life ? clamp(1 - pickup.age / pickup.life, 0, 1) : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = rgba(color, 0.28 + ttl * 0.28);
      ctx.fillStyle = rgba(color, 0.12 + ttl * 0.12);
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pickup.radius * (1.7 + pulse * 0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      if (pickup.eventType === "spring") {
        ctx.beginPath();
        ctx.arc(p.x, p.y + 2, pickup.radius * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(247,243,232,0.86)";
        ctx.fillRect(p.x - 8, p.y - 2, 16, 3);
        ctx.fillRect(p.x - 2, p.y - 8, 4, 15);
      } else {
        ctx.beginPath();
        ctx.roundRect(p.x - pickup.radius * 0.72, p.y - pickup.radius * 0.52, pickup.radius * 1.44, pickup.radius * 1.08, 5);
        ctx.fill();
        ctx.strokeStyle = "rgba(80,52,10,0.72)";
        ctx.stroke();
        ctx.fillStyle = "rgba(80,52,10,0.72)";
        ctx.fillRect(p.x - 8, p.y - 2, 16, 4);
      }
      ctx.font = "800 12px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.lineWidth = 3;
      ctx.fillStyle = color;
      ctx.strokeText(pickup.label || "奇遇", p.x, p.y - pickup.radius * 2.2);
      ctx.fillText(pickup.label || "奇遇", p.x, p.y - pickup.radius * 2.2);
      ctx.restore();
      return;
    }
    if (pickup.type === "material") {
      const color = pickup.color || currencyConfig(pickup.currencyKey).color || "#f7f3e8";
      const pulse = 0.82 + Math.sin(performance.now() / 180 + pickup.id) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = rgba(color, 0.18);
      ctx.strokeStyle = rgba(color, 0.72);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pickup.radius * (1.45 + pulse * 0.12), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = rgba("#10131c", 0.92);
      ctx.beginPath();
      ctx.arc(p.x, p.y, pickup.radius * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "800 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pickup.iconText || pickup.label?.slice(0, 1) || "材", p.x, p.y + 0.5);
      if (pickup.value > 1) {
        ctx.fillStyle = "#f7f3e8";
        ctx.font = "700 10px Arial, sans-serif";
        ctx.fillText(`+${pickup.value}`, p.x, p.y - pickup.radius * 1.9);
      }
      ctx.restore();
      return;
    }
    const sprite = getAsset(`pickup:${pickup.type}`);
    if (sprite) {
      drawImageCentered(sprite, p.x, p.y, pickup.radius * 3.8, pickup.radius * 3.8);
      return;
    }
    const pickupAsset = pickup.type === "health" ? theme.pickups?.health?.asset : theme.pickups?.xp?.asset;
    if (!canUseGeometryFallback(pickupAsset)) return;
    ctx.fillStyle = pickup.type === "health" ? theme.pickups?.health?.color || "#71f2a5" : theme.pickups?.xp?.color || "#58d8ff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, pickup.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (pickup.type === "health") {
      ctx.strokeStyle = "#15542c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 5, p.y);
      ctx.lineTo(p.x + 5, p.y);
      ctx.moveTo(p.x, p.y - 5);
      ctx.lineTo(p.x, p.y + 5);
      ctx.stroke();
    }
  }

  function drawBossArea(item, rect, alphaMultiplier = 1) {
    const p = toScreen(item, rect);
    const skill = effectiveBossSkill(item);
    const color = item.color || skill.color || "#f4d778";
    const progress = item.telegraph ? clamp(Math.max(0, item.age) / item.telegraph, 0, 1) : 1;
    const alpha = (0.18 + progress * 0.3) * alphaMultiplier;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = rgba(color, Math.min(0.9, alpha + 0.25));
    ctx.fillStyle = rgba(color, alpha);
    ctx.lineWidth = 2 + progress * 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + progress * 10;
    if (skill.shape === "circle" || skill.shape === "pool") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, skill.radius || 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (skill.shape === "ring") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, skill.radius || 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, (skill.radius || 130) - (skill.width || 34), 0, Math.PI * 2);
      ctx.stroke();
    } else if (skill.shape === "line") {
      ctx.translate(p.x, p.y);
      ctx.rotate(item.angle || 0);
      ctx.fillRect(-(skill.length || 320) / 2, -(skill.width || 56) / 2, skill.length || 320, skill.width || 56);
      ctx.strokeRect(-(skill.length || 320) / 2, -(skill.width || 56) / 2, skill.length || 320, skill.width || 56);
    } else if (skill.shape === "cone") {
      const boss = getBossEnemy();
      const origin = boss ? toScreen(boss, rect) : p;
      ctx.translate(origin.x, origin.y);
      ctx.rotate(item.angle || 0);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, skill.radius || 170, -(skill.arc || 0.8), skill.arc || 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (skill.shape === "summon" || skill.shape === "pull") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, skill.radius || 110, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBossMechanics(rect) {
    for (const hazard of game.bossHazards) drawBossArea(hazard, rect, Math.max(0.28, 1 - hazard.age / hazard.duration));
    for (const telegraph of game.bossTelegraphs) drawBossArea(telegraph, rect, 1);
  }

  function drawBossIntro(rect) {
    if (!game.bossIntro) return;
    const progress = clamp(game.bossIntro.age / game.bossIntro.life, 0, 1);
    const alpha = Math.sin(progress * Math.PI);
    const mechanics = game.chapter?.bossMechanics || {};
    const color = mechanics.auraColor || "#f4d778";
    const y = Math.max(86, rect.height * 0.18);
    const width = Math.min(rect.width - 36, 430);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(9, 11, 15, 0.68)";
    ctx.strokeStyle = rgba(color, 0.62);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect((rect.width - width) / 2, y - 40, width, 78, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.78)";
    ctx.lineWidth = 5;
    ctx.fillStyle = color;
    ctx.font = "900 24px Arial, sans-serif";
    ctx.strokeText(game.bossIntro.title || "Boss", rect.width / 2, y - 11);
    ctx.fillText(game.bossIntro.title || "Boss", rect.width / 2, y - 11);
    ctx.font = "700 13px Arial, sans-serif";
    ctx.fillStyle = "rgba(247, 243, 232, 0.92)";
    ctx.strokeText(game.bossIntro.subtitle || "", rect.width / 2, y + 18);
    ctx.fillText(game.bossIntro.subtitle || "", rect.width / 2, y + 18);
    ctx.restore();
  }

  function drawEffects(rect) {
    for (const particle of game.particles) {
      const p = toScreen(particle, rect);
      ctx.globalAlpha = 1 - particle.age / particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 16px Arial";
    for (const item of game.texts) {
      const p = toScreen(item, rect);
      ctx.globalAlpha = 1 - item.age / item.life;
      ctx.fillStyle = item.color;
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.lineWidth = 4;
      ctx.strokeText(item.text, p.x, p.y);
      ctx.fillText(item.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawJoystick() {
    if (!pointer.active) return;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(pointer.origin.x, pointer.origin.y, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,211,90,0.55)";
    ctx.beginPath();
    ctx.arc(pointer.current.x, pointer.current.y, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const shakeX = game.camera.shake ? rand(-game.camera.shake, game.camera.shake) : 0;
    const shakeY = game.camera.shake ? rand(-game.camera.shake, game.camera.shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawGrid(rect);
    drawBossMechanics(rect);
    for (const pickup of game.pickups) drawPickup(pickup, rect);
    for (const projectile of game.projectiles) drawProjectile(projectile, rect);
    for (const enemy of game.enemies) drawEnemy(enemy, rect);
    drawPlayer(rect);
    drawEffects(rect);
    ctx.restore();
    drawCoffeeAura(rect);
    drawBossIntro(rect);
    drawJoystick();
  }

  function drawCoffeeAura(rect) {
    const weapon = game.weapons.coffee;
    if (!weapon?.unlocked) return;
    const p = toScreen(game.player, rect);
    const pulse = 0.5 + Math.sin(performance.now() / 130) * 0.08;
    ctx.save();
    ctx.strokeStyle = `rgba(158, 240, 194, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, weapon.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return { render };
}
