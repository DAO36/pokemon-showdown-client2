/**
 * Ladder Panel
 *
 * Panel for ladder formats and associated ladder tables.
 *
 * @author Adam Tran <aviettran@gmail.com>
 * @license MIT
 */

import { Config, PS, PSRoom } from "./client-main";
import { Net } from "./client-connection";
import { PSPanelWrapper, PSRoomPanel } from "./panels";
import { BattleLog } from "./battle-log";
import { TL, toID, type ID } from "./battle-dex";
import { SanitizedHTML } from "./panel-page";

type LadderData = {
	formatid: ID,
	format: string,
	toplist: {
		userid: ID,
		username: string,
		w: number,
		l: number,
		t: number,
		gxe: number,
		r: number,
		rd: number,
		sigma: number,
		rptime: number,
		rpr: number,
		rprd: number,
		rpsigma: number,
		elo: number,
		first_played: number | null,
		last_played: number | null,
		coil?: number,
	}[],
};

export class LadderFormatRoom extends PSRoom {
	override readonly classType: string = 'ladder';
	readonly format?: string = this.id.split('-')[1];
	notice?: string;
	searchValue: string = '';
	lastSearch: string = '';
	loading: boolean = false;
	error?: string;
	ladderData?: LadderData;
	ladderHTML?: string;

	constructor(options: any) {
		super(options);
		if (this.format) this.title = BattleLog.formatName(this.format);
	}

	setNotice = (notice: string) => {
		this.notice = notice;
		this.update(null);
	};
	setSearchValue = (searchValue: string) => {
		this.searchValue = searchValue;
		this.update(null);
	};
	setLastSearch = (lastSearch: string) => {
		this.lastSearch = lastSearch;
		this.update(null);
	};
	setLoading = (loading: boolean) => {
		this.loading = loading;
		this.update(null);
	};
	setError = (error: Error) => {
		this.loading = false;
		this.error = error.message;
		this.ladderData = undefined;
		this.ladderHTML = undefined;
		this.update(null);
	};
	setLadderData = (ladderData: string | undefined) => {
		this.loading = false;
		this.error = undefined;
		this.ladderHTML = undefined;
		if (ladderData) {
			this.ladderData = JSON.parse(ladderData);
		} else {
			this.ladderData = undefined;
		}
		this.update(null);
	};
	setLadderHTML = (ladderHTML: string | undefined) => {
		this.loading = false;
		this.error = undefined;
		this.ladderData = undefined;
		this.ladderHTML = ladderHTML;
		this.update(null);
	};
	requestLadderData = (searchValue: string) => {
		if (!this.format) return;
		this.searchValue = searchValue;
		this.loading = true;
		this.error = undefined;
		this.ladderData = undefined;
		this.ladderHTML = undefined;
		if (PS.teams.usesLocalLadder) {
			const prefix = toID(this.searchValue);
			PS.send(`/cmd laddertop ${this.format}${prefix ? ` ,${prefix}` : ''}`);
		} else if (this.format !== undefined) {
			Net('/ladder.php')
				.get({
					query: {
						format: this.format,
						server: PS.server.id,
						output: 'html',
						prefix: toID(searchValue),
					},
				})
				.then(this.setLadderData)
				.catch(this.setError);
		}
		this.setLoading(true);
	};
}

function LadderFormat(props: {room: LadderRoom}) {
	const {room} = props;
	const {
		format, searchValue, lastSearch, loading, error, ladderData,
		setSearchValue, setLastSearch, requestLadderData,
	} = room;
	if (format === undefined) return null;

	const changeSearch = (e: Event) => {
		setSearchValue((e.currentTarget as HTMLInputElement).value);
	};
	const submitSearch = (e: Event) => {
		e.preventDefault();
		setLastSearch(room.searchValue);
		requestLadderData(room.searchValue);
	};
	const RenderHeader = () => {
		if (!PS.teams.usesLocalLadder) {
			return <h3>
				{BattleLog.escapeFormat(format)} Top{" "}
				{BattleLog.escapeHTML(lastSearch ? `- '${lastSearch}'` : "500")}
			</h3>;
		}
		return null;
	};
	const RenderSearch = () => {
		if (!PS.teams.usesLocalLadder) {
			return <form class="search" onSubmit={submitSearch}>
				<input
					type="text"
					name="searchValue"
					class="textbox searchinput"
					value={BattleLog.escapeHTML(searchValue)}
					placeholder="username prefix"
					onChange={changeSearch}
				/>
				<button type="submit"> Search</button>
			</form>;
		}
		return null;
	};
	const RenderFormat = () => {
		if (loading || !BattleFormats) {
			return <p>Loading...</p>;
		} else if (error !== undefined) {
			return <p>Error: {error}</p>;
		} else if (BattleFormats[format] === undefined) {
			return <p>Format {format} not found.</p>;
		} else if (ladderData === undefined) {
			return null;
		}
		return <>
			<p>
				<button class="button" data-href="ladder" data-target="replace" >
					<i class="fa fa-refresh"></i> Refresh
				</button>
				<RenderSearch/>
			</p>
			<RenderHeader/>
			<SanitizedHTML>{ladderData}</SanitizedHTML>
		</>;
	};
	return <div class="ladder pad">
		<p>
		<button class="button" data-href="ladder" data-target="replace">
				<i class="fa fa-chevron-left"></i> Format List
			</button>
		</p>
		<RenderFormat />
	</div>;
}

