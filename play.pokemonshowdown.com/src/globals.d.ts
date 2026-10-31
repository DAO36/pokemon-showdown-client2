// dex data
///////////

type AnyObject = { [k: string]: any };
type BattleTextEntry = { [templateName: string]: string | null | BattleTextEntry };
type BattleTextTable = { [id: string]: BattleTextEntry };
type BattleTextData = {
	Default: BattleTextTable,
	Pokedex: { [id: string]: { name: string, baseSpecies: string, forme?: string, grammar?: string } },
	Moves: BattleTextTable,
	Abilities: BattleTextTable,
	Items: BattleTextTable,
	Tags: { [id: string]: { name?: string, hint?: string, desc?: string } },
	TypeNames: { [id: string]: string },
	NatureNames: { [id: string]: string },
	GenderNames: { [id: string]: string },
	EggGroupNames: { [id: string]: string },
	ColorNames: { [id: string]: string },
	StatusNames: { [id: string]: string },
	TargetNames: { [id: string]: string },
	StatNames: { [id: string]: string },
	StatMediumNames: { [id: string]: string },
	StatShortNames: { [id: string]: string },
};
declare const BattleText: { [lang: string]: BattleTextData };
type BattleUITextEntry = string | null | { [context: string]: string | null };
declare const BattleUIText: { [lang: string]: { [english: string]: BattleUITextEntry } };
declare const BattleFormats: { [id: string]: import('./battle-dex-data').FormatData };
declare const BattlePokedex: { [id: string]: AnyObject };
declare const BattleMovedex: { [id: string]: AnyObject };
declare const BattleAbilities: { [id: string]: AnyObject };
declare const BattleItems: { [id: string]: AnyObject };
declare const BattleAliases: { [id: string]: string };
declare const BattleStatuses: { [id: string]: AnyObject };
declare const BattlePokemonSprites: { [id: string]: AnyObject };
declare const BattlePokemonSpritesBW: { [id: string]: AnyObject };
declare const NonBattleGames: { [id: string]: string };

// PS globals
/////////////

declare var Config: any;
declare var Replays: any;
declare var exports: any;
type AnyObject = {[k: string]: any};
declare var app: {user: AnyObject, rooms: AnyObject, ignore?: AnyObject};

interface Window {
	[k: string]: any;
}

// Temporary globals (exported from modules, used by non-module files)

// When creating now module files, these should all be commented out
// to make sure they're not being used globally in modules.

declare var Battle: typeof import('./battle').Battle;
type Battle = import('./battle').Battle;
declare var BattleScene: typeof import('./battle-animations').BattleScene;
type BattleScene = import('./battle-animations').BattleScene;
declare var Pokemon: typeof import('./battle').Pokemon;
type Pokemon = import('./battle').Pokemon;
type ServerPokemon = import('./battle').ServerPokemon;
declare var BattleLog: typeof import('./battle-log').BattleLog;
type BattleLog = import('./battle-log').BattleLog;
