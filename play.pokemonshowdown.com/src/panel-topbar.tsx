/**
 * Topbar Panel
 *
 * Topbar view - handles the topbar and some generic popups.
 *
 * Also handles global drag-and-drop support.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

import preact from "../js/lib/preact";
import {
	Config, NARROW_MODE_HEADER_WIDTH, PS, type PSRoom, type RoomID, VERTICAL_HEADER_WIDTH,
} from "./client-main";
import { PSView } from "./panels";
import type { Battle } from "./battle";
import { Dex, TL } from "./battle-dex";
import { BattleLog } from "./battle-log"; // optional

	// The default team drop action for Firefox is to open the team as a
	// URL, which needs to be prevented.
	// The default file drop action for most browsers is to open the file
	// in the tab, which is generally undesirable anyway.
	e.preventDefault();
	PS.dragging = null;
});
window.addEventListener('dragend', e => {
	e.preventDefault();
	PS.dragging = null;
});
window.addEventListener('dragover', e => {
	// this prevents the bounce-back animation
	e.preventDefault();
});

export class PSHeader extends preact.Component {
	faviconNotifying = false;
	updateFavicon = () => {
		const notifying = Object.values(PS.rooms).some(room => room?.notifications.length);
		if (notifying === this.faviconNotifying) return;

		const favicon = document.querySelector<HTMLLinkElement>('#dynamic-favicon');
		if (!favicon) return;
		favicon.href = `${Dex.resourcePrefix}${notifying ? 'favicon-notify.ico' : 'favicon.ico'}`;
		this.faviconNotifying = notifying;
	};
	static toggleMute = (e: Event) => {
		PS.prefs.set('mute', !PS.prefs.mute);
		PS.update();
	};
	static handleDragEnter = (e: DragEvent) => {
		// console.log('dragenter ' + e.dataTransfer!.dropEffect);
		e.preventDefault();
		if (!PS.dragging) return; // TODO: handle dragging other things onto roomtabs
		/** the element being passed over */
		const target = e.currentTarget as HTMLAnchorElement;

		const draggingRoom = PS.dragging.roomid;
		if (draggingRoom === null) return;

		const draggedOverRoom = PS.router.extractRoomID(target.href);
		if (draggedOverRoom === null) return; // should never happen
		if (draggingRoom === draggedOverRoom) return;

		const leftIndex = PS.leftRoomList.indexOf(draggedOverRoom);
		if (leftIndex >= 0) {
			PS.dragOnto(PS.rooms[draggingRoom], 'left', leftIndex);
		} else {
			const rightIndex = PS.rightRoomList.indexOf(draggedOverRoom);
			if (rightIndex >= 0) {
				PS.dragOnto(PS.rooms[draggingRoom], 'right', rightIndex);
			} else {
				return;
			}
		}

		// dropEffect !== 'none' prevents bounce-back animation in
		// Chrome/Safari/Opera
		// if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	};
	handleDragStart = (e: DragEvent) => {
		const roomid = PS.router.extractRoomID((e.currentTarget as HTMLAnchorElement).href);
		if (!roomid) return; // should never happen

		PS.dragging = {type: 'room', roomid};
	};
	static roomInfo(room: PSRoom) {
		const RoomType = PS.roomTypes[room.type];
		let icon = RoomType?.icon || <i class="fa fa-file-text-o" aria-hidden></i>;
		let title = room.getTitle();
		switch (room.type) {
		case '':
		case 'mainmenu':
			icon = <i class="fa fa-home"></i>;
			break;
		case 'teambuilder':
			icon = <i class="fa fa-pencil-square-o"></i>;
			break;
		case 'ladder':
		case 'ladderformat':
			icon = <i class="fa fa-list-ol"></i>;
			break;
		case 'battles':
			icon = <i class="fa fa-caret-square-o-right"></i>;
			break;
		case 'rooms':
			icon = <i class="fa fa-plus" style="margin:7px auto -6px auto"></i>;
			title = '';
			break;
		case 'battle':
			let idChunks = id.substr(7).split('-');
			let formatid;
			// TODO: relocate to room implementation
			if (idChunks.length <= 1) {
				if (idChunks[0] === 'uploadedreplay') formatid = 'Uploaded Replay';
			} else {
				formatid = idChunks[0];
			}
			if (!title) {
				let battle = (room as any).battle as Battle | undefined;
				let p1 = battle?.p1?.name || '';
				let p2 = battle?.p2?.name || '';
				if (p1 && p2) {
					title = `${p1} v. ${p2}`;
				} else if (p1 || p2) {
					title = `${p1}${p2}`;
				} else {
					title = `(empty room)`;
				}
			}
			icon = <i class="text">{formatid}</i>;
			break;
		case 'chat':
			icon = <i class="fa fa-comment-o"></i>;
			break;
		case 'html':
		default:
			if (title.charAt(0) === '[') {
				let closeBracketIndex = title.indexOf(']');
				if (closeBracketIndex > 0) {
					icon = <i class="text">{title.slice(1, closeBracketIndex)}</i>;
					title = title.slice(closeBracketIndex + 1);
					break;
				}
			}
			icon = <i class="fa fa-file-text-o"></i>;
			break;
		}
		return { icon, title };
	}
	static renderRoomTab(id: RoomID, noAria?: boolean, includeMiniNotifications = true) {
		const room = PS.rooms[id];
		if (!room) return null;
		const closable = (id === '' || id === 'rooms' ? '' : ' closable');
		const cur = PS.isVisiblePanel(room) ? ' cur' : '';
		let notifying = room.isSubtleNotifying ? ' subtle-notifying' : '';
		let hoverTitle = '';
		let notifications = room.notifications;
		if (id === '' && includeMiniNotifications) {
			for (const roomid of PS.miniRoomList) {
				const miniNotifications = PS.rooms[roomid]?.notifications;
				if (miniNotifications?.length) notifications = [...notifications, ...miniNotifications];
			}
		}
		if (notifications.length) {
			notifying = ' notifying';
			for (const notif of notifications) {
				if (!notif.body) continue;
				hoverTitle += `${notif.title}\n${notif.body}\n`;
			}
		}
		let className = `roomtab button${notifying}${closable}${cur}`;

		let { icon, title: roomTitle } = PSHeader.roomInfo(room);
		if (room.type === 'rooms' && PS.leftPanelWidth !== null) roomTitle = '';
		if (room.type === 'battle') className += ' roomtab-battle';
		if (room.type === 'team' || room.type === 'viewteam') {
			className += ' roomtab-team';
			hoverTitle = roomTitle + (hoverTitle ? `\n${hoverTitle}` : '');
		}

		let closeButton = null;
		if (closable) {
			closeButton = <button class="closebutton" name="closeRoom" value={id} aria-label={TL`[Close]`}>
				<i class="fa fa-times-circle" aria-hidden></i>
			</button>;
		}
		const aria: Record<string, string> = noAria ? {} : {
			"role": "tab", "id": `roomtab-${id}`, "aria-selected": cur ? "true" : "false",
		};
		if (id === 'rooms') aria['aria-label'] = TL`[Join chat]`;
		return <li class={id === '' ? 'home-li' : ''} key={id}>
			<a
				class={className} href={`/${id}`} draggable={true}
				onDragEnter={this.handleDragEnter} onDragStart={this.handleDragStart}
			>
				{icon} <span>{title}</span>
			</a>
			{closeButton}
		</li>;
	}
	static notifyingMiniRoomTabs() {
		return PS.miniRoomList.filter(roomid => PS.rooms[roomid]?.notifications.length);
	}
	handleResize = () => {
		if (!this.base) return;

		if (PS.leftPanelWidth === null) {
			const width = document.documentElement.clientWidth;
			const oldNarrowMode = PSView.narrowMode;
			PSView.narrowMode = width <= 700;
			PSView.verticalHeaderWidth = PSView.narrowMode ? NARROW_MODE_HEADER_WIDTH : VERTICAL_HEADER_WIDTH;
			document.documentElement.style.width = PSView.useCSSScrollSnap() ?
				`${width + NARROW_MODE_HEADER_WIDTH}px` : 'auto';
			if (oldNarrowMode !== PSView.narrowMode) {
				PSView.updateScrollSnap();
				PS.update();
			}
			return;
		}
		if (PSView.narrowMode) {
			document.documentElement.style.width = 'auto';
			PSView.narrowMode = false;
			PSView.updateScrollSnap();
		}

		let userbarLeft = this.base.querySelector('div.userbar .icon.button')?.getBoundingClientRect()?.left;
		if (userbarLeft) userbarLeft -= 5;
		const plusTabRight = this.base.querySelector('a.roomtab[href="/rooms"]')?.getBoundingClientRect()?.right;
		const overflow = this.base.querySelector<HTMLElement>('.overflow');

		if (!overflow || !userbarLeft || !plusTabRight) return;

		const maintabbar = this.base.querySelector<HTMLElement>('div.maintabbar');
		if (maintabbar) {
			const userbarRight = window.innerWidth - userbarLeft;
			maintabbar.style.marginRight = `${userbarRight}px`;
			overflow.style.right = `${userbarRight}px`;
		}

		if (plusTabRight > userbarLeft - 3) {
			overflow.style.display = 'block';
		} else {
			overflow.style.display = 'none';
		}
	};
	override componentDidMount() {
		PS.user.subscribe(() => {
			this.forceUpdate();
		});
		window.addEventListener('resize', this.handleResize);
		this.handleResize();
		this.updateFavicon();
	}
	override componentDidUpdate() {
		this.handleResize();
		this.updateFavicon();
	}
	renderUser() {
		if (!PS.connection?.connected) {
			return <button class="button" disabled><em>{TL`Offline`}</em></button>;
		}
		if (PS.user.initializing) {
			return <button class="button" disabled><em>{TL`Connecting...`}</em></button>;
		}
		if (!PS.user.named) {
			return <a class="button" href="login">{TL`[Choose name]`}</a>;
		}
		const userColor = window.BattleLog && {color: BattleLog.usernameColor(PS.user.userid)};
		return <span class="username" data-name={PS.user.name} style={userColor}>
			<i class="fa fa-user" style="color:#779EC5"></i> <span class="usernametext">{PS.user.name}</span>
		</span>;
	}
	renderVertical() {
		const miniRoomTabs = PSHeader.notifyingMiniRoomTabs();
		return <div
			id="header" class="header-vertical" role="navigation"
			style={`width:${PSView.verticalHeaderWidth - 7}px`} onClick={PSView.scrollToHeader}
		>
			<div class="maintabbarbottom"></div>
			<div class="scrollable-part">
				<img
					class="logo"
					src={`https://${Config.routes.client}/iconbeta.png`}
					alt="Pokémon Showdown! (beta)"
					width="50" height="50"
				/>
				<div class="tablist" role="tablist">
					<ul>
						{PSHeader.renderRoomTab(PS.leftRoomList[0], false, false)}
						{miniRoomTabs.map(roomid => PSHeader.renderRoomTab(roomid))}
					</ul>
					<ul>
						{PS.leftRoomList.slice(1).map(roomid => PSHeader.renderRoomTab(roomid))}
					</ul>
					<ul class="siderooms">
						{PS.rightRoomList.map(roomid => PSHeader.renderRoomTab(roomid))}
					</ul>
				</div>
			</div>
			<div class="userbar">
				{this.renderUser()} {}
				<div style="float:right">
					<button
						class="icon button" data-href="volume" title={TL`[Sound]`} aria-label={TL`[Sound]`}
						onDblClick={PSHeader.toggleMute}
					>
						<i class={PS.prefs.mute ? 'fa fa-volume-off' : 'fa fa-volume-up'}></i>
					</button> {}
					<button class="icon button" data-href="options" title={TL`[Options]`} aria-label={TL`[Options]`}>
						<i class="fa fa-cog" aria-hidden></i>
					</button>
				</div>
			</div>
			{null /* maintabbar */}
			{null /* overflow */}
		</div>;
	}
	override render() {
		if (PS.leftPanelWidth === null) {
			return this.renderVertical();
		}
		return <div id="header" class="header" role="navigation">
			<div class="maintabbarbottom"></div>
			{null /* vertical tabs */}
			<div class="userbar">
				{this.renderUser()} {}
				<button
					class="icon button" data-href="volume" title={TL`[Sound]`} aria-label={TL`[Sound]`}
					onDblClick={PSHeader.toggleMute}
				>
					<i class={PS.prefs.mute ? 'fa fa-volume-off' : 'fa fa-volume-up'}></i>
				</button> {}
				<button class="icon button alt-notifying" data-href="options" title={TL`[Options]`} aria-label={TL`[Options]`}>
					<i class="fa fa-cog" aria-hidden></i>
				</button>
			</div>
			<div class="tabbar maintabbar"><div class="inner-1" role={PS.leftPanelWidth ? 'none' : 'tablist'}><div class="inner-2">
				<ul class="maintabbar-left" style={{ width: `${PS.leftPanelWidth}px` }} role={PS.leftPanelWidth ? 'tablist' : 'none'}>
					<li>
						<img
							class="logo"
							src={`https://${Config.routes.client}/iconbeta.png`}
							alt="Pokémon Showdown! (beta)"
							width="48" height="48"
						/>
					</li>
					{PSHeader.renderRoomTab(PS.leftRoomList[0])}
					{PS.leftRoomList.slice(1).map(roomid => PSHeader.renderRoomTab(roomid))}
				</ul>
				<ul class="maintabbar-right" role={PS.leftPanelWidth ? 'tablist' : 'none'}>
					{PS.rightRoomList.map(roomid => PSHeader.renderRoomTab(roomid))}
				</ul>
			</div></div></div>
			<div class="overflow">
				<button name="tablist" class="button" data-href="roomtablist" aria-label={TL`[All tabs]`} type="button">
					<i class="fa fa-caret-down" aria-hidden></i>
				</button>
			</div>
		</div>;
	}
}

