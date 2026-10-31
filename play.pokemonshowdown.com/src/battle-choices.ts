/**
 * Battle choices
 *
 * PS will send requests "what do you do this turn?", and you send back
 * choices "I switch Pikachu for Caterpie, and Squirtle uses Water Gun"
 *
 * This file contains classes for handling requests and choices.
 *
 * Dependencies: battle-dex
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

interface BattleRequestSideInfo {
	name: string;
	id: 'p1' | 'p2' | 'p3' | 'p4';
	pokemon: ServerPokemon[];
}
interface BattleRequestActivePokemon {
	moves: {
		name: string,
		id: ID,
		pp: number,
		maxpp: number,
		target: MoveTarget,
		disabled?: boolean,
	}[];
	maxMoves?: {
		name: string,
		id: ID,
		target: MoveTarget,
		disabled?: boolean,
	}[];
	zMoves?: ({
		name: string,
		id: ID,
		target: MoveTarget,
	} | null)[];
	/** also true if the pokemon can Gigantamax */
	canDynamax?: boolean;
	canGigantamax?: boolean;
	canMegaEvo?: boolean;
	canMegaEvoX?: boolean;
	canMegaEvoY?: boolean;
	canUltraBurst?: boolean;
	canTerastallize?: boolean;
	trapped?: boolean;
	maybeTrapped?: boolean;
}

interface BattleMoveRequest {
	requestType: 'move';
	rqid: number;
	side: BattleRequestSideInfo;
	active: (BattleRequestActivePokemon | null)[];
	noCancel?: boolean;
}
interface BattleSwitchRequest {
	requestType: 'switch';
	rqid: number;
	side: BattleRequestSideInfo;
	forceSwitch: boolean[];
	noCancel?: boolean;
}
interface BattleTeamRequest {
	requestType: 'team';
	rqid: number;
	side: BattleRequestSideInfo;
	maxTeamSize?: number;
	noCancel?: boolean;
}
interface BattleWaitRequest {
	requestType: 'wait';
	rqid: number;
	side: undefined;
	noCancel?: boolean;
}
type BattleRequest = BattleMoveRequest | BattleSwitchRequest | BattleTeamRequest | BattleWaitRequest;

interface BattleMoveChoice {
	choiceType: 'move';
	/** 1-based move */
	move: number;
	targetLoc: number;
	mega: boolean;
	megax: boolean;
	megay: boolean;
	ultra: boolean;
	max: boolean;
	z: boolean;
	tera: boolean;
}
interface BattleShiftChoice {
	choiceType: 'shift';
}
interface BattleSwitchChoice {
	choiceType: 'switch' | 'team';
	/** 1-based pokemon */
	targetPokemon: number;
}
type BattleChoice = BattleMoveChoice | BattleShiftChoice | BattleSwitchChoice;

/**
 * Tracks a partial choice, allowing you to build it up one step at a time,
 * and maybe even construct a UI to build it!
 */
class BattleChoiceBuilder {
	request: BattleRequest;
	/** Completed choices in string form */
	choices: string[] = [];
	/** Currently active partial move choice - not used for other choices, which don't have partial states */
	current: BattleMoveChoice = {
		choiceType: 'move',
		/** if nonzero, show target screen; if zero, show move screen */
		move: 0,
		targetLoc: 0, // should always be 0: is not partial if `targetLoc` is known
		mega: false,
		megax: false,
		megay: false,
		ultra: false,
		z: false,
		max: false,
		tera: false,
	};
	alreadySwitchingIn: number[] = [];
	alreadyMega = false;
	alreadyMax = false;
	alreadyZ = false;
	alreadyTera = false;
	serializedChoice: string | null = null;

	constructor(request: BattleRequest) {
		this.request = request;
		this.fillPasses();
	}

	toString() {
		if (this.serializedChoice) return this.serializedChoice;
		let choices = this.choices;
		if (this.current.move) choices = choices.concat(this.stringChoice(this.current));
		return choices.join(', ').replace(/, team /g, ', ');
	}

