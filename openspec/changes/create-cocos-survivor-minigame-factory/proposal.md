## Why

We want to produce a batch of high-feedback casual mini games without rebuilding every title from scratch. A Cocos Creator survivor-like template, paired with a repeatable image2 asset pipeline, gives us a fast path to test multiple "爽感" themes such as office-worker survival, absurd physics, and monster mowing.

## What Changes

- Create a Cocos Creator 2D survivor-like mini game foundation focused on immediate combat feedback, enemy waves, upgrades, drops, and short-session replayability.
- Introduce a configuration-driven content model so characters, enemies, weapons, waves, upgrades, rewards, and themes can be swapped without rewriting gameplay code.
- Define an image2-based visual asset workflow for generating and organizing 2D sprites, icons, cover art, and theme concepts while keeping animation and VFX practical inside Cocos.
- Establish a first playable theme target, "打工人割草老板", as the reference implementation for the template.
- Define minimum acceptance criteria for a playable prototype, including combat loop, upgrade loop, visual feedback, asset structure, and platform packaging direction.

## Capabilities

### New Capabilities

- `cocos-survivor-core`: Core Cocos Creator gameplay template for a 2D survivor-like casual mini game.
- `configurable-theme-content`: Data-driven theme/content system for rapid reskinning and batch game production.
- `image2-asset-pipeline`: Repeatable image2 visual asset generation, processing, and import workflow for Cocos Creator.

### Modified Capabilities

- None.

## Impact

- New Cocos Creator project structure under this repository.
- New gameplay modules for player control, enemy spawning, auto combat, weapon behavior, pickups, upgrades, scoring, and game state.
- New JSON or TypeScript configuration files for content definitions.
- New asset directory conventions for common resources and per-theme resources.
- New documentation and task flow for generating project assets with image2 without committing private keys or modifying global Codex/OpenAI configuration.