class LadderPanel extends PSRoomPanel<LadderRoom> {
	componentDidMount() {
		const {room} = this.props;
		// Request ladder data either on mount or after BattleFormats are loaded
		if (BattleFormats && room.format !== undefined) room.requestLadderData();
		this.subscriptions.push(
			room.subscribe((response: any) => {
				if (response) {
					const [format, ladderData] = response;
					if (room.format === format) {
						if (!ladderData) {
							room.setError(new Error('No data returned from server.'));
						} else {
							room.setLadderHTML(ladderData);
						}
					}
				}
				this.forceUpdate();
			})
		);
		this.subscriptions.push(
			PS.teams.subscribe(() => {
				if (room.format !== undefined) room.requestLadderData();
				this.forceUpdate();
			})
		);
	}
	changeSearch = (e: Event) => {
		e.preventDefault();
		this.props.room.requestLadderData(this.base!.querySelector<HTMLInputElement>('input[name=searchValue]')!.value);
	};
	renderHeader() {
		if (PS.teams.usesLocalLadder) return null;

		const room = this.props.room;
		return <h3>
			{BattleLog.formatName(room.format)} Top
			{room.searchValue ? ` - '${room.searchValue}'` : " 500"}
		</h3>;
	}
	renderSearch() {
		if (PS.teams.usesLocalLadder) return null;

		const room = this.props.room;
		return <form class="search" onSubmit={this.changeSearch}><p>
			<input
				type="text"
				name="searchValue"
				class="textbox searchinput"
				value={BattleLog.escapeHTML(room.searchValue)}
				placeholder="username prefix"
				onChange={this.changeSearch}
			/> {}
			<button type="submit" class="button">{TL`[Search]`}</button>
		</p></form>;
	}
	renderLocalLadder() {
		const room = this.props.room;

		if (room.loading || !BattleFormats) {
			return <p><i class="fa fa-refresh fa-spin" aria-hidden></i> <em>{TL`Loading...`}</em></p>;
		} else if (room.error !== undefined) {
			return <p>Error: {room.error}</p>;
		} else if (!room.ladderHTML) {
			return null;
		}
		return <SanitizedHTML>{room.ladderHTML}</SanitizedHTML>;
	}
	renderTable() {
		const room = this.props.room;

		if (room.loading || !BattleFormats) {
			return <p><i class="fa fa-refresh fa-spin" aria-hidden></i> <em>{TL`Loading...`}</em></p>;
		} else if (room.error !== undefined) {
			return <p>Error: {room.error}</p>;
		} else if (!room.ladderData) {
			return null;
		}
		const showCOIL = room.ladderData?.toplist[0]?.coil !== undefined;

		return <table class="table readable-bg">
			<tr class="table-header">
				<th></th>
				<th>{TL`Name`}</th>
				<th style={{ textAlign: 'center' }}><abbr title={TL`Elo rating`}>Elo</abbr></th>
				<th style={{ textAlign: 'center' }}>
					<abbr title={TL`user's percentage chance of winning a random battle (Glicko X-Act Estimate)`}>GXE</abbr>
				</th>
				<th style={{ textAlign: 'center' }}>
					<abbr title={TL`Glicko-1 rating system: rating±deviation (provisional if deviation>100)`}>Glicko-1</abbr>
				</th>
				{showCOIL && <th style={{ textAlign: 'center' }}>COIL</th>}
			</tr>
			{room.ladderData.toplist.map((row, i) => <tr>
				<td style={{ textAlign: 'right' }}>
					{i < 3 && <i class="fa fa-trophy" aria-hidden style={{ color: ['#d6c939', '#adb2bb', '#ca8530'][i] }}></i>} {i + 1}
				</td>
				<td><span
					class="username no-interact" style={{
						fontWeight: i < 10 ? 'bold' : 'normal', color: BattleLog.usernameColor(row.userid),
					}}
				>
					{row.username}
				</span></td>
				<td style={{ textAlign: 'center' }}><strong>{row.elo.toFixed(0)}</strong></td>
				<td style={{ textAlign: 'center' }}>{Math.trunc(row.gxe)}<small>.{row.gxe.toFixed(1).slice(-1)}%</small></td>
				<td style={{ textAlign: 'center' }}><em>{row.rpr.toFixed(0)}<small> &plusmn; {row.rprd.toFixed(0)}</small></em></td>
				{showCOIL && <td style={{ textAlign: 'center' }}>{row.coil?.toFixed(0)}</td>}
			</tr>)}
			{!room.ladderData.toplist.length && <tr><td colSpan={5}>
				<em>{TL`No one has played any ranked games yet.`}</em>
			</td></tr>}
		</table>;
	}
	override render() {
		const room = this.props.room;
		if (PS.teams.usesLocalLadder) {
			return <PSPanelWrapper room={room}>
				<div class="ladder pad">
					<p>
						<button class="button" data-href="ladder" data-target="replace">
							<i class="fa fa-chevron-left" aria-hidden></i> {TL`[All formats]`}
						</button>
					</p>
					{this.renderLocalLadder()}
				</div>
			</PSPanelWrapper>;
		}
		return <PSPanelWrapper room={room}>
			<div class="ladder pad">
				<p>
					<button class="button" data-href="ladder" data-target="replace">
						<i class="fa fa-chevron-left" aria-hidden></i> {TL`[All formats]`}
					</button>
				</p>
				<p>
					<button class="button" data-href="ladder" data-target="replace">
						<i class="fa fa-refresh" aria-hidden></i> {TL`[Refresh]`}
					</button> <a class="button" href="/view-seasonladder-gen9randombattle">
						<i class="fa fa-trophy" aria-hidden></i> {TL`[Seasonal rankings]`}
					</a>
					{this.renderSearch()}
				</p>
				{this.renderHeader()}
				{this.renderTable()}
			</div>
		</PSPanelWrapper>;
	}
}