export class PSMiniHeader extends preact.Component {
	menuOpen?: boolean;
	override componentDidMount() {
		PSView.addScrollListener(this.handleScroll);
	}
	override componentWillUnmount() {
		PSView.removeScrollListener(this.handleScroll);
	}
	handleScroll = () => {
		if (this.menuOpen !== !PSView.getScrollX()) this.forceUpdate();
	};
	override render() {
		this.menuOpen = !PSView.getScrollX();

/**
 * User popup
 */

		const notificationsCount = Object.values(PS.rooms).filter(
			room => room !== PS.room && room?.notifications.length
		).length;
		const { icon, title } = PSHeader.roomInfo(PS.getPanel());
		const userColor = window.BattleLog && `color:${PS.user.away ? '#888' : BattleLog.usernameColor(PS.user.userid)}`;
		const showMenuButton = PSView.narrowMode;
		const notifying = (
			!showMenuButton && this.menuOpen && Object.values(PS.rooms).some(room => room!.notifications.length)
		) ? ' notifying' : '';
		const menuButton = !showMenuButton ? (
			null
		) : !this.menuOpen ? (
			<button onClick={PSView.scrollToHeader} class={`mini-header-left ${notifying}`} aria-label={TL`[Menu]`}>
				{!!notificationsCount && <div class="notification-badge">{notificationsCount}</div>}
				<i class="fa fa-bars" aria-hidden></i>
			</button>
		) : (
			<button onClick={PSView.scrollToRoom} class="mini-header-left" aria-label={TL`[Menu]`}>
				<i class="fa fa-arrow-right" aria-hidden></i>
			</button>
		);
		return <div class="mini-header" style={`left:${PSView.verticalHeaderWidth + (PSView.narrowMode ? 0 : -1)}px;`}>
			{menuButton}
			<button data-href="options" class="mini-header-right" aria-label={TL`[Options]`}>
				{PS.user.named ? <strong style={userColor}>{PS.user.name}</strong> : <i class="fa fa-cog" aria-hidden></i>}
			</button>
			{icon} {title}
		</div>;
	}
}

