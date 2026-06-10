## ADDED Requirements

### Requirement: Project-local image2 output
The asset workflow SHALL save image2-generated files inside project-local asset or output directories without exposing provider credentials.

#### Scenario: Generate project asset
- **WHEN** image2 is used to create a game asset
- **THEN** the generated file is saved under a project-local path intended for asset review or import

#### Scenario: Credentials stay private
- **WHEN** image2 generation runs
- **THEN** API keys and provider settings remain in the image2 skill private settings and are not copied into the project

### Requirement: Prompt templates for reusable asset types
The asset workflow SHALL provide prompt patterns for common mini game asset types.

#### Scenario: Generate character sprite
- **WHEN** a character or enemy sprite is requested
- **THEN** the prompt includes style, top-down view, outline, transparent background, no text, centered subject, and sprite atlas suitability constraints

#### Scenario: Generate skill icon
- **WHEN** a skill or weapon icon is requested
- **THEN** the prompt includes square icon composition, high contrast, no text, readable-at-small-size constraints, and theme-specific subject detail

### Requirement: Cocos import readiness
The asset workflow SHALL require generated assets to be reviewed and prepared before being used by Cocos scenes or prefabs.

#### Scenario: Asset is prepared for import
- **WHEN** an image2 asset is selected for use
- **THEN** the asset is cropped, named, organized, and placed in the appropriate Cocos asset directory

#### Scenario: Asset can be packed
- **WHEN** multiple sprites are ready for a theme
- **THEN** the sprites are organized so they can be included in a Cocos sprite atlas or theme asset bundle

### Requirement: Runtime independence
The game SHALL not call image2 or any external image-generation provider during gameplay.

#### Scenario: Game runs offline from generated assets
- **WHEN** the game starts in Cocos preview
- **THEN** it uses local imported assets and does not require image2 network access

#### Scenario: Missing generated asset has fallback
- **WHEN** a configured generated asset is unavailable during early development
- **THEN** the game can use a placeholder asset without breaking the gameplay loop