	isDone() {
		return !!this.serializedChoice || this.choices.length >= this.requestLength();
	}
	isEmpty() {
		if (this.serializedChoice) return false;
		for (const choice of this.choices) {
			if (choice !== 'pass') return false;
		}
		if (this.current.move) return false;
		return true;
	}
	previous() {
		const previous = new BattleChoiceBuilder(this.request);
		const choices = this.choices.slice();
		let partialChoice = '';

		if (!this.current.move && !this.serializedChoice) {
			while (choices[choices.length - 1] === 'pass') choices.pop();
			const lastChoiceString = choices.pop();
			if (lastChoiceString) {
				const lastChoice = this.parseChoice(lastChoiceString, choices.length);
				if (lastChoice?.choiceType === 'move' && lastChoice.targetLoc) {
					lastChoice.targetLoc = 0;
					partialChoice = this.stringChoice(lastChoice);
				}
			}
		}
		for (const choice of choices) {
			if (choice === 'pass') continue;
			const possibleError = previous.addChoice(choice);
			if (possibleError) throw new Error(possibleError);
		}
		if (partialChoice) {
			const possibleError = previous.addChoice(partialChoice);
			if (possibleError) throw new Error(possibleError);
		}
		return previous;
	}

	/** Index of the current Pokémon to make choices for */
	index() {
		return this.choices.length;
	}
	/** How many choices is the server expecting? */
	requestLength() {
		const request = this.request;
		switch (request.requestType) {
		case 'move':
			return request.active.length;
		case 'switch':
			return request.forceSwitch.length;
		case 'team':
			if (request.maxTeamSize) return request.maxTeamSize;
			return 1;
		case 'wait':
			return 0;
		}
	}
	currentMoveRequest() {
		if (this.request.requestType !== 'move') return null;
		return this.request.active[index];
	}
	isReviving(index = this.index()) {
		if (this.request.requestType !== 'switch') return false;
		return !!this.request.side.pokemon[index]?.reviving;
	}
	noMoreSwitchChoices() {
		if (this.request.requestType !== 'switch') return false;
		const isReviving = this.isReviving();
		const firstChoice = isReviving ? 0 : this.requestLength();
		for (let i = firstChoice; i < this.request.side.pokemon.length; i++) {
			const pokemon = this.request.side.pokemon[i];
			if (!!pokemon.fainted === isReviving && !this.alreadySwitchingIn.includes(i + 1)) {
				return false;
			}
		}
		return true;
	}

