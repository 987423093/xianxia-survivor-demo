## ADDED Requirements

### Requirement: Player movement and camera follow
The game SHALL provide a controllable 2D player character suitable for mobile survivor-like gameplay.

#### Scenario: Player moves continuously
- **WHEN** the player provides directional input
- **THEN** the player character moves in that direction at the configured speed

#### Scenario: Camera tracks player
- **WHEN** the player moves around the map
- **THEN** the camera keeps the player within the active gameplay view

### Requirement: Enemy wave spawning
The game SHALL spawn enemy waves based on elapsed time and wave configuration.

#### Scenario: Wave starts on schedule
- **WHEN** the game timer reaches a configured wave start time
- **THEN** the game spawns the configured enemy types at the configured rate

#### Scenario: Enemy pressure increases
- **WHEN** later wave definitions become active
- **THEN** enemy density, enemy strength, or enemy mix changes according to configuration

### Requirement: Auto combat
The game SHALL support automatic weapon attacks without requiring manual aiming.

#### Scenario: Weapon attacks nearby enemy
- **WHEN** at least one enemy is within the weapon's targeting range
- **THEN** the weapon automatically attacks according to its cooldown and targeting rule

#### Scenario: Weapon applies damage
- **WHEN** a weapon hit overlaps an enemy
- **THEN** the enemy health is reduced by the weapon's configured damage

### Requirement: Pickups and upgrades
The game SHALL reward enemy defeats with pickups and allow the player to choose upgrades during a run.

#### Scenario: Enemy drops experience
- **WHEN** an enemy is defeated
- **THEN** the game creates an experience pickup using the configured drop rules

#### Scenario: Level-up presents choices
- **WHEN** the player collects enough experience to level up
- **THEN** the game pauses combat flow and presents configured upgrade choices

#### Scenario: Upgrade modifies gameplay
- **WHEN** the player selects an upgrade
- **THEN** the selected upgrade changes the relevant player, weapon, or pickup behavior for the current run

### Requirement: Run state and restart
The game SHALL manage run start, active play, pause, player death, result, and restart states.

#### Scenario: Player dies
- **WHEN** the player's health reaches zero
- **THEN** the game stops active combat and shows a result state with run statistics

#### Scenario: Player restarts
- **WHEN** the player selects restart from the result state
- **THEN** the game starts a new run with initial player stats and wave timing reset

### Requirement: Combat feedback
The game SHALL provide immediate visual and audio-ready feedback for key combat events.

#### Scenario: Enemy receives hit feedback
- **WHEN** an enemy takes damage
- **THEN** the game displays hit feedback such as flash, damage number, knock response, or impact effect

#### Scenario: Player levels up
- **WHEN** the player levels up
- **THEN** the game displays an upgrade feedback effect before or during upgrade selection