class UserPanel extends PSRoomPanel<UserRoom> {
	render() {
		const room = this.props.room;
		const user = PS.mainmenu.userdetailsCache[room.userid] || {userid: room.userid, avatar: '[loading]'};
		const name = room.name.slice(1);

		const group = PS.server.getGroup(room.name);
		let groupName: preact.ComponentChild = group.name || null;
		if (group.type === 'punishment') {
			groupName = <span style='color:#777777'>{groupName}</span>;
		}

		const globalGroup = PS.server.getGroup(user.group);
		let globalGroupName: preact.ComponentChild = globalGroup.name && `Global ${globalGroup.name}` || null;
		if (globalGroup.type === 'punishment') {
			globalGroupName = <span style='color:#777777'>{globalGroupName}</span>;
		}
		if (globalGroup.name === group.name) groupName = null;

		let roomsList: preact.ComponentChild = null;
		if (user.rooms) {
			let battlebuf = [];
			let chatbuf = [];
			let privatebuf = [];
			for (let roomid in user.rooms) {
				if (roomid === 'global') continue;
				const curRoom = user.rooms[roomid];
				let roomrank: preact.ComponentChild = null;
				if (!/[A-Za-z0-9]/.test(roomid.charAt(0))) {
					roomrank = <small style="color: #888; font-size: 100%">{roomid.charAt(0)}</small>;
				}
				roomid = toRoomid(roomid);

				if (roomid.substr(0, 7) === 'battle-') {
					const p1 = curRoom.p1!.substr(1);
					const p2 = curRoom.p2!.substr(1);
					const ownBattle = (PS.user.userid === toUserid(p1) || PS.user.userid === toUserid(p2));
					const roomLink = <a href={`/${roomid}`} class={'ilink' + (ownBattle || roomid in PS.rooms ? ' yours' : '')}
						title={`${p1 || '?'} v. ${p2 || '?'}`}
					>{roomrank}{roomid.substr(7)}</a>;
					if (curRoom.isPrivate) {
						if (privatebuf.length) privatebuf.push(', ');
						privatebuf.push(roomLink);
					} else {
						if (battlebuf.length) battlebuf.push(', ');
						battlebuf.push(roomLink);
					}
				} else {
					const roomLink = <a href={`/${roomid}`} class={'ilink' + (roomid in PS.rooms ? ' yours' : '')}>
						{roomrank}{roomid}
					</a>;
					if (curRoom.isPrivate) {
						if (privatebuf.length) privatebuf.push(", ");
						privatebuf.push(roomLink);
					} else {
						if (chatbuf.length) chatbuf.push(', ');
						chatbuf.push(roomLink);
					}
				}
			}
			if (battlebuf.length) battlebuf.unshift(<br />, <em>Battles:</em>, " ");
			if (chatbuf.length) chatbuf.unshift(<br />, <em>Chatrooms:</em>, " ");
			if (privatebuf.length) privatebuf.unshift(<br />, <em>Private rooms:</em>, " ");
			if (battlebuf.length || chatbuf.length || privatebuf.length) {
				roomsList = <small class="rooms">{battlebuf}{chatbuf}{privatebuf}</small>;
			}
		} else if (user.rooms === false) {
			roomsList = <strong class="offline">OFFLINE</strong>;
		}

		const isSelf = user.userid === PS.user.userid;
		let away = false;
		let status = null;
		if (user.status) {
			away = user.status.startsWith('!');
			status = away ? user.status.slice(1) : user.status;
		}

		return <PSPanelWrapper room={room}>
			<div class="userdetails">
				{user.avatar !== '[loading]' &&
					<img
						class={'trainersprite' + (room.isSelf ? ' yours' : '')}
						src={Dex.resolveAvatar('' + (user.avatar || 'unknown'))}
					/>
				}
				<strong><a href={`//${Config.routes.users}/${user.userid}`} target="_blank" style={away ? {color: '#888888'} : null}>{name}</a></strong><br />
				{status && <div class="userstatus">{status}</div>}
				{groupName && <div class="usergroup roomgroup">{groupName}</div>}
				{globalGroupName && <div class="usergroup globalgroup">{globalGroupName}</div>}
				{user.customgroup && <div class="usergroup globalgroup">{user.customgroup}</div>}
				{roomsList}
			</div>
			{isSelf || !PS.user.named ?
				<p class="buttonbar">
					<button class="button" disabled>Challenge</button> {}
					<button class="button" disabled>Chat</button>
				</p>
			:
				<p class="buttonbar">
					<button class="button" data-href={`/challenge-${user.userid}`}>Challenge</button> {}
					<button class="button" data-href={`/pm-${user.userid}`}>Chat</button> {}
					<button class="button disabled" name="userOptions">{'\u2026'}</button>
				</p>
			}
			{isSelf && <hr />}
			{isSelf && <p class="buttonbar" style="text-align: right">
				<button class="button disabled" name="login"><i class="fa fa-pencil"></i> Change name</button> {}
				<button class="button" name="cmd" value="/logout"><i class="fa fa-power-off"></i> Log out</button>
			</p>}
		</PSPanelWrapper>;
	}
}