class LadderListPanel extends PSRoomPanel {
	static readonly id = 'ladder';
	static readonly routes = ['ladder'];
	static readonly icon = <i class="fa fa-list-ol" aria-hidden></i>;
	static readonly title = 'Ladder';
	static getTitle() {
		return TL`Ladder`;
	}

	override componentDidMount() {
		this.subscribeTo(PS.teams);
	}
	renderList() {
		if (!window.BattleFormats) {
			return <p>{TL`Loading...`}</p>;
		}
		let currentSection: string = "";
		let sections: JSX.Element[] = [];
		let formats: JSX.Element[] = [];
		for (const [key, format] of Object.entries(BattleFormats)) {
			if (!format.rated || !format.searchShow) continue;
			if (format.section !== currentSection) {
				if (formats.length > 0) {
					sections.push(<preact.Fragment key={currentSection}>
						<h3>{currentSection}</h3>
						<ul style="list-style:none;margin:0;padding:0">
							{formats}
						</ul>
					</preact.Fragment>);
					formats = [];
				}
				currentSection = format.section;
			}
			buf.push(<div>
				<a href={`/ladder-${id}`} class="blocklink" style={{ fontSize: '11pt', padding: '3px 6px' }}>
					{BattleLog.formatName(format.id)}
				</a>
			</div>);
		}
		return buf;
	}
	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}>
			<div class="ladder pad">
				<p>
					<a class="button" href={`//${Config.routes.users}/`} target="_blank">
						{TL`[Look up a specific user's rating]`}
					</a>
				</p>
				<p>
					<button data-href="view-ladderhelp" class="button">
						<i class="fa fa-info-circle" aria-hidden></i> {TL`[How the ladder works]`}
					</button>
				</li>
			);
		}
		return <>{sections}</>;
	};
	static ShowFormatList = (props: {room: LadderRoom}) => {
		const {room} = props;
		return <>
			<p>
				<a class="button" href={`/${Config.routes.users}/`} target="_blank">
					Look up a specific user's rating
				</a>
			</p>
			<LadderPanel.Notice notice={room.notice} />
			<p>
				<button name="joinRoom" value="view-ladderhelp" class="button">
					<i class="fa fa-info-circle"></i> How the ladder works
				</button>
			</p>
			<LadderPanel.BattleFormatList />
		</>;
	};
	render() {
		const {room} = this.props;
		return <PSPanelWrapper room={room} scrollable>
			<div class="ladder pad">
				{room.format === undefined && (
					<LadderPanel.ShowFormatList room={room} />
				)}
				{room.format !== undefined && <LadderFormat room={room} />}
			</div>
		</PSPanelWrapper>;
	}
}

PS.roomTypes['ladder'] = {
	Model: LadderRoom,
	Component: LadderPanel,
};
PS.updateRoomTypes();