	addChoice(choiceString: string) {
		if (this.isDone()) return `You've already chosen for this turn; cancel to change your choice`;
		if (choiceString === 'auto' || choiceString === 'default') {
			const currentChoice = this.toString();
			this.serializedChoice = currentChoice ? `${currentChoice}, default` : 'default';
			return null;
		}
		let choice: BattleChoice | null;
		try {
			choice = this.parseChoice(choiceString);
		} catch (err) {
			return (err as Error).message;
		}
		if (!choice) {
			return "You do not need to manually choose to pass; the client handles it for you automatically";
		}
		if (choice.choiceType === 'move') {
			const targetable = (this.request as BattleMoveRequest).targetable;
			if (!choice.targetLoc && targetable) {
				const choosableTargets: unknown[] = ['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe'];
				if (choosableTargets.includes(this.currentMove(choice)?.target)) {
					this.current = choice;
					return null;
				}
			}
			if (this.currentMoveRequest()?.maybeDisabled && isLastChoice && !targetable) {
				this.noCancel = true;
			}
			if (choice.mega || choice.megax || choice.megay) this.alreadyMega = true;
			if (choice.z) this.alreadyZ = true;
			if (choice.max) this.alreadyMax = true;
			if (choice.tera) this.alreadyTera = true;
			this.current.move = 0;
			this.current.mega = false;
			this.current.ultra = false;
			this.current.z = false;
			this.current.max = false;
			this.current.tera = false;
		} else if (choice.choiceType === 'switch' || choice.choiceType === 'team') {
			if (this.alreadySwitchingIn.includes(choice.targetPokemon)) {
				if (choice.choiceType === 'switch') {
					return "You've already chosen to switch that Pokémon in";
				}
				// remove choice instead
				for (let i = 0; i < this.alreadySwitchingIn.length; i++) {
					if (this.alreadySwitchingIn[i] === choice.targetPokemon) {
						this.alreadySwitchingIn.splice(i, 1);
						this.choices.splice(i, 1);
						return null;
					}
				}
				return "Unexpected bug, please report this";
			}
			this.alreadySwitchingIn.push(choice.targetPokemon);
		} else if (choice.choiceType === 'shift') {
			if (this.index() === 1) {
				return "Only Pokémon not already in the center can shift to the center";
			}
		}
		this.choices.push(this.stringChoice(choice));
		this.fillPasses();
		return null;
	}
	addChoices(choiceString: string) {
		let choiceStrings: string[];
		if (choiceString.startsWith('team ')) {
			let teamChoice = choiceString.slice(5).trim();
			const isBracketedTeam = teamChoice.startsWith('[') && teamChoice.endsWith(']');
			if (isBracketedTeam) teamChoice = teamChoice.slice(1, -1).trim();
			const teamChoices = isBracketedTeam || teamChoice.includes(',') || (this.request.side?.pokemon.length ?? 0) >= 10 ?
				teamChoice.split(',') : (/^[0-9]+$/.test(teamChoice) ? teamChoice.split('') : [teamChoice]);
			choiceStrings = teamChoices.slice(0, this.requestLength()).map(choice => `team ${choice.trim()}`);
		} else {
			choiceStrings = choiceString.split(',').map(choice => choice.trim());
		}
		for (const choice of choiceStrings) {
			const possibleError = this.addChoice(choice);
			if (possibleError) return possibleError;
		}
		if (this.request.requestType === 'team' && choiceString.startsWith('team ')) {
			for (let i = 1; this.choices.length < this.requestLength(); i++) {
				if (this.alreadySwitchingIn.includes(i)) continue;
				const possibleError = this.addChoice(`team ${i}`);
				if (possibleError) return possibleError;
			}
		}
		return null;
	}

	/**
	 * Move and switch requests will often skip over some active Pokémon (mainly
	 * fainted Pokémon). This will fill them in automatically, so we don't need
	 * to ask a user for them.
	 */
	fillPasses() {
		const request = this.request;
		switch (request.requestType) {
		case 'move':
			while (this.choices.length < request.active.length && !request.active[this.choices.length]) {
				this.choices.push('pass');
			}
			break;
		case 'switch':
			while (this.choices.length < request.forceSwitch.length) {
				if (!request.forceSwitch[this.choices.length] || this.noMoreSwitchChoices()) {
					this.choices.push('pass');
				} else {
					break;
				}
			}
		}
	}

	getChosenMove(choice: BattleMoveChoice, pokemonIndex: number) {
		const request = this.request as BattleMoveRequest;
		const activePokemon = request.active[pokemonIndex]!;
		const moveIndex = choice.move - 1;
		if (choice.z) {
			return activePokemon.zMoves![moveIndex]!;
		}
		if (choice.max || (activePokemon.maxMoves && !activePokemon.canDynamax)) {
			return activePokemon.maxMoves![moveIndex];
		}
		return activePokemon.moves[moveIndex];
	}

