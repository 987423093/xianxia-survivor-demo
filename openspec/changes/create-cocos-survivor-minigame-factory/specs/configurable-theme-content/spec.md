## ADDED Requirements

### Requirement: Theme configuration
The game SHALL load theme-specific content from configuration rather than hardcoding theme assets and values in core gameplay modules.

#### Scenario: Theme selects assets
- **WHEN** a theme is active
- **THEN** the game uses the configured player, enemy, weapon, pickup, UI, and background asset references for that theme

#### Scenario: Theme can be replaced
- **WHEN** a different valid theme configuration is selected
- **THEN** the game runs with the new theme assets and values without changing core gameplay code

### Requirement: Character and enemy definitions
The content system SHALL define player and enemy stats through structured data.

#### Scenario: Player stats load from config
- **WHEN** a run starts
- **THEN** the player uses configured health, speed, pickup radius, starting weapon, and visual asset values

#### Scenario: Enemy stats load from config
- **WHEN** an enemy is spawned
- **THEN** the enemy uses configured health, speed, damage, experience value, collision size, and visual asset values

### Requirement: Weapon and upgrade definitions
The content system SHALL define weapons and upgrade options through structured data.

#### Scenario: Weapon behavior loads from config
- **WHEN** a weapon is equipped
- **THEN** the weapon uses configured cooldown, damage, range, projectile speed, area size, lifetime, and targeting behavior

#### Scenario: Upgrade pool loads from config
- **WHEN** the player levels up
- **THEN** the upgrade choices are selected from the configured upgrade pool and eligibility rules

### Requirement: Wave and drop definitions
The content system SHALL define wave timing and drop behavior through structured data.

#### Scenario: Wave schedule loads from config
- **WHEN** the game timer changes
- **THEN** active spawn rules are determined by the configured wave schedule

#### Scenario: Drop table loads from config
- **WHEN** an enemy is defeated
- **THEN** pickups are created according to the configured drop table

### Requirement: Reference theme
The project SHALL include a reference theme named "打工人割草老板" to prove the template can support a complete reskin.

#### Scenario: Reference theme starts a run
- **WHEN** the reference theme is selected
- **THEN** the run starts with office-worker player content, office-themed enemies, and matching weapon/upgrade names

#### Scenario: Reference theme remains replaceable
- **WHEN** the reference theme assets are swapped for another theme config
- **THEN** the core survivor gameplay continues to function
