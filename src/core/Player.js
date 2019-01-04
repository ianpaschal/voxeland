// Terrarium is distributed under the MIT license.

import { Box3, Object3D, Vector2, Vector3 } from "three";
import PointerLockControls from "../controls/PointerLockControls";
import KeyboardControls from "../controls/KeyboardControls";

function clip( min, value, max ) {
	return Math.max( min, Math.min( max, value ) );
}

class Player {

	constructor( camera ) {
		this.model = new Object3D();
		this.model.velocity = new Vector3();
		this.model.acceleration = new Vector3();
		this.AABB = new Box3();

		this.mode = 0;

		this.keyboardControls = new KeyboardControls();

		// Assign handlers
		// Esc
		this.keyboardControls.addHandler( 27, () => {
			if ( !this.enabled ) {
				this.enabled = true;
				const blocker = document.getElementById( "blocker" );
				blocker.style.display = "none";
				document.body.requestPointerLock();
			} else {
				this.enabled = false;
				const blocker = document.getElementById( "blocker" );
				blocker.style.display = "";
				document.exitPointerLock();
			}
		});

		// Space
		this.keyboardControls.addHandler( 32, () => {
			this.input.up = true;
		}, () => {
			this.input.up = false;
		});

		// Shift
		this.keyboardControls.addHandler( 16, () => {
			this.input.down = true;
		}, () => {
			this.input.down = false;
		});

		// A
		this.keyboardControls.addHandler( 65, () => {
			this.input.left = true;
		}, () => {
			this.input.left = false;
		});

		// D
		this.keyboardControls.addHandler( 68, () => {
			this.input.right = true;
		}, () => {
			this.input.right = false;
		});

		// S
		this.keyboardControls.addHandler( 83, () => {
			this.input.backward = true;
		}, () => {
			this.input.backward = false;
		});

		// W
		this.keyboardControls.addHandler( 87, () => {
			this.input.forward = true;
		}, () => {
			this.input.forward = false;
		});

		this.collisions = {
			x: false,
			y: false,
			z: false
		};

		this.input = {
			forward: false,
			backward: false,
			left: false,
			right: false,
			up: false,
			down: false
		};

	}

	getModel() {
		return this.model;
	}

	look( e ) {
		if ( !this.enabled ) return;
		const movementX = e.movementX || 0;
		const movementY = e.movementY || 0;
		const PI_2 = Math.PI / 2;
		this.model.rotation.z -= movementX * 0.002;
		this.pitchObject.rotation.x -= movementY * 0.002;

		// Limit pitch to to ±90º
		this.pitchObject.rotation.x = clip(
			-PI_2, this.pitchObject.rotation.x, PI_2
		);
	}

	get normalInput() {
		let x = 0;
		let y = 0;
		let z = 0;
		if ( this.input.left ) {
			x -= 1;
		}
		if ( this.input.right ) {
			x += 1;
		}
		if ( this.input.forward ) {
			y += 1;
		}
		if ( this.input.backward ) {
			y -= 1;
		}
		if ( this.input.up ) {
			z += 1;
		}
		if ( this.input.down ) {
			z -= 1;
		}
		/**
		 * Normalize the input so that holding forward and left doesn't create a
		 * "faster" or "more powerful" diagonal movement.
		 */
		const horizontal = new Vector2( x, y );
		horizontal.normalize();
		horizontal.rotateAround( new Vector2( 0, 0 ), this.model.rotation.z );

		return new Vector3(
			horizontal.x,
			horizontal.y,
			z
		);
	}

	get velocity() {
		return this.model.velocity;
	}
	set velocity( vector ) {
		this.model.velocity = vector;
	}

	get position() {
		return this.model.position;
	}
	set position( vector ) {
		this.model.position = vector;
	}

	attachCamera( camera ) {
		this.controls = new PointerLockControls( camera );
		camera.up.set( 0, 0, 1 );
		camera.lookAt( new Vector3( 0, 1, 0 ) );

		this.pitchObject = new Object3D();
		this.pitchObject.add( camera );
		this.pitchObject.position.z += 0.5;
		this.model.add( this.pitchObject );
		document.addEventListener( "mousemove", this.look.bind( this ), false );
		this.enabled = false;

		this.model.add( this.controls.getObject() );
	}
}
export default Player;