	/**
	 * Parses a choice from string form to BattleChoice form
	 */
	parseChoice(choice: string): BattleChoice | null {
		const request = this.request;
		if (request.requestType === 'wait') throw new Error(`It's not your turn to choose anything`);

		const index = this.choices.length;

		if (choice === 'shift') return {choiceType: 'shift'};

		if (choice.startsWith('move ')) {
			if (request.requestType !== 'move') {
				throw new Error(`You must switch in a Pokémon, not move.`);
			}
			const moveRequest = request.active[index]!;
			choice = choice.slice(5);
			let current: BattleMoveChoice = {
				choiceType: 'move',
				move: 0,
				targetLoc: 0,
				mega: false,
				megax: false,
				megay: false,
				ultra: false,
				z: false,
				max: false,
				tera: false,
			};
			while (true) {
				// If data ends with a number, treat it as a target location.
				// We need to special case 'Conversion 2' so it doesn't get
				// confused with 'Conversion' erroneously sent with the target
				// '2' (since Conversion targets 'self', targetLoc can't be 2).
				if (/\s(?:-|\+)?[1-3]$/.test(choice) && toID(choice) !== 'conversion2') {
					if (current.targetLoc) throw new Error(`Move choice has multiple targets`);
					current.targetLoc = parseInt(choice.slice(-2), 10);
					choice = choice.slice(0, -2).trim();
				} else if (choice.endsWith(' mega')) {
					current.mega = true;
					choice = choice.slice(0, -5);
				} else if (choice.endsWith(' megax')) {
					current.megax = true;
					choice = choice.slice(0, -6);
				} else if (choice.endsWith(' megay')) {
					current.megay = true;
					choice = choice.slice(0, -6);
				} else if (choice.endsWith(' zmove')) {
					current.z = true;
					choice = choice.slice(0, -6);
				} else if (choice.endsWith(' ultra')) {
					current.ultra = true;
					choice = choice.slice(0, -6);
				} else if (choice.endsWith(' dynamax')) {
					current.max = true;
					choice = choice.slice(0, -8);
				} else if (choice.endsWith(' max')) {
					current.max = true;
					choice = choice.slice(0, -4);
				} else if (choice.endsWith(' terastallize')) {
					current.tera = true;
					choice = choice.slice(0, -13);
				} else if (choice.endsWith(' terastal')) {
					current.tera = true;
					choice = choice.slice(0, -9);
				} else {
					break;
				}
			}

			if (/^[0-9]+$/.test(choice)) {
				// Parse a one-based move index.
				current.move = parseInt(choice, 10);
			} else {
				// Parse a move ID.
				// Move names are also allowed, but may cause ambiguity (see client issue #167).
				let moveid = toID(choice);
				if (moveid.startsWith('hiddenpower')) moveid = 'hiddenpower' as ID;

				for (let i = 0; i < moveRequest.moves.length; i++) {
					if (moveid === moveRequest.moves[i].id) {
						current.move = i + 1;
						break;
					}
				}
				if (!current.move && moveRequest.zMoves) {
					for (let i = 0; i < moveRequest.zMoves.length; i++) {
						if (!moveRequest.zMoves[i]) continue;
						if (moveid === moveRequest.zMoves[i]!.id) {
							current.move = i + 1;
							current.z = true;
							break;
						}
					}
				}
				if (!current.move && moveRequest.maxMoves) {
					for (let i = 0; i < moveRequest.maxMoves.length; i++) {
						if (moveid === moveRequest.maxMoves[i].id) {
							current.move = i + 1;
							current.max = true;
							break;
						}
					}
				}
			}
			if (current.max && !moveRequest.canDynamax) current.max = false;
			return current;
		}

		if (choice.startsWith('switch ') || choice.startsWith('team ')) {
			choice = choice.slice(choice.startsWith('team ') ? 5 : 7);
			const isTeamPreview = request.requestType === 'team';
			let current: BattleSwitchChoice = {
				choiceType: isTeamPreview ? 'team' : 'switch',
				targetPokemon: 0,
			};
			if (/^[0-9]+$/.test(choice)) {
				// Parse a one-based move index.
				current.targetPokemon = parseInt(choice, 10);
			} else {
				// Parse a pokemon name
				const lowerChoice = choice.toLowerCase();
				const choiceid = toID(choice);
				let matchLevel = 0;
				let match = 0;
				for (let i = 0 ; i < request.side.pokemon.length; i++) {
					const serverPokemon = request.side.pokemon[i];
					let curMatchLevel = 0;
					if (choice === serverPokemon.name) {
						curMatchLevel = 10;
					} else if (lowerChoice === serverPokemon.name.toLowerCase()) {
						curMatchLevel = 9;
					} else if (choiceid === toID(serverPokemon.name)) {
						curMatchLevel = 8;
					} else if (choiceid === toID(serverPokemon.speciesForme)) {
						curMatchLevel = 7;
					} else if (choiceid === toID(Dex.species.get(serverPokemon.speciesForme).baseSpecies)) {
						curMatchLevel = 6;
					}
					if (curMatchLevel > matchLevel) {
						match = i + 1;
						matchLevel = curMatchLevel;
					}
				}
				if (!match) {
					throw new Error(`Couldn't find Pokémon "${choice}" to switch to`);
				}
				current.targetPokemon = match;
			}
			const target = request.side.pokemon[current.targetPokemon - 1];
			const isReviving = this.isReviving(index);
			if (!target) {
				throw new Error(`Couldn't find Pokémon "${choice}" to switch to!`);
			}
			if (!isTeamPreview && !isReviving && current.targetPokemon - 1 < this.requestLength()) {
				throw new Error(`That Pokémon is already in battle!`);
			}
			if (isReviving && target.fainted) return current;
			if (isReviving && !target.fainted) {
				throw new Error(`${target.name} still has energy to battle!`);
			}
			if (target.fainted) {
				throw new Error(`${target} is fainted and cannot battle!`);
			}
			return current;
		}

		if (choice === 'pass') return null;

		throw new Error(`Unrecognized choice "${choice}"`);
	}

