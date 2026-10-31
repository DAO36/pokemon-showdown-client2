/**
 * Example Panel
 *
 * Just an example panel for creating new panels/popups
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

// Example room with panel

class ExampleRoom extends PSRoom {
	readonly classType: string = 'example';
	constructor(options: RoomOptions) {
		super(options);
	}
}

class ExamplePanel extends PSRoomPanel<ExampleRoom> {
	// This is the ID of the panel type. It can be whatever you want, but
	// it must not be the same as any other panel ID. You usually want to
	// use the room ID or room ID prefix.
	static readonly id = 'exampleview';
	// This is a list of room IDs (URLs). This would make <<exampleview>> and
	// <<examples-anything>> open this panel.
	static readonly routes = ['exampleview', 'examples-*'];
	static readonly Model = ExampleRoom;
	// The default title (shown on the tab list). You can edit
	// `ExampleRoom`'s `title` property to change it.
	static readonly title = 'Example View';
	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}>
			<div class="mainmessage"><p>Loading...</p></div>
		</PSPanelWrapper>;
	}
}

PS.roomTypes['example'] = {
	Model: ExampleRoom,
	Component: ExamplePanel,
};

// Example panel with no room

class ExampleViewPanel extends PSRoomPanel {
	static readonly id = 'exampleview2';
	static readonly routes = ['exampleview2'];
	// Even without a room model, you can edit `room.title`.
	static readonly title = 'Example View';
	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}>
			<div class="mainmessage"><p>Loading...</p></div>
		</PSPanelWrapper>;
	}
}

PS.roomTypes['exampleview'] = {
	Component: ExampleViewPanel,
};
