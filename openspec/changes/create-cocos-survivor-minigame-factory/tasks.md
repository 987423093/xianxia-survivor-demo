## 1. Project Setup

- [x] 1.1 Confirm local Cocos Creator version and choose the project format to use for the first prototype. Cocos Creator.app was not detected locally; first playable prototype uses HTML5 Canvas while preserving Cocos migration structure.
- [ ] 1.2 Scaffold a Cocos Creator 2D project inside this repository.
- [x] 1.3 Create base folders for scripts, prefabs, scenes, common assets, theme assets, configs, and generated image review outputs.
- [x] 1.4 Add a main gameplay scene with camera, canvas, gameplay root nodes, HUD root, VFX root, and placeholder map/background.
- [x] 1.5 Add placeholder sprites and prefabs so the game can run before image2 assets are generated.

## 2. Survivor Core Loop

- [x] 2.1 Implement player movement with keyboard/editor input and a mobile-ready virtual joystick boundary.
- [x] 2.2 Implement camera follow behavior for the player.
- [x] 2.3 Implement enemy entity behavior with health, speed, contact damage, hit feedback, and death handling.
- [x] 2.4 Implement wave spawning based on elapsed run time and spawn rules.
- [x] 2.5 Implement auto-targeting weapon behavior with cooldown, range, projectile or area hit logic, and damage application.
- [x] 2.6 Implement pickups for experience and health recovery.
- [x] 2.7 Implement level progression and an upgrade-choice UI that pauses active combat flow.
- [x] 2.8 Implement run state management for start, active play, pause, death, result, and restart.
- [x] 2.9 Implement core feedback effects including damage numbers, hit flash, scale pop, death burst, pickup fly-in, and screen shake.

## 3. Configurable Theme Content

- [x] 3.1 Define TypeScript interfaces or JSON schemas for theme, player, enemy, weapon, upgrade, wave, and drop configurations.
- [x] 3.2 Implement a theme loader that resolves the active theme and exposes config to gameplay systems.
- [x] 3.3 Move player stats and starting weapon values into theme configuration.
- [x] 3.4 Move enemy definitions and wave schedules into theme configuration.
- [x] 3.5 Move weapon definitions and upgrade pool definitions into theme configuration.
- [x] 3.6 Move pickup/drop table definitions into theme configuration.
- [x] 3.7 Add the reference "打工人割草老板" theme using placeholder assets and office-themed names.
- [x] 3.8 Verify that changing the active theme config can alter visuals and values without modifying core gameplay scripts.

## 4. image2 Asset Pipeline

- [x] 4.1 Create a project-local directory for image2 generated candidates and reviewed import-ready assets.
- [x] 4.2 Document prompt templates for characters, enemies, weapons, skill icons, pickups, cover art, and theme concepts.
- [x] 4.3 Generate the first batch of image2 reference assets for the default theme after the core placeholder loop is playable.
- [x] 4.4 Review generated assets, rename selected files, crop or clean them if needed, and place them in the Cocos theme asset folder. Same-name image2 PNG assets were selected from generated variants and placed under demo/assets/xianxia.
- [x] 4.5 Connect selected image2 assets to the reference theme configuration and prefabs. The xianxia theme now references local image paths and falls back to geometry when images fail.
- [x] 4.6 Confirm provider credentials remain outside the repository and generated files are committed only if explicitly selected.

## 5. Verification

- [ ] 5.1 Run the game in Cocos preview and verify player movement, camera follow, enemy spawning, combat, pickups, upgrades, death, and restart.
- [ ] 5.2 Verify each OpenSpec scenario manually against the playable prototype and record gaps.
- [x] 5.3 Check that the game can run with placeholder assets when image2 assets are missing.
- [x] 5.4 Check that the reference theme uses local imported assets and does not call image2 at runtime.
- [x] 5.5 Capture short gameplay evidence or screenshots for the first playable prototype. Browser screenshots are stored under `tmp/`, including HUD, chapter, material, challenge, event route, and home redesign checks.