	/**
	 * Converts a choice from `BattleChoice` into string form
	 */
	stringChoice(choice: BattleChoice | null) {
		if (!choice) return `pass`;
		switch (choice.choiceType) {
		case 'move':
			const target = choice.targetLoc ? ` ${choice.targetLoc > 0 ? '+' : ''}${choice.targetLoc}` : ``;
			const boost = `${choice.max ? ' max' : ''}${choice.mega ? ' mega' : ''}${choice.z ? ' zmove' : ''}${choice.tera ? ' terastallize' : ''}`;
			return `move ${choice.move}${boost}${target}`;
		case 'switch':
		case 'team':
			return `${choice.choiceType} ${choice.targetPokemon}`;
		case 'shift':
			return `shift`;
		}
	}

	/**
	 * The request sent from the server is actually really gross, but we'll have
	 * to wait until we transition to the new client before fixing it in the
	 * protocol, in the interests of not needing to fix it twice (or needing to
	 * fix it without TypeScript).
	 *
	 * In the meantime, this function converts a request from a shitty request
	 * to a request that makes sense.
	 *
	 * I'm sorry for literally all of this.
	 */
	static fixRequest(request: any, battle: Battle) {
		if (!request.requestType) {
			request.requestType = 'move';
			if (request.forceSwitch) {
				request.requestType = 'switch';
			} else if (request.teamPreview) {
				request.requestType = 'team';
			} else if (request.wait) {
				request.requestType = 'wait';
			}
		}

		if (request.requestType === 'wait') request.noCancel = true;
		if (request.side) {
			for (const serverPokemon of request.side.pokemon) {
				battle.parseDetails(serverPokemon.ident.substr(4), serverPokemon.ident, serverPokemon.details, serverPokemon);
				battle.parseHealth(serverPokemon.condition, serverPokemon);
			}
		}

		if (request.active) {
			request.active = request.active.map(
				(active: any, i: number) => request.side.pokemon[i].fainted ? null : active
			);
			for (const active of request.active) {
				if (!active) continue;
				for (const move of active.moves) {
					if (move.move) move.name = move.move;
					move.id = toID(move.name);
				}
				if (active.maxMoves) {
					if (active.maxMoves.maxMoves) {
						active.canGigantamax = active.maxMoves.gigantamax;
						active.maxMoves = active.maxMoves.maxMoves;
					}
					for (const move of active.maxMoves) {
						if (move.move) move.name = Dex.moves.get(move.move).name;
						move.id = toID(move.name);
					}
				}
				if (active.canZMove) {
					active.zMoves = active.canZMove;
					for (const move of active.zMoves) {
						if (!move) continue;
						if (move.move) move.name = move.move;
						move.id = toID(move.name);
					}
				}
			}
		}
	}
}