PS.roomTypes['user'] = {
	Model: UserRoom,
	Component: UserPanel,
};

class VolumePanel extends PSRoomPanel {
	setVolume = (e: Event) => {
		const slider = e.currentTarget as HTMLInputElement;
		PS.prefs.set(slider.name as 'effectvolume', Number(slider.value));
		this.forceUpdate();
	};
	setMute = (e: Event) => {
		const checkbox = e.currentTarget as HTMLInputElement;
		PS.prefs.set('mute', !!checkbox.checked);
		PS.update();
	};
	componentDidMount() {
		super.componentDidMount();
		this.subscriptions.push(PS.prefs.subscribe(() => {
			this.forceUpdate();
		}));
	}
	render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}>
			<h3>Volume</h3>
			<p class="volume">
				<label class="optlabel">Effects: <span class="value">{!PS.prefs.mute && PS.prefs.effectvolume ? `${PS.prefs.effectvolume}%` : `muted`}</span></label>
				{PS.prefs.mute ?
					<em>(muted)</em> :
					<input
						type="range" min="0" max="100" step="1" name="effectvolume" value={PS.prefs.effectvolume}
						onChange={this.setVolume} onInput={this.setVolume} onKeyUp={this.setVolume}
					/>}
			</p>
			<p class="volume">
				<label class="optlabel">Music: <span class="value">{!PS.prefs.mute && PS.prefs.musicvolume ? `${PS.prefs.musicvolume}%` : `muted`}</span></label>
				{PS.prefs.mute ?
					<em>(muted)</em> :
					<input
						type="range" min="0" max="100" step="1" name="musicvolume" value={PS.prefs.musicvolume}
						onChange={this.setVolume} onInput={this.setVolume} onKeyUp={this.setVolume}
					/>}
			</p>
			<p class="volume">
				<label class="optlabel">Notifications: <span class="value">{!PS.prefs.mute && PS.prefs.notifvolume ? `${PS.prefs.notifvolume}%` : `muted`}</span></label>
				{PS.prefs.mute ?
					<em>(muted)</em> :
					<input
						type="range" min="0" max="100" step="1" name="notifvolume" value={PS.prefs.notifvolume}
						onChange={this.setVolume} onInput={this.setVolume} onKeyUp={this.setVolume}
					/>}
			</p>
			<p>
				<label class="checkbox"><input type="checkbox" name="mute" checked={PS.prefs.mute} onChange={this.setMute} /> Mute all</label>
			</p>
		</PSPanelWrapper>;
	}
}

PS.roomTypes['volume'] = {
	Component: VolumePanel,
};

class OptionsPanel extends PSRoomPanel {
	setTheme = (e: Event) => {
		const theme = (e.currentTarget as HTMLSelectElement).value as 'light' | 'dark' | 'system';
		PS.prefs.set('theme', theme);
		this.forceUpdate();
	};
	render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}>
			<h3>Graphics</h3>
			<p>
				<label class="optlabel">Theme: <select onChange={this.setTheme}>
					<option value="light" selected={PS.prefs.theme === 'light'}>Light</option>
					<option value="dark" selected={PS.prefs.theme === 'dark'}>Dark</option>
					<option value="system" selected={PS.prefs.theme === 'system'}>Match system theme</option>
				</select></label>
			</p>
		</PSPanelWrapper>;
	}
}

PS.roomTypes['options'] = {
	Component: OptionsPanel,
};
